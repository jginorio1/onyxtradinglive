// Convertidor mínimo de Markdown a HTML para el blog. El contenido lo escriben
// el admin u Onyx AI (confiable), pero igual escapamos HTML por seguridad y solo
// habilitamos: ## / ### encabezados, listas "- ", **negritas**, *cursiva*,
// enlaces [texto](url) y párrafos. Suficiente para artículos de blog.
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function inline(s: string): string {
  let t = esc(s);
  t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener nofollow">$1</a>');
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, '$1<em>$2</em>');
  return t;
}
export function mdToHtml(md: string): string {
  const lines = String(md || '').replace(/\r/g, '').split('\n');
  const out: string[] = [];
  let inList = false, para: string[] = [];
  const flushPara = () => { if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; } };
  const closeList = () => { if (inList) { out.push('</ul>'); inList = false; } };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { flushPara(); closeList(); continue; }
    const h = line.match(/^(#{2,4})\s+(.*)$/);
    if (h) { flushPara(); closeList(); const n = Math.min(4, h[1].length); out.push(`<h${n}>${inline(h[2])}</h${n}>`); continue; }
    const li = line.match(/^\s*[-*]\s+(.*)$/);
    if (li) { flushPara(); if (!inList) { out.push('<ul>'); inList = true; } out.push(`<li>${inline(li[1])}</li>`); continue; }
    para.push(line.trim());
  }
  flushPara(); closeList();
  return out.join('\n');
}
