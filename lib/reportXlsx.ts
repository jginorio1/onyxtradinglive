// Reporte de rendimiento del trader como archivo Excel (.xlsx) REAL con formato:
// bandas de color, tarjetas KPI verdes/rojas, cabecera de perfil, tira de
// portafolio y una GRÁFICA incrustada (curva de equity + barras por instrumento
// + dona de ganadoras/perdedoras) renderizada a PNG con @napi-rs/canvas.
//
// Requiere: exceljs (workbook + estilos + imagen) y @napi-rs/canvas (dibujo).
import ExcelJS from 'exceljs';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { FONT_REGULAR_B64, FONT_BOLD_B64 } from './reportFont';

// Registrar la fuente incrustada UNA vez (Vercel no trae fuentes de sistema, así
// que sin esto el texto de las gráficas sale invisible). Alias 'OnyxSans'.
let fontsReady = false;
function ensureFonts() {
  if (fontsReady) return;
  try {
    GlobalFonts.register(Buffer.from(FONT_REGULAR_B64, 'base64'), 'OnyxSans');
    GlobalFonts.register(Buffer.from(FONT_BOLD_B64, 'base64'), 'OnyxSans');
  } catch { /* ya registrada */ }
  fontsReady = true;
}
const FF = 'OnyxSans, Arial, sans-serif';

export type XKpi = { label: string; value: string; tone?: 'good' | 'bad' | 'neutral' };
export type XReport = {
  lang: 'es' | 'en';
  from: string; to: string; generated: string;
  currency: string;
  profile: { name?: string; style?: string; experience?: string; goal?: string; country?: string };
  portfolio: { totalBalance: number; accounts: number };
  kpis: XKpi[];
  equity: number[];
  bySym: { sym: string; n: number; net: number }[];
  winLoss: { wins: number; losses: number };
  trades: { open: string; close: string; sym: string; side: string; vol: string; dur: string; net: number; gross: string; commission: string; swap: string }[];
  avatar?: Buffer | null;
};

// Código de país → nombre legible (los más comunes; si ya viene el nombre, se usa tal cual).
const COUNTRY: Record<string, { es: string; en: string }> = {
  pr: { es: 'Puerto Rico', en: 'Puerto Rico' }, us: { es: 'Estados Unidos', en: 'United States' }, usa: { es: 'Estados Unidos', en: 'United States' },
  mx: { es: 'México', en: 'Mexico' }, es: { es: 'España', en: 'Spain' }, ar: { es: 'Argentina', en: 'Argentina' }, co: { es: 'Colombia', en: 'Colombia' },
  cl: { es: 'Chile', en: 'Chile' }, pe: { es: 'Perú', en: 'Peru' }, ve: { es: 'Venezuela', en: 'Venezuela' }, do: { es: 'Rep. Dominicana', en: 'Dominican Rep.' },
  ec: { es: 'Ecuador', en: 'Ecuador' }, gt: { es: 'Guatemala', en: 'Guatemala' }, br: { es: 'Brasil', en: 'Brazil' }, pa: { es: 'Panamá', en: 'Panama' },
  uy: { es: 'Uruguay', en: 'Uruguay' }, py: { es: 'Paraguay', en: 'Paraguay' }, bo: { es: 'Bolivia', en: 'Bolivia' }, cr: { es: 'Costa Rica', en: 'Costa Rica' },
  hn: { es: 'Honduras', en: 'Honduras' }, sv: { es: 'El Salvador', en: 'El Salvador' }, ni: { es: 'Nicaragua', en: 'Nicaragua' },
};
function countryName(v: string | undefined, lang: 'es' | 'en'): string {
  const raw = (v || '').trim(); if (!raw) return '';
  const key = raw.toLowerCase();
  if (key.length <= 3 && COUNTRY[key]) return COUNTRY[key][lang];
  return raw; // ya es un nombre completo
}

// ---- Paleta (ARGB para exceljs, hex para canvas) ----
const C = {
  brand: '4F46E5', brand2: '7C6CFF', ink: '0F172A', mut: '64748B',
  good: '16A34A', goodBg: 'DCFCE7', bad: 'DC2626', badBg: 'FEE2E2',
  neutralBg: 'EEF2FF', line: 'E2E8F0', head: '111827', bandTxt: 'FFFFFF',
  soft: 'F8FAFC',
};
const argb = (h: string) => 'FF' + h;
const nfMoney = '#,##0.00';

// ============ GRÁFICA COMPUESTA (PNG) ============
function chartPng(o: XReport): Buffer {
  ensureFonts();
  const W = 960, H = 560, S = 2; // supersampling x2 para nitidez
  const cv = createCanvas(W * S, H * S);
  const ctx = cv.getContext('2d');
  ctx.scale(S, S);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
  const es = o.lang === 'es';

  const font = (px: number, w = '400') => `${w} ${px}px ${FF}`;
  const text = (s: string, x: number, y: number, col: string, px: number, w = '400', align: CanvasTextAlign = 'left') => {
    ctx.fillStyle = '#' + col; ctx.font = font(px, w); ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(s, x, y);
  };

  // ---- 1) Curva de equity (arriba, ancho completo) ----
  const eq = o.equity && o.equity.length > 1 ? o.equity : [0, 0];
  const gx = 44, gy = 44, gw = W - 88, gh = 210;
  text(es ? 'Curva de resultados (acumulado)' : 'Equity curve (cumulative)', gx, 30, C.head, 15, '700');
  const min = Math.min(...eq, 0), max = Math.max(...eq, 0), rng = (max - min) || 1;
  const X = (i: number) => gx + (i / (eq.length - 1)) * gw;
  const Y = (v: number) => gy + gh - ((v - min) / rng) * gh;
  // rejilla horizontal
  ctx.strokeStyle = '#' + C.line; ctx.lineWidth = 1;
  for (let k = 0; k <= 4; k++) { const yy = gy + (gh / 4) * k; ctx.beginPath(); ctx.moveTo(gx, yy); ctx.lineTo(gx + gw, yy); ctx.stroke(); }
  // línea cero
  const yz = Y(0); ctx.strokeStyle = '#94A3B8'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(gx, yz); ctx.lineTo(gx + gw, yz); ctx.stroke(); ctx.setLineDash([]);
  // área
  const grad = ctx.createLinearGradient(0, gy, 0, gy + gh);
  grad.addColorStop(0, 'rgba(79,70,229,.30)'); grad.addColorStop(1, 'rgba(79,70,229,.02)');
  ctx.beginPath(); ctx.moveTo(X(0), Y(eq[0]));
  for (let i = 1; i < eq.length; i++) ctx.lineTo(X(i), Y(eq[i]));
  ctx.lineTo(X(eq.length - 1), gy + gh); ctx.lineTo(X(0), gy + gh); ctx.closePath();
  ctx.fillStyle = grad; ctx.fill();
  // línea
  ctx.beginPath(); ctx.moveTo(X(0), Y(eq[0]));
  for (let i = 1; i < eq.length; i++) ctx.lineTo(X(i), Y(eq[i]));
  ctx.strokeStyle = '#' + C.brand; ctx.lineWidth = 2.4; ctx.lineJoin = 'round'; ctx.stroke();
  // punto final
  const last = eq[eq.length - 1];
  ctx.fillStyle = '#' + (last >= 0 ? C.good : C.bad); ctx.beginPath(); ctx.arc(X(eq.length - 1), Y(last), 4, 0, Math.PI * 2); ctx.fill();
  text((last >= 0 ? '+' : '') + Math.round(last).toLocaleString('en-US'), gx + gw, gy - 6, last >= 0 ? C.good : C.bad, 13, '700', 'right');

  // Punto sólido (en vez del carácter ● que no existe en la fuente).
  const dot = (x: number, y: number, col: string, rr = 5) => { ctx.fillStyle = '#' + col; ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.fill(); };

  // ---- 2) Barras por instrumento (abajo izq) ----
  const bx = 44, byTitle = 302, by = 326, bh = 190;
  text(es ? 'Neto por instrumento' : 'Net by instrument', bx, byTitle, C.head, 15, '700');
  const syms = [...(o.bySym || [])].sort((a, b) => Math.abs(b.net) - Math.abs(a.net)).slice(0, 7);
  if (syms.length) {
    const maxA = Math.max(...syms.map((s) => Math.abs(s.net)), 1);
    const rowH = Math.min(26, bh / syms.length);
    const labelW = 92, zeroX = bx + labelW + 150, half = 120;   // eje cero desplazado, barras a ±120px
    syms.forEach((s, i) => {
      const yy = by + i * rowH + rowH / 2;
      text(s.sym.length > 11 ? s.sym.slice(0, 11) : s.sym, bx, yy + 4, C.mut, 12, '700');
      const w = Math.max(2, (Math.abs(s.net) / maxA) * half);
      ctx.fillStyle = '#' + (s.net >= 0 ? C.good : C.bad);
      if (s.net >= 0) roundRect(ctx, zeroX, yy - 8, w, 16, 3);
      else roundRect(ctx, zeroX - w, yy - 8, w, 16, 3);
      ctx.fill();
      text((s.net >= 0 ? '+' : '-') + Math.abs(Math.round(s.net)).toLocaleString('en-US'), s.net >= 0 ? zeroX + w + 7 : zeroX - w - 7, yy + 4, s.net >= 0 ? C.good : C.bad, 11, '700', s.net >= 0 ? 'left' : 'right');
    });
    ctx.strokeStyle = '#CBD5E1'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(zeroX, by - 4); ctx.lineTo(zeroX, by + syms.length * rowH); ctx.stroke();
  } else { text(es ? 'Sin operaciones en el período' : 'No trades in range', bx, by + 24, C.mut, 13); }

  // ---- 3) Dona ganadoras/perdedoras (abajo der) ----
  const wins = o.winLoss.wins, losses = o.winLoss.losses, tot = wins + losses;
  const cx = 860, cy = 418, r = 70, ir = 43;
  text(es ? 'Ganadoras vs perdedoras' : 'Winners vs losers', 640, byTitle, C.head, 15, '700');
  if (tot > 0) {
    const wa = (wins / tot) * Math.PI * 2;
    donut(ctx, cx, cy, r, ir, -Math.PI / 2, -Math.PI / 2 + wa, C.good);
    donut(ctx, cx, cy, r, ir, -Math.PI / 2 + wa, -Math.PI / 2 + Math.PI * 2, C.bad);
    text(Math.round((wins / tot) * 100) + '%', cx, cy + 4, C.head, 22, '800', 'center');
    text(es ? 'aciertos' : 'win rate', cx, cy + 21, C.mut, 11, '400', 'center');
    // Leyenda a la izquierda de la dona (sin solaparla).
    dot(648, cy - 6, C.good); text(wins + (es ? ' ganadas' : ' won'), 662, cy - 2, C.good, 13, '700', 'left');
    dot(648, cy + 20, C.bad); text(losses + (es ? ' perdidas' : ' lost'), 662, cy + 24, C.bad, 13, '700', 'left');
  } else { text(es ? 'Sin operaciones en el período' : 'No trades in range', 640, by + 24, C.mut, 13); }

  return cv.toBuffer('image/png');
}
function roundRect(ctx: any, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, Math.abs(w) / 2, h / 2); const x2 = x + w;
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x2, y, x2, y + h, r); ctx.arcTo(x2, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x2, y, r); ctx.closePath();
}
function donut(ctx: any, cx: number, cy: number, r: number, ir: number, a0: number, a1: number, col: string) {
  ctx.beginPath(); ctx.arc(cx, cy, r, a0, a1); ctx.arc(cx, cy, ir, a1, a0, true); ctx.closePath(); ctx.fillStyle = '#' + col; ctx.fill();
}

// ============ WORKBOOK ============
export async function buildReportXlsx(o: XReport): Promise<Buffer> {
  const es = o.lang === 'es';
  const L = es
    ? { app: 'Onyx Trading — Reporte de rendimiento', period: 'Período', gen: 'Generado', currency: 'Moneda', prof: 'Perfil del trader', name: 'Nombre', style: 'Estilo', exp: 'Experiencia', goal: 'Meta', country: 'País', port: 'Portafolio', bal: 'Balance total', accs: 'Cuentas', sum: 'Resumen', sym: 'Por instrumento', symH: 'Instrumento', n: 'Ops', net: 'Neto', list: 'Operaciones', open: 'Apertura', close: 'Cierre', dur: 'Duración', gross: 'Bruto', comm: 'Comisión', swap: 'Swap', side: 'Tipo', vol: 'Vol', sh1: 'Resumen', sh2: 'Operaciones', dash: '—' }
    : { app: 'Onyx Trading — Performance report', period: 'Period', gen: 'Generated', currency: 'Currency', prof: 'Trader profile', name: 'Name', style: 'Style', exp: 'Experience', goal: 'Goal', country: 'Country', port: 'Portfolio', bal: 'Total balance', accs: 'Accounts', sum: 'Summary', sym: 'By instrument', symH: 'Instrument', n: 'Trades', net: 'Net', list: 'Trades', open: 'Open', close: 'Close', dur: 'Duration', gross: 'Gross', comm: 'Commission', swap: 'Swap', side: 'Side', vol: 'Vol', sh1: 'Summary', sh2: 'Trades', dash: '—' };

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Onyx Trading'; wb.created = new Date();

  // ---------- Hoja 1: Resumen ----------
  const ws = wb.addWorksheet(L.sh1, { views: [{ showGridLines: false }], properties: { defaultRowHeight: 18 } });
  ws.columns = [{ width: 20 }, { width: 20 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }];

  const fill = (h: string) => ({ type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: argb(h) } });
  const setBand = (row: number, label: string) => {
    ws.mergeCells(row, 1, row, 14);
    const c = ws.getCell(row, 1); c.value = label; c.fill = fill(C.brand); c.font = { color: { argb: argb(C.bandTxt) }, bold: true, size: 12 };
    c.alignment = { vertical: 'middle', indent: 1 }; ws.getRow(row).height = 24;
  };
  const kv = (row: number, k: string, v: string) => {
    const a = ws.getCell(row, 1), b = ws.getCell(row, 2);
    a.value = k; a.font = { color: { argb: argb(C.mut) }, size: 11 };
    b.value = v; b.font = { color: { argb: argb(C.ink) }, bold: true, size: 11 };
    ws.mergeCells(row, 2, row, 5);
  };

  // Título
  ws.mergeCells('A1:N2');
  const t = ws.getCell('A1'); t.value = L.app; t.fill = fill(C.head); t.font = { color: { argb: argb('FFFFFF') }, bold: true, size: 18 };
  t.alignment = { vertical: 'middle', indent: 1 }; ws.getRow(1).height = 20; ws.getRow(2).height = 20;
  // Foto de perfil (si vino) arriba a la derecha del título.
  if (o.avatar && o.avatar.length) {
    try {
      const aId = wb.addImage({ buffer: o.avatar as any, extension: 'png' });
      ws.addImage(aId, { tl: { col: 12.15, row: 0.15 } as any, ext: { width: 46, height: 46 } });
    } catch { /* imagen inválida: seguir sin ella */ }
  }
  ws.mergeCells('A3:N3');
  const sub = ws.getCell('A3'); sub.value = `${L.period}: ${o.from} - ${o.to}      ·      ${L.gen}: ${o.generated} UTC      ·      ${L.currency}: ${o.currency}`;
  sub.fill = fill(C.soft); sub.font = { color: { argb: argb(C.mut) }, size: 10.5 }; sub.alignment = { vertical: 'middle', indent: 1 }; ws.getRow(3).height = 20;

  let r = 5;
  setBand(r, L.prof); r++;
  kv(r++, L.name, o.profile.name || L.dash);
  kv(r++, L.style, o.profile.style || L.dash);
  kv(r++, L.exp, o.profile.experience || L.dash);
  kv(r++, L.goal, o.profile.goal || L.dash);
  kv(r++, L.country, countryName(o.profile.country, o.lang) || L.dash);
  r++;
  setBand(r, L.port); r++;
  kv(r++, L.bal, `${o.currency} ${o.portfolio.totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  kv(r++, L.accs, String(o.portfolio.accounts));
  r++;

  // Tarjetas KPI (2 filas de tarjetas coloreadas)
  setBand(r, L.sum); r++;
  const kpiTop = r;
  o.kpis.forEach((k, i) => {
    const col = 1 + (i % 4) * 3;           // columnas 1,4,7,10
    const rowL = kpiTop + Math.floor(i / 4) * 3;
    const bg = k.tone === 'good' ? C.goodBg : k.tone === 'bad' ? C.badBg : C.neutralBg;
    const fg = k.tone === 'good' ? C.good : k.tone === 'bad' ? C.bad : C.brand;
    ws.mergeCells(rowL, col, rowL, col + 2);
    ws.mergeCells(rowL + 1, col, rowL + 1, col + 2);
    const lc = ws.getCell(rowL, col); lc.value = k.label.toUpperCase(); lc.fill = fill(bg); lc.font = { color: { argb: argb(C.mut) }, bold: true, size: 9 }; lc.alignment = { vertical: 'middle', indent: 1 };
    const vc = ws.getCell(rowL + 1, col); vc.value = k.value; vc.fill = fill(bg); vc.font = { color: { argb: argb(fg) }, bold: true, size: 15 }; vc.alignment = { vertical: 'middle', indent: 1 };
    ws.getRow(rowL).height = 16; ws.getRow(rowL + 1).height = 24;
  });
  r = kpiTop + Math.ceil(o.kpis.length / 4) * 3 + 1;

  // Gráfica incrustada (PNG)
  try {
    const png = chartPng(o);
    const imgId = wb.addImage({ buffer: png as any, extension: 'png' });
    ws.addImage(imgId, { tl: { col: 0, row: r - 1 }, ext: { width: 960, height: 560 } });
    r += 30; // reservar espacio bajo la imagen
  } catch { /* si canvas falla, seguimos sin la imagen */ }

  // ---------- Tabla Por instrumento (misma hoja, debajo) ----------
  setBand(r, L.sym); r++;
  const symHead = r;
  ['', L.symH, L.n, L.net].forEach((h, i) => { const c = ws.getCell(symHead, 1 + i); c.value = h; c.font = { bold: true, size: 10, color: { argb: argb(C.head) } }; c.fill = fill(C.soft); });
  r++;
  const syms = [...o.bySym].sort((a, b) => b.net - a.net);
  syms.forEach((s) => {
    ws.getCell(r, 2).value = s.sym;
    ws.getCell(r, 3).value = s.n;
    const nc = ws.getCell(r, 4); nc.value = s.net; nc.numFmt = nfMoney; nc.font = { bold: true, color: { argb: argb(s.net >= 0 ? C.good : C.bad) } };
    r++;
  });

  // ---------- Hoja 2: Operaciones ----------
  const ws2 = wb.addWorksheet(L.sh2, { views: [{ showGridLines: false, state: 'frozen', ySplit: 1 }] });
  const heads = [L.open, L.close, L.symH, L.side, L.vol, L.dur, L.net, L.gross, L.comm, L.swap];
  ws2.columns = heads.map((h, i) => ({ header: h, key: 'c' + i, width: i < 2 ? 20 : i === 5 ? 12 : 13 }));
  const hr = ws2.getRow(1); hr.height = 22;
  hr.eachCell((c) => { c.fill = fill(C.brand); c.font = { color: { argb: argb('FFFFFF') }, bold: true, size: 10.5 }; c.alignment = { vertical: 'middle' }; });
  o.trades.forEach((tr, i) => {
    const row = ws2.addRow([tr.open, tr.close, tr.sym, tr.side, tr.vol, tr.dur, tr.net, tr.gross ? Number(tr.gross) : '', tr.commission ? Number(tr.commission) : '', tr.swap ? Number(tr.swap) : '']);
    if (i % 2) row.eachCell((c) => { if (!c.fill || (c.fill as any).pattern !== 'solid') c.fill = fill(C.soft); });
    const nc = row.getCell(7); nc.numFmt = nfMoney; nc.font = { bold: true, color: { argb: argb(tr.net >= 0 ? C.good : C.bad) } };
    row.getCell(8).numFmt = nfMoney; row.getCell(9).numFmt = nfMoney; row.getCell(10).numFmt = nfMoney;
  });

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out as ArrayBuffer);
}
