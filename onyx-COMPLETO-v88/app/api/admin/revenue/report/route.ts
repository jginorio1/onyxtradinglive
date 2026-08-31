import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { computeRevenue } from '@/lib/revenue';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function defaultRange(): [number, number] {
  const now = new Date();
  return [new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).getTime(), Date.now()];
}
function parseRange(sp: URLSearchParams): [number, number] {
  const f = sp.get('from'), t = sp.get('to');
  if (f && t) {
    const fm = new Date(f + 'T00:00:00Z').getTime(), tm = new Date(t + 'T23:59:59Z').getTime();
    if (!isNaN(fm) && !isNaN(tm) && fm < tm) return [fm, tm];
  }
  return defaultRange();
}

// GET · reporte de ventas listo para imprimir → "Guardar como PDF".
export async function GET(req: Request) {
  const { ok } = await requirePerm('planes', 'view');
  if (!ok) return new NextResponse('No autorizado', { status: 403 });

  const sp = new URL(req.url).searchParams;
  const es = sp.get('lang') !== 'en';
  const [from, to] = parseRange(sp);
  const d = await computeRevenue(from, to, es);
  const cur = (d.currency || 'usd').toUpperCase();
  const m = (n: number) => new Intl.NumberFormat(es ? 'es' : 'en', { style: 'currency', currency: cur }).format(n || 0);
  const T = es
    ? { title: 'Reporte de ventas', range: 'Período', gen: 'Generado', mrr: 'MRR', arr: 'ARR proyectado', subs: 'Suscripciones activas', arpu: 'ARPU', coll: 'Cobrado en el período', prev: 'vs período anterior', newS: 'Nuevas', canc: 'Canceladas', fail: 'Pagos fallidos', churn: 'Churn', byPlan: 'Suscripciones por plan', plan: 'Plan', mov: 'Movimientos de MRR', movNew: 'Nuevo', movLost: 'Perdido', movNet: 'Neto', months: 'Ingresos por mes', month: 'Mes', collected: 'Cobrado', print: 'Imprimir / Guardar PDF' }
    : { title: 'Sales report', range: 'Period', gen: 'Generated', mrr: 'MRR', arr: 'Projected ARR', subs: 'Active subscriptions', arpu: 'ARPU', coll: 'Collected in period', prev: 'vs previous period', newS: 'New', canc: 'Canceled', fail: 'Failed payments', churn: 'Churn', byPlan: 'Subscriptions by plan', plan: 'Plan', mov: 'MRR movements', movNew: 'New', movLost: 'Lost', movNet: 'Net', months: 'Revenue by month', month: 'Month', collected: 'Collected', print: 'Print / Save PDF' };

  const kpi = (label: string, value: string, sub = '') => `<div class="kpi"><div class="kl">${label}</div><div class="kv">${value}</div>${sub ? `<div class="ks">${sub}</div>` : ''}</div>`;
  const delta = d.collectedDelta == null ? '' : `${d.collectedDelta >= 0 ? '▲' : '▼'} ${Math.abs(d.collectedDelta)}% ${T.prev}`;

  const html = `<!doctype html><html lang="${es ? 'es' : 'en'}"><head><meta charset="utf-8"><title>${T.title} · Onyx Trading Live</title>
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
  table{width:100%;border-collapse:collapse;font-size:13px} th,td{text-align:left;padding:7px 6px;border-bottom:1px solid #eee} th{color:#6b7280;font-weight:600}
  td.r,th.r{text-align:right}
  .btn{display:inline-block;margin-top:24px;padding:9px 16px;background:#7c8cff;color:#fff;border-radius:8px;text-decoration:none;font-size:13px}
  @media print{.btn{display:none}}
</style></head><body>
  <div class="head">
    <div><h1>${T.title}</h1><div class="muted">${T.range}: ${d.from.slice(0, 10)} → ${d.to.slice(0, 10)} · ${T.gen}: ${new Date().toLocaleString(es ? 'es' : 'en')}</div></div>
    <div class="brand">Onyx Trading Live</div>
  </div>
  <div class="grid">
    ${kpi(T.mrr, m(d.mrr), d.moveNet >= 0 ? `▲ ${m(d.moveNet)} ${T.movNet}` : `▼ ${m(Math.abs(d.moveNet))} ${T.movNet}`)}
    ${kpi(T.arr, m(d.arr))}
    ${kpi(T.subs, String(d.activeSubs), `+${d.newSubs} ${T.newS}`)}
    ${kpi(T.arpu, m(d.arpu))}
    ${kpi(T.coll, m(d.collected), delta)}
    ${kpi(T.churn, d.churnPct + '%')}
  </div>

  <h2>${T.byPlan}</h2>
  <table><thead><tr><th>${T.plan}</th><th class="r">${T.subs}</th><th class="r">${T.mrr}</th><th class="r">%</th></tr></thead><tbody>
    ${d.plans.map((p) => `<tr><td>${p.name}</td><td class="r">${p.subs}</td><td class="r">${m(p.mrr)}</td><td class="r">${p.pct}%</td></tr>`).join('') || `<tr><td colspan="4" class="muted">—</td></tr>`}
  </tbody></table>

  <h2>${T.mov}</h2>
  <table><tbody>
    <tr><td>${T.movNew}</td><td class="r" style="color:#16a34a">+${m(d.moveNew)}</td></tr>
    <tr><td>${T.movLost}</td><td class="r" style="color:#dc2626">−${m(d.moveLost)}</td></tr>
    <tr><td><b>${T.movNet}</b></td><td class="r"><b>${m(d.moveNet)}</b></td></tr>
  </tbody></table>

  <h2>${T.months}</h2>
  <table><thead><tr><th>${T.month}</th><th class="r">${T.collected}</th></tr></thead><tbody>
    ${d.monthly.map((x) => `<tr><td>${x.label}</td><td class="r">${m(x.total)}</td></tr>`).join('')}
  </tbody></table>

  <a class="btn" href="#" onclick="window.print();return false">${T.print}</a>
  <script>setTimeout(function(){window.print()},400)</script>
</body></html>`;

  return new NextResponse(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}
