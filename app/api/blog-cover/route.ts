import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Portada ON-BRAND generada al vuelo (SVG). Degradado Onyx + etiqueta + título +
// marca. Coste cero, siempre coherente. Se usa cuando el artículo no tiene una
// imagen subida. Tamaño 1200×630 (proporción social/OG).
const esc = (s: string) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Paletas de degradado; se elige una de forma determinista por el id/tema.
const PALETTES = [
  ['#161a33', '#241c48', '#3a1f5e'],   // morado
  ['#0f1b2e', '#123047', '#0e4b52'],   // azul-teal
  ['#1e1430', '#3a1836', '#5a1f3e'],   // vino
  ['#121a2c', '#1c2a4a', '#26407a'],   // azul
  ['#101f1a', '#123a2c', '#0f4d3a'],   // verde
];
function hash(s: string): number { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }

// Parte el título en líneas (aprox. por nº de caracteres) para el SVG.
function wrap(text: string, perLine = 22, maxLines = 3): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = []; let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > perLine && cur) { lines.push(cur); cur = w; }
    else cur = (cur + ' ' + w).trim();
    if (lines.length >= maxLines) break;
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  if (lines.length === maxLines) { const last = lines[maxLines - 1]; if (words.join(' ').length > lines.join(' ').length) lines[maxLines - 1] = last.replace(/\s+\S*$/, '') + '…'; }
  return lines;
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  const title = (u.searchParams.get('t') || 'Onyx Trading Live').slice(0, 100);
  const kicker = (u.searchParams.get('k') || '').slice(0, 30).toUpperCase();
  const seed = u.searchParams.get('id') || title;
  const pal = PALETTES[hash(seed) % PALETTES.length];
  const lines = wrap(title, 22, 3);
  const startY = 300 - (lines.length - 1) * 34;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${pal[0]}"/><stop offset="0.55" stop-color="${pal[1]}"/><stop offset="1" stop-color="${pal[2]}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.8" cy="0.2" r="0.7"><stop offset="0" stop-color="#7c8cff" stop-opacity="0.22"/><stop offset="1" stop-color="#7c8cff" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <circle cx="1050" cy="120" r="4" fill="#7c8cff" opacity="0.7"/>
  ${kicker ? `<text x="80" y="150" font-family="Arial,Helvetica,sans-serif" font-size="26" font-weight="800" letter-spacing="6" fill="#b9c0ff">${esc(kicker)}</text>` : ''}
  ${lines.map((ln, i) => `<text x="80" y="${startY + i * 72}" font-family="Arial,Helvetica,sans-serif" font-size="60" font-weight="800" fill="#f2f4ff">${esc(ln)}</text>`).join('\n  ')}
  <g transform="translate(80,560)">
    <circle cx="16" cy="-6" r="16" fill="#7c8cff"/><path d="M8 -6 a8 8 0 0 1 16 0 z" fill="#0b0f1e"/>
    <text x="44" y="0" font-family="Arial,Helvetica,sans-serif" font-size="28" font-weight="700" fill="#cfd4ff">Onyx Trading Live</text>
  </g>
</svg>`;

  return new NextResponse(svg, {
    headers: { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': 'public, max-age=86400, s-maxage=604800' },
  });
}
