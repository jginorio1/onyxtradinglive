import { NextResponse } from 'next/server';
import { requirePerm, logAdmin } from '@/lib/admin';
import { sendManual, renderTemplate } from '@/lib/campaigns';
import { sendEmailId } from '@/lib/mail';
import { userLangByEmail } from '@/lib/emailTemplates';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ============================================================
// Redactar y enviar un correo desde el Centro de correos.
//   action 'count'    → cuántos lo recibirían (segmento o lista).
//   action 'test'     → prueba a la propia dirección del admin.
//   action 'send'     → envía YA (a un segmento o a direcciones concretas).
//   action 'schedule' → programa para una fecha (solo por segmento; usa la cola).
// Cada correo sale en el idioma del perfil del destinatario.
// ============================================================

function parseEmails(raw: any): string[] {
  return String(raw || '')
    .split(/[\s,;]+/).map((s) => s.trim().toLowerCase())
    .filter((s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s))
    .slice(0, 500);
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

    // Prueba a la propia dirección del admin.
    if (action === 'test') {
      const to = b.to || p.user?.email;
      if (!to) return NextResponse.json({ error: 'sin destino' }, { status: 400 });
      const lang = b.lang === 'es' ? 'es' : 'en';
      const r = { id: 'test', email: to, name: (p.user?.email || '').split('@')[0], lang, plan: 'test' } as any;
      const subject = lang === 'en' ? (sEn || sEs) : (sEs || sEn);
      const body = lang === 'en' ? (bEn || bEs) : (bEs || bEn);
      if (!subject || !body) return NextResponse.json({ error: 'falta asunto o cuerpo' }, { status: 400 });
      const { ok } = await sendEmailId(to, '[PRUEBA] ' + renderTemplate(subject, r), renderTemplate(body, r), { kind: 'admin', unsub: null });
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
      const row = {
        name: String(b.name || sEs || sEn || 'Correo programado').slice(0, 120),
        kind: 'manual', segment: String(b.segment || 'all'),
        subject_es: sEs.slice(0, 200), body_es: bEs.slice(0, 4000),
        subject_en: sEn.slice(0, 200), body_en: bEn.slice(0, 4000),
        scheduled_at: d.toISOString(), enabled: true,
      };
      const { data, error } = await supabaseAdmin.from('campaigns').insert(row).select('id').maybeSingle();
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
        const body = lang === 'en' ? (bEn || bEs) : (bEs || bEn);
        if (!subject || !body) continue;
        const { ok } = await sendEmailId(to, renderTemplate(subject, r), renderTemplate(body, r), { kind: 'admin', unsub: null });
        if (ok) sent++;
      }
      await logAdmin(p.user?.email || '', 'email_send_direct', String(emails.length), { sent });
      return NextResponse.json({ ok: true, count: emails.length, sent });
    }

    // A un segmento (reusa el motor; respeta el idioma de cada perfil).
    const r = await sendManual({ segment: b.segment || 'all', subject_es: sEs, body_es: bEs, subject_en: sEn, body_en: bEn });
    await logAdmin(p.user?.email || '', 'email_send_segment', b.segment || 'all', { sent: r.sent });
    return NextResponse.json({ ok: true, ...r });
  } catch (e: any) {
    await logError('emails_compose', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
