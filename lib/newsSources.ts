// ============================================================
// Fuentes de noticias económicas / de mercados para el piloto automático.
// Todas son feeds RSS/Atom públicos y rápidos. Cada fuente tiene:
//  · tier: 'primary' (bancos centrales/datos oficiales — lo más autorizado y veloz)
//          'wire'    (medios de mercado)
//  · cat:  familia de tema para el filtro (macro | markets | earnings | crypto)
// Si un feed deja de responder, simplemente se ignora (no rompe el piloto).
// ============================================================

export type NewsSource = { id: string; name: string; url: string; tier: 'primary' | 'wire'; cat: 'macro' | 'markets' | 'earnings' | 'crypto' };

export const NEWS_SOURCES: NewsSource[] = [
  // Primarias (oficiales) — máxima autoridad, muy rápidas.
  { id: 'fed', name: 'Federal Reserve', url: 'https://www.federalreserve.gov/feeds/press_all.xml', tier: 'primary', cat: 'macro' },
  { id: 'ecb', name: 'ECB', url: 'https://www.ecb.europa.eu/rss/press.html', tier: 'primary', cat: 'macro' },
  { id: 'bls', name: 'US BLS', url: 'https://www.bls.gov/feed/bls_latest.rss', tier: 'primary', cat: 'macro' },
  // Wires de mercado.
  { id: 'cnbc_econ', name: 'CNBC Economy', url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258', tier: 'wire', cat: 'macro' },
  { id: 'cnbc_mkts', name: 'CNBC Markets', url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=15839135', tier: 'wire', cat: 'markets' },
  { id: 'cnbc_fin', name: 'CNBC Finance', url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664', tier: 'wire', cat: 'markets' },
  { id: 'mw_top', name: 'MarketWatch Top', url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories', tier: 'wire', cat: 'markets' },
  { id: 'mw_rt', name: 'MarketWatch Real-time', url: 'https://feeds.content.dowjones.io/public/rss/mw_realtimeheadlines', tier: 'wire', cat: 'markets' },
  { id: 'investing_news', name: 'Investing.com News', url: 'https://www.investing.com/rss/news.rss', tier: 'wire', cat: 'markets' },
  { id: 'investing_econ', name: 'Investing.com Economy', url: 'https://www.investing.com/rss/news_25.rss', tier: 'wire', cat: 'macro' },
  { id: 'fxstreet', name: 'FXStreet', url: 'https://www.fxstreet.com/rss/news', tier: 'wire', cat: 'macro' },
  { id: 'yahoo', name: 'Yahoo Finance', url: 'https://finance.yahoo.com/news/rssindex', tier: 'wire', cat: 'markets' },
  { id: 'cnbc_earn', name: 'CNBC Earnings', url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=15839250', tier: 'wire', cat: 'earnings' },
  { id: 'coindesk', name: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', tier: 'wire', cat: 'crypto' },
  { id: 'cointelegraph', name: 'Cointelegraph', url: 'https://cointelegraph.com/rss', tier: 'wire', cat: 'crypto' },
];

// Combina las fuentes de por defecto con las que el dueño añadió a mano (custom_sources).
// Las custom entran como tier 'wire' y con id prefijado 'x_' para no chocar con las de casa.
export function mergedSources(custom?: { id: string; name: string; url: string; cat: string }[]): NewsSource[] {
  const cats = new Set(['macro', 'markets', 'earnings', 'crypto']);
  const extra: NewsSource[] = (custom || [])
    .filter((c) => c && c.url && /^https?:\/\//i.test(c.url))
    .map((c) => ({
      id: c.id || ('x_' + Math.random().toString(36).slice(2, 8)),
      name: (c.name || c.url).slice(0, 60),
      url: c.url.trim(),
      tier: 'wire' as const,
      cat: (cats.has(c.cat) ? c.cat : 'markets') as NewsSource['cat'],
    }));
  return [...NEWS_SOURCES, ...extra];
}

export type NewsItem = { title: string; link: string; summary: string; published: number; sourceId: string; sourceName: string; cat: NewsSource['cat']; tier: NewsSource['tier'] };

// Entidades HTML con nombre más comunes en titulares financieros.
const NAMED_ENT: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ndash: '\u2013', mdash: '\u2014', hellip: '\u2026',
  lsquo: '\u2018', rsquo: '\u2019', ldquo: '\u201C', rdquo: '\u201D',
  laquo: '\u00AB', raquo: '\u00BB', trade: '\u2122', reg: '\u00AE', copy: '\u00A9',
  deg: '\u00B0', euro: '\u20AC', pound: '\u00A3', cent: '\u00A2', middot: '\u00B7',
};
// Decodifica entidades numéricas (&#8217; y &#x2019;) y con nombre (&apos;, &rsquo;…).
function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => { try { return String.fromCodePoint(parseInt(h, 16)); } catch { return _; } })
    .replace(/&#(\d+);/g, (_, d) => { try { return String.fromCodePoint(parseInt(d, 10)); } catch { return _; } })
    .replace(/&([a-zA-Z][a-zA-Z0-9]*);/g, (m, n) => NAMED_ENT[n] ?? NAMED_ENT[String(n).toLowerCase()] ?? m);
}
// Repara "mojibake": texto UTF-8 que en algún punto se leyó como Latin-1 (â€˜, â€™, Ã©…).
function fixMojibake(s: string): string {
  if (!/[\u00C2\u00C3\u00E2]/.test(s)) return s;
  try {
    // Re-interpreta los bytes como UTF-8. Si empeora (aparece \uFFFD), descártalo.
    const bytes = Uint8Array.from([...s].map((c) => c.charCodeAt(0) & 0xff));
    const fixed = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    return fixed.includes('\uFFFD') ? s : fixed;
  } catch { return s; }
}
const strip = (s: string) => fixMojibake(decodeEntities(String(s || '')
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/<[^>]+>/g, ' ')))
  .replace(/\s+/g, ' ').trim();

const tag = (block: string, name: string): string => {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? strip(m[1]) : '';
};
const attrLink = (block: string): string => {
  // Atom: <link href="..."/>
  const m = block.match(/<link[^>]*href="([^"]+)"/i);
  return m ? m[1] : '';
};

// Parser mínimo de RSS 2.0 y Atom (sin dependencias). Devuelve los items del feed.
export function parseFeed(xml: string, src: NewsSource): NewsItem[] {
  if (!xml) return [];
  const items: NewsItem[] = [];
  const isAtom = /<feed[\s>]/i.test(xml) && /<entry[\s>]/i.test(xml);
  const blocks = xml.split(isAtom ? /<entry[\s>]/i : /<item[\s>]/i).slice(1);
  for (const raw of blocks.slice(0, 30)) {
    const block = raw.split(isAtom ? /<\/entry>/i : /<\/item>/i)[0] || raw;
    const title = tag(block, 'title');
    let link = tag(block, 'link') || attrLink(block) || tag(block, 'guid');
    const summary = tag(block, 'description') || tag(block, 'summary') || tag(block, 'content');
    const dateStr = tag(block, 'pubDate') || tag(block, 'updated') || tag(block, 'published') || tag(block, 'dc:date');
    const published = dateStr ? Date.parse(dateStr) : NaN;
    if (!title || !link) continue;
    items.push({
      title: title.slice(0, 300), link: link.trim().slice(0, 500), summary: summary.slice(0, 800),
      published: Number.isFinite(published) ? published : Date.now(),
      sourceId: src.id, sourceName: src.name, cat: src.cat, tier: src.tier,
    });
  }
  return items;
}

// Descarga y parsea un feed con timeout corto (para no colgar el cron).
export async function fetchFeed(src: NewsSource, timeoutMs = 8000): Promise<NewsItem[]> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    // EN VIVO SIEMPRE: sin esto, Next.js/Vercel guardan la respuesta del feed en su
    // Data Cache (persiste ENTRE despliegues), así el cron leía siempre la MISMA foto
    // vieja de titulares — se congelaban y con el tiempo pasaban de la ventana de
    // frescura -> 'no_fresh' permanente. 'no-store' salta ese Data Cache; el parametro
    // anti-cache rompe cualquier CDN/edge intermedia para traer los titulares del momento.
    const bust = (src.url.includes('?') ? '&' : '?') + '_onyx=' + Date.now();
    const r = await fetch(src.url + bust, {
      signal: ctrl.signal,
      cache: 'no-store',
      headers: { 'user-agent': 'OnyxNewsBot/1.0 (+https://www.onyxtradinglive.com)', 'cache-control': 'no-cache' },
    });
    if (!r.ok) return [];
    // Decodificamos con el charset REAL del feed. Muchos feeds son UTF-8 pero, si se
    // leen como Latin-1, salen los símbolos rotos (â€˜, â€™). Detectamos el encoding
    // de la declaración XML y, por defecto, usamos UTF-8.
    const buf = await r.arrayBuffer();
    let enc = 'utf-8';
    try {
      const head = new TextDecoder('latin1').decode(new Uint8Array(buf.slice(0, 300)));
      const m = head.match(/encoding=["']([\w-]+)["']/i);
      if (m) enc = m[1].toLowerCase();
    } catch {}
    let xml = '';
    try { xml = new TextDecoder(enc as any).decode(buf); }
    catch { xml = new TextDecoder('utf-8').decode(buf); }
    return parseFeed(xml, src);
  } catch { return []; }
  finally { clearTimeout(t); }
}
