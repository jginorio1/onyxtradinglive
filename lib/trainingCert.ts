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
