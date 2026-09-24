// ============================================================
// Analítica de visitantes PROPIA (privacy-first, sin cookies).
//
// Identidad anónima: vid = sha256(IP + navegador + secreto). Es irreversible y
// NO guardamos ni la IP ni el user-agent, solo ese hash. El secreto es estable
// (no rota a diario) para poder distinguir "recurrente vs nuevo" entre días:
//   · nuevo      = su primera visita cae dentro del rango consultado.
//   · recurrente = ya existía antes del rango y ha vuelto dentro de él.
// Recargar o navegar varias páginas NO cuenta como visitante nuevo: es el mismo
// vid, así que los "únicos" quedan deduplicados por persona.
// ============================================================
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const SECRET = process.env.VISITOR_SALT || process.env.CRON_SECRET || 'onyx-visitors-v1';
const ONLINE_MIN = 5;                     // minutos para considerar a alguien "en línea"
const BOT_RE = /(bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|quora|pinterest|vkshare|whatsapp|telegrambot|preview|monitor|lighthouse|headless|python-requests|curl|wget|axios|go-http)/i;

export const looksLikeBot = (ua: string) => !ua || BOT_RE.test(ua);

// Hash anónimo del visitante (estable). Nunca se guarda IP ni user-agent.
export function visitorId(ip: string, ua: string): string {
  return crypto.createHash('sha256').update(`${ip}|${ua}|${SECRET}`).digest('hex').slice(0, 32);
}

// Normaliza el origen del tráfico a un nombre corto (google, instagram, directo…).
export function refName(referrer: string, selfHost: string): string {
  try {
    if (!referrer) return 'directo';
    const h = new URL(referrer).hostname.replace(/^www\./, '').toLowerCase();
    if (!h || h === selfHost.replace(/^www\./, '')) return 'directo';
    if (h.includes('google')) return 'google';
    if (h.includes('bing')) return 'bing';
    if (h.includes('duckduckgo')) return 'duckduckgo';
    if (h.includes('instagram')) return 'instagram';
    if (h.includes('facebook') || h === 'fb.com' || h.includes('l.facebook')) return 'facebook';
    if (h.includes('youtube') || h === 'youtu.be') return 'youtube';
    if (h.includes('tiktok')) return 'tiktok';
    if (h.includes('t.co') || h.includes('twitter') || h === 'x.com') return 'x';
    if (h.includes('t.me') || h.includes('telegram')) return 'telegram';
    if (h.includes('reddit')) return 'reddit';
    if (h.includes('linkedin')) return 'linkedin';
    return h;
  } catch { return 'directo'; }
}

// Registra una visita: alta o actualización del visitante + evento de página.
export async function recordVisit(o: { vid: string; path: string; ref: string; country: string }) {
  const now = new Date().toISOString();
  const country = (o.country || '').slice(0, 2).toUpperCase() || null;
  try {
    const { data: ex } = await supabaseAdmin.from('visitors').select('vid,hits').eq('vid', o.vid).maybeSingle();
    if (ex) {
      await supabaseAdmin.from('visitors').update({ last_seen: now, hits: ((ex as any).hits || 0) + 1, country }).eq('vid', o.vid);
    } else {
      await supabaseAdmin.from('visitors').insert({ vid: o.vid, first_seen: now, last_seen: now, hits: 1, country });
    }
  } catch { /* no rompemos la navegación por un fallo de analítica */ }
  try {
    await supabaseAdmin.from('page_visits').insert({ vid: o.vid, path: (o.path || '/').slice(0, 200), ref: (o.ref || 'directo').slice(0, 60), country, ts: now });
  } catch {}
}

const countSince = async (table: string, col: string, sinceIso: string, extra?: (q: any) => any) => {
  let q = supabaseAdmin.from(table).select('*', { count: 'exact', head: true }).gte(col, sinceIso);
  if (extra) q = extra(q);
  const { count } = await q;
  return count || 0;
};

export type VisitorStats = {
  online: number;
  unique: number; newV: number; returning: number; pageviews: number;
  perVisitor: number;
  series: number[];                         // 24 valores (visitantes únicos por hora, últimas 24h)
  topPages: Array<{ k: string; n: number }>;
  topCountries: Array<{ k: string; n: number }>;
  topRefs: Array<{ k: string; n: number }>;
  feed: Array<{ country: string; path: string; ago: number }>;   // ago = segundos
  rangeDays: number;
};

// Estadísticas agregadas para el panel. rangeDays: 1 = hoy(24h), 7, 30.
export async function visitorStats(rangeDays = 1): Promise<VisitorStats> {
  const now = Date.now();
  const startMs = now - rangeDays * 864e5;
  const startIso = new Date(startMs).toISOString();
  const onlineIso = new Date(now - ONLINE_MIN * 60000).toISOString();
  const day1Iso = new Date(now - 864e5).toISOString();

  const [online, unique, newV, pageviews] = await Promise.all([
    countSince('visitors', 'last_seen', onlineIso),
    countSince('visitors', 'last_seen', startIso),
    countSince('visitors', 'last_seen', startIso, (q) => q.gte('first_seen', startIso)),
    countSince('page_visits', 'ts', startIso),
  ]);
  const returning = Math.max(0, unique - newV);

  // Serie por hora (últimas 24h): visitantes ÚNICOS por hora.
  const series = new Array(24).fill(0);
  try {
    const buckets: Array<Set<string>> = Array.from({ length: 24 }, () => new Set());
    const { data } = await supabaseAdmin.from('page_visits').select('vid,ts').gte('ts', day1Iso).order('ts', { ascending: false }).limit(20000);
    for (const r of (data || []) as any[]) {
      const h = 23 - Math.floor((now - new Date(r.ts).getTime()) / 36e5);
      if (h >= 0 && h < 24) buckets[h].add(r.vid);
    }
    for (let i = 0; i < 24; i++) series[i] = buckets[i].size;
  } catch {}

  // Tops del rango + feed reciente (una sola lectura acotada).
  const topPages: Record<string, number> = {}, topCountries: Record<string, number> = {}, topRefs: Record<string, number> = {};
  const feed: VisitorStats['feed'] = [];
  try {
    const { data } = await supabaseAdmin.from('page_visits').select('path,country,ref,ts').gte('ts', startIso).order('ts', { ascending: false }).limit(20000);
    const rows = (data || []) as any[];
    for (const r of rows) {
      topPages[r.path || '/'] = (topPages[r.path || '/'] || 0) + 1;
      if (r.country) topCountries[r.country] = (topCountries[r.country] || 0) + 1;
      topRefs[r.ref || 'directo'] = (topRefs[r.ref || 'directo'] || 0) + 1;
    }
    for (const r of rows.slice(0, 12)) feed.push({ country: r.country || '', path: r.path || '/', ago: Math.max(0, Math.round((now - new Date(r.ts).getTime()) / 1000)) });
  } catch {}

  const top = (m: Record<string, number>) => Object.entries(m).map(([k, n]) => ({ k, n })).sort((a, b) => b.n - a.n).slice(0, 5);

  return {
    online, unique, newV, returning, pageviews,
    perVisitor: unique ? Math.round((pageviews / unique) * 10) / 10 : 0,
    series,
    topPages: top(topPages), topCountries: top(topCountries), topRefs: top(topRefs),
    feed, rangeDays,
  };
}
