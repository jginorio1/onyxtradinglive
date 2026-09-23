import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { saveSetting, botPlanMatrixSettings, BOT_PLAN_MATRIX_DEF, BOT_CAP_META, type BotPlanMatrix } from '@/lib/settings';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · matriz de capacidades por plan de bots (para el editor del admin).
export async function GET() {
  const { ok } = await requirePerm('ajustes', 'view');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  return NextResponse.json({ matrix: await botPlanMatrixSettings(), meta: BOT_CAP_META, def: BOT_PLAN_MATRIX_DEF });
}

// PATCH · guardar la matriz (owner). Sanea: mantiene los 3 tiers y solo las
// capacidades conocidas; boolean → bool, texto → string corto.
export async function PATCH(req: Request) {
  const { ok } = await requirePerm('ajustes', 'manage');
  if (!ok) return NextResponse.json({ error: 'Solo el Owner puede editar esto.' }, { status: 403 });
  const prev = await botPlanMatrixSettings();
  const b = await req.json().catch(() => ({} as any));
  const inCaps = (b?.caps && typeof b.caps === 'object') ? b.caps : {};
  const tiers = Array.isArray(b?.tiers) && b.tiers.length ? b.tiers.slice(0, 3).map((t: any, i: number) => ({
    id: String(t?.id || prev.tiers[i]?.id || `t${i}`),
    es: String(t?.es || prev.tiers[i]?.es || '').slice(0, 30),
    en: String(t?.en || prev.tiers[i]?.en || '').slice(0, 30),
  })) : prev.tiers;
  const caps: Record<string, Record<string, any>> = {};
  for (const m of BOT_CAP_META) {
    const row = inCaps[m.key] || prev.caps[m.key] || {};
    caps[m.key] = {};
    for (const tr of tiers) {
      const v = row[tr.id];
      caps[m.key][tr.id] = m.type === 'bool' ? !!v : String(v ?? '').slice(0, 24);
    }
  }
  const value: BotPlanMatrix = { tiers, caps };
  await saveSetting('bot_plan_matrix', value);
  return NextResponse.json({ ok: true, matrix: value });
}
