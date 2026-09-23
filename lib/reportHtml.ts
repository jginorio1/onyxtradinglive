// ============================================================
// Onyx Bot Factory · Reporte HTML autónomo (imprimible a PDF).
// Igual que StrategyQuant pero MEJOR: incluye el Onyx Robustness Score,
// la validación fina en M1 y la auditoría de Claude (SQ no tiene IA).
// ============================================================
import type { FullReport } from '@/lib/report';

const esc = (s: any) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as any)[c]);
const money = (v: number) => (v < 0 ? '-$' : '$') + Math.abs(Math.round(v)).toLocaleString('en-US');

// ============================================================
// Reporte del trader (dashboard → Exportar). CSV + página HTML imprimible a PDF.
// Lo usan /api/dashboard/report y lib/traderReport.
// ============================================================

// Filas → texto CSV (con BOM para Excel; escapa comas, comillas y saltos).
export function toCsvRows(rows: (string | number)[][]): string {
  const cell = (v: any) => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n');
}

// Página HTML autónoma con gráficas modernas (curva de equity, barras por
// instrumento, dona ganadoras/perdedoras) + cabecera del perfil del trader y
// resumen de portafolio. 100% inline (imprimible a PDF sin librerías externas).
export function reportPage(o: {
  lang: 'es' | 'en'; from: string; to: string;
  profile?: { name?: string; avatar?: string; style?: string; experience?: string; goal?: string; country?: string };
  portfolio?: { totalBalance?: number; accounts?: number; currency?: string };
  kpis: { label: string; value: string; tone?: 'good' | 'bad' | 'neutral' }[];
  equity?: number[];
  bySym?: { sym: string; n: number; net: number }[];
  winLoss?: { wins: number; losses: number };
  tables: { title: string; head: string[]; alignRight?: number[]; rows: (string | number)[][] }[];
}): string {
  const es = o.lang === 'es';
  const GREEN = '#16a34a', RED = '#dc2626', BRAND = '#6d5efc', INK = '#0b1020';
  const fmtMoney = (v: number) => (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // --- KPI cards (coloreadas por tono) ---
  const kpis = o.kpis.map((k) => {
    const c = k.tone === 'good' ? GREEN : k.tone === 'bad' ? RED : INK;
    const bg = k.tone === 'good' ? '#f0fdf4' : k.tone === 'bad' ? '#fef2f2' : '#f7f8fc';
    const bd = k.tone === 'good' ? '#bbf7d0' : k.tone === 'bad' ? '#fecaca' : '#e6e8ee';
    return `<div class="k" style="background:${bg};border-color:${bd}"><div class="kl">${esc(k.label)}</div><div class="kv" style="color:${c}">${esc(k.value)}</div></div>`;
  }).join('');

  // --- Curva de equity (área + línea) ---
  let equityChart = '';
  const eq = o.equity || [];
  if (eq.length > 1) {
    const W = 760, H = 200, pad = 8;
    const mn = Math.min(0, ...eq), mx = Math.max(0, ...eq), span = mx - mn || 1;
    const X = (i: number) => pad + (i / (eq.length - 1)) * (W - 2 * pad);
    const Y = (v: number) => H - pad - ((v - mn) / span) * (H - 2 * pad);
    const up = eq[eq.length - 1] >= 0;
    const col = up ? GREEN : RED;
    const line = eq.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
    const area = `M${X(0).toFixed(1)},${Y(0).toFixed(1)} ` + eq.map((v, i) => `L${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ') + ` L${X(eq.length - 1).toFixed(1)},${Y(0).toFixed(1)} Z`;
    equityChart = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="200" preserveAspectRatio="none">
      <defs><linearGradient id="eqg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity="0.22"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs>
      <line x1="${pad}" y1="${Y(0).toFixed(1)}" x2="${W - pad}" y2="${Y(0).toFixed(1)}" stroke="#e2e5ee" stroke-width="1" stroke-dasharray="3 3"/>
      <path d="${area}" fill="url(#eqg)"/><path d="${line}" fill="none" stroke="${col}" stroke-width="2.5"/></svg>`;
  }

  // --- Barras por instrumento (verde/rojo) ---
  let barsChart = '';
  const top = (o.bySym || []).slice(0, 10);
  if (top.length) {
    const W = 760, rowH = 26, H = top.length * rowH + 10, maxAbs = Math.max(1, ...top.map((s) => Math.abs(s.net)));
    const labelW = 120, barX = labelW + 8, barMaxW = W - barX - 110;
    barsChart = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}">` + top.map((s, i) => {
      const y = i * rowH + 6, w = (Math.abs(s.net) / maxAbs) * barMaxW, col = s.net >= 0 ? GREEN : RED;
      return `<text x="0" y="${y + 15}" font-size="11" fill="#556" font-family="Arial">${esc(s.sym).slice(0, 16)}</text>`
        + `<rect x="${barX}" y="${y + 4}" width="${w.toFixed(1)}" height="14" rx="4" fill="${col}"/>`
        + `<text x="${(barX + w + 6).toFixed(1)}" y="${y + 15}" font-size="10.5" font-weight="bold" fill="${col}" font-family="Arial">${fmtMoney(s.net)}</text>`;
    }).join('') + `</svg>`;
  }

  // --- Dona ganadoras vs perdedoras ---
  let donut = '';
  const wl = o.winLoss;
  if (wl && (wl.wins + wl.losses) > 0) {
    const totalT = wl.wins + wl.losses, r = 54, cx = 70, cy = 70, C = 2 * Math.PI * r;
    const winFrac = wl.wins / totalT, dash = (winFrac * C).toFixed(1);
    const pct = Math.round(winFrac * 100);
    donut = `<div style="display:flex;align-items:center;gap:18px">
      <svg viewBox="0 0 140 140" width="140" height="140">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#fee2e2" stroke-width="16"/>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${GREEN}" stroke-width="16" stroke-dasharray="${dash} ${(C - Number(dash)).toFixed(1)}" stroke-dashoffset="${(C / 4).toFixed(1)}" stroke-linecap="round" transform="rotate(-90 ${cx} ${cy})"/>
        <text x="${cx}" y="${cy - 2}" text-anchor="middle" font-size="24" font-weight="800" fill="${INK}" font-family="Arial">${pct}%</text>
        <text x="${cx}" y="${cy + 16}" text-anchor="middle" font-size="10" fill="#889" font-family="Arial">${es ? 'aciertos' : 'win rate'}</text>
      </svg>
      <div style="font-size:12.5px;line-height:1.9">
        <div><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${GREEN};margin-right:6px"></span>${es ? 'Ganadoras' : 'Winners'}: <b>${wl.wins}</b></div>
        <div><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${RED};margin-right:6px"></span>${es ? 'Perdedoras' : 'Losers'}: <b>${wl.losses}</b></div>
      </div></div>`;
  }

  // --- Tablas ---
  const tables = o.tables.map((t) => {
    const ar = new Set(t.alignRight || []);
    const head = t.head.map((h, i) => `<th style="text-align:${ar.has(i) ? 'right' : 'left'}">${esc(h)}</th>`).join('');
    const body = t.rows.length
      ? t.rows.map((r) => `<tr>${r.map((c, i) => `<td style="text-align:${ar.has(i) ? 'right' : 'left'}">${esc(c)}</td>`).join('')}</tr>`).join('')
      : `<tr><td colspan="${t.head.length}" class="mut" style="text-align:center">${es ? 'Sin datos en este período' : 'No data in this period'}</td></tr>`;
    return `<h2>${esc(t.title)}</h2><table class="t"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
  }).join('');

  // --- Cabecera perfil + portafolio ---
  const p = o.profile || {};
  const chips = [p.style, p.experience, p.goal, p.country].filter(Boolean).map((c) => `<span class="chip">${esc(c)}</span>`).join('');
  const avatar = p.avatar
    ? `<img src="${esc(p.avatar)}" style="width:56px;height:56px;border-radius:50%;object-fit:cover;object-position:50% 30%;border:2px solid rgba(255,255,255,.5)"/>`
    : `<div style="width:56px;height:56px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:#fff">${esc((p.name || 'O').slice(0, 2).toUpperCase())}</div>`;
  const pf = o.portfolio || {};
  const cur = pf.currency || 'USD';
  const portfolioStrip = pf.totalBalance != null ? `<div class="pf">
      <div><div class="pfl">${es ? 'Balance del portafolio' : 'Portfolio balance'}</div><div class="pfv">${cur} ${(pf.totalBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div></div>
      <div><div class="pfl">${es ? 'Cuentas' : 'Accounts'}</div><div class="pfv">${pf.accounts ?? 0}</div></div>
    </div>` : '';

  return `<!doctype html><html lang="${es ? 'es' : 'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Onyx · ${es ? 'Reporte' : 'Report'}</title>
<style>*{box-sizing:border-box}body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;margin:0;padding:0;color:#0b1020;background:#f4f5fa}
.wrap{max-width:840px;margin:0 auto;padding:20px;position:relative;z-index:1}
.hero{background:linear-gradient(135deg,#4b3ff0,#7c8cff);color:#fff;border-radius:16px;padding:20px 22px;display:flex;align-items:center;gap:16px}
.hn{font-size:20px;font-weight:800} .hs{font-size:12px;opacity:.85;margin-top:2px}
.chips{margin-top:8px;display:flex;gap:6px;flex-wrap:wrap}.chip{background:rgba(255,255,255,.18);border-radius:20px;padding:3px 10px;font-size:11px}
.pf{display:flex;gap:20px;background:#fff;border:1px solid #e6e8ee;border-radius:12px;padding:12px 16px;margin-top:12px}
.pfl{color:#889;font-size:11px}.pfv{font-size:18px;font-weight:800}
h2{font-size:15px;margin:22px 0 8px;border-bottom:2px solid #e6e8ee;padding-bottom:4px}
.card{background:#fff;border:1px solid #e6e8ee;border-radius:12px;padding:14px 16px;margin-top:12px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin-top:12px}
.k{border:1px solid #e6e8ee;border-radius:10px;padding:9px 11px}.kl{color:#889;font-size:10.5px}.kv{font-size:17px;font-weight:800}
.t{border-collapse:collapse;width:100%;font-size:11px;margin-top:4px}.t th,.t td{border:1px solid #eef;padding:4px 6px}.t th{background:#f7f8fc;color:#778}.mut{color:#aab}
.print{margin:12px 0 0;padding:9px 16px;border:1px solid #6d5efc;background:#eceaff;color:#4b3ff0;border-radius:9px;font-weight:700;cursor:pointer}
.foot{margin:26px 0 8px;color:#99a;font-size:11px;border-top:1px solid #e6e8ee;padding-top:10px}
.obar{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:8px;background:rgba(244,245,250,.92);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);border-bottom:1px solid #e6e8ee;padding:10px 16px}
.obrand{display:flex;align-items:center;gap:7px;font-weight:800;font-size:14px;color:#0b1020;margin-right:auto}
.obrand span.dot{width:16px;height:16px;border-radius:5px;background:linear-gradient(135deg,#4b3ff0,#7c8cff);display:inline-block}
.obtn{display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border-radius:9px;font-weight:700;font-size:13px;cursor:pointer;border:1px solid #d6d9e6;background:#fff;color:#0b1020;text-decoration:none}
.obtn.pri{border-color:#6d5efc;background:#4b3ff0;color:#fff}
.wmark{position:fixed;inset:0;pointer-events:none;z-index:0;display:flex;align-items:center;justify-content:center;opacity:.04;font-size:120px;font-weight:900;color:#4b3ff0;transform:rotate(-24deg);letter-spacing:8px}
@media print{body{background:#fff}.print,.obar{display:none}.wrap{max-width:none;padding:0}.wmark{opacity:.05}}</style></head><body>
<div class="obar">
  <div class="obrand"><span class="dot"></span> Onyx Trading Live</div>
  <a class="obtn" href="/dashboard">${es ? '← Volver a Onyx' : '← Back to Onyx'}</a>
  <button class="obtn" onclick="window.print()">${es ? '🖨️ Imprimir / PDF' : '🖨️ Print / PDF'}</button>
  <button class="obtn pri" onclick="onyxShare()">${es ? '📤 Compartir' : '📤 Share'}</button>
</div>
<div class="wmark">ONYX</div>
<div class="wrap">
  <div class="hero">
    ${avatar}
    <div style="flex:1">
      <div class="hn">${esc(p.name || (es ? 'Reporte de rendimiento' : 'Performance report'))}</div>
      <div class="hs">Onyx Trading Live · ${esc(o.from)} – ${esc(o.to)}</div>
      ${chips ? `<div class="chips">${chips}</div>` : ''}
    </div>
    <div style="text-align:right"><div style="font-size:11px;opacity:.8">${es ? 'Generado' : 'Generated'}</div><div style="font-size:12px;font-weight:700">${new Date().toLocaleDateString(es ? 'es-ES' : 'en-US')}</div></div>
  </div>
  ${portfolioStrip}

  <div class="grid">${kpis}</div>

  ${equityChart ? `<h2>${es ? '📈 Curva de resultados' : '📈 Equity curve'}</h2><div class="card">${equityChart}</div>` : ''}
  ${donut || barsChart ? `<h2>${es ? '📊 Desglose' : '📊 Breakdown'}</h2><div class="card" style="display:flex;gap:24px;flex-wrap:wrap;align-items:flex-start">${donut}${barsChart ? `<div style="flex:1;min-width:320px"><div style="font-size:12px;color:#667;margin-bottom:6px">${es ? 'Neto por instrumento' : 'Net by instrument'}</div>${barsChart}</div>` : ''}</div>` : ''}

  ${tables}
  <div class="foot">Onyx Trading Live · ${es ? 'Reporte histórico. No garantiza resultados futuros. Valida en demo antes de operar en real.' : 'Historical report. Does not guarantee future results. Validate on demo before live trading.'}</div>
</div>
<script>
function onyxShare(){
  var d={title:'Onyx Trading Live',text:${JSON.stringify(es ? 'Mi reporte de rendimiento — Onyx Trading Live' : 'My performance report — Onyx Trading Live')},url:location.href};
  if(navigator.share){navigator.share(d).catch(function(){});}
  else if(navigator.clipboard){navigator.clipboard.writeText(location.href).then(function(){alert(${JSON.stringify(es ? 'Enlace copiado' : 'Link copied')});}).catch(function(){});}
}
</script>
</body></html>`;
}

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
