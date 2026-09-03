import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getPlan, savePlan, getCheckin, saveCheckin, computeStats, HABIT_KEYS, guardianSummary, planHabitIds, getPlanHistory } from '@/lib/tradingPlan';

// Ventanas de sesión (aprox, en horas UTC) para auto-verificar "respeté mi sesión".
const SESSION_UTC: Record<string, [number, number]> = { asia: [0, 9], london: [7, 16], ny: [12, 21] };

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function me() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  return user;
}
async function aiEnabled(userId: string): Promise<boolean> {
  const { data: prof } = await supabaseAdmin.from('profiles').select('plan').eq('id', userId).maybeSingle();
  const { data: pl } = await supabaseAdmin.from('plans').select('capabilities').eq('id', (prof as any)?.plan || 'free').maybeSingle();
  return !!(pl?.capabilities as any)?.coach;
}

// GET · mi plan + check-in de hoy + estadísticas (racha, adherencia).
// Acepta ?range=7|30|90 para la ventana de las estadísticas y el mapa.
export async function GET(req: Request) {
  const user = await me();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const rq = Number(sp.get('range')) || 30;
  const range = [7, 30, 90].includes(rq) ? rq : 30;
  const plan = await getPlan(user.id);
  // Alcance de la MEDICIÓN según la cuenta elegida arriba (un solo control): 'all' = todas;
  // un id = solo esa cuenta. Solo afecta la respuesta (no cambia el plan guardado).
  const acc = sp.get('account');
  const planForStats = !acc ? plan
    : acc === 'all' ? { ...plan, scope: 'all' as const }
    : { ...plan, scope: 'primary' as const, primary_account_id: acc };
  const [checkin, stats, ai, guardian, planRow] = await Promise.all([
    getCheckin(user.id), computeStats(user.id, planForStats, range), aiEnabled(user.id), guardianSummary(user.id),
    supabaseAdmin.from('trading_plans').select('user_id').eq('user_id', user.id).maybeSingle(),
  ]);

  // Auto-marcado: lo que Onyx ya sabe de hoy, para premarcar hábitos y que el
  // trader solo confirme. Funciona con o sin Guardian. Silencioso si algo falla.
  const auto: Record<string, boolean> = {};
  try {
    const dayStart = new Date(); dayStart.setUTCHours(0, 0, 0, 0);
    const { data: accs } = await supabaseAdmin.from('trading_accounts').select('id').eq('user_id', user.id);
    const ids = (accs || []).map((a: any) => a.id);
    let rows: any[] = [];
    if (ids.length) {
      const r = await supabaseAdmin.from('trades').select('open_time,close_time')
        .in('account_id', ids).gte('close_time', dayStart.toISOString()).limit(1000);
      rows = r.data || [];
    }
    const tradesToday = rows.length;
    const { count: blockedToday } = await supabaseAdmin.from('manager_events').select('*', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('kind', 'blocked').gte('created_at', dayStart.toISOString());
    auto.journaled = tradesToday > 0;                                   // operaciones sincronizadas = registradas
    auto.stopped_at_limit = tradesToday > 0 && !(blockedToday || 0);    // operó y no lo frenaron por límite
    // Respeté mi sesión: todas las operaciones de hoy abrieron dentro de alguna
    // de las sesiones del plan (aprox por hora UTC).
    const wins = (plan.sessions || []).map((s: string) => SESSION_UTC[s]).filter(Boolean) as [number, number][];
    if (tradesToday > 0 && wins.length) {
      const inSession = (t: any) => { const ts = t.open_time || t.close_time; if (!ts) return false; const h = new Date(ts).getUTCHours(); return wins.some(([a, b]) => h >= a && h < b); };
      auto.respected_sessions = rows.every(inSession);
    }
  } catch { /* sin auto-marcado */ }

  const history = await getPlanHistory(user.id, range).catch(() => []);
  return NextResponse.json({ plan, checkin, stats, aiEnabled: ai, habitKeys: HABIT_KEYS, guardian, hasPlan: !!(planRow as any)?.data, auto, history });
}

// PATCH · guardar el plan.
export async function PATCH(req: Request) {
  const user = await me();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const plan = await savePlan(user.id, b.plan || {});
  const stats = await computeStats(user.id, plan);
  return NextResponse.json({ ok: true, plan, stats });
}

// POST · guardar el check-in de hoy.
export async function POST(req: Request) {
  const user = await me();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  // Aceptamos los hábitos predefinidos y los propios del trader (los que estén en su plan).
  const plan0 = await getPlan(user.id);
  const valid = new Set(planHabitIds(plan0));
  const items: Record<string, boolean> = {};
  if (b.items && typeof b.items === 'object') for (const k of Object.keys(b.items)) if (valid.has(k)) items[k] = !!b.items[k];
  await saveCheckin(user.id, items, String(b.note || ''));
  const plan = await getPlan(user.id);
  const stats = await computeStats(user.id, plan);
  return NextResponse.json({ ok: true, stats });
}
