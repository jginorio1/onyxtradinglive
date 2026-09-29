import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { setIapPlan } from '@/lib/entitlements';
import { planRank } from '@/lib/planNotify';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// ============================================================================
// CRON de reconciliacion de planes de Apple (RevenueCat) - backstop semanal.
//
// Ademas del webhook (tiempo real) y de /api/iap/refresh (al abrir la app), este
// cron recorre a los usuarios con compra de Apple y confirma su estado real contra
// RevenueCat. Cierra el ultimo hueco: un usuario cuya suscripcion caduco pero que
// nunca vuelve a abrir la app se corrige igual (baja a su plan de Stripe o free).
//
// Protegido con CRON_SECRET. Programar en vercel.json (semanal recomendado).
// ============================================================================

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;                       // sin secreto configurado: no bloquea
  const q = new URL(req.url).searchParams.get('key') || '';
  const auth = req.headers.get('authorization') || '';
  return auth === `Bearer ${secret}` || q === secret;
}

async function planFromProduct(productId: string, plans: any[]): Promise<string | null> {
  const pid = String(productId || '').toLowerCase();
  try {
    const raw = process.env.REVENUECAT_PRODUCT_MAP;
    if (raw) { const m = JSON.parse(raw); if (m[productId]) return String(m[productId]); if (m[pid]) return String(m[pid]); }
  } catch {}
  for (const p of plans) {
    const id = String(p.id || '').toLowerCase();
    if (id && id !== 'free' && pid.includes(id)) return p.id;
  }
  return null;
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const key = process.env.REVENUECAT_SECRET_KEY;
  if (!key) return NextResponse.json({ ok: false, error: 'no_key' });

  // Solo usuarios con compra de Apple (activa o en gracia). Evita pegarle a RC por todos.
  const { data: users } = await supabaseAdmin.from('profiles')
    .select('id')
    .not('iap_plan', 'is', null)
    .limit(500);

  const rank = await planRank();
  const { data: plans } = await supabaseAdmin.from('plans').select('id').order('price_month', { ascending: false });
  const plansArr = (plans || []) as any[];

  let checked = 0, changed = 0, cleared = 0, errors = 0;
  for (const u of (users || []) as any[]) {
    try {
      const r = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(u.id)}`, {
        headers: { Authorization: `Bearer ${key}` }, cache: 'no-store',
        signal: (AbortSignal as any).timeout ? (AbortSignal as any).timeout(10000) : undefined,
      }).catch(() => null);
      if (!r || !r.ok) { errors++; continue; }   // ante duda, no tocamos a este usuario
      const data: any = await r.json().catch(() => ({}));
      const subs = data?.subscriber?.subscriptions || {};
      const now = Date.now();
      let bestPlan: string | null = null, bestProduct = '', bestExp: string | null = null, bestRank = -1;
      for (const [pid, s] of Object.entries<any>(subs)) {
        const expMs = s?.expires_date ? Date.parse(s.expires_date) : 0;
        if (!expMs || expMs <= now) continue;
        const plan = await planFromProduct(pid, plansArr);
        if (!plan) continue;
        const rk = rank[plan] != null ? rank[plan] : -1;
        if (rk > bestRank) { bestRank = rk; bestPlan = plan; bestProduct = pid; bestExp = new Date(expMs).toISOString(); }
      }
      checked++;
      if (bestPlan) { await setIapPlan(u.id, { plan: bestPlan, product: bestProduct, status: 'active', expiresAt: bestExp }); changed++; }
      else { await setIapPlan(u.id, { plan: null, status: 'expired' }); cleared++; }
    } catch { errors++; }
  }

  return NextResponse.json({ ok: true, total: (users || []).length, checked, changed, cleared, errors });
}
