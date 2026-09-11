import { NextResponse } from 'next/server';
import { getAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { stripe } from '@/lib/stripe';
import { botLabSettings, cardEnabled } from '@/lib/botlab';
import { addonSettings, mailRoutes } from '@/lib/settings';

// Compara un precio de Stripe (por su Price ID) con el importe esperado en la app.
async function checkPrice(label: string, kind: string, appAmt: number, priceId: string, enabled = true) {
  const r: any = { plan: label, period: kind, appAmount: appAmt, priceId: priceId || '', active: enabled };
  if (!priceId) { r.status = appAmt > 0 && enabled ? 'missing' : 'ok'; r.note = appAmt > 0 && enabled ? 'Falta el Stripe Price ID' : (enabled ? '' : 'Desactivado'); return r; }
  try {
    const price: any = await stripe.prices.retrieve(priceId);
    const stripeAmt = (Number(price.unit_amount) || 0) / 100;
    r.stripeAmount = stripeAmt; r.currency = (price.currency || 'usd').toUpperCase(); r.stripeActive = !!price.active;
    if (!price.active) { r.status = 'inactive'; r.note = 'El precio está inactivo en Stripe'; }
    else if (Math.round(stripeAmt) !== Math.round(appAmt)) { r.status = 'mismatch'; r.note = `App $${appAmt} ≠ Stripe $${stripeAmt}`; }
    else r.status = 'ok';
  } catch (e: any) { r.status = 'error'; r.note = `No existe en Stripe (${e?.message || 'error'})`; }
  return r;
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · chequeo de pagos para el admin:
//  · Precios: cada plan cruzado con su Stripe Price ID (importe, moneda, activo).
//  · Checklist anti-chargeback: 3DS, descriptor, casilla de términos, email, evidencia.
//  · Salud de la tabla de evidencia (cuántas compras y disputas hay).
export async function GET() {
  try {
    const { isAdmin } = await getAdmin();
    if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });

    // --- Precios de planes ---
    const { data: plans } = await supabaseAdmin.from('plans').select('id,name,price_month,price_year,stripe_price_id,stripe_price_id_year,active').order('sort', { ascending: true });
    const rows: any[] = [];
    for (const p of (plans || []) as any[]) {
      for (const period of ['month', 'year'] as const) {
        const appAmt = Number(period === 'month' ? p.price_month : p.price_year) || 0;
        const priceId = period === 'month' ? p.stripe_price_id : p.stripe_price_id_year;
        // El plan Free (0) o sin Price ID no se cobra: no es error.
        if (appAmt <= 0 && !priceId) continue;
        const r: any = { plan: p.name, period, appAmount: appAmt, priceId: priceId || '', active: p.active };
        if (!priceId) { r.status = appAmt > 0 ? 'missing' : 'ok'; r.note = appAmt > 0 ? 'Falta el Stripe Price ID' : ''; rows.push(r); continue; }
        try {
          const price: any = await stripe.prices.retrieve(priceId);
          const stripeAmt = (Number(price.unit_amount) || 0) / 100;
          r.stripeAmount = stripeAmt; r.currency = (price.currency || 'usd').toUpperCase(); r.stripeActive = !!price.active;
          if (!price.active) { r.status = 'inactive'; r.note = 'El precio está inactivo en Stripe'; }
          else if (Math.round(stripeAmt) !== Math.round(appAmt)) { r.status = 'mismatch'; r.note = `App $${appAmt} ≠ Stripe $${stripeAmt}`; }
          else r.status = 'ok';
        } catch (e: any) { r.status = 'error'; r.note = `No existe en Stripe (${e?.message || 'error'})`; }
        rows.push(r);
      }
    }

    // --- Add-ons (complementos que se venden aparte, configurados en Planes) ---
    const ad = await addonSettings();
    const addonDefs: { label: string; amt: number; id: string; on: boolean }[] = [
      { label: 'Add-on · Cuenta extra', amt: Number(ad.extra_account_price) || 0, id: ad.extra_account_price_id, on: ad.extra_account_enabled !== false },
      { label: 'Add-on · Esclava extra (Copy)', amt: Number(ad.extra_slave_price) || 0, id: ad.extra_slave_price_id, on: !!ad.extra_slave_enabled },
      { label: 'Add-on · Master extra (Copy)', amt: Number(ad.extra_master_price) || 0, id: ad.extra_master_price_id, on: !!ad.extra_master_enabled },
      { label: 'Add-on · Módulo de robots', amt: Number(ad.algo_price) || 0, id: ad.algo_price_id, on: !!ad.algo_enabled },
    ];
    const addonRows: any[] = [];
    for (const a of addonDefs) {
      // Solo alertamos por los add-ons ACTIVOS; los apagados se muestran informativos.
      if (!a.on && !a.id) { addonRows.push({ plan: a.label, period: 'addon', appAmount: a.amt, priceId: '', active: false, status: 'ok', note: 'Desactivado' }); continue; }
      addonRows.push(await checkPrice(a.label, 'addon', a.amt, a.id, a.on));
    }

    // --- Checklist anti-chargeback ---
    const bl = await botLabSettings();
    const { count: evCount } = await supabaseAdmin.from('payment_evidence').select('*', { count: 'exact', head: true });
    const { count: disCount } = await supabaseAdmin.from('payment_evidence').select('*', { count: 'exact', head: true }).eq('status', 'disputed');
    let acct: any = null; try { acct = await stripe.accounts.retrieve(); } catch {}
    const routes = await mailRoutes();
    const checklist = [
      { key: '3ds', ok: true, label: '3D Secure automático en los checkouts', note: 'Se pide autenticación al banco (traslada el fraude al emisor).' },
      { key: 'descriptor', ok: true, label: `Descriptor de tarjeta (…* ${(process.env.STRIPE_DESCRIPTOR_BOTLAB || 'BOTLAB')})`, note: acct?.settings?.payments?.statement_descriptor ? `Cuenta: ${acct.settings.payments.statement_descriptor}` : 'Fija el descriptor base en Stripe → Public details.' },
      { key: 'tos', ok: process.env.STRIPE_TOS_ON === '1', label: 'Casilla de términos en el checkout (STRIPE_TOS_ON)', note: process.env.STRIPE_TOS_ON === '1' ? 'Activa.' : 'Ponla en Vercel y añade la URL de Términos en Stripe.' },
      { key: 'alert', ok: !!(process.env.DISPUTE_ALERT_EMAIL || routes.billing), label: 'Aviso de disputa (buzón de pagos)', note: `Llega a: ${process.env.DISPUTE_ALERT_EMAIL || routes.billing || 'sin configurar'} · edítalo en Ajustes → Direcciones de correo.` },
      { key: 'evidence', ok: (evCount || 0) > 0, label: 'Tabla de evidencia recibiendo datos', note: `${evCount || 0} compras registradas · ${disCount || 0} en disputa` },
      { key: 'card', ok: cardEnabled(bl), label: 'Pago con tarjeta activo en Bot Lab', note: cardEnabled(bl) ? 'Activo.' : 'Desactivado en Bot Lab → Ajustes.' },
    ];

    const testHint = 'Prueba en MODO TEST de Stripe: paga con la tarjeta 4000 0000 0000 0259 (dispara un chargeback automático). El webhook armará la evidencia y verás el borrador en la disputa.';

    return NextResponse.json({ prices: rows, addons: addonRows, checklist, testHint });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
