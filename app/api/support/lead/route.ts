import { pickLang, langFromCookie } from '@/lib/i18n';
import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendEmail } from '@/lib/mail';
import { logError } from '@/lib/errlog';
import { notifyNewTicket } from '@/lib/supportNotify';
import { autoHandleTicket } from '@/lib/supportAI';
import { rateLimit, clientIp, tooMany } from '@/lib/ratelimit';
import { reqGeo, flagEmoji } from '@/lib/geo';

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
    const name = String(b.name || '').trim().replace(/\s+/g, ' ').slice(0, 80);
    const message = String(b.message || '').trim().slice(0, 4000);
    const lang = pickLang(b.lang);
    // Rate-limit: público, llama a la IA y crea un ticket (spam). 5 por minuto por IP.
    const rl = await rateLimit('support_lead', clientIp(req), 5, 60);
    if (!rl.ok) return tooMany(rl.retryAfter, lang === 'en' ? 'en' : 'es');
    // Conversación completa con la IA (para dar contexto al equipo)
    const history: any[] = Array.isArray(b.history) ? b.history.slice(-20) : [];
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return NextResponse.json({ error: 'email inválido', code: 'email' }, { status: 400 });
    }

    // Asunto: la primera pregunta del visitante, o el último mensaje, o genérico
    const firstUserMsg = history.find((m) => m?.role === 'user' && m?.content)?.content || message;
    const subject = (firstUserMsg || (lang === 'en' ? 'Question from the website' : 'Consulta desde la web')).slice(0, 120);

    // Token público para que el invitado (sin sesión) siga viendo y respondiendo
    // la conversación en el widget. Si la columna aún no existe, el insert reintenta sin ella.
    const publicToken = randomUUID();
    // De dónde escribe (aproximado, por IP vía cabeceras de Vercel). País fiable;
    // ciudad opcional. No se le pide nada al cliente.
    const geo = reqGeo(req);
    const base: any = { user_id: null, email, subject, category: 'general', status: 'open', is_lead: true };
    // Campos nuevos opcionales (name/country/city): si las columnas no existen aún,
    // caemos al inserto con solo el token (que sí existe) para no fallar nunca.
    const extra: any = { name };
    if (geo.country) extra.country = geo.country;
    if (geo.city) extra.city = geo.city;
    // Lead source: de dónde vino (web, facebook, instagram, google, email…). Lo
    // manda el widget (UTM + referrer). Van APARTE para que, si esas columnas no
    // existen aún, igual se guarde el nombre/país (candidato intermedio).
    const attr = (b.attr && typeof b.attr === 'object') ? b.attr : {};
    const src: any = {};
    if (attr.source) src.source = String(attr.source).slice(0, 24);
    if (attr.utm_source) src.utm_source = String(attr.utm_source).slice(0, 60);
    if (attr.utm_medium) src.utm_medium = String(attr.utm_medium).slice(0, 60);
    if (attr.utm_campaign) src.utm_campaign = String(attr.utm_campaign).slice(0, 80);
    if (attr.landing) src.landing = String(attr.landing).slice(0, 120);
    const candidates: any[] = [
      { ...base, public_token: publicToken, ...extra, ...src },
      { ...base, public_token: publicToken, ...extra },
      { ...base, public_token: publicToken },
      { ...base, ...extra },
      { ...base },
    ].filter((c, i, arr) => i === 0 || JSON.stringify(c) !== JSON.stringify(arr[i - 1]));
    let ticket: any = null; let error: any = null;
    for (const row of candidates) {
      const r = await supabaseAdmin.from('support_tickets').insert(row).select('id').single();
      if (!r.error && r.data) { ticket = r.data; error = null; break; }
      error = r.error;
    }
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
      // Soporte bilingüe: detecta el idioma del cliente a partir de su primer
      // mensaje, lo guarda en el ticket y añade a cada mensaje del cliente la
      // versión en el idioma del empleado (meta.alt). Tolerante a falta de clave
      // de IA o de la columna meta.
      try {
        const { inbound, setTicketClientLang } = await import('@/lib/supportTranslate');
        let clientLang = '';
        for (const row of rows as any[]) {
          if (row.sender === 'user' && String(row.body || '').trim()) {
            const { clientLang: cl, meta } = await inbound(row.body, clientLang);
            if (!clientLang && cl) clientLang = cl;
            if (meta) row.meta = meta;
          }
        }
        if (clientLang) await setTicketClientLang(ticket.id, clientLang);
      } catch {}
      let r = await supabaseAdmin.from('support_messages').insert(rows);
      if ((r as any)?.error) { // reintenta sin meta
        r = await supabaseAdmin.from('support_messages').insert(rows.map(({ meta, ...m }: any) => m));
        if ((r as any)?.error && attList.length) await supabaseAdmin.from('support_messages').insert(rows.map(({ attachments, meta, ...m }: any) => m));
      }
    } else if (message || attList.length) {
      const one: any = { ticket_id: ticket.id, sender: 'user', body: message || (lang === 'en' ? '(screenshot attached)' : '(captura adjunta)') };
      if (attList.length) one.attachments = attList;
      const r = await supabaseAdmin.from('support_messages').insert(one);
      if ((r as any)?.error) await supabaseAdmin.from('support_messages').insert({ ticket_id: ticket.id, sender: 'user', body: one.body });
    } else {
      // Ni conversación ni mensaje: dejó su correo sin escribir. No dejamos el
      // hilo vacío, para que el equipo sepa qué pasó.
      const who = name ? `${name} ` : (lang === 'en' ? 'The visitor ' : 'El visitante ');
      const place = [geo.city, geo.country].filter(Boolean).join(', ');
      const from = place ? ` ${flagEmoji(geo.country)} ${lang === 'en' ? 'from' : 'desde'} ${place}` : '';
      await supabaseAdmin.from('support_messages').insert({
        ticket_id: ticket.id, sender: 'note',
        body: lang === 'en'
          ? `${who}entered the chat and left their contact (${email})${from}.`
          : `${who}entró al chat y dejó su contacto (${email})${from}.`,
      });
    }

    // Avisar al equipo por Telegram (no bloquea la respuesta al visitante)
    await notifyNewTicket({ email, subject, isLead: true });

    // Pregunta real del visitante (si la hay). Cuando solo dejó su contacto desde la
    // puerta de entrada (nombre + correo, sin escribir todavía), NO hay pregunta: no
    // corremos el triage de IA (evita la nota falsa de "la IA tuvo un error / necesita
    // humano") ni el acuse por correo. La conversación seguirá en el widget.
    const realQuestion = String(firstUserMsg || message || '').trim();

    // Triage + auto-respuesta con IA (si está activada y el tema no es sensible)
    let answered = false;
    if (realQuestion) {
      ({ answered } = await autoHandleTicket({ ticketId: ticket.id, question: realQuestion, lang, email, subject }));
    }

    // Si la IA ya respondió, esa respuesta salió por correo y no duplicamos el
    // acuse. Si no respondió (y había pregunta), mandamos el acuse "recibimos tu mensaje".
    if (realQuestion && !answered) {
      await sendEmail(
        email,
        lang === 'en' ? 'We got your message · Onyx Trading Live' : 'Recibimos tu mensaje · Onyx Trading Live',
        lang === 'en'
          ? `Thanks for writing to Onyx Trading Live. A person will get back to you soon at this address.\n\n${message ? `Your message:\n${message}\n\n` : ''}— Onyx Trading Live`
          : `Gracias por escribir a Onyx Trading Live. Una persona te responderá pronto a este correo.\n\n${message ? `Tu mensaje:\n${message}\n\n` : ''}— Onyx Trading Live`,
      );
    }

    // Devolvemos el id y el token para que el widget siga la conversación en vivo.
    return NextResponse.json({ ok: true, answered, ticketId: ticket.id, token: publicToken });
  } catch (e: any) {
    await logError('support_lead', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
