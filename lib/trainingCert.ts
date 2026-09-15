// Certificado de formación en PDF (horizontal) con marca Onyx. pdf-lib dinámico.
// Es un comprobante interno de aprobación de una ruta del centro de formación.
// Diseño: orla doble (oro + púrpura) con floreados en las esquinas, sello de
// laurel con "OFICIAL", nombre en serif, bloque de firma del emisor, acentos
// preservados (WinAnsi) y QR de verificación del folio.

export async function certificatePdf(opts: {
  brand: string; personName: string; trackTitle: string; score: number;
  code: string; issuedAt: string; expiresAt?: string | null; lang?: 'es' | 'en';
  signerName?: string; signerRole?: string; verifyUrl?: string;
}): Promise<Uint8Array> {
  const en = opts.lang === 'en';
  // @ts-ignore
  const { PDFDocument, StandardFonts, rgb, degrees } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  const W = 842, H = 595;
  const page = doc.addPage([W, H]); // A4 horizontal
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);
  const serif = await doc.embedFont(StandardFonts.TimesRomanBold);        // nombre elegante
  const serifIt = await doc.embedFont(StandardFonts.TimesRomanItalic);

  const purple = rgb(0.33, 0.29, 0.72);   // púrpura profundo (orla exterior)
  const brand = rgb(0.486, 0.549, 1);     // acento Onyx
  const gold = rgb(0.76, 0.60, 0.24);     // oro (orla interior + sello)
  const goldLt = rgb(0.90, 0.79, 0.46);
  const dark = rgb(0.07, 0.08, 0.15);
  const gray = rgb(0.42, 0.45, 0.5);
  const cream = rgb(0.995, 0.98, 0.945);  // fondo del sello

  // WinAnsi cubre á é í ó ú ñ ¡ ¿ etc.; solo quitamos lo que quede fuera de 0x00–0xFF.
  const clean = (s: string) => String(s || '').replace(/[^\x00-\xFF]/g, '');

  // Texto centrado con auto-ajuste de tamaño para no desbordar el marco.
  const centerFit = (s: string, y: number, size: number, f = font, color = dark, maxW = W - 200) => {
    const t = clean(s) || '—'; let sz = size;
    while (sz > 8 && f.widthOfTextAtSize(t, sz) > maxW) sz -= 0.5;
    const w = f.widthOfTextAtSize(t, sz);
    page.drawText(t, { x: (W - w) / 2, y, size: sz, font: f, color });
    return sz;
  };
  const textW = (s: string, sz: number, f = font) => f.widthOfTextAtSize(clean(s), sz);

  // ---- Fondo + orla doble ----
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(1, 1, 1) });
  page.drawRectangle({ x: 20, y: 20, width: W - 40, height: H - 40, borderColor: purple, borderWidth: 3 });
  page.drawRectangle({ x: 30, y: 30, width: W - 60, height: H - 60, borderColor: gold, borderWidth: 1.4 });

  // ---- Floreados en las 4 esquinas ----
  const flourish = (cx: number, cy: number, sx: number, sy: number) => {
    // dos trazos en L + diamante interior
    page.drawLine({ start: { x: cx, y: cy }, end: { x: cx + 34 * sx, y: cy }, thickness: 1.4, color: gold });
    page.drawLine({ start: { x: cx, y: cy }, end: { x: cx, y: cy + 34 * sy }, thickness: 1.4, color: gold });
    page.drawLine({ start: { x: cx + 8 * sx, y: cy + 8 * sy }, end: { x: cx + 24 * sx, y: cy + 8 * sy }, thickness: 0.8, color: goldLt });
    page.drawLine({ start: { x: cx + 8 * sx, y: cy + 8 * sy }, end: { x: cx + 8 * sx, y: cy + 24 * sy }, thickness: 0.8, color: goldLt });
    page.drawEllipse({ x: cx + 8 * sx, y: cy + 8 * sy, xScale: 3, yScale: 3, color: gold });
  };
  flourish(40, 40, 1, 1); flourish(W - 40, 40, -1, 1); flourish(40, H - 40, 1, -1); flourish(W - 40, H - 40, -1, -1);

  // ---- Cabecera ----
  centerFit((opts.brand || 'Onyx Academy · Formación interna').toUpperCase(), 536, 12, bold, brand, W - 260);
  page.drawLine({ start: { x: W / 2 - 60, y: 528 }, end: { x: W / 2 + 60, y: 528 }, thickness: 0.8, color: goldLt });

  centerFit(en ? 'CERTIFICATE' : 'CERTIFICADO', 476, 46, serif, dark, W - 200);
  centerFit(en ? 'of completion' : 'de finalización', 450, 16, serifIt, gold, W - 200);

  centerFit(en ? 'Proudly awarded to' : 'Se otorga con orgullo a', 410, 12.5, italic, gray);
  centerFit(opts.personName, 372, 30, serif, dark, W - 220);
  // Regla decorativa bajo el nombre.
  { const w = Math.min(360, Math.max(160, textW(opts.personName, 30, serif) + 60));
    page.drawLine({ start: { x: (W - w) / 2, y: 360 }, end: { x: (W + w) / 2, y: 360 }, thickness: 1, color: goldLt }); }

  centerFit(en ? 'for successfully completing the track' : 'por completar satisfactoriamente la ruta', 336, 12.5, italic, gray);
  centerFit(opts.trackTitle, 306, 20, bold, brand, W - 240);

  // ---- Píldora de calificación ----
  { const label = `${en ? 'SCORE' : 'CALIFICACIÓN'}  ${opts.score} / 100`;
    const sz = 12; const pw = textW(label, sz, bold) + 34; const px = (W - pw) / 2; const py = 262;
    page.drawRectangle({ x: px, y: py, width: pw, height: 26, color: rgb(0.96, 0.97, 1), borderColor: brand, borderWidth: 1 });
    page.drawText(clean(label), { x: px + 17, y: py + 8, size: sz, font: bold, color: brand }); }

  // ---- Sello de laurel (centro-inferior) ----
  const cx = W / 2, cy = 168, R = 46;
  page.drawEllipse({ x: cx, y: cy, xScale: R, yScale: R, color: cream, borderColor: gold, borderWidth: 2 });
  page.drawEllipse({ x: cx, y: cy, xScale: R - 6, yScale: R - 6, borderColor: goldLt, borderWidth: 1 });
  // Corona de laurel: hojas (elipses) a lo largo de dos arcos laterales.
  const leaf = (ang: number) => {
    const rad = ang * Math.PI / 180; const lr = R - 3;
    const x = cx + lr * Math.cos(rad), y = cy + lr * Math.sin(rad);
    page.drawEllipse({ x, y, xScale: 6, yScale: 2.6, rotate: degrees(ang + 90), color: gold });
  };
  [250, 236, 222, 208, 194, 180, 166].forEach(leaf);            // rama izquierda
  [290, 304, 318, 332, 346, 360, 14].forEach(leaf);             // rama derecha
  // Check central (drawSvgPath usa Y hacia abajo, así que el vértice va abajo).
  page.drawSvgPath('M -12 0 L -3 10 L 15 -11', { x: cx, y: cy + 2, borderColor: purple, borderWidth: 3.4, scale: 1 });
  // "OFICIAL" + cinta.
  { const t = 'OFICIAL'; const sz = 8; const w = textW(t, sz, bold);
    page.drawText(t, { x: cx - w / 2, y: cy - R - 4, size: sz, font: bold, color: purple }); }

  // ---- Bloques de firma (izquierda: emisor · derecha: fechas) ----
  const issued = new Date(opts.issuedAt).toLocaleDateString(en ? 'en-US' : 'es-ES');
  const exp = opts.expiresAt ? new Date(opts.expiresAt).toLocaleDateString(en ? 'en-US' : 'es-ES') : (en ? 'No expiry' : 'No caduca');

  // Emisor / firma (izquierda).
  const lx = 92;
  page.drawText(clean(opts.signerName || opts.brand || 'Onyx Trading Live'), { x: lx, y: 128, size: 13, font: serif, color: dark });
  page.drawLine({ start: { x: lx, y: 122 }, end: { x: lx + 220, y: 122 }, thickness: 1, color: gray });
  page.drawText(clean(en ? 'Issuer · Authorized signature' : 'Emisor · Firma autorizada'), { x: lx, y: 108, size: 8.5, font, color: gray });
  page.drawText(clean(opts.signerRole || (en ? 'Training Dept.' : 'Dirección de Formación')), { x: lx, y: 95, size: 8.5, font: bold, color: gray });

  // Fechas (derecha).
  const rx = 530;
  page.drawText(clean(issued), { x: rx, y: 128, size: 13, font: serif, color: dark });
  page.drawLine({ start: { x: rx, y: 122 }, end: { x: rx + 200, y: 122 }, thickness: 1, color: gray });
  page.drawText(clean(en ? 'Issued' : 'Emitido') + `   ·   ${en ? 'Valid until' : 'Válido hasta'}: ${exp}`, { x: rx, y: 108, size: 8.5, font, color: gray });
  page.drawText(clean(`${en ? 'Certificate ID' : 'Folio'}: ${opts.code || '—'}`), { x: rx, y: 95, size: 8.5, font: bold, color: dark });

  // ---- QR de verificación (esquina inferior derecha) ----
  if (opts.verifyUrl) {
    try {
      // @ts-ignore
      const QRCode = (await import('qrcode')).default || (await import('qrcode'));
      const buf: Buffer = await QRCode.toBuffer(opts.verifyUrl, { type: 'png', margin: 0, width: 132, errorCorrectionLevel: 'M', color: { dark: '#1a1830', light: '#ffffff' } });
      const png = await doc.embedPng(new Uint8Array(buf));
      const qs = 56; const qx = W - 56 - qs, qy = 44;
      page.drawImage(png, { x: qx, y: qy, width: qs, height: qs });
      const cap = en ? 'Verify' : 'Verifica';
      page.drawText(cap, { x: qx + (qs - textW(cap, 7, font)) / 2, y: qy - 10, size: 7, font, color: gray });
    } catch { /* si falta qrcode, seguimos sin QR */ }
  }

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
