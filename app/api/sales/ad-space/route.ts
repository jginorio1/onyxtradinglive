import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { repByUser } from '@/lib/sales';
import { AD_SLOTS, slotByKey, rateCard, getAdsConfig } from '@/lib/ads';
import { dailyAvailability, capacityFor, createBooking, listBookings, slotCap } from '@/lib/adBooking';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Estimación best-effort de impresiones/día del espacio, a partir del tráfico
// real (page_visits, últimos 7 días). Si algo falla, devuelve 0 (se omite).
async function estImpressionsPerDay(page: string): Promise<number> {
  try {
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    let q = supabaseAdmin.from('page_visits').select('path', { count: 'exact', head: true }).gte('ts', since);
    if (page === 'blog' || page === 'article') q = q.ilike('path', '%blog%');
    else if (page === 'landing') q = q.in('path', ['/', '/en']);
    else if (page === 'directory') q = q.ilike('path', '%publicidad%');
    const { count } = await q;
    return Math.round((Number(count) || 0) / 7);
  } catch { return 0; }
}

// GET · datos para el vendedor: ubicaciones con tarifa + cupo, y sus reservas.
export async function GET() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const rep = await repByUser(user.id);
  if (!rep) return NextResponse.json({ isRep: false });

  const cfg = await getAdsConfig();
  const card = await rateCard();
  const slots = [] as any[];
  for (const s of card) {
    slots.push({ key: s.key, es: s.es, en: s.en, size: s.size, page: s.page, unit: s.unit, price: s.price, cap: await slotCap(s.key, cfg) });
  }
  const { data: prof } = await supabaseAdmin.from('profiles').select('email').eq('id', user.id).maybeSingle();
  const bookings = await listBookings({ repId: rep.id, limit: 100 });
  return NextResponse.json({
    isRep: true,
    seller: { name: rep.display_name || rep.code, work_email: (rep as any).work_email || '', login_email: (prof as any)?.email || '' },
    commissionPct: cfg.spaceCommissionPct, holdMinutes: cfg.holdMinutes,
    slots, bookings,
  });
}

// POST · acciones del vendedor.
export async function POST(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const rep = await repByUser(user.id);
  if (!rep) return NextResponse.json({ error: 'no eres vendedor' }, { status: 403 });

  const b = await req.json().catch(() => ({} as any));
  const action = String(b.action || '');
  const lang: 'es' | 'en' = b.lang === 'en' ? 'en' : 'es';

  // Disponibilidad de un slot (calendario) + capacidad del rango elegido.
  if (action === 'availability') {
    const slot = slotByKey(String(b.slot || ''));
    if (!slot) return NextResponse.json({ error: 'slot inválido' }, { status: 400 });
    const from = /^\d{4}-\d{2}-\d{2}$/.test(b.from) ? b.from : new Date().toISOString().slice(0, 10);
    const days = Math.min(90, Math.max(14, Number(b.days) || 42));
    const calendar = await dailyAvailability(slot.key, from, days);
    let range = null;
    if (b.start && b.end) range = await capacityFor(slot.key, `${b.start}T00:00:00Z`, `${b.end}T23:59:59Z`);
    return NextResponse.json({ ok: true, calendar, range });
  }

  // Crear reserva (hold). El anunciante aún no paga: bloquea el cupo un rato.
  if (action === 'book') {
    const r = await createBooking({
      slotKey: String(b.slot || ''), startDate: String(b.start || ''), endDate: String(b.end || ''),
      advertiser: String(b.advertiser || ''), advertiserCompany: String(b.company || ''), advertiserEmail: String(b.email || ''),
      linkUrl: String(b.link || ''), note: String(b.note || ''), soldAmount: Number(b.price) || 0,
      repId: rep.id, source: 'seller',
    });
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
    return NextResponse.json({ ok: true, id: r.id, holdUntil: r.holdUntil });
  }

  // Generar la propuesta (PDF) o enviarla por correo, personalizada.
  if (action === 'proposal_pdf' || action === 'proposal_email') {
    const slot = slotByKey(String(b.slot || ''));
    if (!slot) return NextResponse.json({ error: 'slot inválido' }, { status: 400 });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.start) || !/^\d{4}-\d{2}-\d{2}$/.test(b.end)) return NextResponse.json({ error: 'fechas inválidas' }, { status: 400 });
    const cfg = await getAdsConfig();
    const { data: prof } = await supabaseAdmin.from('profiles').select('email').eq('id', user.id).maybeSingle();
    const sellerEmail = ((rep as any).work_email || '').trim() || (prof as any)?.email || '';
    const validUntil = new Date(Date.now() + Math.max(1, cfg.quoteValidityDays) * 86400000).toISOString().slice(0, 10);
    const { adProposalPdf, adProposalEmail } = await import('@/lib/adSpaceProposal');
    const inp = {
      slotKey: slot.key,
      slotNameEs: slot.es, slotNameEn: slot.en, size: slot.size, pageEs: slot.page, pageEn: slot.page,
      startDate: String(b.start), endDate: String(b.end), price: Number(b.price) || slot.price,
      cap: await slotCap(slot.key, cfg), impressionsPerDay: await estImpressionsPerDay(slot.page),
      holdUntil: b.holdUntil || undefined, validUntil,
      // El vendedor NO edita sus datos: salen de su cuenta (rep + perfil).
      sellerName: rep.display_name || rep.code, sellerEmail, sellerPhone: (rep as any).phone || '',
      advertiser: String(b.advertiser || ''), advertiserCompany: String(b.company || ''), advertiserEmail: String(b.email || ''),
      linkUrl: String(b.link || ''),
      tpl: cfg.quoteTemplate[lang],
    };
    const pdf = await adProposalPdf(inp, { lang });
    const base64 = Buffer.from(pdf).toString('base64');
    const filename = lang === 'en' ? 'onyx-ad-space-proposal.pdf' : 'propuesta-espacio-onyx.pdf';
    if (action === 'proposal_pdf') return NextResponse.json({ ok: true, pdf: base64, filename });

    const to = String(b.email || '').trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return NextResponse.json({ error: 'correo del anunciante inválido' }, { status: 400 });
    const { sendEmail, mailEnabled, fromWithAddr } = await import('@/lib/mail');
    if (!mailEnabled()) return NextResponse.json({ error: 'correo no configurado' }, { status: 400 });
    const em = adProposalEmail(inp, lang);
    const from = fromWithAddr(inp.sellerName, (rep as any).work_email || null);
    const sent = await sendEmail(to, em.subject, em.body, {
      kind: 'ad_space_proposal', from, replyTo: sellerEmail || undefined,
      attachments: [{ filename, content: base64 }],
    });
    if (!sent) return NextResponse.json({ error: 'no se pudo enviar' }, { status: 500 });
    return NextResponse.json({ ok: true, sent: true });
  }

  return NextResponse.json({ error: 'acción inválida' }, { status: 400 });
}
