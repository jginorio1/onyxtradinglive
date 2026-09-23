// Propuesta de reclutamiento para vendedores.
//
// Calcula los ejemplos de ganancia a partir de los MISMOS parámetros del panel
// de Ventas (impulso 1.er mes, residual, overrides, metas, bono, ascensos) y
// genera un PDF de marca para enviar por correo a un candidato. Si el admin
// cambia un parámetro, los ejemplos del PDF salen recalculados: aquí no hay
// números fijos, todo sale de `s`.

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
};

const n = (v: any, d = 0) => { const x = Number(v); return Number.isFinite(x) ? x : d; };

// Calcula toda la propuesta a partir de los parámetros actuales.
export function proposalData(s: ProposalSettings, opts?: { price?: number; months?: number; includeOverrides?: boolean; candidateName?: string }): ProposalData {
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
  const monthsCap = infinite ? (opts?.months || 12) : Math.min(cm, opts?.months || 12);
  const monthsPaid = Math.max(1, monthsCap);

  const perFirst = Math.round(price * firstDirectPct / 100);
  const perMonthly = Math.round(price * residualDirectPct / 100);
  const perYear1 = perFirst + perMonthly * (monthsPaid - 1);

  const rows = [5, 10, 20].map((c) => ({ clients: c, first: perFirst * c, monthly: perMonthly * c, year1: perYear1 * c }));

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
  };
}

// Genera el PDF de la propuesta con pdf-lib (marca Onyx, tabla y escalera).
export async function proposalPdf(d: ProposalData, opts?: { company?: string }): Promise<Uint8Array> {
  // @ts-ignore
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const brand = rgb(0.486, 0.549, 1);
  const dark = rgb(0.06, 0.075, 0.14);
  const gray = rgb(0.42, 0.45, 0.5);
  const green = rgb(0.11, 0.62, 0.46);
  const gold = rgb(0.73, 0.46, 0.09);
  const clean = (s: string) => String(s).replace(/[^\x00-\xFF]/g, '-');
  const money = (v: number) => `$${(Math.round(v || 0)).toLocaleString('en-US')}`;
  let y = 812;
  const T = (s: string, x: number, size: number, f = font, color = dark) => page.drawText(clean(s), { x, y, size, font: f, color });
  const line = (dy = 14) => { y -= dy; };

  // Cabecera de marca
  page.drawRectangle({ x: 0, y: 784, width: 595, height: 58, color: rgb(0.043, 0.059, 0.118) });
  page.drawText(clean(opts?.company || 'Onyx Trading Live'), { x: 40, y: 812, size: 15, font: bold, color: rgb(1, 1, 1) });
  page.drawText('Propuesta para vendedores', { x: 40, y: 794, size: 10, font, color: rgb(0.78, 0.8, 0.86) });
  y = 756;
  T(d.candidateName ? `Preparado para: ${d.candidateName}` : 'Unete a nuestro equipo de ventas', 40, 12, bold, dark); line(24);

  // Cómo ganas
  T('Asi ganas', 40, 13, bold, brand); line(18);
  T(`Con un cliente de ${money(d.price)}/mes:`, 40, 11, font, gray); line(20);
  const cell = (x: number, w: number, title: string, big: string, sub: string, col: any) => {
    page.drawRectangle({ x, y: y - 40, width: w, height: 52, borderColor: rgb(0.85, 0.86, 0.9), borderWidth: 1, color: rgb(0.98, 0.98, 0.99) });
    page.drawText(clean(title), { x: x + 10, y: y, size: 8.5, font, color: gray });
    page.drawText(clean(big), { x: x + 10, y: y - 20, size: 18, font: bold, color: col });
    page.drawText(clean(sub), { x: x + 10, y: y - 34, size: 8, font, color: gray });
  };
  cell(40, 160, 'PRIMER MES', money(d.perFirst), `${d.firstDirectPct}% del primer pago`, gold);
  cell(217, 160, 'CADA MES DESPUES', money(d.perMonthly), `${d.residualDirectPct}% recurrente`, green);
  cell(394, 160, 'EN 1 ANO', money(d.perYear1), 'por ese solo cliente', dark);
  line(66);

  // Tabla por clientes
  T('Si cierras mas clientes', 40, 12, bold, dark); line(18);
  const cols = [40, 200, 320, 440];
  T('Clientes', cols[0], 9, bold, gray); T('1.er mes', cols[1], 9, bold, gold); T('Cada mes', cols[2], 9, bold, green); T('Ano 1', cols[3], 9, bold, dark);
  line(4); page.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 0.7, color: rgb(0.85, 0.86, 0.9) }); line(14);
  for (const r of d.rows) {
    T(`${r.clients} clientes`, cols[0], 11, font, dark);
    T(money(r.first), cols[1], 11, font, gold);
    T(money(r.monthly), cols[2], 11, font, green);
    T(money(r.year1), cols[3], 11, bold, dark);
    line(18);
  }
  line(8);

  // Carrera / overrides
  if (d.includeOverrides) {
    T('Tu carrera (subes solo)', 40, 12, bold, dark); line(18);
    T(`${d.ladder.advisor}  ->  ${d.ladder.lead}: al llegar a ${d.ladder.toLead} clientes activos.`, 40, 10.5, font, gray); line(15);
    T(`${d.ladder.lead}  ->  ${d.ladder.director}: con ${d.ladder.toDirector} en su equipo.`, 40, 10.5, font, gray); line(15);
    T(`Como ${d.ladder.lead} ganas +${d.overrides.l1Res}% de lo que venda tu equipo; como ${d.ladder.director}, +${d.overrides.l2Res}%.`, 40, 10.5, font, gray); line(20);
  }

  // Metas y bonos
  if (d.goal.clients > 0 || d.goal.amount > 0 || d.firstBonus) {
    T('Metas y bonos', 40, 12, bold, dark); line(18);
    if (d.goal.bonus > 0 && (d.goal.clients > 0 || d.goal.amount > 0)) {
      const target = d.goal.clients > 0 ? `${d.goal.clients} clientes` : `${money(d.goal.amount)} en comision`;
      T(`Meta del mes: ${target}  ->  bono de ${money(d.goal.bonus)}.`, 40, 10.5, font, gray); line(15);
    }
    if (d.firstBonus) { T(`Bono de arranque: tus primeras ${d.firstBonus.count} ventas = ${money(d.firstBonus.bonus)} extra.`, 40, 10.5, font, gray); line(15); }
    line(6);
  }

  // CTA + disclaimer
  page.drawRectangle({ x: 40, y: y - 34, width: 515, height: 40, color: rgb(0.043, 0.059, 0.118) });
  page.drawText('Listo para empezar? Postulate en onyxtradinglive.com/unete-ventas', { x: 56, y: y - 20, size: 11, font: bold, color: rgb(1, 1, 1) });
  y -= 54;
  page.drawText('Ejemplos calculados con los parametros actuales. Las comisiones dependen de que el cliente siga pagando.', { x: 40, y, size: 7.5, font, color: gray });

  return await doc.save();
}
