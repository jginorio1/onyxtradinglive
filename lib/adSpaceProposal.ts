// Propuesta / cotización PROFESIONAL de un espacio publicitario, personalizada
// con los datos del VENDEDOR (nombre + su correo de trabajo con tu dominio, que
// salen de su cuenta — el vendedor NO los edita) y del COMPRADOR (empresa,
// contacto, correo). El contenido sale de una PLANTILLA editable por secciones
// (por idioma) con variables {advertiser}, {seller}, {slot}, {price},
// {validUntil}, etc. Genera un PDF de marca para adjuntar al correo.

import { DEFAULT_QUOTE_TPL, fillQuoteVars, type QuoteTpl } from '@/lib/ads';

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
  holdUntil?: string;                   // validez de la RESERVA (ISO) — distinta de la validez de la cotización
  validUntil?: string;                  // validez de la COTIZACIÓN (YYYY-MM-DD) — "válida hasta"
  // vendedor (de su cuenta, no editable por él)
  sellerName: string; sellerEmail: string; sellerPhone?: string;
  // comprador (lo que el vendedor sí edita)
  advertiser: string; advertiserCompany?: string; advertiserEmail?: string;
  linkUrl?: string;
  // plantilla resuelta para el idioma elegido (si falta, se usa la de fábrica)
  tpl?: QuoteTpl;
};

const clean = (s: string) => String(s || '').replace(/[^\x00-\xFF]/g, '').slice(0, 400);
const fmtDate = (d: string, lang: 'es' | 'en') => {
  try {
    const dt = new Date(d + 'T00:00:00Z');
    return dt.toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
  } catch { return d; }
};
const daysBetween = (a: string, b: string) => Math.max(1, Math.round((+new Date(b + 'T00:00:00Z') - +new Date(a + 'T00:00:00Z')) / 86400000) + 1);

// Variables disponibles para la plantilla, ya con formato del idioma.
function tplVars(inp: AdProposalInput, lang: 'es' | 'en'): Record<string, string> {
  const days = daysBetween(inp.startDate, inp.endDate);
  return {
    advertiser: inp.advertiser || (lang === 'es' ? 'anunciante' : 'advertiser'),
    company: inp.advertiserCompany || inp.advertiser || '',
    seller: inp.sellerName || 'Onyx Trading Live',
    sellerEmail: inp.sellerEmail || '',
    slot: lang === 'es' ? inp.slotNameEs : inp.slotNameEn,
    size: inp.size || '',
    page: lang === 'es' ? inp.pageEs : inp.pageEn,
    start: fmtDate(inp.startDate, lang),
    end: fmtDate(inp.endDate, lang),
    days: String(days),
    price: `$${Math.round(inp.price).toLocaleString(lang === 'es' ? 'es-ES' : 'en-US')}`,
    cap: String(inp.cap || 1),
    validUntil: inp.validUntil ? fmtDate(inp.validUntil, lang) : '',
  };
}
const tplFor = (inp: AdProposalInput, lang: 'es' | 'en'): QuoteTpl => inp.tpl || DEFAULT_QUOTE_TPL[lang];

// Texto del correo (usa la plantilla: intro + resumen + cierre). El PDF va adjunto.
export function adProposalEmail(inp: AdProposalInput, lang: 'es' | 'en'): { subject: string; body: string } {
  const en = lang === 'en';
  const days = daysBetween(inp.startDate, inp.endDate);
  const place = en ? inp.slotNameEn : inp.slotNameEs;
  const vars = tplVars(inp, lang);
  const tpl = tplFor(inp, lang);
  const intro = fillQuoteVars(tpl.intro, vars);
  const closing = fillQuoteVars(tpl.closing, vars);
  const validity = vars.validUntil ? fillQuoteVars(tpl.validityNote, vars) : '';
  const lines = en
    ? [`- Dates: ${vars.start} to ${vars.end} (${days} days)`, `- Total: ${vars.price} USD`]
    : [`- Fechas: del ${vars.start} al ${vars.end} (${days} días)`, `- Total: ${vars.price} USD`];
  const subject = en
    ? `Ad space proposal · ${place} · Onyx Trading Live`
    : `Propuesta de espacio publicitario · ${place} · Onyx Trading Live`;
  const body = `${intro}\n\n${lines.join('\n')}${validity ? `\n\n${validity}` : ''}\n\n${closing}${inp.sellerEmail ? `\n${inp.sellerEmail}` : ''}${inp.sellerPhone ? `\n${inp.sellerPhone}` : ''}`;
  return { subject, body };
}

export async function adProposalPdf(inp: AdProposalInput, opts?: { lang?: 'es' | 'en' }): Promise<Uint8Array> {
  const lang = opts?.lang === 'en' ? 'en' : 'es';
  const en = lang === 'en';
  const vars = tplVars(inp, lang);
  const tpl = tplFor(inp, lang);
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 595, H = 842, M = 40;

  const brand = rgb(0.486, 0.549, 1);
  const dark = rgb(0.043, 0.059, 0.118);
  const ink = rgb(0.1, 0.12, 0.18);
  const gray = rgb(0.42, 0.45, 0.5);
  const soft = rgb(0.9, 0.91, 0.94);
  const panel = rgb(0.97, 0.975, 0.985);
  const green = rgb(0.106, 0.686, 0.478);

  let page = doc.addPage([W, H]);
  let y = 0;

  const header = () => {
    page.drawRectangle({ x: 0, y: H - 58, width: W, height: 58, color: dark });
    page.drawText('Onyx Trading Live', { x: M, y: H - 30, size: 15, font: bold, color: rgb(1, 1, 1) });
    page.drawText(clean(en ? 'Advertising proposal' : 'Propuesta de publicidad'), { x: M, y: H - 48, size: 10, font, color: rgb(0.78, 0.8, 0.86) });
    const today = new Date().toLocaleDateString(en ? 'en-US' : 'es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
    page.drawText(clean((en ? 'Date: ' : 'Fecha: ') + today), { x: W - 190, y: H - 42, size: 9, font, color: rgb(0.78, 0.8, 0.86) });
    y = H - 90;
  };
  header();

  const ensure = (space: number) => { if (y - space < 60) { page = doc.addPage([W, H]); header(); } };
  const T = (s: string, x: number, yy: number, size: number, f = font, color = ink) => page.drawText(clean(s), { x, y: yy, size, font: f, color });

  // Título de sección con línea.
  const section = (title: string) => { ensure(40); T(title, M, y, 9, bold, brand); y -= 8; page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1, color: soft }); y -= 18; };

  // Word-wrap: parte el texto en líneas que quepan y las dibuja; respeta \n.
  const paragraph = (text: string, size = 9.5, f = font, color = ink, lh = 14, indent = 0) => {
    const maxW = W - M * 2 - indent;
    for (const raw of String(text || '').split('\n')) {
      const words = raw.split(/\s+/).filter(Boolean);
      let line = '';
      const flush = () => { if (line) { ensure(lh); T(line, M + indent, y, size, f, color); y -= lh; line = ''; } };
      if (!words.length) { y -= lh * 0.6; continue; }
      for (const w of words) {
        const test = line ? line + ' ' + w : w;
        if (f.widthOfTextAtSize(clean(test), size) > maxW && line) { flush(); line = w; } else line = test;
      }
      flush();
    }
  };
  // Viñetas (una por línea del texto).
  const bullets = (text: string) => {
    for (const raw of String(text || '').split('\n')) {
      const it = raw.trim(); if (!it) continue;
      ensure(16); T('•', M + 12, y, 10, bold, green);
      const before = y; paragraph(it, 9.5, font, ink, 14, 26); if (y === before) y -= 14;
      y -= 2;
    }
  };

  // De / Para
  const boxW = 250;
  const drawParty = (x: number, title: string, ls: string[]) => {
    page.drawRectangle({ x, y: y - 78, width: boxW, height: 84, borderColor: soft, borderWidth: 1, color: panel });
    T(title, x + 12, y - 6, 8.5, bold, gray);
    let ly = y - 24;
    for (const l of ls) { if (l) { T(l, x + 12, ly, 10, l === ls[0] ? bold : font, ink); ly -= 15; } }
  };
  ensure(100);
  drawParty(M, en ? 'PREPARED BY' : 'PREPARADA POR', [inp.sellerName, inp.sellerEmail, inp.sellerPhone || '', 'onyxtradinglive.com']);
  drawParty(M + boxW + 15, en ? 'FOR' : 'PARA', [inp.advertiserCompany || inp.advertiser, inp.advertiserCompany ? inp.advertiser : '', inp.advertiserEmail || '', inp.linkUrl || '']);
  y -= 100;

  // Intro (de la plantilla)
  paragraph(fillQuoteVars(tpl.intro, vars), 10, font, ink, 15);
  y -= 8;

  // Detalle del espacio
  section(en ? 'PLACEMENT' : 'ESPACIO'); y += 4;
  const days = daysBetween(inp.startDate, inp.endDate);
  const rowsData: [string, string][] = [
    [en ? 'Location' : 'Ubicación', vars.slot],
    [en ? 'Format (IAB)' : 'Formato (IAB)', inp.size],
    [en ? 'Section' : 'Sección', vars.page],
    [en ? 'Dates' : 'Fechas', `${vars.start}  —  ${vars.end}  (${days} ${en ? 'days' : 'días'})`],
    [en ? 'Rotation' : 'Rotación', en ? `Shared space · up to ${inp.cap} advertisers rotating` : `Espacio compartido · hasta ${inp.cap} anunciantes rotando`],
  ];
  if (inp.impressionsPerDay && inp.impressionsPerDay > 0) rowsData.push([en ? 'Est. impressions' : 'Impresiones estim.', `~${Math.round(inp.impressionsPerDay).toLocaleString(en ? 'en-US' : 'es-ES')} ${en ? '/ day' : '/ día'}`]);
  for (const [k, v] of rowsData) { ensure(20); T(k, 52, y, 10, font, gray); T(v, 210, y, 10, bold, ink); y -= 20; }
  y -= 6;

  // Precio total
  ensure(56);
  page.drawRectangle({ x: M, y: y - 44, width: W - M * 2, height: 50, color: rgb(0.96, 0.965, 1), borderColor: brand, borderWidth: 1.2 });
  T(en ? 'TOTAL FOR THE PERIOD' : 'TOTAL DEL PERIODO', 56, y - 14, 10, bold, gray);
  T(en ? 'Flat rate · no cost per click · users who pay for Pro do not see ads' : 'Tarifa plana · sin costo por clic · los usuarios Pro no ven anuncios', 56, y - 30, 8.5, font, gray);
  T(vars.price, W - 155, y - 26, 22, bold, brand);
  T('USD', W - 70, y - 20, 10, font, gray);
  y -= 66;

  // Diagrama de la ubicación exacta.
  section(en ? 'WHERE IT APPEARS' : 'DÓNDE APARECE'); y += 12;
  ensure(160);
  {
    const dx = M, dw = W - M * 2, dtop = y, dh = 150;
    page.drawRectangle({ x: dx, y: dtop - dh, width: dw, height: dh, borderColor: soft, borderWidth: 1, color: rgb(0.985, 0.985, 1) });
    page.drawRectangle({ x: dx, y: dtop - 16, width: dw, height: 16, color: rgb(0.93, 0.94, 0.98) });
    T('onyxtradinglive.com', dx + 8, dtop - 12, 7.5, font, gray);
    const cx = dx + 8, cy0 = dtop - 22, cw = dw - 16, ch = dh - 30;
    const blk = (nx: number, ny: number, nw: number, nh: number, fill = rgb(0.9, 0.91, 0.95)) =>
      page.drawRectangle({ x: cx + nx * cw, y: cy0 - (ny + nh) * ch, width: nw * cw, height: nh * ch, color: fill });
    const ad = (nx: number, ny: number, nw: number, nh: number) => {
      page.drawRectangle({ x: cx + nx * cw, y: cy0 - (ny + nh) * ch, width: nw * cw, height: nh * ch, color: rgb(0.83, 0.85, 1), borderColor: brand, borderWidth: 1.5 });
      T(en ? 'YOUR AD' : 'TU ANUNCIO', cx + nx * cw + 4, cy0 - (ny + nh) * ch + nh * ch / 2 - 3, 7, bold, rgb(0.32, 0.36, 0.85));
    };
    blk(0.04, 0.02, 0.92, 0.08);
    const sk = inp.slotKey || '';
    if (inp.pageEs === 'blog' || sk.startsWith('blog')) {
      if (sk === 'blog_top') ad(0.04, 0.14, 0.92, 0.12); else blk(0.04, 0.14, 0.92, 0.12);
      if (sk === 'blog_infeed' || sk === 'blog_native') { blk(0.04, 0.30, 0.44, 0.6); ad(0.52, 0.30, 0.44, 0.28); blk(0.52, 0.62, 0.44, 0.28); }
      else { blk(0.04, 0.30, 0.44, 0.28); blk(0.52, 0.30, 0.44, 0.28); blk(0.04, 0.62, 0.44, 0.28); blk(0.52, 0.62, 0.44, 0.28); }
    } else if (inp.pageEs === 'article' || sk.startsWith('article')) {
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
      if (sk === 'footer_site') ad(0.04, 0.72, 0.92, 0.12); else blk(0.04, 0.72, 0.92, 0.12);
    }
    y = dtop - dh - 14;
  }

  // Incluye (plantilla)
  section(en ? 'INCLUDED' : 'INCLUYE'); bullets(fillQuoteVars(tpl.includes, vars)); y -= 6;

  // Por qué Onyx (plantilla)
  section(en ? 'WHY ONYX' : 'POR QUÉ ONYX'); bullets(fillQuoteVars(tpl.whyOnyx, vars)); y -= 6;

  // Términos (plantilla)
  section(en ? 'TERMS' : 'TÉRMINOS'); paragraph(fillQuoteVars(tpl.terms, vars), 9, font, gray, 13); y -= 8;

  // Validez de la cotización (plantilla + fecha) y, si aplica, del hold.
  if (vars.validUntil) { ensure(28); T(fillQuoteVars(tpl.validityNote, vars), M, y, 9.5, bold, ink); y -= 20; }
  if (inp.holdUntil) {
    const hu = new Date(inp.holdUntil).toLocaleString(en ? 'en-US' : 'es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    ensure(20); T(en ? `The dates are held until ${hu} while this offer is open.` : `Las fechas quedan apartadas hasta ${hu} mientras esta oferta esté abierta.`, M, y, 9, font, gray); y -= 20;
  }

  // Cierre / CTA
  ensure(46);
  page.drawRectangle({ x: M, y: y - 34, width: W - M * 2, height: 40, color: dark });
  T(en ? 'To confirm, reply to this email or contact your Onyx rep.' : 'Para confirmar, responde a este correo o contacta a tu asesor Onyx.', 56, y - 20, 10.5, bold, rgb(1, 1, 1));

  return await doc.save();
}
