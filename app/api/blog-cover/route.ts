import { ImageResponse } from 'next/og';
import { createElement as h } from 'react';

export const runtime = 'edge';

// Portada ON-BRAND generada al vuelo como PNG (1200×630). Se usa cuando el
// artículo no tiene imagen subida. IMPORTANTE: se genera en PNG (no SVG) porque
// Facebook/Twitter/LinkedIn NO muestran SVG en la vista previa al compartir.
const PALETTES = [
  ['#161a33', '#241c48', '#3a1f5e'],
  ['#0f1b2e', '#123047', '#0e4b52'],
  ['#1e1430', '#3a1836', '#5a1f3e'],
  ['#121a2c', '#1c2a4a', '#26407a'],
  ['#101f1a', '#123a2c', '#0f4d3a'],
];
function hash(s: string): number { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
const esc = (s: string) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function fallbackSvg(title: string, kicker: string, pal: string[]) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${pal[0]}"/><stop offset="1" stop-color="${pal[2]}"/></linearGradient></defs><rect width="1200" height="630" fill="url(#g)"/>${kicker ? `<text x="80" y="150" font-family="Arial" font-size="26" font-weight="800" letter-spacing="6" fill="#b9c0ff">${esc(kicker)}</text>` : ''}<text x="80" y="330" font-family="Arial" font-size="58" font-weight="800" fill="#f2f4ff">${esc(title.slice(0, 40))}</text><text x="80" y="560" font-family="Arial" font-size="28" font-weight="700" fill="#cfd4ff">Onyx Trading Live</text></svg>`;
  return new Response(svg, { headers: { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': 'public, max-age=86400' } });
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  const title = (u.searchParams.get('t') || 'Onyx Trading Live').slice(0, 110);
  const kicker = (u.searchParams.get('k') || '').slice(0, 30).toUpperCase();
  const pal = PALETTES[hash(u.searchParams.get('id') || title) % PALETTES.length];

  try {
    // Fuente para el renderizado (Satori necesita una fuente incrustada).
    const font = await fetch('https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.8/files/inter-latin-800-normal.woff').then((r) => {
      if (!r.ok) throw new Error('font'); return r.arrayBuffer();
    });

    const tree = h('div', {
      style: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        padding: '70px 80px', backgroundImage: `linear-gradient(135deg, ${pal[0]} 0%, ${pal[1]} 55%, ${pal[2]} 100%)`, fontFamily: 'Inter' },
    }, [
      kicker ? h('div', { key: 'k', style: { display: 'flex', fontSize: 28, fontWeight: 800, letterSpacing: 6, color: '#b9c0ff' } }, kicker) : h('div', { key: 'k', style: { display: 'flex' } }),
      h('div', { key: 't', style: { display: 'flex', fontSize: 64, fontWeight: 800, color: '#f2f4ff', lineHeight: 1.18, maxWidth: 1000 } }, title),
      h('div', { key: 'b', style: { display: 'flex', alignItems: 'center', fontSize: 30, fontWeight: 800, color: '#cfd4ff' } }, [
        h('div', { key: 'r', style: { width: 42, height: 42, borderRadius: 21, border: '9px solid #7c8cff', marginRight: 18, display: 'flex' } }),
        'Onyx Trading Live',
      ]),
    ]);

    return new ImageResponse(tree as any, {
      width: 1200, height: 630,
      fonts: [{ name: 'Inter', data: font, weight: 800, style: 'normal' }],
      headers: { 'cache-control': 'public, max-age=86400, s-maxage=604800' },
    });
  } catch {
    return fallbackSvg(title, kicker, pal);   // si falla la fuente/render, SVG (mínimo se ve en la web)
  }
}
