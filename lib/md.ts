// Convertidor mínimo de Markdown a HTML para el blog. El contenido lo escriben
// el admin u Onyx AI (confiable), pero igual escapamos HTML por seguridad y solo
// habilitamos: ## / ### encabezados, listas "- ", **negritas**, *cursiva*,
// enlaces [texto](url|/ruta), imágenes ![alt](url), y bloques :::chart / :::figure / :::faq.
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
const attr = (s: string) => esc(String(s || '')).replace(/"/g, '&quot;');

function inline(s: string): string {
  let t = esc(s);
  // Imágenes ![alt](url) — antes que los enlaces, con alt para SEO/accesibilidad.
  t = t.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g,
    (_m, alt, url) => `<figure class="blog-img"><img src="${attr(url)}" alt="${attr(alt)}" loading="lazy" />${alt ? `<figcaption>${esc(alt)}</figcaption>` : ''}</figure>`);
  // Enlaces INTERNOS [texto](/ruta): follow, misma pestaña (clave para el SEO de enlazado interno).
  t = t.replace(/\[([^\]]+)\]\((\/[^\s)]+)\)/g, '<a href="$2" class="blog-ilink">$1</a>');
  // Enlaces EXTERNOS: nueva pestaña + nofollow.
  t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener nofollow">$1</a>');
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, '$1<em>$2</em>');
  return t;
}

// Lee los pares clave:valor de un bloque ::: … :::
function blockFields(lines: string[]): Record<string, string> {
  const cfg: Record<string, string> = {};
  for (const raw of lines) {
    const mm = raw.match(/^\s*([a-zA-Z]+)\s*:\s*(.*)$/); if (!mm) continue;
    cfg[mm[1].toLowerCase()] = mm[2].trim();
  }
  return cfg;
}

// :::chart … ::: → <figure> con <canvas data-onyx-chart='JSON'> (lo dibuja BlogCharts).
function renderChart(lines: string[]): string {
  const cfg: any = { type: 'line', title: '', alt: '', source: '', x: [], y: [] };
  const arr = (v: string) => v.replace(/^\[|\]$/g, '').split(',').map((s) => s.trim()).filter((s) => s !== '');
  for (const raw of lines) {
    const mm = raw.match(/^\s*([a-zA-Z]+)\s*:\s*(.*)$/); if (!mm) continue;
    const k = mm[1].toLowerCase(), v = mm[2].trim();
    if (k === 'type') cfg.type = ['line', 'bar', 'doughnut'].includes(v.toLowerCase()) ? v.toLowerCase() : 'line';
    else if (k === 'title') cfg.title = v;
    else if (k === 'alt') cfg.alt = v;
    else if (k === 'source') cfg.source = v;
    else if (k === 'x' || k === 'labels') cfg.x = arr(v);
    else if (k === 'y' || k === 'data') cfg.y = arr(v).map((n) => Number(n));
  }
  if (!cfg.y.length) return '';
  const cap = [cfg.title, cfg.source].filter(Boolean).join(' · ');
  const json = attr(JSON.stringify(cfg));
  return `<figure class="blog-chart"><div class="blog-chart-canvas"><canvas data-onyx-chart="${json}" role="img" aria-label="${attr(cfg.alt || cfg.title)}"></canvas></div>${cap ? `<figcaption>${esc(cap)}</figcaption>` : ''}</figure>`;
}

// :::figure … ::: → banner on-brand (imagen de contenido generada, sin archivo externo).
// Campos: kicker (etiqueta), title (frase), alt (para accesibilidad).
function renderFigure(lines: string[]): string {
  const c = blockFields(lines);
  const title = c.title || '';
  if (!title) return '';
  const kicker = (c.kicker || c.tag || '').toUpperCase();
  const alt = c.alt || title;
  return `<figure class="blog-banner" role="img" aria-label="${attr(alt)}" style="border-radius:14px;padding:32px 22px;margin:18px 0;background:linear-gradient(135deg,#161a33 0%,#241c48 55%,#341f5e 100%);border:1px solid rgba(255,255,255,.10);overflow:hidden">`
    + (kicker ? `<div style="font-size:11px;font-weight:800;letter-spacing:.14em;color:#b9c0ff;margin-bottom:9px">${esc(kicker)}</div>` : '')
    + `<div style="font-size:20px;font-weight:800;color:#f2f4ff;line-height:1.3;max-width:90%">${esc(title)}</div>`
    + `<div style="margin-top:14px;font-size:12px;font-weight:700;color:#cfd4ff;opacity:.85">◒ Onyx Trading Live</div>`
    + `</figure>`;
}

// :::faq … ::: → acordeón. Cada par se escribe "Q: pregunta" / "A: respuesta".
function renderFaq(lines: string[]): string {
  const pairs = parseFaqLines(lines);
  if (!pairs.length) return '';
  const items = pairs.map((p) =>
    `<details class="blog-faq-item" style="border:1px solid var(--line);border-radius:10px;padding:2px 12px;margin:8px 0;background:var(--card)">`
    + `<summary style="cursor:pointer;font-weight:600;padding:10px 0;list-style:none">${esc(p.q)}</summary>`
    + `<div style="padding:0 0 12px;color:var(--mut,#9aa3b8);line-height:1.6">${inline(p.a)}</div></details>`
  ).join('');
  return `<div class="blog-faq" style="margin:16px 0">${items}</div>`;
}

// Extrae los pares Q/A de las líneas de un bloque :::faq.
function parseFaqLines(lines: string[]): { q: string; a: string }[] {
  const pairs: { q: string; a: string }[] = [];
  let q = '', a = '';
  const push = () => { if (q && a) pairs.push({ q: q.trim(), a: a.trim() }); q = ''; a = ''; };
  for (const raw of lines) {
    const mq = raw.match(/^\s*Q\s*:\s*(.*)$/i);
    const ma = raw.match(/^\s*A\s*:\s*(.*)$/i);
    if (mq) { push(); q = mq[1]; }
    else if (ma) { a = ma[1]; }
    else if (a && raw.trim()) { a += ' ' + raw.trim(); }
  }
  push();
  return pairs;
}

// Extrae TODOS los pares Q/A de un markdown (para el schema FAQPage). Público.
export function parseFaq(md: string): { q: string; a: string }[] {
  const lines = String(md || '').replace(/\r/g, '').split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === ':::faq') {
      const buf: string[] = []; i++;
      while (i < lines.length && lines[i].trim() !== ':::') { buf.push(lines[i]); i++; }
      return parseFaqLines(buf);
    }
  }
  return [];
}

export function mdToHtml(md: string): string {
  const lines = String(md || '').replace(/\r/g, '').split('\n');
  const out: string[] = [];
  let inList = false, para: string[] = [];
  const flushPara = () => { if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; } };
  const closeList = () => { if (inList) { out.push('</ul>'); inList = false; } };
  const readBlock = (start: number): { buf: string[]; end: number } => {
    const buf: string[] = []; let i = start + 1;
    while (i < lines.length && lines[i].trim() !== ':::') { buf.push(lines[i]); i++; }
    return { buf, end: i };
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd();
    const trimmed = line.trim();
    if (trimmed === ':::chart' || trimmed === ':::figure' || trimmed === ':::faq') {
      flushPara(); closeList();
      const { buf, end } = readBlock(i); i = end;
      out.push(trimmed === ':::chart' ? renderChart(buf) : trimmed === ':::figure' ? renderFigure(buf) : renderFaq(buf));
      continue;
    }
    if (!line.trim()) { flushPara(); closeList(); continue; }
    const img = line.trim().match(/^!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)$/);
    if (img) { flushPara(); closeList(); out.push(inline(line.trim())); continue; }
    const h = line.match(/^(#{2,4})\s+(.*)$/);
    if (h) { flushPara(); closeList(); const n = Math.min(4, h[1].length); out.push(`<h${n}>${inline(h[2])}</h${n}>`); continue; }
    const li = line.match(/^\s*[-*]\s+(.*)$/);
    if (li) { flushPara(); if (!inList) { out.push('<ul>'); inList = true; } out.push(`<li>${inline(li[1])}</li>`); continue; }
    para.push(line.trim());
  }
  flushPara(); closeList();
  return out.join('\n');
}
