import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { setIapPlan } from '@/lib/entitlements';
import { planRank } from '@/lib/planNotify';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Auto-reconciliacion de la compra de Apple (RevenueCat) con la base de Onyx.
// La app iOS llama a este endpoint al abrir y al volver del segundo plano. El
// servidor le pregunta a RevenueCat cual es el plan activo y actualiza el perfil.
// Si RevenueCat no responde, NO cambia nada (evita bajar el plan por un fallo).

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
    if (!key) return NextResponse.json({ ok: false, error: 'no_key' });

    const r = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(user.id)}`, {
      headers: { Authorization: `Bearer ${key}` }, cache: 'no-store',
    }).catch(() => null);
    if (!r || !r.ok) return NextResponse.json({ ok: false, error: 'rc_unreachable' });

    const data: any = await r.json().catch(() => ({}));
    const subs = data?.subscriber?.subscriptions || {};
    const now = Date.now();
    const rank = await planRank();

    let bestPlan: string | null = null, bestProduct = '', bestExp: string | null = null, bestRank = -1;
    for (const [pid, s] of Object.entries<any>(subs)) {
      const expMs = s?.expires_date ? Date.parse(s.expires_date) : 0;
      if (!expMs || expMs <= now) continue;
      const plan = await planFromProduct(pid);
      if (!plan) continue;
      const rk = rank[plan] != null ? rank[plan] : -1;
      if (rk > bestRank) { bestRank = rk; bestPlan = plan; bestProduct = pid; bestExp = new Date(expMs).toISOString(); }
    }

    if (bestPlan) {
      const eff = await setIapPlan(user.id, { plan: bestPlan, product: bestProduct, status: 'active', expiresAt: bestExp });
      return NextResponse.json({ ok: true, iap: bestPlan, plan: eff });
    }
    const eff = await setIapPlan(user.id, { plan: null, status: 'expired' });
    return NextResponse.json({ ok: true, iap: null, plan: eff });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'error' });
  }
}
