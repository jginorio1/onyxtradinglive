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

export type NewsItem = { title: string; link: string; summary: string; published: number; sourceId: string; sourceName: string; cat: NewsSource['cat']; tier: NewsSource['tier'] };

const strip = (s: string) => String(s || '')
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
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
    const r = await fetch(src.url, { signal: ctrl.signal, headers: { 'user-agent': 'OnyxNewsBot/1.0 (+https://www.onyxtradinglive.com)' } });
    if (!r.ok) return [];
    const xml = await r.text();
    return parseFeed(xml, src);
  } catch { return []; }
  finally { clearTimeout(t); }
}
