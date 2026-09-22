import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { slotByKey, rateCard, getAdsConfig, priceFor, rangeAvailable } from '@/lib/ads';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST · autoservicio: el anunciante compra un espacio por N periodos con tarjeta.
// Calcula el precio (precio del slot × periodos), verifica disponibilidad, crea la
// campaña en borrador y abre Stripe Checkout. Al pagar, /api/ads/confirm la activa.
export async function POST(req: Request) {
  try {
    const cfg = await getAdsConfig();
    if (!cfg.enabled) return NextResponse.json({ error: 'Los anuncios están desactivados temporalmente.' }, { status: 400 });

    const b = await req.json().catch(() => ({} as any));
    const slot = slotByKey(String(b.slot || ''));
    if (!slot) return NextResponse.json({ error: 'Ubicación inválida.' }, { status: 400 });
    if (slot.unit === 'cpm') return NextResponse.json({ error: 'Este espacio se contrata por CPM; escríbenos para reservarlo.' }, { status: 400 });

    const advertiser = String(b.advertiser || '').slice(0, 120).trim();
    const contact = String(b.contact || '').slice(0, 160).trim();
    const creative = String(b.creative_url || '').trim();
    const link = String(b.link_url || '').trim();
    const periods = Math.max(1, Math.min(52, parseInt(b.periods, 10) || 1));
    if (!advertiser || !contact) return NextResponse.json({ error: 'Falta tu nombre o contacto.' }, { status: 400 });
    if (!/^https?:\/\//i.test(creative) || !/^https?:\/\//i.test(link)) return NextResponse.json({ error: 'Pon la URL de la imagen y del enlace (http…).' }, { status: 400 });

    // Precio efectivo (tarifario del dueño).
    const rc = await rateCard();
    const rate = rc.find((r) => r.key === slot.key) || slot;
    const amount = priceFor(rate as any, periods);
    if (amount <= 0) return NextResponse.json({ error: 'Este espacio no tiene precio configurado.' }, { status: 400 });

    // Fechas: inicia hoy (o la fecha pedida) por N semanas/meses.
    const start = b.starts_at ? new Date(b.starts_at) : new Date();
    if (isNaN(start.getTime())) return NextResponse.json({ error: 'Fecha inválida.' }, { status: 400 });
    const end = new Date(start);
    if (rate.unit === 'month') end.setMonth(end.getMonth() + periods); else end.setDate(end.getDate() + periods * 7);
    const startIso = start.toISOString(), endIso = end.toISOString();

    // Disponibilidad (modelo exclusivo): no vender un hueco ya reservado.
    if (!(await rangeAvailable(slot.key, startIso, endIso))) {
      return NextResponse.json({ error: 'Ese espacio ya está reservado en esas fechas. Elige otra fecha u otro espacio.' }, { status: 409 });
    }

    // Crea la campaña en BORRADOR (reserva el hueco durante el checkout).
    const reportToken = randomUUID();
    const { data: camp, error } = await supabaseAdmin.from('ad_campaigns').insert({
      advertiser, contact, slot_key: slot.key, creative_url: creative, link_url: link,
      alt: String(b.alt || advertiser).slice(0, 300), lang: ['all', 'es', 'en'].includes(b.lang) ? b.lang : 'all',
      geo: String(b.geo || 'all').slice(0, 120) || 'all',
      starts_at: startIso, ends_at: endIso, weight: 1, price: amount,
      status: 'draft', source: 'selfserve', report_token: reportToken,
    }).select('id').maybeSingle();
    if (error || !camp) return NextResponse.json({ error: error?.message || 'No se pudo crear la campaña.' }, { status: 500 });

    let base = (process.env.NEXT_PUBLIC_APP_URL || '').trim().replace(/\/+$/, '');
    if (!base) { const u = new URL(req.url); base = `${u.protocol}//${u.host}`; }
    if (!/^https?:\/\//i.test(base)) base = 'https://' + base;

    const unitLbl = rate.unit === 'month' ? (periods > 1 ? `${periods} meses` : '1 mes') : (periods > 1 ? `${periods} semanas` : '1 semana');
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: Math.round(amount * 100), product_data: { name: `Onyx · ${rate.es} (${rate.size})`, description: `Espacio patrocinado · ${unitLbl}` } } }],
      customer_email: /@/.test(contact) ? contact : undefined,
      success_url: `${base}/publicidad/gracias?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/publicidad`,
      metadata: { kind: 'ad', campaignId: (camp as any).id },
    });
    await supabaseAdmin.from('ad_campaigns').update({ stripe_session: session.id }).eq('id', (camp as any).id);

    return NextResponse.json({ ok: true, url: session.url, amount });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
