import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getPlan, savePlan, getCheckin, saveCheckin, computeStats, HABIT_KEYS } from '@/lib/tradingPlan';

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
export async function GET() {
  const user = await me();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const plan = await getPlan(user.id);
  const [checkin, stats, ai] = await Promise.all([getCheckin(user.id), computeStats(user.id, plan), aiEnabled(user.id)]);
  return NextResponse.json({ plan, checkin, stats, aiEnabled: ai, habitKeys: HABIT_KEYS });
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
  const items: Record<string, boolean> = {};
  if (b.items && typeof b.items === 'object') for (const k of HABIT_KEYS) items[k] = !!b.items[k];
  await saveCheckin(user.id, items, String(b.note || ''));
  const plan = await getPlan(user.id);
  const stats = await computeStats(user.id, plan);
  return NextResponse.json({ ok: true, stats });
}
