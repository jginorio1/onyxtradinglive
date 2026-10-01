import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { setIapPlan } from '@/lib/entitlements';
import { planRank } from '@/lib/planNotify';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ============================================================================
// AUTO-RECONCILIACIÓN de la compra de Apple (RevenueCat) con la base de Onyx.
//
// La app de iOS llama a este endpoint al abrir (y al volver del segundo plano).
// El SERVIDOR le pregunta a RevenueCat (API REST, con la llave SECRETA) cuál es el
// plan realmente activo para este usuario y actualiza profiles.iap_plan/status/expira
// + recalcula el plan efectivo. Así, aunque un webhook se pierda o alguien toque la
// base a mano, en la siguiente apertura se corrige solo: nunca queda desincronizado.
//
// Seguro: el plan viene de RevenueCat (fuente de verdad), no del cliente, así que
// nadie puede falsear su plan. Si no hay llave secreta configurada, no hace nada.
// ============================================================================

// Mapea un product_id de App Store a un plan de Onyx (mismo criterio que el webhook).
async function planFromProduct(productId: string): Promise<string | null> {
  const pid = String(productId || '').toLowerCase();
  try {
    const raw = process.env.REVENUECAT_PRODUCT_MAP;
    if (raw) { const m = JSON.parse(raw); if (m[productId]) return String(m[productId]); if (m[pid]) return String(m[pid]); }
  } catch {}
  const { data: plans } = await supabaseAdmin.from('plans').select('id').order('price_month', { ascending: false });
  for (const p of (plans || []) as any[]) {
    const id = String(p.id || '').toLowerCase();
    if (id && id !== 'free' && pid.includes(id)) return p.id;
  }
  return null;
}

export async function POST() {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: 'no_auth' }, { status: 401 });

    const key = process.env.REVENUECAT_SECRET_KEY;
    if (!key) return NextResponse.json({ ok: false, error: 'no_key' });   // sin llave: no tocamos nada

    // app_user_id en RevenueCat = id del perfil (se ata con Purchases.logIn en la app).
    const r = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(user.id)}`, {
      headers: { Authorization: `Bearer ${key}` }, cache: 'no-store',
    }).catch(() => null);
    // Si RevenueCat no responde bien, NO cambiamos nada (evita bajar el plan por un fallo de red).
    if (!r || !r.ok) return NextResponse.json({ ok: false, error: 'rc_unreachable' });

    const data: any = await r.json().catch(() => ({}));
    const subs = data?.subscriber?.subscriptions || {};
    const now = Date.now();
    const rank = await planRank();

    // Busca la suscripción ACTIVA de mayor rango.
    let bestPlan: string | null = null, bestProduct = '', bestExp: string | null = null, bestRank = -1;
    for (const [pid, s] of Object.entries<any>(subs)) {
      const expMs = s?.expires_date ? Date.parse(s.expires_date) : 0;
      if (!expMs || expMs <= now) continue;                 // caducada o sin fecha → no activa
      const plan = await planFromProduct(pid);
      if (!plan) continue;
      const rk = rank[plan] != null ? rank[plan] : -1;
      if (rk > bestRank) { bestRank = rk; bestPlan = plan; bestProduct = pid; bestExp = new Date(expMs).toISOString(); }
    }

    if (bestPlan) {
      const eff = await setIapPlan(user.id, { plan: bestPlan, product: bestProduct, status: 'active', expiresAt: bestExp });
      return NextResponse.json({ ok: true, iap: bestPlan, plan: eff });
    }
    // RevenueCat respondió y NO hay suscripción de Apple activa → limpia el IAP.
    // (applyEffectivePlan mantiene el plan de Stripe si lo hay; si no, baja a free.)
    const eff = await setIapPlan(user.id, { plan: null, status: 'expired' });
    return NextResponse.json({ ok: true, iap: null, plan: eff });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'error' });
  }
}
