// Propuesta / cotización PROFESIONAL de un espacio publicitario, personalizada
// con los datos del VENDEDOR (nombre + su correo de trabajo con tu dominio) y
// del COMPRADOR (empresa, contacto, correo). Genera un PDF de marca para
// adjuntar al correo. Todo sale de los parámetros: nada fijo.

export type AdProposalInput = {
  // ubicación
  slotKey?: string;
  slotNameEs: string; slotNameEn: string; size: string; pageEs: string; pageEn: string;
  // fechas
  startDate: string; endDate: string;   // YYYY-MM-DD
  // comercial
  price: number;                        // total USD del periodo
  cap: number;                          // cupo (anunciantes rotando)
  impressionsPerDay?: number;           // estimado del tráfico real (opcional)
  holdUntil?: string;                   // validez de la reserva (ISO)
  // vendedor
  sellerName: string; sellerEmail: string; sellerPhone?: string;
  // comprador
  advertiser: string; advertiserCompany?: string; advertiserEmail?: string;
  linkUrl?: string;
};

const clean = (s: string) => String(s || '').replace(/[^\x00-\xFF]/g, '').slice(0, 200);
const fmtDate = (d: string, lang: 'es' | 'en') => {
  try {
    const dt = new Date(d + 'T00:00:00Z');
    return dt.toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
  } catch { return d; }
};
const daysBetween = (a: string, b: string) => Math.max(1, Math.round((+new Date(b + 'T00:00:00Z') - +new Date(a + 'T00:00:00Z')) / 86400000) + 1);

// Texto del correo (personalizado). El PDF va adjunto.
export function adProposalEmail(inp: AdProposalInput, lang: 'es' | 'en'): { subject: string; body: string } {
  const days = daysBetween(inp.startDate, inp.endDate);
  const place = lang === 'es' ? inp.slotNameEs : inp.slotNameEn;
  const who = inp.advertiser ? (lang === 'es' ? `Hola ${inp.advertiser},` : `Hi ${inp.advertiser},`) : (lang === 'es' ? 'Hola,' : 'Hi,');
  if (lang === 'en') {
    return {
      subject: `Ad space proposal · ${place} · Onyx Trading Live`,
      body: `${who}\n\nThank you for your interest in advertising with Onyx Trading Live. Please find attached a proposal for the **${place}** placement (${inp.size}).\n\n- Dates: ${fmtDate(inp.startDate, 'en')} to ${fmtDate(inp.endDate, 'en')} (${days} days)\n- Total: $${Math.round(inp.price)} USD\n\nOnce you confirm, we reserve the space for those exact dates and it goes live automatically on the start date. I'm happy to answer any questions.\n\nBest regards,\n${inp.sellerName}\nOnyx Trading Live\n${inp.sellerEmail}${inp.sellerPhone ? `\n${inp.sellerPhone}` : ''}`,
    };
  }
  return {
    subject: `Propuesta de espacio publicitario · ${place} · Onyx Trading Live`,
    body: `${who}\n\nGracias por tu interés en anunciarte con Onyx Trading Live. Adjunto la propuesta para el espacio **${place}** (${inp.size}).\n\n- Fechas: del ${fmtDate(inp.startDate, 'es')} al ${fmtDate(inp.endDate, 'es')} (${days} días)\n- Total: $${Math.round(inp.price)} USD\n\nEn cuanto confirmes, reservamos el espacio para esas fechas exactas y sale al aire automáticamente el día de inicio. Quedo atento a cualquier duda.\n\nUn saludo,\n${inp.sellerName}\nOnyx Trading Live\n${inp.sellerEmail}${inp.sellerPhone ? `\n${inp.sellerPhone}` : ''}`,
  };
}

export async function adProposalPdf(inp: AdProposalInput, opts?: { lang?: 'es' | 'en' }): Promise<Uint8Array> {
  const lang = opts?.lang === 'en' ? 'en' : 'es';
  const en = lang === 'en';
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 595;

  const brand = rgb(0.486, 0.549, 1);
  const dark = rgb(0.043, 0.059, 0.118);
  const ink = rgb(0.1, 0.12, 0.18);
  const gray = rgb(0.42, 0.45, 0.5);
  const soft = rgb(0.9, 0.91, 0.94);
  const panel = rgb(0.97, 0.975, 0.985);
  const green = rgb(0.106, 0.686, 0.478);

  const T = (s: string, x: number, y: number, size: number, f = font, color = ink) => page.drawText(clean(s), { x, y, size, font: f, color });

  // Cabecera
  page.drawRectangle({ x: 0, y: 784, width: W, height: 58, color: dark });
  T('Onyx Trading Live', 40, 812, 15, bold, rgb(1, 1, 1));
  T(en ? 'Advertising proposal' : 'Propuesta de publicidad', 40, 794, 10, font, rgb(0.78, 0.8, 0.86));
  const today = new Date().toLocaleDateString(en ? 'en-US' : 'es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
  T((en ? 'Date: ' : 'Fecha: ') + today, W - 190, 800, 9, font, rgb(0.78, 0.8, 0.86));

  let y = 752;

  // De / Para
  const boxW = 250;
  const drawParty = (x: number, title: string, lines: string[]) => {
    page.drawRectangle({ x, y: y - 78, width: boxW, height: 84, borderColor: soft, borderWidth: 1, color: panel });
    T(title, x + 12, y - 6, 8.5, bold, gray);
    let ly = y - 24;
    for (const l of lines) { if (l) { T(l, x + 12, ly, 10, l === lines[0] ? bold : font, ink); ly -= 15; } }
  };
  drawParty(40, en ? 'PREPARED BY' : 'PREPARADA POR', [inp.sellerName, inp.sellerEmail, inp.sellerPhone || '', 'onyxtradinglive.com']);
  drawParty(40 + boxW + 15, en ? 'FOR' : 'PARA', [inp.advertiserCompany || inp.advertiser, inp.advertiserCompany ? inp.advertiser : '', inp.advertiserEmail || '', inp.linkUrl || '']);
  y -= 100;

  // Detalle del espacio
  T(en ? 'PLACEMENT' : 'ESPACIO', 40, y, 9, bold, brand); y -= 8;
  page.drawLine({ start: { x: 40, y }, end: { x: W - 40, y }, thickness: 1, color: soft }); y -= 22;

  const days = daysBetween(inp.startDate, inp.endDate);
  const rowsData: [string, string][] = [
    [en ? 'Location' : 'Ubicación', en ? inp.slotNameEn : inp.slotNameEs],
    [en ? 'Format (IAB)' : 'Formato (IAB)', inp.size],
    [en ? 'Section' : 'Sección', en ? inp.pageEn : inp.pageEs],
    [en ? 'Dates' : 'Fechas', `${fmtDate(inp.startDate, lang)}  —  ${fmtDate(inp.endDate, lang)}  (${days} ${en ? 'days' : 'días'})`],
    [en ? 'Rotation' : 'Rotación', en ? `Shared space · up to ${inp.cap} advertisers rotating` : `Espacio compartido · hasta ${inp.cap} anunciantes rotando`],
  ];
  if (inp.impressionsPerDay && inp.impressionsPerDay > 0) {
    rowsData.push([en ? 'Est. impressions' : 'Impresiones estim.', `~${Math.round(inp.impressionsPerDay).toLocaleString(en ? 'en-US' : 'es-ES')} ${en ? '/ day' : '/ día'}`]);
  }
  for (const [k, v] of rowsData) {
    T(k, 52, y, 10, font, gray);
    T(v, 210, y, 10, bold, ink);
    y -= 20;
  }
  y -= 6;

  // Precio total
  page.drawRectangle({ x: 40, y: y - 44, width: W - 80, height: 50, color: rgb(0.96, 0.965, 1), borderColor: brand, borderWidth: 1.2 });
  T(en ? 'TOTAL FOR THE PERIOD' : 'TOTAL DEL PERIODO', 56, y - 14, 10, bold, gray);
  T(en ? 'Flat rate · no cost per click · users who pay for Pro do not see ads' : 'Tarifa plana · sin costo por clic · los usuarios Pro no ven anuncios', 56, y - 30, 8.5, font, gray);
  T(`$${Math.round(inp.price).toLocaleString(en ? 'en-US' : 'es-ES')}`, W - 150, y - 26, 22, bold, brand);
  T('USD', W - 70, y - 20, 10, font, gray);
  y -= 66;

  // Diagrama de la ubicación exacta (esquema de la página con el hueco resaltado).
  T(en ? 'WHERE IT APPEARS' : 'DÓNDE APARECE', 40, y, 9, bold, brand); y -= 8;
  page.drawLine({ start: { x: 40, y }, end: { x: W - 40, y }, thickness: 1, color: soft }); y -= 6;
  {
    const dx = 40, dw = W - 80, dtop = y, dh = 150;
    // marco tipo navegador
    page.drawRectangle({ x: dx, y: dtop - dh, width: dw, height: dh, borderColor: soft, borderWidth: 1, color: rgb(0.985, 0.985, 1) });
    page.drawRectangle({ x: dx, y: dtop - 16, width: dw, height: 16, color: rgb(0.93, 0.94, 0.98) });
    T('onyxtradinglive.com', dx + 8, dtop - 12, 7.5, font, gray);
    const cx = dx + 8, cy0 = dtop - 22, cw = dw - 16, ch = dh - 30;   // lienzo interno
    const blk = (nx: number, ny: number, nw: number, nh: number, fill = rgb(0.9, 0.91, 0.95)) =>
      page.drawRectangle({ x: cx + nx * cw, y: cy0 - (ny + nh) * ch, width: nw * cw, height: nh * ch, color: fill });
    const ad = (nx: number, ny: number, nw: number, nh: number) => {
      page.drawRectangle({ x: cx + nx * cw, y: cy0 - (ny + nh) * ch, width: nw * cw, height: nh * ch, color: rgb(0.83, 0.85, 1), borderColor: brand, borderWidth: 1.5 });
      T(en ? 'YOUR AD' : 'TU ANUNCIO', cx + nx * cw + 4, cy0 - (ny + nh) * ch + nh * ch / 2 - 3, 7, bold, rgb(0.32, 0.36, 0.85));
    };
    // estructura base
    blk(0.04, 0.02, 0.92, 0.08);   // nav
    const sk = inp.slotKey || '';
    if (inp.pageEs === 'blog' || sk.startsWith('blog')) {
      if (sk === 'blog_top') ad(0.04, 0.14, 0.92, 0.12); else blk(0.04, 0.14, 0.92, 0.12);
      if (sk === 'blog_infeed' || sk === 'blog_native') { blk(0.04, 0.30, 0.44, 0.6); ad(0.52, 0.30, 0.44, 0.28); blk(0.52, 0.62, 0.44, 0.28); }
      else { blk(0.04, 0.30, 0.44, 0.28); blk(0.52, 0.30, 0.44, 0.28); blk(0.04, 0.62, 0.44, 0.28); blk(0.52, 0.62, 0.44, 0.28); }
    } else if (inp.pageEs === 'article' || sk.startsWith('article')) {
      // columna + lateral
      if (sk === 'article_incontent') { blk(0.04, 0.14, 0.6, 0.16); ad(0.04, 0.34, 0.6, 0.12); blk(0.04, 0.50, 0.6, 0.4); }
      else blk(0.04, 0.14, 0.6, 0.76);
      if (sk === 'article_sidebar') ad(0.68, 0.14, 0.28, 0.24);
      else if (sk === 'article_halfpage') ad(0.68, 0.14, 0.28, 0.55);
      else blk(0.68, 0.14, 0.28, 0.4);
    } else if (inp.pageEs === 'landing' || sk.startsWith('landing')) {
      if (sk === 'landing_billboard') ad(0.04, 0.14, 0.92, 0.26);
      else if (sk === 'landing_top') ad(0.04, 0.14, 0.92, 0.12);
      else blk(0.04, 0.14, 0.92, 0.16);
      blk(0.22, 0.46, 0.56, 0.16); blk(0.04, 0.7, 0.28, 0.2); blk(0.36, 0.7, 0.28, 0.2); blk(0.68, 0.7, 0.28, 0.2);
    } else if (inp.pageEs === 'directory' || sk === 'directory_partner') {
      blk(0.04, 0.14, 0.5, 0.08);
      if (sk === 'directory_partner') ad(0.04, 0.26, 0.92, 0.14); else blk(0.04, 0.26, 0.92, 0.14);
      blk(0.04, 0.44, 0.92, 0.12); blk(0.04, 0.6, 0.92, 0.12); blk(0.04, 0.76, 0.92, 0.12);
    } else {
      blk(0.04, 0.14, 0.92, 0.5);
      if (sk === 'sticky_bottom') ad(0.04, 0.86, 0.92, 0.08);
      else if (sk === 'footer_site') ad(0.04, 0.72, 0.92, 0.12);
      else blk(0.04, 0.72, 0.92, 0.12);
    }
    y = dtop - dh - 14;
  }

  // Incluye
  T(en ? 'INCLUDED' : 'INCLUYE', 40, y, 9, bold, brand); y -= 8;
  page.drawLine({ start: { x: 40, y }, end: { x: W - 40, y }, thickness: 1, color: soft }); y -= 18;
  const incl = en
    ? ['Banner shown across the placement for the full date range', 'Automatic go-live on the start date and auto-pause at the end', 'Impression and click reporting', 'Creative in the exact IAB size, subject to a quick review']
    : ['Banner mostrado en el espacio durante todo el rango de fechas', 'Encendido automático el día de inicio y apagado al terminar', 'Reporte de impresiones y clics', 'Arte en el tamaño IAB exacto, sujeto a una revisión rápida'];
  for (const it of incl) { T('•', 52, y, 10, bold, green); T(it, 66, y, 9.5, font, ink); y -= 16; }
  y -= 8;

  // Validez
  if (inp.holdUntil) {
    const hu = new Date(inp.holdUntil).toLocaleString(en ? 'en-US' : 'es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    T(en ? `This quote holds the space until ${hu}. After that the dates are released.` : `Esta cotización reserva el espacio hasta ${hu}. Después, las fechas se liberan.`, 40, y, 9, font, gray);
    y -= 20;
  }

  // CTA
  page.drawRectangle({ x: 40, y: y - 34, width: W - 80, height: 40, color: dark });
  T(en ? 'To confirm, reply to this email or contact your Onyx rep.' : 'Para confirmar, responde a este correo o contacta a tu asesor Onyx.', 56, y - 20, 10.5, bold, rgb(1, 1, 1));

  return await doc.save();
}
