import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { reportPage, toCsvRows } from '@/lib/reportHtml';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function range(sp: URLSearchParams): [string, string] {
  const now = new Date();
  const f = sp.get('from') || new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
  const t = sp.get('to') || now.toISOString().slice(0, 10);
  return [f, t];
}
const num = (n: number) => (Math.round(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Reporte de rendimiento del trader que ha iniciado sesión (solo sus datos).
export async function GET(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return new NextResponse('No autorizado', { status: 401 });

  const sp = new URL(req.url).searchParams;
  const es = sp.get('lang') !== 'en';
  const [from, to] = range(sp);

  const { data: accs } = await sb.from('trading_accounts').select('id,currency,balance').eq('user_id', user.id);
  const allIds = (accs || []).map((a) => a.id);
  // Cuenta seleccionada (acc): si viene una cuenta concreta (y es del usuario), el
  // reporte se limita a ELLA; si es 'all' o no viene, usa todas. Antes se ignoraba,
  // así que el reporte salía igual sin importar la cuenta elegida.
  const accParam = sp.get('acc') || '';
  const accIds = (accParam && accParam !== 'all' && allIds.includes(accParam)) ? [accParam] : allIds;
  const selAcc = accIds.length === 1 && accParam && accParam !== 'all' ? (accs || []).find((a: any) => a.id === accParam) : null;
  const cur = ((selAcc?.currency || (accs || [])[0]?.currency || 'USD') as string).toUpperCase();
  const totalBalance = selAcc ? Number(selAcc.balance || 0) : (accs || []).reduce((s, a: any) => s + Number(a.balance || 0), 0);
  // Perfil del trader para la cabecera del reporte (tolerante si faltan columnas).
  let prof: any = {};
  try { const r = await sb.from('profiles').select('full_name,avatar_url,trade_style,experience,goal,country').eq('id', user.id).maybeSingle(); prof = r.data || {}; } catch {}
  let trades: any[] = [];
  if (accIds.length) {
    const { data } = await sb.from('trades').select('symbol,side,volume,open_time,close_time,net_profit,profit,commission,swap')
      .in('account_id', accIds)
      .gte('close_time', from + 'T00:00:00Z').lte('close_time', to + 'T23:59:59Z')
      .order('close_time', { ascending: false }).limit(10000);
    trades = data || [];
  }
  const net = (t: any) => Number(t.net_profit ?? t.profit ?? 0) || 0;

  const total = trades.length;
  let wins = 0, grossWin = 0, grossLoss = 0, netTotal = 0, best = -Infinity, worst = Infinity;
  const bySym: Record<string, { n: number; net: number }> = {};
  for (const t of trades) {
    const p = net(t); netTotal += p;
    if (p >= 0) { wins++; grossWin += p; } else grossLoss += -p;
    best = Math.max(best, p); worst = Math.min(worst, p);
    const k = t.symbol || '—'; bySym[k] = bySym[k] || { n: 0, net: 0 }; bySym[k].n++; bySym[k].net += p;
  }
  const winRate = total ? Math.round((wins / total) * 1000) / 10 : 0;
  const pf = grossLoss > 0 ? Math.round((grossWin / grossLoss) * 100) / 100 : (grossWin > 0 ? 99 : 0);
  const avg = total ? netTotal / total : 0;

  const T = es
    ? { title: 'Reporte de rendimiento', pnl: 'Resultado neto', trades: 'Operaciones', win: 'Aciertos', pf: 'Factor de beneficio', avg: 'Media por operación', best: 'Mejor', worst: 'Peor', bySym: 'Por instrumento', sym: 'Instrumento', n: 'Ops', net: 'Neto', list: 'Operaciones', side: 'Tipo', vol: 'Vol', close: 'Cierre' }
    : { title: 'Performance report', pnl: 'Net result', trades: 'Trades', win: 'Win rate', pf: 'Profit factor', avg: 'Avg per trade', best: 'Best', worst: 'Worst', bySym: 'By instrument', sym: 'Instrument', n: 'Trades', net: 'Net', list: 'Trades', side: 'Side', vol: 'Vol', close: 'Close' };

  // Resumen JSON ligero para la tarjeta compartible (dashboard → Compartir).
  if (sp.get('export') === 'json') {
    // Mapa local de estilo (styleMap se declara más abajo → evitamos el TDZ).
    const styleMapJ: any = { scalping: 'Scalper', day: 'Day Trader', swing: 'Swing Trader', position: 'Position Trader', algo: 'Algo/Robots' };
    const chronoJ = [...trades].reverse();
    let cumJ = 0; const equityJ = [0, ...chronoJ.map((t) => (cumJ += net(t)))];
    const pct = totalBalance > 0 ? Math.round((netTotal / totalBalance) * 1000) / 10 : 0;
    return NextResponse.json({
      name: prof.full_name || '', avatar: prof.avatar_url || '',
      style: styleMapJ[prof.trade_style] || prof.trade_style || '',
      currency: cur, from, to,
      net: Math.round(netTotal * 100) / 100, pct,
      winRate, pf, trades: total,
      best: total ? Math.round(best * 100) / 100 : 0, worst: total ? Math.round(worst * 100) / 100 : 0,
      equity: equityJ,
    });
  }

  if (sp.get('export') === 'csv') {
    // CSV rico: cabecera + resumen + portafolio + perfil + por instrumento + lista
    // completa de operaciones (con apertura, cierre, duración y desglose de costes).
    const styleMapC: any = { scalping: 'Scalper', day: 'Day Trader', swing: 'Swing Trader', position: 'Position Trader', algo: 'Algo/Robots' };
    const expMapC: any = { novato: es ? 'Principiante' : 'Beginner', intermedio: es ? 'Intermedio' : 'Intermediate', avanzado: es ? 'Avanzado' : 'Advanced', pro: 'Pro' };
    const goalMapC: any = { pasar_challenge: es ? 'Pasar reto' : 'Pass challenge', consistencia: es ? 'Consistencia' : 'Consistency', crecer: es ? 'Crecer cuenta' : 'Grow account', vivir: es ? 'Vivir del trading' : 'Trade for a living' };
    const dur = (t: any) => {
      const a = t.open_time ? Date.parse(t.open_time) : NaN, b = t.close_time ? Date.parse(t.close_time) : NaN;
      if (!isFinite(a) || !isFinite(b) || b < a) return '';
      const m = Math.round((b - a) / 60000);
      if (m < 60) return m + 'm';
      if (m < 1440) return Math.floor(m / 60) + 'h ' + (m % 60) + 'm';
      return Math.floor(m / 1440) + 'd ' + Math.floor((m % 1440) / 60) + 'h';
    };
    const symRowsC = Object.entries(bySym).sort((a, b) => b[1].net - a[1].net).map(([s, v]) => [s, String(v.n), num(v.net)]);
    const L = es
      ? { app: 'Onyx Trading — Reporte de rendimiento', period: 'Período', gen: 'Generado', currency: 'Moneda', S_prof: 'PERFIL DEL TRADER', name: 'Nombre', style: 'Estilo', exp: 'Experiencia', goal: 'Meta', country: 'País', S_port: 'PORTAFOLIO', bal: 'Balance total', accs: 'Cuentas', S_sum: 'RESUMEN', S_sym: 'POR INSTRUMENTO', S_list: 'OPERACIONES', open: 'Apertura', close: 'Cierre', durc: 'Duración', gross: 'Bruto', metric: 'Métrica', value: 'Valor' }
      : { app: 'Onyx Trading — Performance report', period: 'Period', gen: 'Generated', currency: 'Currency', S_prof: 'TRADER PROFILE', name: 'Name', style: 'Style', exp: 'Experience', goal: 'Goal', country: 'Country', S_port: 'PORTFOLIO', bal: 'Total balance', accs: 'Accounts', S_sum: 'SUMMARY', S_sym: 'BY INSTRUMENT', S_list: 'TRADES', open: 'Open', close: 'Close', durc: 'Duration', gross: 'Gross', metric: 'Metric', value: 'Value' };
    const blank: string[] = [];
    const rows: string[][] = [
      [L.app],
      [L.period, from + ' → ' + to],
      [L.gen, new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC'],
      [L.currency, cur],
      blank,
      [L.S_prof],
      [L.name, prof.full_name || '—'],
      [L.style, styleMapC[prof.trade_style] || prof.trade_style || '—'],
      [L.exp, expMapC[prof.experience] || '—'],
      [L.goal, goalMapC[prof.goal] || '—'],
      [L.country, prof.country || '—'],
      blank,
      [L.S_port],
      [L.bal, cur + ' ' + num(totalBalance)],
      [L.accs, String(accIds.length)],
      blank,
      [L.S_sum],
      [L.metric, L.value],
      [T.pnl, cur + ' ' + num(netTotal)],
      [T.trades, String(total)],
      [T.win, winRate + '%'],
      [T.pf, String(pf)],
      [T.avg, cur + ' ' + num(avg)],
      [T.best, total ? num(best) : '—'],
      [T.worst, total ? num(worst) : '—'],
      blank,
      [L.S_sym],
      [T.sym, T.n, T.net],
      ...symRowsC,
      blank,
      [L.S_list],
      [L.open, L.close, T.sym, T.side, T.vol, L.durc, T.net, L.gross, 'commission', 'swap'],
      ...trades.map((t) => [
        (t.open_time || '').slice(0, 19).replace('T', ' '),
        (t.close_time || '').slice(0, 19).replace('T', ' '),
        t.symbol || '', t.side || '', String(t.volume ?? ''), dur(t),
        num(net(t)), t.profit != null ? num(Number(t.profit)) : '', String(t.commission ?? ''), String(t.swap ?? ''),
      ]),
    ];
    const csv = toCsvRows(rows);
    return new NextResponse(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="onyx-reporte-${from}.csv"` } });
  }

  const symRows = Object.entries(bySym).sort((a, b) => b[1].net - a[1].net).map(([s, v]) => [s, String(v.n), cur + ' ' + num(v.net)]);
  // Curva de resultados: acumulado cronológico (los trades vienen desc → invertir).
  const chrono = [...trades].reverse();
  let cum = 0; const equity = [0, ...chrono.map((t) => (cum += net(t)))];
  const losses = total - wins;
  // Etiquetas legibles del perfil (los códigos del catálogo → texto).
  const styleMap: any = { scalping: es ? 'Scalper' : 'Scalper', day: 'Day Trader', swing: 'Swing Trader', position: 'Position Trader', algo: es ? 'Algo/Robots' : 'Algo/Robots' };
  const expMap: any = { novato: es ? 'Principiante' : 'Beginner', intermedio: es ? 'Intermedio' : 'Intermediate', avanzado: es ? 'Avanzado' : 'Advanced', pro: 'Pro' };
  const goalMap: any = { pasar_challenge: es ? 'Pasar reto' : 'Pass challenge', consistencia: es ? 'Consistencia' : 'Consistency', crecer: es ? 'Crecer cuenta' : 'Grow account', vivir: es ? 'Vivir del trading' : 'Trade for a living' };

  // ---- PDF de verdad (server-side, con pdf-lib) ----
  // El webview de Android NO soporta window.print(), así que el botón "Imprimir /
  // PDF" en la app descarga ESTE PDF real. Mismo layout limpio, bilingüe, con
  // cabecera del trader, resultado grande, KPIs, por instrumento y lista de ops.
  if (sp.get('export') === 'pdf') {
    const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
    const durP = (t: any) => {
      const a = t.open_time ? Date.parse(t.open_time) : NaN, b = t.close_time ? Date.parse(t.close_time) : NaN;
      if (!isFinite(a) || !isFinite(b) || b < a) return '';
      const m = Math.round((b - a) / 60000);
      if (m < 60) return m + 'm';
      if (m < 1440) return Math.floor(m / 60) + 'h ' + (m % 60) + 'm';
      return Math.floor(m / 1440) + 'd ' + Math.floor((m % 1440) / 60) + 'h';
    };
    const L = es
      ? { app: 'Onyx Trading Live', title: 'Reporte de rendimiento', period: 'Período', gen: 'Generado', name: 'Nombre', style: 'Estilo', exp: 'Experiencia', goal: 'Meta', country: 'País', bal: 'Balance total', accs: 'Cuentas', S_sym: 'Por instrumento', S_list: 'Operaciones', open: 'Apertura', close: 'Cierre', durc: 'Duración', page: 'Página' }
      : { app: 'Onyx Trading Live', title: 'Performance report', period: 'Period', gen: 'Generated', name: 'Name', style: 'Style', exp: 'Experience', goal: 'Goal', country: 'Country', bal: 'Total balance', accs: 'Accounts', S_sym: 'By instrument', S_list: 'Trades', open: 'Open', close: 'Close', durc: 'Duration', page: 'Page' };

    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const PW = 595.28, PH = 841.89, M = 40;          // A4 en puntos
    const INK = rgb(0.09, 0.10, 0.15), MUT = rgb(0.42, 0.45, 0.55);
    const BRAND = rgb(0.31, 0.36, 0.86), LINE = rgb(0.88, 0.89, 0.93);
    const GOOD = rgb(0.09, 0.55, 0.33), BAD = rgb(0.80, 0.20, 0.24);

    let page = doc.addPage([PW, PH]);
    let y = PH - M;
    // Recorta un texto para que no se salga del ancho dado.
    const clip = (s: string, f: any, size: number, maxW: number) => {
      s = String(s ?? '');
      if (f.widthOfTextAtSize(s, size) <= maxW) return s;
      while (s.length > 1 && f.widthOfTextAtSize(s + '…', size) > maxW) s = s.slice(0, -1);
      return s + '…';
    };
    const text = (s: string, x: number, yy: number, o: { f?: any; size?: number; color?: any; right?: number } = {}) => {
      const f = o.f || font, size = o.size || 10;
      let xx = x;
      if (o.right != null) xx = o.right - f.widthOfTextAtSize(String(s ?? ''), size);
      page.drawText(String(s ?? ''), { x: xx, y: yy, size, font: f, color: o.color || INK });
    };
    const newPageIfNeeded = (need: number) => {
      if (y - need < M + 24) {
        page = doc.addPage([PW, PH]); y = PH - M;
      }
    };

    // Cabecera de marca.
    page.drawRectangle({ x: 0, y: PH - 6, width: PW, height: 6, color: BRAND });
    text(L.app, M, y - 8, { f: bold, size: 16, color: BRAND });
    text(L.title, M, y - 26, { f: bold, size: 12, color: INK });
    text(`${L.period}: ${from}  →  ${to}`, M, y - 42, { size: 9, color: MUT });
    text(`${L.gen}: ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`, PW - M, y - 42, { size: 8, color: MUT, right: PW - M });
    y -= 58;
    page.drawLine({ start: { x: M, y }, end: { x: PW - M, y }, thickness: 1, color: LINE });
    y -= 22;

    // Perfil del trader.
    const profRows: [string, string][] = [
      [L.name, prof.full_name || '—'],
      [L.style, styleMap[prof.trade_style] || prof.trade_style || '—'],
      [L.exp, expMap[prof.experience] || '—'],
      [L.goal, goalMap[prof.goal] || '—'],
      [L.country, prof.country || '—'],
      [L.bal, cur + ' ' + num(totalBalance)],
      [L.accs, String(accIds.length)],
    ];
    const colW = (PW - M * 2) / 2;
    for (let i = 0; i < profRows.length; i += 2) {
      for (let c = 0; c < 2 && i + c < profRows.length; c++) {
        const [k, v] = profRows[i + c];
        const x = M + c * colW;
        text(k.toUpperCase(), x, y, { f: bold, size: 7, color: MUT });
        text(clip(v, font, 11, colW - 8), x, y - 13, { size: 11, color: INK });
      }
      y -= 32;
    }
    y -= 6;

    // Resultado grande.
    page.drawLine({ start: { x: M, y }, end: { x: PW - M, y }, thickness: 1, color: LINE });
    y -= 26;
    text(T.pnl.toUpperCase(), M, y, { f: bold, size: 8, color: MUT });
    y -= 30;
    text(cur + ' ' + num(netTotal), M, y, { f: bold, size: 30, color: netTotal >= 0 ? GOOD : BAD });
    y -= 34;

    // KPIs en tarjetas (2 filas de 3-4).
    const kpis: [string, string, any][] = [
      [T.trades, String(total), INK],
      [T.win, winRate + '%', winRate >= 50 ? GOOD : INK],
      [T.pf, String(pf), pf >= 1.3 ? GOOD : pf < 1 ? BAD : INK],
      [T.avg, cur + ' ' + num(avg), avg >= 0 ? GOOD : BAD],
      [T.best, total ? num(best) : '—', GOOD],
      [T.worst, total ? num(worst) : '—', BAD],
    ];
    const perRow = 3, gap = 10, cardW = (PW - M * 2 - gap * (perRow - 1)) / perRow, cardH = 46;
    for (let i = 0; i < kpis.length; i++) {
      const col = i % perRow, row = Math.floor(i / perRow);
      const x = M + col * (cardW + gap);
      const cy = y - row * (cardH + gap);
      page.drawRectangle({ x, y: cy - cardH, width: cardW, height: cardH, borderColor: LINE, borderWidth: 1, color: rgb(0.98, 0.98, 0.99) });
      text(kpis[i][0].toUpperCase(), x + 10, cy - 16, { f: bold, size: 7, color: MUT });
      text(kpis[i][1], x + 10, cy - 34, { f: bold, size: 14, color: kpis[i][2] });
    }
    y -= Math.ceil(kpis.length / perRow) * (cardH + gap) + 10;

    // Por instrumento.
    const symRowsP = Object.entries(bySym).sort((a, b) => b[1].net - a[1].net).map(([s, v]) => [s, String(v.n), num(v.net)]);
    newPageIfNeeded(40 + symRowsP.length * 16);
    text(L.S_sym, M, y, { f: bold, size: 11, color: INK });
    y -= 16;
    const scX = [M, M + 260, PW - M];   // instrumento | ops(right) | neto(right)
    text(T.sym, scX[0], y, { f: bold, size: 8, color: MUT });
    text(T.n, scX[1], y, { f: bold, size: 8, color: MUT, right: scX[1] });
    text(T.net, scX[2], y, { f: bold, size: 8, color: MUT, right: scX[2] });
    y -= 6;
    page.drawLine({ start: { x: M, y }, end: { x: PW - M, y }, thickness: 0.8, color: LINE });
    y -= 14;
    for (const r of symRowsP) {
      newPageIfNeeded(18);
      text(clip(r[0], font, 9, 240), scX[0], y, { size: 9 });
      text(r[1], scX[1], y, { size: 9, right: scX[1] });
      text(r[2], scX[2], y, { size: 9, color: Number(r[2].replace(/,/g, '')) < 0 ? BAD : INK, right: scX[2] });
      y -= 16;
    }
    y -= 12;

    // Lista de operaciones (máx 200).
    const listT = trades.slice(0, 200);
    newPageIfNeeded(40);
    text(`${L.S_list} (${total})`, M, y, { f: bold, size: 11, color: INK });
    y -= 16;
    // cierre | símbolo | tipo | vol | duración | neto(right)
    const cX = [M, M + 118, M + 210, M + 260, M + 300, PW - M];
    const head = [L.close, T.sym, T.side, T.vol, L.durc, T.net];
    for (let i = 0; i < head.length; i++) {
      const isNet = i === head.length - 1;
      text(head[i], cX[i], y, { f: bold, size: 7.5, color: MUT, right: isNet ? cX[i] : undefined });
    }
    y -= 6;
    page.drawLine({ start: { x: M, y }, end: { x: PW - M, y }, thickness: 0.8, color: LINE });
    y -= 13;
    for (const t of listT) {
      newPageIfNeeded(16);
      const nv = net(t);
      text((t.close_time || '').slice(0, 16).replace('T', ' '), cX[0], y, { size: 8, color: MUT });
      text(clip(t.symbol || '', font, 8, 86), cX[1], y, { size: 8 });
      text(t.side || '', cX[2], y, { size: 8 });
      text(String(t.volume ?? ''), cX[3], y, { size: 8 });
      text(durP(t), cX[4], y, { size: 8, color: MUT });
      text(num(nv), cX[5], y, { size: 8, color: nv < 0 ? BAD : GOOD, right: cX[5] });
      y -= 15;
    }

    // Pie de página con numeración.
    const pages = doc.getPages();
    pages.forEach((p, i) => {
      p.drawText(`${L.app} · ${L.page} ${i + 1}/${pages.length}`, { x: M, y: 22, size: 7, font, color: MUT });
    });

    const bytes = await doc.save();
    return new NextResponse(Buffer.from(bytes) as any, { headers: { 'content-type': 'application/pdf', 'content-disposition': `attachment; filename="onyx-reporte-${from}.pdf"` } });
  }

  // ---- Excel (.xlsx) con formato + gráficas incrustadas ----
  if (sp.get('export') === 'xlsx') {
    const { buildReportXlsx } = await import('@/lib/reportXlsx');
    // Foto de perfil (best-effort): la bajamos y la convertimos a PNG con sharp.
    let avatarBuf: Buffer | null = null;
    if (prof.avatar_url && /^https?:\/\//.test(prof.avatar_url)) {
      try {
        const ab = await fetch(prof.avatar_url).then((r) => (r.ok ? r.arrayBuffer() : null));
        if (ab) {
          const sharp = (await import('sharp')).default;
          avatarBuf = await sharp(Buffer.from(ab)).resize(92, 92, { fit: 'cover' }).png().toBuffer();
        }
      } catch { avatarBuf = null; }
    }
    const durX = (t: any) => {
      const a = t.open_time ? Date.parse(t.open_time) : NaN, b = t.close_time ? Date.parse(t.close_time) : NaN;
      if (!isFinite(a) || !isFinite(b) || b < a) return '';
      const m = Math.round((b - a) / 60000);
      if (m < 60) return m + 'm';
      if (m < 1440) return Math.floor(m / 60) + 'h ' + (m % 60) + 'm';
      return Math.floor(m / 1440) + 'd ' + Math.floor((m % 1440) / 60) + 'h';
    };
    const buf = await buildReportXlsx({
      lang: es ? 'es' : 'en', from, to, generated: new Date().toISOString().slice(0, 16).replace('T', ' '),
      currency: cur,
      profile: {
        name: prof.full_name || '', style: styleMap[prof.trade_style] || prof.trade_style || '',
        experience: expMap[prof.experience] || '', goal: goalMap[prof.goal] || '', country: prof.country || '',
      },
      portfolio: { totalBalance, accounts: accIds.length },
      kpis: [
        { label: T.pnl, value: cur + ' ' + num(netTotal), tone: netTotal >= 0 ? 'good' : 'bad' },
        { label: T.trades, value: String(total), tone: 'neutral' },
        { label: T.win, value: winRate + '%', tone: winRate >= 50 ? 'good' : 'neutral' },
        { label: T.pf, value: String(pf), tone: pf >= 1.3 ? 'good' : pf < 1 ? 'bad' : 'neutral' },
        { label: T.avg, value: cur + ' ' + num(avg), tone: avg >= 0 ? 'good' : 'bad' },
        { label: T.best, value: total ? num(best) : '—', tone: 'good' },
        { label: T.worst, value: total ? num(worst) : '—', tone: 'bad' },
      ],
      equity,
      bySym: Object.entries(bySym).sort((a, b) => b[1].net - a[1].net).map(([s, v]) => ({ sym: s, n: v.n, net: v.net })),
      winLoss: { wins, losses },
      trades: trades.map((t) => ({
        open: (t.open_time || '').slice(0, 16).replace('T', ' '), close: (t.close_time || '').slice(0, 16).replace('T', ' '),
        sym: t.symbol || '', side: t.side || '', vol: String(t.volume ?? ''), dur: durX(t),
        net: net(t), gross: t.profit != null ? String(Number(t.profit)) : '', commission: String(t.commission ?? ''), swap: String(t.swap ?? ''),
      })),
      avatar: avatarBuf,
    });
    return new NextResponse(buf as any, { headers: { 'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'content-disposition': `attachment; filename="onyx-reporte-${from}.xlsx"` } });
  }

  const html = reportPage({
    lang: es ? 'es' : 'en', from, to,
    profile: {
      name: prof.full_name || '', avatar: prof.avatar_url || '',
      style: styleMap[prof.trade_style] || prof.trade_style || '',
      experience: expMap[prof.experience] || '', goal: goalMap[prof.goal] || '', country: prof.country || '',
    },
    portfolio: { totalBalance, accounts: accIds.length, currency: cur },
    equity,
    winLoss: { wins, losses },
    bySym: Object.entries(bySym).sort((a, b) => b[1].net - a[1].net).map(([s, v]) => ({ sym: s, n: v.n, net: v.net })),
    kpis: [
      { label: T.pnl, value: cur + ' ' + num(netTotal), tone: netTotal >= 0 ? 'good' : 'bad' },
      { label: T.trades, value: String(total), tone: 'neutral' },
      { label: T.win, value: winRate + '%', tone: winRate >= 50 ? 'good' : 'neutral' },
      { label: T.pf, value: String(pf), tone: pf >= 1.3 ? 'good' : pf < 1 ? 'bad' : 'neutral' },
      { label: T.avg, value: cur + ' ' + num(avg), tone: avg >= 0 ? 'good' : 'bad' },
      { label: T.best, value: total ? num(best) : '—', tone: 'good' },
      { label: T.worst, value: total ? num(worst) : '—', tone: 'bad' },
    ],
    tables: [
      { title: T.bySym, head: [T.sym, T.n, T.net], alignRight: [1, 2], rows: symRows },
      { title: T.list, head: [T.close, T.sym, T.side, T.vol, T.net], alignRight: [3, 4], rows: trades.slice(0, 200).map((t) => [(t.close_time || '').slice(0, 16).replace('T', ' '), t.symbol || '', t.side || '', String(t.volume ?? ''), num(net(t))]) },
    ],
  });
  return new NextResponse(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}
