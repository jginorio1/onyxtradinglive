import { NextResponse } from 'next/server';
import { requirePerm, logAdmin } from '@/lib/admin';
import { sendManual, renderTemplate } from '@/lib/campaigns';
import { processEmailLinks, normalizeButtonLinks } from '@/lib/emailLinks';
import { sendEmailId } from '@/lib/mail';
import { userLangByEmail } from '@/lib/emailTemplates';
import { getSetting } from '@/lib/settings';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ============================================================
// Redactar y enviar un correo desde el Centro de correos.
//   action 'count'    → cuántos lo recibirían (segmento o lista).
//   action 'test'     → prueba a una dirección que indique el admin.
//   action 'send'     → envía YA (a un segmento o a direcciones concretas).
//   action 'schedule' → programa para una fecha (solo por segmento; usa la cola).
// Soporta cuerpo en TEXTO (markdown básico) o en HTML profesional (html_es/html_en),
// una FIRMA guardada (signature_id) y ADJUNTOS. Cada correo sale en el idioma del
// perfil del destinatario.
// ============================================================

function parseEmails(raw: any): string[] {
  return String(raw || '')
    .split(/[\s,;]+/).map((s) => s.trim().toLowerCase())
    .filter((s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s))
    .slice(0, 500);
}

function cleanAttachments(raw: any): { filename: string; content: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 10).map((a: any) => ({
    filename: String(a?.filename || 'adjunto').replace(/[^\w.\- ]+/g, '_').slice(0, 120),
    content: String(a?.content || ''),  // base64 puro (sin el prefijo data:)
  })).filter((a) => a.content);
}

export async function POST(req: Request) {
  const p = await requirePerm('campanas', 'manage');
  if (!p.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  try {
    const b = await req.json().catch(() => ({} as any));
    const action = b.action || 'count';
    const emails = parseEmails(b.emails);
    const sEs = String(b.subject_es || ''), bEs = String(b.body_es || '');
    const sEn = String(b.subject_en || ''), bEn = String(b.body_en || '');
    let hEs = String(b.html_es || ''), hEn = String(b.html_en || '');
    const attachments = cleanAttachments(b.attachments);

    // Firma guardada: se adjunta al final del cuerpo (HTML si lo hay, o texto).
    let sigHtml = '', sigText = '';
    if (b.signature_id) {
      const sigs = await getSetting<any[]>('email_signatures', []);
      const s = (Array.isArray(sigs) ? sigs : []).find((x) => x?.id === b.signature_id);
      if (s?.html) { sigHtml = String(s.html); sigText = sigHtml.replace(/<br\s*\/?>(\s*)/gi, '\n').replace(/<[^>]+>/g, '').trim(); }
    }
    const withSigHtml = (h: string) => h ? (h + (sigHtml ? '<br><br>' + sigHtml : '')) : '';
    const withSigText = (t: string) => t ? (t + (sigText ? '\n\n' + sigText : '')) : '';
    hEs = withSigHtml(hEs); hEn = withSigHtml(hEn);
    const bEsS = withSigText(bEs), bEnS = withSigText(bEn);

    // Enlaces: SIEMPRE se normalizan (candado anti-enlace-roto). Además, si se pidió,
    // se les añade UTM y/o se acortan a enlace de marca. Igual para todos los destinatarios.
    if (action !== 'count') {
      if (b.utm || b.short_links) {
        const linkOpts = { utm: !!b.utm, shorten: !!b.short_links, campaign: String(b.campaign || b.subject_es || b.subject_en || 'email') };
        if (hEs) hEs = await processEmailLinks(hEs, linkOpts);   // processEmailLinks ya normaliza primero
        if (hEn) hEn = await processEmailLinks(hEn, linkOpts);
      } else {
        if (hEs) hEs = normalizeButtonLinks(hEs);
        if (hEn) hEn = normalizeButtonLinks(hEn);
      }
    }

    // Prueba a la dirección que indique el admin (o su propio correo).
    if (action === 'test') {
      const to = b.to || p.user?.email;
      if (!to) return NextResponse.json({ error: 'sin destino' }, { status: 400 });
      const lang = b.lang === 'es' ? 'es' : 'en';
      const r = { id: 'test', email: to, name: (p.user?.email || '').split('@')[0], lang, plan: 'test' } as any;
      const subject = lang === 'en' ? (sEn || sEs) : (sEs || sEn);
      const html = lang === 'en' ? (hEn || hEs) : (hEs || hEn);
      const body = lang === 'en' ? (bEnS || bEsS) : (bEsS || bEnS);
      if (!subject || (!body && !html)) return NextResponse.json({ error: 'falta asunto o cuerpo' }, { status: 400 });
      const { ok } = await sendEmailId(to, '[PRUEBA] ' + renderTemplate(subject, r), renderTemplate(body || ' ', r), {
        kind: 'admin', unsub: null, attachments, ...(html ? { htmlBody: renderTemplate(html, r) } : {}),
      });
      return NextResponse.json({ ok, test: true });
    }

    // Conteo previo.
    if (action === 'count') {
      if (emails.length) return NextResponse.json({ count: emails.length });
      const r = await sendManual({ segment: b.segment || 'all', dryRun: true, subject_es: sEs, body_es: bEs, subject_en: sEn, body_en: bEn });
      return NextResponse.json({ count: r.count });
    }

    // Programar (solo por segmento): crea una entrada manual que el cron enviará.
    if (action === 'schedule') {
      if (emails.length) return NextResponse.json({ error: 'Para programar, usa un segmento (no direcciones sueltas).' }, { status: 400 });
      const d = new Date(b.scheduled_at);
      if (isNaN(d.getTime())) return NextResponse.json({ error: 'Fecha inválida.' }, { status: 400 });
      if (d.getTime() < Date.now() - 60000) return NextResponse.json({ error: 'La fecha ya pasó.' }, { status: 400 });
      if (!sEs && !sEn) return NextResponse.json({ error: 'Falta el asunto.' }, { status: 400 });
      const row: any = {
        name: String(b.name || sEs || sEn || 'Correo programado').slice(0, 120),
        kind: 'manual', segment: String(b.segment || 'all'),
        subject_es: sEs.slice(0, 200), body_es: bEsS.slice(0, 8000),
        subject_en: sEn.slice(0, 200), body_en: bEnS.slice(0, 8000),
        scheduled_at: d.toISOString(), enabled: true,
      };
      // Si hay HTML, lo guardamos también (columnas opcionales html_es/html_en).
      if (hEs) row.html_es = hEs.slice(0, 20000);
      if (hEn) row.html_en = hEn.slice(0, 20000);
      let { data, error } = await supabaseAdmin.from('campaigns').insert(row).select('id').maybeSingle();
      // Si la tabla aún no tiene columnas html_*, reintenta sin ellas.
      if (error && /html_e[sn]/.test(error.message || '')) {
        delete row.html_es; delete row.html_en;
        ({ data, error } = await supabaseAdmin.from('campaigns').insert(row).select('id').maybeSingle());
      }
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      await logAdmin(p.user?.email || '', 'email_schedule', (data as any)?.id || '', { segment: b.segment, when: d.toISOString() });
      return NextResponse.json({ ok: true, scheduled: true, id: (data as any)?.id, when: d.toISOString() });
    }

    // Envío YA.
    if (!sEs && !sEn) return NextResponse.json({ error: 'Falta el asunto.' }, { status: 400 });

    // A direcciones concretas: cada una en el idioma de SU perfil (es por defecto).
    if (emails.length) {
      let sent = 0;
      for (const to of emails) {
        const lang = await userLangByEmail(to);
        const r = { id: 'direct', email: to, name: to.split('@')[0], lang, plan: '' } as any;
        const subject = lang === 'en' ? (sEn || sEs) : (sEs || sEn);
        const html = lang === 'en' ? (hEn || hEs) : (hEs || hEn);
        const body = lang === 'en' ? (bEnS || bEsS) : (bEsS || bEnS);
        if (!subject || (!body && !html)) continue;
        const { ok } = await sendEmailId(to, renderTemplate(subject, r), renderTemplate(body || ' ', r), {
          kind: 'admin', unsub: null, attachments, ...(html ? { htmlBody: renderTemplate(html, r) } : {}),
        });
        if (ok) sent++;
      }
      await logAdmin(p.user?.email || '', 'email_send_direct', String(emails.length), { sent });
      return NextResponse.json({ ok: true, count: emails.length, sent });
    }

    // A un segmento (reusa el motor; respeta el idioma de cada perfil + HTML).
    const r = await sendManual({ segment: b.segment || 'all', subject_es: sEs, body_es: bEsS, subject_en: sEn, body_en: bEnS, html_es: hEs, html_en: hEn });
    await logAdmin(p.user?.email || '', 'email_send_segment', b.segment || 'all', { sent: r.sent });
    return NextResponse.json({ ok: true, ...r });
  } catch (e: any) {
    await logError('emails_compose', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
