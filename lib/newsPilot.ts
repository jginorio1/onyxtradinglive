import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { newsPilotSettings, blogKeywordsSettings, type NewsPilot } from '@/lib/settings';
import { NEWS_SOURCES, mergedSources, fetchFeed, type NewsItem, type NewsSource } from '@/lib/newsSources';
import { generateNewsArticle } from '@/lib/blogAI';
import { gscOpportunities } from '@/lib/seoSearchConsole';
import { savePost } from '@/lib/blog';
import { sendBlogEmailNow } from '@/lib/blogEmail';
import { logError } from '@/lib/errlog';

// SEO ligero para noticias: elige UNA frase clave de marca (de la lista manual del
// blog o de las oportunidades reales de Search Console) para tejerla SOLO si encaja.
// El foco principal sigue siendo el evento; esto es un extra opcional.
async function pickSeoKeyword(): Promise<string | undefined> {
  try {
    const s = await blogKeywordsSettings();
    if (!s.enabled) return undefined;
    if (s.useGsc) {
      const opps = await gscOpportunities(90, 3);
      if (opps[0]?.query) return opps[0].query;
    }
    const first = (s.es || [])[0] || (s.en || [])[0];
    return first || undefined;
  } catch { return undefined; }
}

// ============================================================
// Piloto de NOTICIAS: vigila fuentes financieras, detecta lo importante y (en
// modo auto) escribe + publica + envía por email al instante. Con tope diario,
// separación mínima y anti-duplicados (tabla news_seen).
// ============================================================

// Palabras clave por familia de tema. Para medios (wire) exigimos que el titular
// contenga alguna; las fuentes primarias (Fed/BLS/ECB) se consideran importantes
// por sí mismas.
const KW: Record<string, string[]> = {
  macro: ['fed', 'federal reserve', 'fomc', 'rate cut', 'rate hike', 'interest rate', 'rates', 'cpi', 'inflation', 'pce', 'gdp', 'jobs', 'payroll', 'nonfarm', 'non-farm', 'unemployment', 'jobless', 'ecb', 'boe', 'boj', 'recession', 'tariff', 'powell', 'treasury', 'yields', 'central bank'],
  markets: ['s&p', 'nasdaq', 'dow', 'stocks', 'sell-off', 'selloff', 'rally', 'wall street', 'futures', 'vix', 'oil', 'crude', 'gold', 'dollar', 'bond', 'plunge', 'surge', 'record high'],
  earnings: ['earnings', 'revenue', 'profit', 'guidance', 'quarterly results', 'beats estimates', 'misses estimates', 'results'],
  crypto: ['bitcoin', 'btc', 'ethereum', 'eth', 'crypto', 'stablecoin', 'binance', 'coinbase', 'etf approval', 'spot etf'],
};

function hashOf(s: string): string {
  let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return 'n' + (h >>> 0).toString(36);
}
const norm = (s: string) => String(s || '').toLowerCase();

// Familia de tema activa según los toggles del dueño.
function topicOn(cat: NewsSource['cat'], t: NewsPilot['topics']): boolean {
  return (cat === 'macro' && t.macro) || (cat === 'markets' && t.markets) || (cat === 'earnings' && t.earnings) || (cat === 'crypto' && t.crypto);
}

// Puntúa la importancia de un item. Fuente primaria pesa mucho; cada keyword suma.
function score(item: NewsItem): number {
  const title = norm(item.title);
  let s = item.tier === 'primary' ? 100 : 0;
  for (const cat of Object.keys(KW)) for (const k of KW[cat]) if (title.includes(k)) s += 6;
  return s;
}
// ¿Es "importante"? Primaria siempre; wire solo si engancha alguna keyword.
function important(item: NewsItem): boolean {
  if (item.tier === 'primary') return true;
  const title = norm(item.title);
  return Object.values(KW).some((arr) => arr.some((k) => title.includes(k)));
}

// Cuántos artículos del piloto se han publicado HOY (UTC) y cuándo fue el último.
async function todayStats(): Promise<{ count: number; lastMs: number }> {
  try {
    const since = new Date(); since.setUTCHours(0, 0, 0, 0);
    const { data } = await supabaseAdmin.from('news_seen').select('created_at').eq('posted', true).gte('created_at', since.toISOString()).order('created_at', { ascending: false });
    const rows = data || [];
    return { count: rows.length, lastMs: rows[0] ? new Date((rows[0] as any).created_at).getTime() : 0 };
  } catch { return { count: 0, lastMs: 0 }; }
}

export type PilotResult = { ran: boolean; reason?: string; posted?: number; seen?: number; candidate?: string; feeds?: number; feedsOk?: number; fetched?: number; important?: number };

// Envoltorio público: corre el ciclo y DEJA CONSTANCIA de la última corrida
// (hora + motivo + si publicó) para que el panel muestre si el cron está vivo.
export async function runNewsPilot(force = false, via: 'cron' | 'test' = 'cron'): Promise<PilotResult> {
  let res: PilotResult;
  try { res = await runCycle(force); }
  catch (e: any) { res = { ran: false, reason: 'error: ' + (e?.message || 'error') }; }
  const now = Date.now();
  try {
    const { saveSetting, getSetting } = await import('@/lib/settings');
    await saveSetting('news_pilot_last', { at: new Date(now).toISOString(), via, reason: res.reason || '', posted: res.posted || 0, candidate: res.candidate || '' });
    // Contador de LATIDOS del cron: guardamos la marca de cada corrida automática
    // (via='cron') de las últimas 3 h. Así el panel puede decir cuántas veces disparó
    // Vercel de verdad (esperado ~20/h con */3) y saber si el cron está vivo o no.
    if (via === 'cron') {
      const prev = await getSetting<{ hits: number[] }>('news_pilot_cron', { hits: [] });
      const hits = [...(prev.hits || []), now].filter((t) => now - t <= 3 * 3600 * 1000).slice(-240);
      await saveSetting('news_pilot_cron', { hits });
    }
  } catch {}
  return res;
}

// Ejecuta un ciclo del piloto. Devuelve un resumen para logs/panel.
async function runCycle(force = false): Promise<PilotResult> {
  const cfg = await newsPilotSettings();
  if (!cfg.enabled && !force) return { ran: false, reason: 'disabled' };

  const { count, lastMs } = await todayStats();
  if (count >= (cfg.maxPerDay || 3)) return { ran: true, reason: 'cap_reached', posted: 0 };
  if (lastMs && Date.now() - lastMs < (cfg.minMinutesBetween || 20) * 60000) return { ran: true, reason: 'too_soon', posted: 0 };

  // Fuentes activas (por toggle y por tema). Incluye las custom del dueño.
  const all = mergedSources(cfg.custom_sources);
  const active = all.filter((s) => cfg.sources[s.id] !== false && topicOn(s.cat, cfg.topics));
  if (!active.length) return { ran: true, reason: 'no_sources', posted: 0 };

  // Descarga feeds en paralelo y junta items frescos e importantes.
  const results = await Promise.all(active.map((s) => fetchFeed(s)));
  // Ventana de frescura. Piso de 48 h: los fines de semana los feeds casi no
  // publican, así que en lunes la noticia más reciente puede tener 2-3 días. Con
  // anti-duplicados (news_seen) + tope diario + separación mínima, una ventana amplia
  // NO satura; solo garantiza que SIEMPRE haya candidatas. El orden por importancia
  // y luego por frescura (más abajo) hace que se publiquen las MEJORES y más nuevas
  // primero. (Antes el default de 45 min descartaba todo y solo publicaba con Test.)
  const maxAge = Math.max(cfg.maxAgeMin || 2880, 2880) * 60000;
  const flat = results.flat();
  // Diagnóstico (se ve en la respuesta del cron): cuántos feeds respondieron con
  // items, cuántos items en total, cuántos importantes y cuántos frescos. Así
  // sabemos si el problema es que las fuentes vienen vacías (bloqueadas) o el filtro.
  const feedsOk = results.filter((r) => r.length > 0).length;
  const importantCount = flat.filter((it) => important(it)).length;
  const diag = { feeds: active.length, feedsOk, fetched: flat.length, important: importantCount };
  const fresh = flat.filter((it) => Date.now() - it.published <= maxAge && important(it));
  if (!fresh.length) return { ran: true, reason: 'no_fresh', posted: 0, seen: 0, ...diag };

  // Ordena por importancia y frescura.
  fresh.sort((a, b) => (score(b) - score(a)) || (b.published - a.published));

  // Salta los ya vistos (anti-duplicados). Toma el primero nuevo.
  let pick: NewsItem | null = null; let pickHash = '';
  for (const it of fresh.slice(0, 25)) {
    const h = hashOf(norm(it.link) || norm(it.title));
    const { data: seen } = await supabaseAdmin.from('news_seen').select('hash').eq('hash', h).maybeSingle();
    if (seen) continue;
    // Registra como visto de inmediato (aunque no lo publiquemos) para no reevaluarlo.
    try { await supabaseAdmin.from('news_seen').insert({ hash: h, source: it.sourceId, title: it.title.slice(0, 300), url: it.link, posted: false }); } catch {}
    pick = it; pickHash = h; break;
  }
  if (!pick) return { ran: true, reason: 'all_seen', posted: 0 };

  // SEO ligero (opcional): una keyword de marca para tejer solo si encaja.
  const keyword = cfg.seo ? await pickSeoKeyword() : undefined;
  // Escribe el artículo con la IA.
  const gen = await generateNewsArticle({ headline: pick.title, summary: pick.summary, sourceName: pick.sourceName, sourceUrl: pick.link, category: pick.cat, keyword });
  if (!gen.ok || !gen.article) {
    // IMPORTANTE: si la IA falla (429/timeout transitorio), LIBERAMOS la noticia
    // (borramos el registro "visto") para que el siguiente ciclo del cron la
    // reintente y llegue a publicarse sola. Antes se quedaba "quemada" para siempre.
    try { await supabaseAdmin.from('news_seen').delete().eq('hash', pickHash); } catch {}
    await logError('news_pilot_gen', new Error(gen.reason || 'gen_failed'));
    return { ran: true, reason: 'gen_failed', posted: 0, candidate: pick.title };
  }

  const auto = cfg.mode !== 'draft';
  // Publica (auto) o deja borrador. En auto, activa el email inmediato (inglés).
  const saved = await savePost({
    ...gen.article,
    status: auto ? 'published' : 'draft', is_news: true,
    email_enabled: auto, email_when: 'now', email_segment: cfg.emailSegment || 'all',
  });

  // Marca el registro como publicado (para tope diario y separación).
  try { await supabaseAdmin.from('news_seen').update({ posted: auto, post_id: saved.id }).eq('hash', pickHash); } catch {}

  // Envío por email inmediato solo en modo auto.
  if (auto) {
    try {
      const { data: post } = await supabaseAdmin.from('blog_posts').select('*').eq('id', saved.id).maybeSingle();
      if (post) await sendBlogEmailNow(post, cfg.emailSegment || 'all');
    } catch (e) { await logError('news_pilot_email', e); }
  }

  return { ran: true, reason: auto ? 'posted' : 'drafted', posted: auto ? 1 : 0, candidate: pick.title };
}
