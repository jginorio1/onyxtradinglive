// Convertidor mínimo de Markdown a HTML para el blog. El contenido lo escriben
// el admin u Onyx AI (confiable), pero igual escapamos HTML por seguridad y solo
// habilitamos: ## / ### encabezados, listas "- ", **negritas**, *cursiva*,
// enlaces [texto](url), imágenes ![alt](url), gráficas :::chart y párrafos.
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
const attr = (s: string) => esc(String(s || '')).replace(/"/g, '&quot;');

function inline(s: string): string {
  let t = esc(s);
  // Imágenes ![alt](url) — antes que los enlaces, con alt para SEO/accesibilidad.
  t = t.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g,
    (_m, alt, url) => `<figure class="blog-img"><img src="${attr(url)}" alt="${attr(alt)}" loading="lazy" />${alt ? `<figcaption>${esc(alt)}</figcaption>` : ''}</figure>`);
  t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener nofollow">$1</a>');
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, '$1<em>$2</em>');
  return t;
}

// Parsea un bloque :::chart … ::: en un <figure> con <canvas data-onyx-chart='JSON'>.
// El componente cliente BlogCharts lo dibuja con Chart.js. Datos siempre ilustrativos.
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

export function mdToHtml(md: string): string {
  const lines = String(md || '').replace(/\r/g, '').split('\n');
  const out: string[] = [];
  let inList = false, para: string[] = [];
  const flushPara = () => { if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; } };
  const closeList = () => { if (inList) { out.push('</ul>'); inList = false; } };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd();
    // Bloque de gráfica :::chart … :::
    if (line.trim() === ':::chart') {
      flushPara(); closeList();
      const buf: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== ':::') { buf.push(lines[i]); i++; }
      out.push(renderChart(buf));
      continue;
    }
    if (!line.trim()) { flushPara(); closeList(); continue; }
    // Imagen sola en su línea → figura de ancho completo.
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
