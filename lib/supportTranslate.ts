// ============================================================
// Soporte bilingüe · puente entre el idioma del CLIENTE y el idioma del EMPLEADO.
//
// Idea:
//   · El empleado fija SU idioma principal (Ajustes de soporte → support_agent_lang).
//   · Cuando el cliente escribe, detectamos su idioma y guardamos la versión en el
//     idioma del empleado (para que éste la lea) junto al original.
//   · Cuando el empleado responde, traducimos al idioma del cliente y es ESA versión
//     la que recibe el cliente (y la que va por correo). El empleado ve ambas.
//
// Todo se guarda en support_messages.meta (jsonb) y support_tickets.client_lang.
// Si esas columnas aún no existen, el inserto es tolerante (reintenta sin ellas) y
// el sistema sigue funcionando en un solo idioma. Si no hay ANTHROPIC_API_KEY, el
// texto pasa sin traducir.
// ============================================================
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSetting } from '@/lib/settings';
import { detectLang, translateTo, normLang } from '@/lib/translate';

// Forma de support_messages.meta para un mensaje bilingüe.
export type MsgMeta = {
  lang: string;      // idioma del texto original (body), tal cual lo escribió el autor
  altLang: string;   // idioma de la versión traducida
  alt: string;       // texto traducido (contraparte de body)
};

// Idioma principal del empleado de soporte (por defecto español).
export async function agentLang(): Promise<string> {
  const v = await getSetting<string>('support_agent_lang', 'es');
  return normLang(typeof v === 'string' ? v : 'es') || 'es';
}

// El cliente ESCRIBE (entrante). Detecta su idioma y traduce al idioma del empleado.
// Devuelve el idioma del cliente y el meta a guardar (alt = versión para el empleado).
export async function inbound(text: string, knownClientLang = ''): Promise<{ clientLang: string; meta: MsgMeta | null }> {
  const emp = await agentLang();
  const clean = String(text || '').trim();
  if (!clean) return { clientLang: normLang(knownClientLang) || emp, meta: null };
  // Dos pasos ROBUSTOS (en vez de un JSON que se cortaba con textos largos como
  // el chino): 1) detectar el idioma del cliente, 2) traducir al del empleado.
  const detected = normLang(knownClientLang) || await detectLang(clean);
  const clientLang = detected || emp;
  // Si el cliente ya escribe en el idioma del empleado, no hay nada que mostrar aparte.
  if (!clientLang || clientLang === emp) return { clientLang: emp, meta: null };
  const tr = await translateTo(clean, emp, clientLang);
  return { clientLang, meta: { lang: clientLang, altLang: emp, alt: tr } };
}

// El empleado RESPONDE (saliente). Traduce del idioma del empleado al del cliente.
// Devuelve el texto que recibe el cliente (clientText) y el meta a guardar
// (alt = versión en idioma del cliente, para mostrarla y enviarla por correo).
export async function outbound(text: string, clientLang: string): Promise<{ clientText: string; meta: MsgMeta | null }> {
  const emp = await agentLang();
  const cl = normLang(clientLang);
  const clean = String(text || '').trim();
  if (!clean || !cl || cl === emp) return { clientText: text, meta: null };
  const tr = await translateTo(clean, cl, emp);
  return { clientText: tr, meta: { lang: emp, altLang: cl, alt: tr } };
}

// Lee el idioma guardado del cliente en el ticket (o '' si no hay / columna ausente).
export async function ticketClientLang(ticketId: string): Promise<string> {
  try {
    const { data } = await supabaseAdmin.from('support_tickets').select('client_lang').eq('id', ticketId).maybeSingle();
    return normLang((data as any)?.client_lang || '');
  } catch { return ''; }
}

// Guarda el idioma del cliente en el ticket si aún no está (tolerante a columna ausente).
export async function setTicketClientLang(ticketId: string, lang: string): Promise<void> {
  const l = normLang(lang);
  if (!l) return;
  try { await supabaseAdmin.from('support_tickets').update({ client_lang: l }).eq('id', ticketId); } catch {}
}

// Inserta un mensaje incluyendo meta; si la columna meta no existe, reintenta sin ella.
export async function insertMessage(row: Record<string, any>, meta: MsgMeta | null): Promise<void> {
  if (meta) {
    const r = await supabaseAdmin.from('support_messages').insert({ ...row, meta });
    if (!(r as any)?.error) return;
  }
  await supabaseAdmin.from('support_messages').insert(row);
}
