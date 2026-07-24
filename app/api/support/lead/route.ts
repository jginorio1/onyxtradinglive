import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendEmail } from '@/lib/mail';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Captura de un visitante SIN cuenta: crea un ticket-lead con su correo.
// Endpoint público (no requiere sesión), acotado para evitar abuso.
export async function POST(req: Request) {
  try {
    const b = await req.json().catch(() => ({}));
    const email = String(b.email || '').trim().toLowerCase().slice(0, 160);
    const message = String(b.message || '').trim().slice(0, 4000);
    const lang = b.lang === 'en' ? 'en' : 'es';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return NextResponse.json({ error: 'email inválido', code: 'email' }, { status: 400 });
    }

    const subject = (message || (lang === 'en' ? 'Question from the website' : 'Consulta desde la web')).slice(0, 120);

    const { data: ticket, error } = await supabaseAdmin
      .from('support_tickets')
      .insert({ user_id: null, email, subject, category: 'general', status: 'open', is_lead: true })
      .select('id').single();
    if (error || !ticket) return NextResponse.json({ error: error?.message || 'error' }, { status: 500 });

    if (message) {
      await supabaseAdmin.from('support_messages').insert({ ticket_id: ticket.id, sender: 'user', body: message });
    }

    // Acuse de recibo al visitante (si Resend está configurado)
    await sendEmail(
      email,
      lang === 'en' ? 'We got your message · Onyx Trading Live' : 'Recibimos tu mensaje · Onyx Trading Live',
      lang === 'en'
        ? `Thanks for writing to Onyx Trading Live. A person will get back to you soon at this address.\n\n${message ? `Your message:\n${message}\n\n` : ''}— Onyx Trading Live`
        : `Gracias por escribir a Onyx Trading Live. Una persona te responderá pronto a este correo.\n\n${message ? `Tu mensaje:\n${message}\n\n` : ''}— Onyx Trading Live`,
    );

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    await logError('support_lead', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
