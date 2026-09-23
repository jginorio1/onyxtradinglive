// Propuesta de reclutamiento para vendedores.
//
// Calcula los ejemplos de ganancia a partir de los MISMOS parámetros del panel
// de Ventas (impulso 1.er mes, residual, overrides, metas, bono, ascensos) y
// genera un PDF de marca para enviar por correo a un candidato. Si el admin
// cambia un parámetro, los ejemplos del PDF salen recalculados: aquí no hay
// números fijos, todo sale de `s`.
//
// La propuesta está pensada para PERSUADIR: muestra el potencial real con la
// "bola de nieve" (el ingreso mensual crece solo al acumular clientes), qué
// parte del dinero es recurrente vs del primer mes, y por qué Onyx es la mejor
// opción (carrera + overrides + bonos). El escenario (clientes/mes) es
// ajustable al generar cada propuesta.

export type ProposalSettings = {
  direct_rate?: number; override1_rate?: number; override2_rate?: number;
  boost_first_month?: boolean; first_direct_rate?: number; first_override1_rate?: number; first_override2_rate?: number;
  first_sales_count?: number; first_sales_bonus?: number; commission_months?: number;
  goal_clients?: number; goal_amount?: number; goal_bonus?: number;
  promote_to_l1_clients?: number; promote_to_l2_team?: number;
  level_names?: { l2?: string; l1?: string; vendedor?: string };
};

export type ProposalData = {
  price: number;
  firstDirectPct: number; residualDirectPct: number;
  perFirst: number; perMonthly: number; perYear1: number; monthsPaid: number; infinite: boolean;
  rows: { clients: number; first: number; monthly: number; year1: number }[];
  overrides: { l1First: number; l2First: number; l1Res: number; l2Res: number };
  ladder: { advisor: string; lead: string; director: string; toLead: number; toDirector: number };
  goal: { clients: number; amount: number; bonus: number };
  firstBonus: { count: number; bonus: number } | null;
  includeOverrides: boolean;
  candidateName?: string;
  // --- persuasión ---
  clientsPerMonth: number;          // escenario elegido
  monthly: number[];                // ingreso mensual (12 meses), la "bola de nieve"
  potentialMonthly: number;         // ingreso del mes 12 (a dónde llegas)
  totalYear1: number;               // suma de los 12 meses
  activeYear1: number;              // clientes activos al final del año (cpm*12)
  mixFirst: number;                 // $ del año que viene del 1.er mes
  mixResidual: number;              // $ del año que es recurrente
  mixResidualPct: number;           // % recurrente (el argumento fuerte)
};

const n = (v: any, d = 0) => { const x = Number(v); return Number.isFinite(x) ? x : d; };
const r0 = (v: number) => Math.round(v || 0);

// Calcula toda la propuesta a partir de los parámetros actuales.
export function proposalData(s: ProposalSettings, opts?: { price?: number; months?: number; includeOverrides?: boolean; candidateName?: string; clientsPerMonth?: number }): ProposalData {
  const price = Math.max(1, n(opts?.price, 100));
  const boost = !!s.boost_first_month;
  const firstDirectPct = boost ? n(s.first_direct_rate, n(s.direct_rate)) : n(s.direct_rate);
  const residualDirectPct = n(s.direct_rate);
  const l1First = boost ? n(s.first_override1_rate, n(s.override1_rate)) : n(s.override1_rate);
  const l2First = boost ? n(s.first_override2_rate, n(s.override2_rate)) : n(s.override2_rate);
  const l1Res = n(s.override1_rate);
  const l2Res = n(s.override2_rate);

  const cm = n(s.commission_months, 0);              // 0 = ∞
  const infinite = cm <= 0;
  const horizon = 12;
  const monthsCap = infinite ? horizon : Math.min(cm, horizon);
  const monthsPaid = Math.max(1, monthsCap);

  const perFirst = r0(price * firstDirectPct / 100);
  const perMonthly = r0(price * residualDirectPct / 100);
  const perYear1 = perFirst + perMonthly * (monthsPaid - 1);

  const rows = [5, 10, 20].map((c) => ({ clients: c, first: perFirst * c, monthly: perMonthly * c, year1: perYear1 * c }));

  // --- Bola de nieve: cierras `cpm` clientes nuevos cada mes. Cada cliente paga
  // el 1.er mes (perFirst) y luego residual (perMonthly) mientras siga activo,
  // hasta agotar su ventana de comisión (commission_months; ∞ = todo el año).
  const cpm = Math.max(1, Math.round(n(opts?.clientsPerMonth, 3)));
  const residualCap = infinite ? horizon : Math.max(0, cm - 1);   // meses que paga residual
  const monthly: number[] = [];
  for (let m = 1; m <= horizon; m++) {
    let inc = cpm * perFirst;                        // los nuevos de este mes
    for (let k = 1; k < m; k++) {                    // cohortes anteriores
      const age = m - k;                             // 1 = su 2.º mes, etc.
      if (age <= residualCap) inc += cpm * perMonthly;
    }
    monthly.push(inc);
  }
  const totalYear1 = monthly.reduce((a, b) => a + b, 0);
  const potentialMonthly = monthly[horizon - 1];
  const mixFirst = horizon * cpm * perFirst;
  const mixResidual = Math.max(0, totalYear1 - mixFirst);
  const mixResidualPct = totalYear1 > 0 ? Math.round((mixResidual / totalYear1) * 100) : 0;

  const names = s.level_names || {};
  return {
    price, firstDirectPct, residualDirectPct, perFirst, perMonthly, perYear1, monthsPaid, infinite,
    rows,
    overrides: { l1First, l2First, l1Res, l2Res },
    ladder: {
      advisor: names.vendedor || 'Advisor', lead: names.l1 || 'Lead', director: names.l2 || 'Director',
      toLead: n(s.promote_to_l1_clients), toDirector: n(s.promote_to_l2_team),
    },
    goal: { clients: n(s.goal_clients), amount: n(s.goal_amount), bonus: n(s.goal_bonus) },
    firstBonus: boost && n(s.first_sales_count) > 0 && n(s.first_sales_bonus) > 0 ? { count: n(s.first_sales_count), bonus: n(s.first_sales_bonus) } : null,
    includeOverrides: opts?.includeOverrides !== false,
    candidateName: opts?.candidateName,
    clientsPerMonth: cpm,
    monthly, potentialMonthly, totalYear1, activeYear1: cpm * horizon,
    mixFirst, mixResidual, mixResidualPct,
  };
}

// Genera el PDF de la propuesta con pdf-lib (marca Onyx, gráficas y escalera).
export async function proposalPdf(d: ProposalData, opts?: { company?: string }): Promise<Uint8Array> {
  // @ts-ignore
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const brand = rgb(0.486, 0.549, 1);
  const dark = rgb(0.043, 0.059, 0.118);
  const ink = rgb(0.1, 0.12, 0.18);
  const gray = rgb(0.42, 0.45, 0.5);
  const green = rgb(0.106, 0.686, 0.478);   // recurrente
  const gold = rgb(0.933, 0.631, 0);        // primer mes
  const blue = rgb(0.165, 0.471, 0.839);    // bola de nieve
  const soft = rgb(0.9, 0.91, 0.94);
  const panel = rgb(0.97, 0.975, 0.985);

  const clean = (s: string) => String(s).replace(/[^\x00-\xFF]/g, '-');
  const money = (v: number) => `$${(Math.round(v || 0)).toLocaleString('en-US')}`;
  const T = (s: string, x: number, y: number, size: number, f = font, color = ink) => page.drawText(clean(s), { x, y, size, font: f, color });

  const W = 595;

  // ---- Cabecera de marca ----
  page.drawRectangle({ x: 0, y: 784, width: W, height: 58, color: dark });
  T('Onyx Trading Live', 40, 812, 15, bold, rgb(1, 1, 1));
  T('Propuesta para vendedores', 40, 794, 10, font, rgb(0.78, 0.8, 0.86));

  // ---- Titular emocional ----
  let y = 752;
  T(d.candidateName ? `Preparado para: ${d.candidateName}` : 'Unete a nuestro equipo de ventas', 40, y, 10.5, font, gray);
  y -= 22;
  T('Vende una vez. Cobra cada mes.', 40, y, 20, bold, dark);
  y -= 20;
  T(clean(`Con ${d.clientsPerMonth} clientes nuevos al mes, en 12 meses llegas a ${money(d.potentialMonthly)}/mes de ingreso recurrente.`), 40, y, 11, font, ink);
  y -= 26;

  // ---- Tarjetas de ganancia por cliente ----
  const gcell = (x: number, w: number, title: string, big: string, sub: string, col: any) => {
    page.drawRectangle({ x, y: y - 44, width: w, height: 56, borderColor: soft, borderWidth: 1, color: panel });
    T(title, x + 12, y - 4, 8.5, font, gray);
    T(big, x + 12, y - 26, 19, bold, col);
    T(sub, x + 12, y - 39, 7.5, font, gray);
  };
  gcell(40, 165, 'TU 1.ER MES POR CLIENTE', money(d.perFirst), `${d.firstDirectPct}% del primer pago`, gold);
  gcell(215, 165, 'CADA MES DESPUES', money(d.perMonthly), `${d.residualDirectPct}% mientras siga activo`, green);
  gcell(390, 165, 'ESE CLIENTE EN 1 ANO', money(d.perYear1), 'de un solo cliente', dark);
  y -= 66;

  // ---- Dona (recurrente vs 1.er mes) + curva bola de nieve ----
  const chartTop = y;
  const chartH = 150;
  // Panel izquierdo: dona
  page.drawRectangle({ x: 40, y: chartTop - chartH, width: 250, height: chartH, borderColor: soft, borderWidth: 1, color: rgb(1, 1, 1) });
  T('De donde viene tu dinero', 52, chartTop - 16, 10.5, bold, dark);
  T(clean(`Ano 1 - ${d.activeYear1} clientes`), 52, chartTop - 30, 8, font, gray);
  // dibujar dona con segmentos de arco (aprox. con triángulos)
  const cx = 108, cy = chartTop - 92, rOut = 40, rIn = 24;
  const drawRing = (start: number, end: number, col: any) => {
    const steps = Math.max(2, Math.round((end - start) / (Math.PI / 40)));
    for (let i = 0; i < steps; i++) {
      const a0 = start + (end - start) * (i / steps);
      const a1 = start + (end - start) * ((i + 1) / steps);
      const p0o = [cx + rOut * Math.cos(a0), cy + rOut * Math.sin(a0)];
      const p1o = [cx + rOut * Math.cos(a1), cy + rOut * Math.sin(a1)];
      const p0i = [cx + rIn * Math.cos(a0), cy + rIn * Math.sin(a0)];
      const p1i = [cx + rIn * Math.cos(a1), cy + rIn * Math.sin(a1)];
      page.drawLine({ start: { x: p0i[0], y: p0i[1] }, end: { x: p0o[0], y: p0o[1] }, thickness: 0, color: col });
      // relleno del sector con dos triángulos aproximados por líneas gruesas radiales
      const mid = (a0 + a1) / 2;
      const rmid = (rOut + rIn) / 2;
      page.drawLine({ start: { x: cx + rIn * Math.cos(mid), y: cy + rIn * Math.sin(mid) }, end: { x: cx + rOut * Math.cos(mid), y: cy + rOut * Math.sin(mid) }, thickness: (2 * Math.PI * rmid / steps) + 1.5, color: col });
    }
  };
  const pRes = d.mixResidualPct / 100;
  const a0 = -Math.PI / 2;
  const aRes = a0 + 2 * Math.PI * pRes;
  drawRing(a0, aRes, green);
  drawRing(aRes, a0 + 2 * Math.PI, gold);
  // leyenda dona
  page.drawRectangle({ x: 160, y: chartTop - 78, width: 9, height: 9, color: green });
  T(clean(`Recurrente ${d.mixResidualPct}%`), 173, chartTop - 77, 8.5, font, ink);
  page.drawRectangle({ x: 160, y: chartTop - 96, width: 9, height: 9, color: gold });
  T(clean(`1.er mes ${100 - d.mixResidualPct}%`), 173, chartTop - 95, 8.5, font, ink);
  T(money(d.totalYear1), 160, chartTop - 118, 12, bold, dark);
  T('total ano 1', 160, chartTop - 130, 7.5, font, gray);

  // Panel derecho: curva bola de nieve
  const bx = 305, bw = 250;
  page.drawRectangle({ x: bx, y: chartTop - chartH, width: bw, height: chartH, borderColor: soft, borderWidth: 1, color: rgb(1, 1, 1) });
  T('El efecto bola de nieve', bx + 12, chartTop - 16, 10.5, bold, dark);
  T('Ingreso mensual, mes 1 a 12', bx + 12, chartTop - 30, 8, font, gray);
  const gx0 = bx + 16, gx1 = bx + bw - 14, gy0 = chartTop - chartH + 22, gy1 = chartTop - 44;
  const maxV = Math.max(...d.monthly, 1);
  const px = (i: number) => gx0 + (gx1 - gx0) * (i / (d.monthly.length - 1));
  const py = (v: number) => gy0 + (gy1 - gy0) * (v / maxV);
  // eje base
  page.drawLine({ start: { x: gx0, y: gy0 }, end: { x: gx1, y: gy0 }, thickness: 0.7, color: soft });
  // área + línea
  for (let i = 0; i < d.monthly.length - 1; i++) {
    page.drawLine({ start: { x: px(i), y: py(d.monthly[i]) }, end: { x: px(i + 1), y: py(d.monthly[i + 1]) }, thickness: 2, color: blue });
  }
  // punto final destacado con su etiqueta
  const lastX = px(d.monthly.length - 1), lastY = py(maxV);
  page.drawCircle({ x: lastX, y: lastY, size: 3, color: blue });
  const lbl = `${money(d.potentialMonthly)}/mes`;
  T(lbl, lastX - bold.widthOfTextAtSize(lbl, 10), lastY + 7, 10, bold, blue);
  T('M1', gx0, gy0 - 11, 7, font, gray);
  T('mes 12', gx1 - 26, gy0 - 11, 7, font, gray);
  y = chartTop - chartH - 20;

  // ---- Tabla por clientes ----
  T('Si cierras mas clientes', 40, y, 12, bold, dark); y -= 18;
  const cols = [40, 210, 330, 450];
  T('Clientes', cols[0], y, 9, bold, gray); T('1.er mes', cols[1], y, 9, bold, gold); T('Cada mes', cols[2], y, 9, bold, green); T('Ano 1', cols[3], y, 9, bold, dark);
  y -= 4; page.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 0.7, color: soft }); y -= 14;
  for (const rr of d.rows) {
    T(`${rr.clients} clientes`, cols[0], y, 11, font, ink);
    T(money(rr.first), cols[1], y, 11, font, gold);
    T(money(rr.monthly), cols[2], y, 11, font, green);
    T(money(rr.year1), cols[3], y, 11, bold, dark);
    y -= 18;
  }
  y -= 10;

  // ---- Por qué Onyx ----
  T('Por que Onyx es tu mejor opcion', 40, y, 12, bold, dark); y -= 18;
  const why = (t: string, s2: string) => { T(clean(`- ${t}: `), 40, y, 10, bold, ink); T(clean(s2), 40 + bold.widthOfTextAtSize(`- ${t}: `, 10), y, 10, font, gray); y -= 15; };
  why('Ingreso que se repite', 'no arrancas de cero: cobras cada mes que el cliente sigue.');
  why('Subes de nivel solo', `${d.ladder.advisor} -> ${d.ladder.lead} -> ${d.ladder.director}, y ganas de tu equipo.`);
  why('Bonos de arranque', 'tus primeras ventas y las metas del mes suman extra.');
  y -= 8;

  // ---- Carrera / overrides ----
  if (d.includeOverrides) {
    T('Tu carrera y lo que ganas de tu equipo', 40, y, 12, bold, dark); y -= 18;
    T(clean(`${d.ladder.advisor}  ->  ${d.ladder.lead}: al llegar a ${d.ladder.toLead} clientes activos.`), 40, y, 10.5, font, gray); y -= 15;
    T(clean(`${d.ladder.lead}  ->  ${d.ladder.director}: con ${d.ladder.toDirector} en su equipo.`), 40, y, 10.5, font, gray); y -= 15;
    T(clean(`Como ${d.ladder.lead} ganas +${d.overrides.l1Res}% de lo que venda tu equipo; como ${d.ladder.director}, +${d.overrides.l2Res}%.`), 40, y, 10.5, font, gray); y -= 20;
  }

  // ---- Metas y bonos ----
  if (d.goal.clients > 0 || d.goal.amount > 0 || d.firstBonus) {
    T('Metas y bonos', 40, y, 12, bold, dark); y -= 18;
    if (d.goal.bonus > 0 && (d.goal.clients > 0 || d.goal.amount > 0)) {
      const target = d.goal.clients > 0 ? `${d.goal.clients} clientes` : `${money(d.goal.amount)} en comision`;
      T(clean(`Meta del mes: ${target}  ->  bono de ${money(d.goal.bonus)}.`), 40, y, 10.5, font, gray); y -= 15;
    }
    if (d.firstBonus) { T(clean(`Bono de arranque: tus primeras ${d.firstBonus.count} ventas = ${money(d.firstBonus.bonus)} extra.`), 40, y, 10.5, font, gray); y -= 15; }
    y -= 6;
  }

  // ---- CTA + disclaimer ----
  page.drawRectangle({ x: 40, y: y - 34, width: 515, height: 40, color: dark });
  T('Listo para empezar? Postulate en onyxtradinglive.com/unete-ventas', 56, y - 20, 11, bold, rgb(1, 1, 1));
  y -= 54;
  T('Ejemplos calculados con los parametros actuales. Las comisiones dependen de que el cliente siga pagando.', 40, y, 7.5, font, gray);

  return await doc.save();
}
