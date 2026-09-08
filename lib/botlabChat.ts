import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { detectToEs, fromEs } from '@/lib/translate';

// ============================================================
// Chat de Bot Lab con traducción automática.
//  · El cliente escribe en su idioma → guardamos original + traducción al español.
//  · Tú (admin) respondes en español → traducimos a SU idioma antes de mostrarlo.
// ============================================================

export async function getThreadForUser(userId: string, name?: string, email?: string) {
  const { data } = await supabaseAdmin.from('botlab_threads').select('*').eq('user_id', userId).maybeSingle();
  if (data) return data as any;
  const { data: ins } = await supabaseAdmin.from('botlab_threads').insert({ user_id: userId, name: name || null, email: email || null }).select('*').single();
  return ins as any;
}
export async function getThreadById(id: string) {
  const { data } = await supabaseAdmin.from('botlab_threads').select('*').eq('id', id).maybeSingle();
  return data as any;
}
export async function createAnonThread(name?: string, email?: string) {
  const { data } = await supabaseAdmin.from('botlab_threads').insert({ name: name || null, email: email || null }).select('*').single();
  return data as any;
}

export async function listMessages(threadId: string) {
  const { data } = await supabaseAdmin.from('botlab_messages').select('*').eq('thread_id', threadId).order('created_at').limit(200);
  return (data || []) as any[];
}

// Mensaje del CLIENTE: detecta idioma + traduce al español. Sube el contador de sin-leer.
export async function postUserMessage(threadId: string, text: string) {
  const { lang, es } = await detectToEs(text);
  await supabaseAdmin.from('botlab_messages').insert({ thread_id: threadId, sender: 'user', lang, body_orig: text, body_es: es });
  // El idioma del hilo = el del último mensaje del cliente (para responderle en él).
  const { data: th } = await supabaseAdmin.from('botlab_threads').select('unread_admin').eq('id', threadId).maybeSingle();
  await supabaseAdmin.from('botlab_threads').update({ lang, unread_admin: ((th as any)?.unread_admin || 0) + 1, last_at: new Date().toISOString() }).eq('id', threadId);
  return { lang, es };
}

// Respuesta del ADMIN (en español): la traducimos al idioma del cliente.
export async function postAdminMessage(threadId: string, esText: string) {
  const th = await getThreadById(threadId);
  const lang = (th?.lang || 'es');
  const orig = await fromEs(esText, lang);
  await supabaseAdmin.from('botlab_messages').insert({ thread_id: threadId, sender: 'admin', lang, body_orig: orig, body_es: esText });
  await supabaseAdmin.from('botlab_threads').update({ last_at: new Date().toISOString() }).eq('id', threadId);
  return { orig };
}

export async function markRead(threadId: string) {
  await supabaseAdmin.from('botlab_threads').update({ unread_admin: 0 }).eq('id', threadId);
  await supabaseAdmin.from('botlab_messages').update({ read_admin: true }).eq('thread_id', threadId).eq('sender', 'user');
}

// Bandeja del admin: hilos con su último mensaje (en español) y sin-leer.
export async function adminListThreads() {
  const { data: threads } = await supabaseAdmin.from('botlab_threads').select('*').order('last_at', { ascending: false }).limit(100);
  const rows = (threads || []) as any[];
  // Nombre del usuario logueado si falta.
  const uids = Array.from(new Set(rows.map((t) => t.user_id).filter(Boolean)));
  const nameOf: Record<string, string> = {};
  if (uids.length) { const { data: pr } = await supabaseAdmin.from('profiles').select('id,full_name,email').in('id', uids); (pr || []).forEach((p: any) => { nameOf[p.id] = p.full_name || p.email || ''; }); }
  const out: any[] = [];
  for (const t of rows) {
    const { data: last } = await supabaseAdmin.from('botlab_messages').select('body_es,sender,created_at').eq('thread_id', t.id).order('created_at', { ascending: false }).limit(1);
    out.push({ ...t, who: t.name || nameOf[t.user_id] || (t.email || '').split('@')[0] || 'Cliente', preview: (last || [])[0]?.body_es || '' });
  }
  return out;
}
export async function totalUnread() {
  const { data } = await supabaseAdmin.from('botlab_threads').select('unread_admin');
  return (data || []).reduce((s: number, r: any) => s + (r.unread_admin || 0), 0);
}
