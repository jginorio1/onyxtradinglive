// Certificado de formación en PDF (horizontal) con marca Onyx. pdf-lib dinámico.
// Es un comprobante interno de aprobación de una ruta del centro de formación.

export async function certificatePdf(opts: {
  brand: string; personName: string; trackTitle: string; score: number;
  code: string; issuedAt: string; expiresAt?: string | null; lang?: 'es' | 'en';
}): Promise<Uint8Array> {
  const en = opts.lang === 'en';
  // @ts-ignore
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  const page = doc.addPage([842, 595]); // A4 horizontal
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);
  const brand = rgb(0.486, 0.549, 1);
  const dark = rgb(0.06, 0.075, 0.14);
  const gray = rgb(0.42, 0.45, 0.5);
  const clean = (s: string) => String(s || '').replace(/[^\x00-\xFF]/g, '-');
  const W = 842;

  // Marco.
  page.drawRectangle({ x: 24, y: 24, width: W - 48, height: 595 - 48, borderColor: brand, borderWidth: 2, color: rgb(1, 1, 1) });
  page.drawRectangle({ x: 34, y: 34, width: W - 68, height: 595 - 68, borderColor: rgb(0.85, 0.87, 1), borderWidth: 1 });

  // Centrado horizontal.
  const center = (s: string, y: number, size: number, f = font, color = dark) => {
    const t = clean(s); const w = f.widthOfTextAtSize(t, size);
    page.drawText(t, { x: (W - w) / 2, y, size, font: f, color });
  };

  center(opts.brand || 'Onyx Trading Live', 520, 16, bold, brand);
  center(en ? 'CERTIFICATE OF COMPLETION' : 'CERTIFICADO DE FORMACION', 470, 30, bold);
  center(en ? 'This certifies that' : 'Se certifica que', 420, 13, italic, gray);
  center(opts.personName || '-', 385, 26, bold);
  center(en ? 'has successfully completed the track' : 'ha completado satisfactoriamente la ruta', 345, 13, italic, gray);
  center(opts.trackTitle || '-', 312, 20, bold, brand);
  center(`${en ? 'Score' : 'Calificacion'}: ${opts.score}/100`, 275, 14, bold);

  // Pie: folio + fechas.
  const issued = new Date(opts.issuedAt).toLocaleDateString(en ? 'en-US' : 'es-ES');
  const exp = opts.expiresAt ? new Date(opts.expiresAt).toLocaleDateString(en ? 'en-US' : 'es-ES') : (en ? 'No expiry' : 'No caduca');
  page.drawLine({ start: { x: 120, y: 150 }, end: { x: 340, y: 150 }, thickness: 1, color: gray });
  page.drawText(clean(en ? 'Issued' : 'Emitido'), { x: 120, y: 132, size: 10, font, color: gray });
  page.drawText(clean(issued), { x: 120, y: 116, size: 12, font: bold, color: dark });
  page.drawLine({ start: { x: 500, y: 150 }, end: { x: 720, y: 150 }, thickness: 1, color: gray });
  page.drawText(clean(en ? 'Valid until' : 'Valido hasta'), { x: 500, y: 132, size: 10, font, color: gray });
  page.drawText(clean(exp), { x: 500, y: 116, size: 12, font: bold, color: dark });
  center(`${en ? 'Certificate ID' : 'Folio'}: ${opts.code || '-'}`, 70, 10, font, gray);

  return await doc.save();
}

// Reporte de cumplimiento en PDF (una tabla persona × estado por ruta). Para
// archivar o compartir con dirección/auditoría.
export async function compliancePdf(opts: {
  brand: string; lang?: 'es' | 'en';
  tracks: { id: string; title: string }[];
  people: any[];
  summary: { total: number; compliant: number; overdue: number; pending: number };
}): Promise<Uint8Array> {
  const en = opts.lang === 'en';
  // @ts-ignore
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const brand = rgb(0.486, 0.549, 1), dark = rgb(0.06, 0.075, 0.14), gray = rgb(0.42, 0.45, 0.5);
  const green = rgb(0.1, 0.66, 0.42), amber = rgb(0.78, 0.55, 0.12), red = rgb(0.85, 0.28, 0.32);
  const clean = (s: string) => String(s || '').replace(/[^\x00-\xFF]/g, '-');
  const stColor = (st: string) => st === 'ok' ? green : st === 'expired' ? amber : red;
  const stTxt = (st: string) => en ? (st === 'ok' ? 'OK' : st === 'expired' ? 'EXP' : 'PEND') : (st === 'ok' ? 'OK' : st === 'expired' ? 'VENC' : 'PEND');

  const W = 842, H = 595, left = 36;
  let page = doc.addPage([W, H]); let y = 0;
  const nameW = 190; const colW = Math.min(70, (W - left - nameW - 20) / Math.max(1, opts.tracks.length));
  const header = () => {
    y = H - 44;
    page.drawText(clean(opts.brand || 'Onyx Trading Live'), { x: left, y, size: 13, font: bold, color: brand }); y -= 18;
    page.drawText(clean(en ? 'Training compliance report' : 'Reporte de cumplimiento de formacion'), { x: left, y, size: 16, font: bold, color: dark }); y -= 16;
    const su = opts.summary;
    page.drawText(clean(`${en ? 'People' : 'Personas'}: ${su.total}   ${en ? 'Compliant' : 'Al dia'}: ${su.compliant}   ${en ? 'Overdue' : 'Vencidos'}: ${su.overdue}   ${en ? 'Pending' : 'Pendientes'}: ${su.pending}   ·   ${new Date().toLocaleDateString(en ? 'en-US' : 'es-ES')}`, ), { x: left, y, size: 9, font, color: gray }); y -= 18;
    // Cabecera de columnas.
    page.drawText(clean(en ? 'Person' : 'Persona'), { x: left, y, size: 9, font: bold, color: gray });
    opts.tracks.forEach((t, i) => page.drawText(clean(t.title.slice(0, 10)), { x: left + nameW + i * colW, y, size: 7.5, font, color: gray }));
    y -= 4; page.drawLine({ start: { x: left, y }, end: { x: W - left, y }, thickness: 1, color: brand }); y -= 14;
  };
  header();
  for (const p of opts.people) {
    if (y < 44) { page = doc.addPage([W, H]); header(); }
    const nm = clean((p.name || p.email || '-') + (p.compliant ? '  OK' : ''));
    page.drawText(nm.slice(0, 34), { x: left, y, size: 9, font, color: dark });
    page.drawText(clean('(' + p.role + ')'), { x: left, y: y - 9, size: 7, font, color: gray });
    opts.tracks.forEach((t, i) => {
      const it = p.items[t.id];
      const x = left + nameW + i * colW;
      if (it) page.drawText(stTxt(it.status), { x, y, size: 8, font: bold, color: stColor(it.status) });
      else page.drawText('-', { x, y, size: 8, font, color: gray });
    });
    y -= 22;
  }
  return await doc.save();
}
