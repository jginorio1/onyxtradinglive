import { pickLang, langFromCookie } from '@/lib/i18n';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendEmail } from '@/lib/mail';
import { logError } from '@/lib/errlog';
import { notifyNewTicket } from '@/lib/supportNotify';
import { autoHandleTicket } from '@/lib/supportAI';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Sube UNA imagen del visitante (data URL) al Storage y devuelve su URL pública.
// Solo imágenes y con tope de tamaño; el visitante no tiene sesión, por eso la
// subida es server-side y va a una carpeta "anon/". Nunca rompe el flujo del lead.
const IMG_OK = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const IMG_MAX = 6 * 1024 * 1024;
async function uploadAnonImage(att: any): Promise<{ url: string; name: string; type: string } | null> {
  try {
    const data = String(att?.data || '');
    const m = /^data:([^;]+);base64,([\s\S]+)$/.exec(data);
    if (!m) return null;
    const mediaType = m[1];
    if (!IMG_OK.includes(mediaType)) return null;
    const buf = Buffer.from(m[2], 'base64');
    if (buf.byteLength > IMG_MAX) return null;
    const name = String(att?.name || 'captura').replace(/[^\w.\- ]+/g, '_').slice(0, 80);
    const path = `anon/${Date.now()}-${name}`;
    const up = await supabaseAdmin.storage.from('chat-uploads').upload(path, buf, { contentType: mediaType, upsert: false });
    if (up.error) return null;
    const { data: pub } = supabaseAdmin.storage.from('chat-uploads').getPublicUrl(path);
    return { url: pub.publicUrl, name, type: mediaType };
  } catch { return null; }
}

// Captura de un visitante SIN cuenta: crea un ticket-lead con su correo.
// Endpoint público (no requiere sesión), acotado para evitar abuso.
export async function POST(req: Request) {
  try {
    const b = await req.json().catch(() => ({}));
    const email = String(b.email || '').trim().toLowerCase().slice(0, 160);
    const message = String(b.message || '').trim().slice(0, 4000);
    const lang = pickLang(b.lang);
    // Conversación completa con la IA (para dar contexto al equipo)
    const history: any[] = Array.isArray(b.history) ? b.history.slice(-20) : [];
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return NextResponse.json({ error: 'email inválido', code: 'email' }, { status: 400 });
    }

    // Asunto: la primera pregunta del visitante, o el último mensaje, o genérico
    const firstUserMsg = history.find((m) => m?.role === 'user' && m?.content)?.content || message;
    const subject = (firstUserMsg || (lang === 'en' ? 'Question from the website' : 'Consulta desde la web')).slice(0, 120);

    const { data: ticket, error } = await supabaseAdmin
      .from('support_tickets')
      .insert({ user_id: null, email, subject, category: 'general', status: 'open', is_lead: true })
      .select('id').single();
    if (error || !ticket) return NextResponse.json({ error: error?.message || 'error' }, { status: 500 });

    // Adjunto opcional: una sola imagen (captura). Se sube server-side.
    const img = b.attachment ? await uploadAnonImage(b.attachment) : null;
    const attList = img ? [{ url: img.url, name: img.name, type: img.type }] : [];

    // Guardamos TODA la conversación con la IA en el hilo del ticket. Así el
    // equipo ve exactamente qué preguntó y qué respondió Onyx AI.
    const rows = history
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && String(m.content || '').trim())
      .map((m) => ({ ticket_id: ticket.id, sender: m.role === 'assistant' ? 'ai' : 'user', body: String(m.content).slice(0, 4000) }));

    if (rows.length) {
      // La captura se adjunta al último mensaje del usuario (o al primero si no hay).
      if (attList.length) {
        for (let i = rows.length - 1; i >= 0; i--) { if (rows[i].sender === 'user') { (rows[i] as any).attachments = attList; break; } }
        if (!rows.some((r: any) => r.attachments)) (rows[0] as any).attachments = attList;
      }
      const r = await supabaseAdmin.from('support_messages').insert(rows);
      if ((r as any)?.error && attList.length) await supabaseAdmin.from('support_messages').insert(rows.map(({ attachments, ...m }: any) => m));
    } else if (message || attList.length) {
      const one: any = { ticket_id: ticket.id, sender: 'user', body: message || (lang === 'en' ? '(screenshot attached)' : '(captura adjunta)') };
      if (attList.length) one.attachments = attList;
      const r = await supabaseAdmin.from('support_messages').insert(one);
      if ((r as any)?.error) await supabaseAdmin.from('support_messages').insert({ ticket_id: ticket.id, sender: 'user', body: one.body });
    } else {
      // Ni conversación ni mensaje: dejó su correo sin escribir. No dejamos el
      // hilo vacío, para que el equipo sepa qué pasó.
      await supabaseAdmin.from('support_messages').insert({
        ticket_id: ticket.id, sender: 'note',
        body: lang === 'en' ? 'The visitor left their email from the widget without writing a question.' : 'El visitante dejó su correo desde el widget sin escribir una pregunta.',
      });
    }

    // Avisar al equipo por Telegram (no bloquea la respuesta al visitante)
    await notifyNewTicket({ email, subject, isLead: true });

    // Triage + auto-respuesta con IA (si está activada y el tema no es sensible)
    const { answered } = await autoHandleTicket({ ticketId: ticket.id, question: firstUserMsg || message, lang, email, subject });

    // Si la IA ya respondió, esa respuesta salió por correo y no duplicamos el
    // acuse. Si no respondió, mandamos el acuse "recibimos tu mensaje".
    if (!answered) {
      await sendEmail(
        email,
        lang === 'en' ? 'We got your message · Onyx Trading Live' : 'Recibimos tu mensaje · Onyx Trading Live',
        lang === 'en'
          ? `Thanks for writing to Onyx Trading Live. A person will get back to you soon at this address.\n\n${message ? `Your message:\n${message}\n\n` : ''}— Onyx Trading Live`
          : `Gracias por escribir a Onyx Trading Live. Una persona te responderá pronto a este correo.\n\n${message ? `Tu mensaje:\n${message}\n\n` : ''}— Onyx Trading Live`,
      );
    }

    return NextResponse.json({ ok: true, answered });
  } catch (e: any) {
    await logError('support_lead', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
