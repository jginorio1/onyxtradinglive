import { NextResponse } from 'next/server';
import { requirePerm, logAdmin } from '@/lib/admin';
import { sendManual, renderTemplate } from '@/lib/campaigns';
import { sendEmailId } from '@/lib/mail';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST · vista previa de conteo, correo de prueba, o envío real de una promo/noticia.
// body: { action: 'count' | 'test' | 'send', ...campos }
export async function POST(req: Request) {
  const p = await requirePerm('campanas', 'manage');
  if (!p.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  try {
    const b = await req.json().catch(() => ({} as any));
    const action = b.action || 'count';

    // Correo de prueba a la propia dirección del admin (no toca la base).
    if (action === 'test') {
      const to = b.to || p.user?.email;
      if (!to) return NextResponse.json({ error: 'sin destino' }, { status: 400 });
      const lang = b.lang === 'es' ? 'es' : 'en';
      const r = { id: 'test', email: to, name: (p.user?.email || '').split('@')[0], lang, plan: 'test' } as any;
      const subject = lang === 'en' ? (b.subject_en || b.subject_es) : b.subject_es;
      const body = lang === 'en' ? (b.body_en || b.body_es) : b.body_es;
      if (!subject || !body) return NextResponse.json({ error: 'falta asunto o cuerpo' }, { status: 400 });
      const { ok, id } = await sendEmailId(to, '[PRUEBA] ' + renderTemplate(subject, r), renderTemplate(body, r), { kind: 'campaign', unsub: null });
      // Registramos la prueba como rastreable (clave '__test__', excluida de las
      // métricas reales) para poder verificar que el webhook capta aperturas/clics.
      try { await supabaseAdmin.from('campaign_sends').insert({ campaign_key: '__test__', email: to, status: ok ? 'sent' : 'failed', resend_id: id }); } catch {}
      return NextResponse.json({ ok, test: true });
    }

    // Conteo previo (cuántos lo recibirían).
    if (action === 'count') {
      const r = await sendManual({ campaignId: b.campaignId, segment: b.segment, dryRun: true, subject_es: b.subject_es, body_es: b.body_es, subject_en: b.subject_en, body_en: b.body_en });
      return NextResponse.json({ count: r.count });
    }

    // Envío real.
    const r = await sendManual({
      campaignId: b.campaignId, segment: b.segment,
      subject_es: b.subject_es, body_es: b.body_es, subject_en: b.subject_en, body_en: b.body_en,
    });
    await logAdmin(p.user?.email || '', 'campaign_send', b.campaignId || b.segment || '', { sent: r.sent, segment: b.segment, subject: b.subject_es || b.subject_en, note: b.note || null });
    return NextResponse.json({ ok: true, ...r });
  } catch (e: any) {
    await logError('campaigns_send', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
