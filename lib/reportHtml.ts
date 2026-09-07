// ============================================================
// Onyx Bot Factory · Reporte HTML autónomo (imprimible a PDF).
// Igual que StrategyQuant pero MEJOR: incluye el Onyx Robustness Score,
// la validación fina en M1 y la auditoría de Claude (SQ no tiene IA).
// ============================================================
import type { FullReport } from '@/lib/report';

const esc = (s: any) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as any)[c]);
const money = (v: number) => (v < 0 ? '-$' : '$') + Math.abs(Math.round(v)).toLocaleString('en-US');

export type ReportMeta = {
  name: string; symbol: string; timeframe?: string; magic?: number;
  source?: string; broker?: string;
  onyxM15?: number | null; onyxGrade?: string | null;
  onyxM1?: number | null; onyxM1Grade?: string | null;
  robustnessVerdict?: string | null;
  ai?: string | null; mutations?: string[];
};

export function reportHTML(m: ReportMeta, r: FullReport, es = true): string {
  const MON = es ? ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'] : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const kpi = (l: string, v: string, good?: boolean) => `<div class="k"><div class="kl">${esc(l)}</div><div class="kv${good === true ? ' g' : good === false ? ' r' : ''}">${esc(v)}</div></div>`;
  // Curva de equity (SVG simple).
  const eq = r.equity || [];
  let curve = '';
  if (eq.length > 1) {
    const W = 900, H = 220, pad = 10;
    const mn = Math.min(...eq.map((p) => p.eq)), mx = Math.max(...eq.map((p) => p.eq));
    const x = (i: number) => pad + (i / (eq.length - 1)) * (W - 2 * pad);
    const y = (v: number) => H - pad - ((v - mn) / (mx - mn || 1)) * (H - 2 * pad);
    const line = eq.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.eq).toFixed(1)}`).join(' ');
    curve = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="220" preserveAspectRatio="none"><path d="${line}" fill="none" stroke="#1D9E75" stroke-width="2"/></svg>`;
  }
  // Tabla mensual.
  let months = '';
  const yrs = r.monthKeys || [];
  if (yrs.length) {
    months = '<table class="t"><tr><th>Año</th>' + MON.map((mm) => `<th>${mm}</th>`).join('') + '<th>YTD</th></tr>';
    for (const y of yrs) {
      months += `<tr><td class="b">${y}</td>` + MON.map((_, mi) => {
        const v = (r.months[y] || {})[mi];
        if (v == null) return '<td class="mut">·</td>';
        return `<td class="${v >= 0 ? 'g' : 'r'}">${Math.round(v)}</td>`;
      }).join('') + `<td class="b ${(r.ytd[y] || 0) >= 0 ? 'g' : 'r'}">${Math.round(r.ytd[y] || 0)}</td></tr>`;
    }
    months += '</table>';
  }
  const gr = (g?: string | null) => g === 'A' || g === 'B' ? 'g' : g === 'C' ? 'a' : g ? 'r' : 'mut';

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(m.name)} · Onyx report</title>
<style>
  *{box-sizing:border-box} body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;margin:0;padding:28px;color:#0b1020;background:#fff}
  h1{font-size:22px;margin:0 0 2px} h2{font-size:15px;margin:22px 0 8px;border-bottom:2px solid #eee;padding-bottom:4px}
  .sub{color:#667;font-size:12.5px;margin-bottom:14px}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px}
  .k{border:1px solid #e6e8ee;border-radius:8px;padding:8px 10px}
  .kl{color:#889;font-size:10.5px} .kv{font-size:16px;font-weight:800} .kv.g{color:#1D9E75} .kv.r{color:#E24B4A}
  .onyx{display:flex;gap:10px;flex-wrap:wrap;margin:6px 0 4px}
  .badge{border-radius:8px;padding:8px 12px;font-weight:800;font-size:13px;border:1px solid #e6e8ee}
  .badge.g{background:#eafaf3;color:#127a57;border-color:#bfe9d7} .badge.a{background:#fff6e8;color:#a56a12;border-color:#f2ddb4} .badge.r{background:#fdeceb;color:#a3312f;border-color:#f3c7c5} .badge.mut{color:#889}
  .ai{background:#f6f4ff;border:1px solid #ddd6ff;border-radius:10px;padding:12px 14px;font-size:13px;line-height:1.6;white-space:pre-wrap}
  .mut{color:#aab} .t{border-collapse:collapse;width:100%;font-size:11px;margin-top:4px} .t th,.t td{border:1px solid #eee;padding:4px 6px;text-align:right} .t th{background:#fafafd;color:#778} .t .b{font-weight:800;text-align:left} .t .g{color:#1D9E75} .t .r{color:#E24B4A}
  .foot{margin-top:26px;color:#99a;font-size:11px;border-top:1px solid #eee;padding-top:10px}
  @media print{body{padding:12px}}
</style></head><body>
  <h1>${esc(m.name)} <span style="color:#889;font-weight:400">· ${esc(m.symbol)}${m.timeframe ? ' · ' + esc(m.timeframe) : ''}</span></h1>
  <div class="sub">Onyx Bot Factory · ${es ? 'reporte generado' : 'report generated'} ${new Date().toLocaleString(es ? 'es-ES' : 'en-US')}${m.magic ? ' · Magic ' + m.magic : ''}${m.source ? ' · ' + esc(m.source) : ''}${m.broker ? ' (' + esc(m.broker) + ')' : ''}</div>

  <h2>${es ? 'Robustez y validación' : 'Robustness & validation'}</h2>
  <div class="onyx">
    ${m.onyxM15 != null ? `<span class="badge ${gr(m.onyxGrade)}">Onyx M15: ${m.onyxM15} (${esc(m.onyxGrade || '—')})</span>` : ''}
    ${m.onyxM1 != null ? `<span class="badge ${gr(m.onyxM1Grade)}">Onyx M1 (tick-accurate): ${m.onyxM1} (${esc(m.onyxM1Grade || '—')})</span>` : ''}
    ${m.robustnessVerdict ? `<span class="badge ${m.robustnessVerdict === 'robusto' ? 'g' : m.robustnessVerdict === 'moderado' ? 'a' : 'r'}">${es ? 'Veredicto' : 'Verdict'}: ${esc(m.robustnessVerdict)}</span>` : ''}
  </div>

  ${m.ai ? `<h2>🧠 ${es ? 'Auditoría de la IA (Claude)' : 'AI audit (Claude)'}</h2><div class="ai">${esc(m.ai)}${(m.mutations || []).length ? '\n\n' + (es ? 'Mutaciones sugeridas:' : 'Suggested mutations:') + '\n• ' + (m.mutations || []).map(esc).join('\n• ') : ''}</div>` : ''}

  <h2>${es ? 'KPIs principales' : 'Key KPIs'}</h2>
  <div class="grid">
    ${kpi(es ? 'Beneficio total' : 'Total profit', money(r.net), r.net >= 0)}
    ${kpi('Profit factor', String(r.pf), r.pf >= 1.3)}
    ${kpi('Sharpe', String(r.sharpe))}
    ${kpi('Return/DD', String(r.retDD), r.retDD >= 3)}
    ${kpi(es ? '% ganadoras' : 'Win %', r.winRate + '%')}
    ${kpi('Drawdown', money(r.maxDD) + ' · ' + r.maxDDpct + '%', false)}
    ${kpi('SQN', String(r.sqn), r.sqn >= 2)}
    ${kpi('CAGR', r.cagr + '%')}
    ${kpi(es ? 'Operaciones' : 'Trades', String(r.trades))}
    ${kpi('Expectancy', money(r.expectancy))}
  </div>

  <h2>${es ? 'Métricas avanzadas' : 'Advanced metrics'}</h2>
  <div class="grid">
    ${kpi(es ? 'Anual medio' : 'Yearly avg', money(r.yearlyAvgProfit))}
    ${kpi(es ? 'Anual %' : 'Yearly %', r.yearlyAvgPct + '%')}
    ${kpi(es ? 'Mensual medio' : 'Monthly avg', money(r.monthlyAvgProfit))}
    ${kpi('Annual/MaxDD', String(r.annualMaxDD), r.annualMaxDD >= 1)}
    ${kpi('AHPR %', r.ahpr + '%')}
    ${kpi('R-Expectancy', String(r.rExpectancy))}
    ${kpi('STR Quality', String(r.strQuality), r.strQuality >= 2)}
    ${kpi('Z-Score', String(r.zScore))}
    ${kpi('Z-Prob %', r.zProb + '%')}
    ${kpi('Payout', String(r.payout))}
    ${kpi(es ? 'Racha máx. G/P' : 'Max consec W/L', r.maxConsecWins + ' / ' + r.maxConsecLosses)}
    ${kpi(es ? 'Estancamiento' : 'Stagnation', r.stagnationDays + 'd · ' + r.stagnationPct + '%', false)}
  </div>

  <h2>${es ? 'Curva de equity' : 'Equity curve'}</h2>
  <div style="border:1px solid #eee;border-radius:8px;padding:6px">${curve || '<span class="mut">—</span>'}</div>

  ${months ? `<h2>${es ? 'Rendimiento mensual ($)' : 'Monthly performance ($)'}</h2>${months}` : ''}

  <div class="foot">Onyx Bot Factory · ${es ? 'Este reporte es histórico y no garantiza resultados futuros. Valida en demo antes de operar en real.' : 'This report is historical and does not guarantee future results. Validate on demo before live trading.'}</div>
</body></html>`;
}
