// Generador de reportes imprimibles (→ "Guardar como PDF") con la marca Onyx.
// Lo usan Ingresos, Usuarios, Embajadores, etc. para verse todos igual.

const esc = (s: any) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as any)[c]);

export type ReportTable = { title?: string; head: string[]; rows: (string | number)[][]; alignRight?: number[] };

export function reportPage(opts: {
  lang?: string; title: string; from: string; to: string;
  kpis?: { label: string; value: string; sub?: string }[];
  tables?: ReportTable[];
}): string {
  const es = opts.lang !== 'en';
  const genLabel = es ? 'Generado' : 'Generated';
  const rangeLabel = es ? 'Período' : 'Period';
  const printLabel = es ? 'Imprimir / Guardar PDF' : 'Print / Save PDF';

  const kpis = (opts.kpis || []).map((k) =>
    `<div class="kpi"><div class="kl">${esc(k.label)}</div><div class="kv">${esc(k.value)}</div>${k.sub ? `<div class="ks">${esc(k.sub)}</div>` : ''}</div>`).join('');

  const tables = (opts.tables || []).map((t) => {
    const ar = new Set(t.alignRight || []);
    const head = t.head.map((h, i) => `<th class="${ar.has(i) ? 'r' : ''}">${esc(h)}</th>`).join('');
    const rows = t.rows.length
      ? t.rows.map((r) => `<tr>${r.map((c, i) => `<td class="${ar.has(i) ? 'r' : ''}">${esc(c)}</td>`).join('')}</tr>`).join('')
      : `<tr><td colspan="${t.head.length}" class="muted">—</td></tr>`;
    return `${t.title ? `<h2>${esc(t.title)}</h2>` : ''}<table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`;
  }).join('');

  return `<!doctype html><html lang="${es ? 'es' : 'en'}"><head><meta charset="utf-8"><title>${esc(opts.title)} · Onyx Trading Live</title>
<style>
  *{box-sizing:border-box;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif}
  body{margin:0;padding:32px;color:#101322;background:#fff}
  h1{font-size:22px;margin:0 0 2px} .muted{color:#6b7280;font-size:13px}
  .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #7c8cff;padding-bottom:14px;margin-bottom:20px}
  .brand{font-weight:800;color:#7c8cff;font-size:16px}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:22px}
  .kpi{border:1px solid #e5e7eb;border-radius:10px;padding:12px}
  .kl{font-size:12px;color:#6b7280} .kv{font-size:22px;font-weight:700;margin-top:2px} .ks{font-size:11px;color:#16a34a;margin-top:2px}
  h2{font-size:14px;margin:18px 0 8px}
  table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:8px} th,td{text-align:left;padding:7px 6px;border-bottom:1px solid #eee} th{color:#6b7280;font-weight:600}
  td.r,th.r{text-align:right}
  .btn{display:inline-block;margin-top:24px;padding:9px 16px;background:#7c8cff;color:#fff;border-radius:8px;text-decoration:none;font-size:13px}
  @media print{.btn{display:none}}
</style></head><body>
  <div class="head">
    <div><h1>${esc(opts.title)}</h1><div class="muted">${rangeLabel}: ${esc(opts.from.slice(0, 10))} → ${esc(opts.to.slice(0, 10))} · ${genLabel}: ${esc(new Date().toLocaleString(es ? 'es' : 'en'))}</div></div>
    <div class="brand">Onyx Trading Live</div>
  </div>
  ${kpis ? `<div class="grid">${kpis}</div>` : ''}
  ${tables}
  <a class="btn" href="#" onclick="window.print();return false">${printLabel}</a>
  <script>setTimeout(function(){window.print()},400)</script>
</body></html>`;
}

// CSV simple a partir de filas.
export function toCsvRows(rows: (string | number)[][]): string {
  return rows.map((r) => r.map((c) => {
    const s = String(c ?? '');
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(',')).join('\n');
}
