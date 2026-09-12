import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { newsPilotSettings, type NewsPilot } from '@/lib/settings';
import { NEWS_SOURCES, fetchFeed, type NewsItem, type NewsSource } from '@/lib/newsSources';
import { generateNewsArticle } from '@/lib/blogAI';
import { savePost } from '@/lib/blog';
import { sendBlogEmailNow } from '@/lib/blogEmail';
import { logError } from '@/lib/errlog';

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

// Ejecuta un ciclo del piloto. Devuelve un resumen para logs/panel.
export async function runNewsPilot(force = false): Promise<{ ran: boolean; reason?: string; posted?: number; seen?: number; candidate?: string }> {
  const cfg = await newsPilotSettings();
  if (!cfg.enabled && !force) return { ran: false, reason: 'disabled' };

  const { count, lastMs } = await todayStats();
  if (count >= (cfg.maxPerDay || 3)) return { ran: true, reason: 'cap_reached', posted: 0 };
  if (lastMs && Date.now() - lastMs < (cfg.minMinutesBetween || 20) * 60000) return { ran: true, reason: 'too_soon', posted: 0 };

  // Fuentes activas (por toggle y por tema).
  const active = NEWS_SOURCES.filter((s) => cfg.sources[s.id] !== false && topicOn(s.cat, cfg.topics));
  if (!active.length) return { ran: true, reason: 'no_sources', posted: 0 };

  // Descarga feeds en paralelo y junta items frescos e importantes.
  const results = await Promise.all(active.map((s) => fetchFeed(s)));
  const maxAge = (cfg.maxAgeMin || 45) * 60000;
  const fresh = results.flat().filter((it) => Date.now() - it.published <= maxAge && important(it));
  if (!fresh.length) return { ran: true, reason: 'no_fresh', posted: 0, seen: 0 };

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

  // Escribe el artículo con la IA.
  const gen = await generateNewsArticle({ headline: pick.title, summary: pick.summary, sourceName: pick.sourceName, sourceUrl: pick.link, category: pick.cat });
  if (!gen.ok || !gen.article) { await logError('news_pilot_gen', new Error(gen.reason || 'gen_failed')); return { ran: true, reason: 'gen_failed', posted: 0, candidate: pick.title }; }

  const auto = cfg.mode !== 'draft';
  // Publica (auto) o deja borrador. En auto, activa el email inmediato (inglés).
  const saved = await savePost({
    ...gen.article,
    status: auto ? 'published' : 'draft',
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
