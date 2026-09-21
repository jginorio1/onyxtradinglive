import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { getSetting, saveSetting, newsPilotSettings, type NewsPilot } from '@/lib/settings';
import { NEWS_SOURCES, fetchFeed, type NewsSource } from '@/lib/newsSources';
import { runNewsPilot } from '@/lib/newsPilot';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const oneOf = <T extends string>(v: any, a: T[], fb: T): T => (a.includes(v) ? v : fb);
const clampInt = (v: any, lo: number, hi: number, fb: number) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fb; };
const CATS = ['macro', 'markets', 'earnings', 'crypto'];
// Limpia y valida la lista de fuentes personalizadas del dueño (id, name, url http, cat válida).
function sanitizeCustom(v: any, fb: { id: string; name: string; url: string; cat: string }[]) {
  if (!Array.isArray(v)) return fb;
  const out: { id: string; name: string; url: string; cat: string }[] = [];
  for (const c of v.slice(0, 40)) {
    const url = String(c?.url || '').trim();
    if (!/^https?:\/\//i.test(url)) continue;
    out.push({
      id: (c?.id && String(c.id)) || ('x_' + Math.random().toString(36).slice(2, 9)),
      name: String(c?.name || url).slice(0, 60),
      url: url.slice(0, 500),
      cat: CATS.includes(c?.cat) ? c.cat : 'markets',
    });
  }
  return out;
}

// GET · ajustes + catálogo de fuentes + últimos titulares vistos/publicados.
export async function GET() {
  const { ok } = await requirePerm('modulos', 'view');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const settings = await newsPilotSettings();
  const sources = NEWS_SOURCES.map((s) => ({ id: s.id, name: s.name, url: s.url, tier: s.tier, cat: s.cat }));
  const lastRun = await getSetting<any>('news_pilot_last', null);
  // Latidos del cron: cuántas corridas automáticas hubo en la última hora (esperado
  // ~20 con */3). Prueba definitiva de si Vercel está disparando el cron o no.
  const cron = await getSetting<{ hits: number[] }>('news_pilot_cron', { hits: [] });
  const nowMs = Date.now();
  const cronHits1h = (cron.hits || []).filter((t) => nowMs - t <= 3600 * 1000).length;
  const cronLastAt = (cron.hits || []).length ? new Date(Math.max(...cron.hits)).toISOString() : null;
  let recent: any[] = [];
  try {
    const { data } = await supabaseAdmin.from('news_seen').select('title,source,url,posted,created_at').order('created_at', { ascending: false }).limit(20);
    recent = data || [];
  } catch {}
  return NextResponse.json({ settings, sources, recent, lastRun, cronHits1h, cronLastAt });
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
    custom_sources: sanitizeCustom(b.custom_sources, prev.custom_sources),
    maxAgeMin: b.maxAgeMin == null ? prev.maxAgeMin : clampInt(b.maxAgeMin, 5, 720, prev.maxAgeMin),
    seo: b.seo == null ? (prev.seo ?? true) : !!b.seo,
  };
  await saveSetting('news_pilot', value);
  return NextResponse.json({ ok: true, ...value });
}

// POST · probar AHORA (fuerza un ciclo) o probar un feed (action='test').
export async function POST(req: Request) {
  const { ok } = await requirePerm('modulos', 'manage');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const b = await req.json().catch(() => ({} as any));

  // Probar un feed RSS/Atom concreto: devuelve si responde y cuántos titulares trae.
  if (b?.action === 'test') {
    const url = String(b?.url || '').trim();
    if (!/^https?:\/\//i.test(url)) return NextResponse.json({ ok: false, error: 'URL inválida' });
    try {
      const probe: NewsSource = { id: 'test', name: 'test', url, tier: 'wire', cat: 'markets' };
      const items = await fetchFeed(probe, 8000);
      const sample = items[0]?.title || '';
      return NextResponse.json({ ok: items.length > 0, count: items.length, sample });
    } catch (e: any) {
      return NextResponse.json({ ok: false, error: e?.message || 'no responde' });
    }
  }

  try {
    const r = await runNewsPilot(true, 'test');
    return NextResponse.json({ ok: true, ...r });
  } catch (e: any) {
    await logError('news_pilot_run', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
