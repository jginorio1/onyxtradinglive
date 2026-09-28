import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { setIapPlan } from '@/lib/entitlements';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ============================================================
// Webhook de RevenueCat (compras In-App de Apple en iOS).
//
// RevenueCat valida el recibo con Apple y nos avisa aquí de cada evento
// (compra, renovación, cancelación, expiración, reembolso…). Nosotros solo
// actualizamos el plan del usuario en Onyx vía la capa de entitlements; el plan
// EFECTIVO se recalcula solo (gana el de mayor rango entre Stripe e IAP).
//
// SEGURIDAD: RevenueCat manda un header Authorization con el secreto que tú pones
// en su panel (REVENUECAT_WEBHOOK_SECRET). Rechazamos si no coincide.
//
// app_user_id = profiles.id (lo fijamos como appUserID al iniciar RevenueCat en la app).
// El producto (product_id) se mapea a un plan de Onyx: por convención el id del
// producto contiene el id del plan (onyx_pro_monthly → pro). Puedes forzar el mapa
// con REVENUECAT_PRODUCT_MAP (JSON: { "com.onyx.pro.month": "pro", ... }).
// ============================================================

// Mapea un product_id de App Store a un plan de Onyx.
async function planFromProduct(productId: string): Promise<string | null> {
  const pid = String(productId || '').toLowerCase();
  // 1) Mapa explícito por env (gana si está).
  try {
    const raw = process.env.REVENUECAT_PRODUCT_MAP;
    if (raw) { const m = JSON.parse(raw); if (m[productId]) return String(m[productId]); if (m[pid]) return String(m[pid]); }
  } catch {}
  // 2) Por convención: el id del plan aparece dentro del product_id.
  const { data: plans } = await supabaseAdmin.from('plans').select('id').order('price_month', { ascending: false });
  for (const p of (plans || []) as any[]) {
    const id = String(p.id || '').toLowerCase();
    if (id && id !== 'free' && pid.includes(id)) return p.id;   // el de mayor precio que aparezca
  }
  return null;
}

export async function POST(req: Request) {
  // Auth: header Authorization = secreto configurado en RevenueCat.
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization') || '';
    if (auth !== secret && auth !== `Bearer ${secret}`) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({} as any));
  const ev = body?.event || {};
  const type = String(ev.type || '').toUpperCase();
  const userId = String(ev.app_user_id || ev.original_app_user_id || '');
  const productId = String(ev.product_id || '');
  const expMs = Number(ev.expiration_at_ms || 0);
  const expiresAt = expMs ? new Date(expMs).toISOString() : null;

  if (!userId) return NextResponse.json({ ok: true, skipped: 'no_user' });

  // Guarda el app_user_id de RevenueCat para trazabilidad.
  try { await supabaseAdmin.from('profiles').update({ rc_user_id: userId }).eq('id', userId); } catch {}

  try {
    if (['INITIAL_PURCHASE', 'RENEWAL', 'PRODUCT_CHANGE', 'UNCANCELLATION', 'NON_RENEWING_PURCHASE'].includes(type)) {
      const plan = await planFromProduct(productId);
      if (plan) await setIapPlan(userId, { plan, product: productId, status: 'active', expiresAt });
    } else if (type === 'CANCELLATION') {
      // Canceló la auto-renovación pero SIGUE con acceso hasta que expire: mantenemos
      // el plan activo y solo marcamos el estado.
      const plan = await planFromProduct(productId);
      if (plan) await setIapPlan(userId, { plan, product: productId, status: 'cancelled', expiresAt });
    } else if (type === 'EXPIRATION') {
      // Se acabó el acceso de Apple → sin plan de IAP. Baja al de Stripe (o free).
      await setIapPlan(userId, { plan: null, product: productId, status: 'expired', expiresAt });
    } else if (type === 'BILLING_ISSUE') {
      // Problema de cobro: Apple da un periodo de gracia; no cortamos aún.
      // (Si finalmente expira, llegará EXPIRATION.)
    } else if (type === 'REFUND' || type === 'REVOKE') {
      await setIapPlan(userId, { plan: null, product: productId, status: 'expired', expiresAt });
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || 'exec') }, { status: 200 });
  }

  return NextResponse.json({ ok: true, type });
}
