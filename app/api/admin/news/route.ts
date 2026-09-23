import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { getSetting, saveSetting, newsPilotSettings, type NewsPilot } from '@/lib/settings';
import { NEWS_SOURCES, mergedSources, fetchFeed, type NewsSource } from '@/lib/newsSources';
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
  // KPIs: publicados hoy / 7 días / total. Robusto: si is_news no existe, contamos
  // todo lo publicado del rango (nunca dejamos que un filtro roto devuelva 0).
  async function cnt(fromIso?: string): Promise<number> {
    let q: any = supabaseAdmin.from('blog_posts').select('id', { count: 'exact', head: true }).eq('status', 'published').eq('is_news', true);
    // Contamos por created_at (siempre presente) para que "Publicados hoy" coincida
    // con el tope diario del piloto y no discrepe de lo que realmente frena.
    if (fromIso) q = q.gte('created_at', fromIso);
    const r1 = await q;
    if (r1.error) {
      let q2: any = supabaseAdmin.from('blog_posts').select('id', { count: 'exact', head: true }).eq('status', 'published');
      if (fromIso) q2 = q2.gte('published_at', fromIso);
      const r2 = await q2;
      return r2.count || 0;
    }
    return r1.count || 0;
  }
  const startToday = new Date(); startToday.setUTCHours(0, 0, 0, 0);
  const start7 = new Date(nowMs - 7 * 86400000);
  let today = 0, last7 = 0, total = 0;
  try { today = await cnt(startToday.toISOString()); last7 = await cnt(start7.toISOString()); total = await cnt(); } catch {}
  // Próxima ventana: cuándo podrá publicar el siguiente. Dos motivos de espera:
  //  · Tope diario alcanzado → se reanuda mañana 00:00 UTC (cuando se reinicia el día).
  //  · Separación mínima → gate.at + gap.
  // Devolvemos también nextAt (epoch ms) para que el panel muestre un countdown en vivo.
  const gate = await getSetting<{ at: number }>('news_pilot_gate', { at: 0 });
  const gapMin = settings.minMinutesBetween || 60;
  const capReached = today >= (settings.maxPerDay || 3);
  const tomorrow0 = new Date(); tomorrow0.setUTCHours(24, 0, 0, 0);
  const gateNextMs = gate.at ? gate.at + gapMin * 60000 : nowMs;
  const nextAt = capReached ? tomorrow0.getTime() : Math.max(gateNextMs, nowMs);
  const nextWindowMin = Math.max(0, Math.ceil((nextAt - nowMs) / 60000));
  const gateFree = !capReached && (!gate.at || (nowMs - gate.at) >= gapMin * 60000);
  const log = await getSetting<{ runs: any[] }>('news_pilot_log', { runs: [] });
  return NextResponse.json({ settings, sources, recent, lastRun, cronHits1h, cronLastAt, today, last7, total, nextWindowMin, nextAt, capReached, gateFree, log: log.runs || [] });
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

  // SIMULAR ciclo: corre todo el motor pero NO publica; devuelve el embudo + candidatos.
  if (b?.action === 'simulate') {
    try { const r = await runNewsPilot(true, 'test', true); return NextResponse.json({ ok: true, ...r }); }
    catch (e: any) { return NextResponse.json({ ok: false, error: e?.message || 'error' }); }
  }
  // Probar la CLAVE de la IA (Anthropic): un ping mínimo. 200 = clave válida.
  if (b?.action === 'ai_test') {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) return NextResponse.json({ ok: false, error: 'Falta ANTHROPIC_API_KEY' });
    const model = process.env.ONYX_AI_MODEL || 'claude-haiku-4-5-20251001';
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: 8, messages: [{ role: 'user', content: 'ping' }] }),
      });
      if (r.ok) return NextResponse.json({ ok: true, model });
      let msg = ''; try { msg = JSON.parse(await r.text())?.error?.message || ''; } catch {}
      return NextResponse.json({ ok: false, status: r.status, error: msg || ('HTTP ' + r.status) });
    } catch (e: any) { return NextResponse.json({ ok: false, error: e?.message || 'error de red' }); }
  }
  // Probar TODOS los feeds activos, uno por uno: responde/no + cuántos + antigüedad del más nuevo.
  if (b?.action === 'feeds_test') {
    const st = await newsPilotSettings();
    const active = mergedSources(st.custom_sources).filter((s) => st.sources[s.id] !== false);
    const feeds = await Promise.all(active.map(async (s) => {
      try {
        const items = await fetchFeed(s, 7000);
        const newest = items.reduce((m, i) => Math.max(m, i.published || 0), 0);
        return { id: s.id, name: s.name, cat: s.cat, ok: items.length > 0, count: items.length, ageMin: newest ? Math.round((Date.now() - newest) / 60000) : null };
      } catch { return { id: s.id, name: s.name, cat: s.cat, ok: false, count: 0, ageMin: null }; }
    }));
    return NextResponse.json({ ok: true, feeds });
  }

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
