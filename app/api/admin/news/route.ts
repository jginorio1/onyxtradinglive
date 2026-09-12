import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { getSetting, saveSetting, newsPilotSettings, type NewsPilot } from '@/lib/settings';
import { NEWS_SOURCES } from '@/lib/newsSources';
import { runNewsPilot } from '@/lib/newsPilot';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const oneOf = <T extends string>(v: any, a: T[], fb: T): T => (a.includes(v) ? v : fb);
const clampInt = (v: any, lo: number, hi: number, fb: number) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fb; };

// GET · ajustes + catálogo de fuentes + últimos titulares vistos/publicados.
export async function GET() {
  const { ok } = await requirePerm('modulos', 'view');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const settings = await newsPilotSettings();
  const sources = NEWS_SOURCES.map((s) => ({ id: s.id, name: s.name, tier: s.tier, cat: s.cat }));
  let recent: any[] = [];
  try {
    const { data } = await supabaseAdmin.from('news_seen').select('title,source,url,posted,created_at').order('created_at', { ascending: false }).limit(20);
    recent = data || [];
  } catch {}
  return NextResponse.json({ settings, sources, recent });
}

// PATCH · guardar ajustes del piloto (owner/gestor de módulos).
export async function PATCH(req: Request) {
  const { ok } = await requirePerm('modulos', 'manage');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const prev = await getSetting<NewsPilot>('news_pilot', await newsPilotSettings());
  const b = await req.json().catch(() => ({} as any));
  const t = b.topics || {};
  const value: NewsPilot = {
    enabled: b.enabled == null ? prev.enabled : !!b.enabled,
    mode: oneOf(b.mode, ['auto', 'draft'], prev.mode),
    maxPerDay: b.maxPerDay == null ? prev.maxPerDay : clampInt(b.maxPerDay, 1, 50, prev.maxPerDay),
    minMinutesBetween: b.minMinutesBetween == null ? prev.minMinutesBetween : clampInt(b.minMinutesBetween, 0, 720, prev.minMinutesBetween),
    emailSegment: b.emailSegment ? String(b.emailSegment).slice(0, 40) : prev.emailSegment,
    topics: {
      macro: t.macro == null ? prev.topics.macro : !!t.macro,
      markets: t.markets == null ? prev.topics.markets : !!t.markets,
      earnings: t.earnings == null ? prev.topics.earnings : !!t.earnings,
      crypto: t.crypto == null ? prev.topics.crypto : !!t.crypto,
    },
    sources: (b.sources && typeof b.sources === 'object') ? b.sources : prev.sources,
    maxAgeMin: b.maxAgeMin == null ? prev.maxAgeMin : clampInt(b.maxAgeMin, 5, 720, prev.maxAgeMin),
  };
  await saveSetting('news_pilot', value);
  return NextResponse.json({ ok: true, ...value });
}

// POST · probar AHORA (fuerza un ciclo aunque esté apagado). Útil para verificar.
export async function POST() {
  const { ok } = await requirePerm('modulos', 'manage');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  try {
    const r = await runNewsPilot(true);
    return NextResponse.json({ ok: true, ...r });
  } catch (e: any) {
    await logError('news_pilot_run', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
