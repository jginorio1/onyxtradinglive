// Recibo de nómina (payslip) en PDF con marca Onyx. Muestra bruto, cada
// concepto (percepción/deducción) y el neto pagado. pdf-lib se importa dinámico.
// AVISO: es un comprobante interno; no sustituye la declaración fiscal oficial.

export async function payslipPdf(opts: {
  company: string; employeeName: string; department?: string; position?: string;
  period: string; currency: string; gross: number; net: number;
  items: { label: string; kind: string; amount: number }[];
  method: string; status: string; paidAt?: string | null;
}): Promise<Uint8Array> {
  // @ts-ignore
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const brand = rgb(0.486, 0.549, 1);
  const dark = rgb(0.06, 0.075, 0.14);
  const gray = rgb(0.42, 0.45, 0.5);
  const red = rgb(0.9, 0.3, 0.35);
  const green = rgb(0.1, 0.7, 0.4);
  const cur = opts.currency || 'USD';
  const clean = (s: string) => String(s).replace(/[^\x00-\xFF]/g, '-');
  let y = 800;
  const T = (s: string, x: number, size: number, f = font, color = dark) => page.drawText(clean(s), { x, y, size, font: f, color });
  const money = (n: number) => `${cur} ${(Math.round((n || 0) * 100) / 100).toFixed(2)}`;

  T(opts.company || 'Onyx Trading Live', 40, 15, bold, brand); y -= 24;
  T('Recibo de nomina', 40, 20, bold); y -= 18;
  T(`Periodo: ${opts.period}   ·   ${opts.employeeName}`, 40, 10, font, gray); y -= 13;
  T([opts.department, opts.position].filter(Boolean).join(' · '), 40, 10, font, gray); y -= 20;
  page.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 1, color: brand }); y -= 26;

  T('Sueldo base', 40, 12, font, gray); T(money(opts.gross - percSum(opts.items)), 400, 12, bold); y -= 22;

  // Percepciones (earnings) y deducciones desglosadas.
  const earns = opts.items.filter((i) => i.kind === 'earning');
  const deds = opts.items.filter((i) => i.kind === 'deduction');
  if (earns.length) { T('Percepciones', 40, 11, bold); y -= 18; for (const e of earns) { T(e.label, 55, 11, font, gray); T('+ ' + money(e.amount), 400, 11, font, green); y -= 16; } y -= 4; }
  T('Total bruto', 40, 12, bold); T(money(opts.gross), 400, 12, bold); y -= 22;

  if (deds.length) { T('Deducciones', 40, 11, bold); y -= 18; for (const d of deds) { T(d.label, 55, 11, font, gray); T('- ' + money(d.amount), 400, 11, font, red); y -= 16; } y -= 4; }
  const totalDed = deds.reduce((a, d) => a + d.amount, 0);
  T('Total deducciones', 40, 12, bold); T('- ' + money(totalDed), 400, 12, bold, red); y -= 26;

  page.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 1, color: brand }); y -= 26;
  T('NETO A PAGAR', 40, 15, bold); T(money(opts.net), 380, 15, bold, brand); y -= 26;
  T(`Metodo: ${opts.method}   ·   Estado: ${opts.status}${opts.paidAt ? '   ·   Pagado: ' + new Date(opts.paidAt).toLocaleDateString() : ''}`, 40, 10, font, gray); y -= 40;

  T('Comprobante interno de pago. No sustituye la declaracion fiscal oficial.', 40, 8, font, gray);
  return await doc.save();
}

// suma de percepciones para deducir el sueldo base a partir del bruto.
function percSum(items: { kind: string; amount: number }[]): number {
  return items.filter((i) => i.kind === 'earning').reduce((a, i) => a + i.amount, 0);
}
