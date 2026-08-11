import { supabaseAdmin } from '@/lib/supabaseAdmin';

// ============================================================
// Telegram. Todo pasa por el bot cuyo token está en la variable de
// entorno TELEGRAM_BOT_TOKEN. El token NO va en el código — si esta
// variable falta, las funciones no hacen nada y no rompen la app.
// ============================================================

const API = (method: string) =>
  `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`;

export const telegramEnabled = () => !!process.env.TELEGRAM_BOT_TOKEN;

// Nombre de la cuenta tal como se ve en la web: apodo, o "Broker · #login".
// Se usa para que cada aviso identifique claramente de qué cuenta habla.
export function accName(a: any): string {
  return a?.nickname || (a?.broker ? `${a.broker} · #${a.login}` : `#${a?.login}`);
}

// Nombre de usuario del bot, para armar el enlace de vinculación.
// t.me/<bot>?start=<codigo> abre Telegram con el /start ya rellenado.
export const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || 'OnyxGuardianLive_bot';

// Guarda una fila en el registro de envíos. Tolerante: si la tabla no existe
// (telegram_log.sql sin correr), no hace nada y no rompe el envío.
async function logSend(kind: string, ok: boolean, userId?: string | null, error?: string) {
  try { await supabaseAdmin.from('telegram_log').insert({ kind, ok, user_id: userId || null, error: error || null }); } catch {}
}

// Envía un mensaje a un chat. Nunca lanza: si falla, lo registra y sigue.
// `meta` (opcional) permite anotar el tipo de mensaje y a quién, para las métricas.
export async function sendMessage(chatId: string, text: string, meta?: { kind?: string; userId?: string | null }) {
  if (!telegramEnabled() || !chatId) return false;
  const kind = meta?.kind || 'message';
  try {
    const r = await fetch(API('sendMessage'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    await logSend(kind, r.ok, meta?.userId, r.ok ? undefined : `HTTP ${r.status}`);
    return r.ok;
  } catch (e: any) { await logSend(kind, false, meta?.userId, e?.message || 'network'); return false; }
}

// Envía una foto por URL (p. ej. un gráfico generado). Nunca lanza.
export async function sendPhoto(chatId: string, photoUrl: string, caption?: string) {
  if (!telegramEnabled() || !chatId || !photoUrl) return false;
  try {
    const r = await fetch(API('sendPhoto'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, photo: photoUrl, caption: caption || '', parse_mode: 'HTML' }),
    });
    await logSend('photo', r.ok, null, r.ok ? undefined : `HTTP ${r.status}`);
    return r.ok;
  } catch (e: any) { await logSend('photo', false, null, e?.message || 'network'); return false; }
}

// Envía una imagen (bytes PNG) como foto. Nunca lanza.
export async function sendPhotoFile(chatId: string, bytes: Uint8Array, caption?: string) {
  if (!telegramEnabled() || !chatId) return false;
  try {
    const form = new FormData();
    form.append('chat_id', chatId);
    if (caption) { form.append('caption', caption); form.append('parse_mode', 'HTML'); }
    form.append('photo', new Blob([bytes as any], { type: 'image/png' }), 'report.png');
    const r = await fetch(API('sendPhoto'), { method: 'POST', body: form as any });
    await logSend('photo', r.ok, null, r.ok ? undefined : `HTTP ${r.status}`);
    return r.ok;
  } catch (e: any) { await logSend('photo', false, null, e?.message || 'network'); return false; }
}

// Envía un archivo (PDF, CSV…) como documento adjunto. Nunca lanza.
export async function sendDocument(chatId: string, filename: string, content: Uint8Array | string, mime: string, caption?: string) {
  if (!telegramEnabled() || !chatId) return false;
  try {
    const bytes = typeof content === 'string' ? new TextEncoder().encode(content) : content;
    const form = new FormData();
    form.append('chat_id', chatId);
    if (caption) { form.append('caption', caption); form.append('parse_mode', 'HTML'); }
    form.append('document', new Blob([bytes as any], { type: mime }), filename);
    const r = await fetch(API('sendDocument'), { method: 'POST', body: form as any });
    await logSend('document', r.ok, null, r.ok ? undefined : `HTTP ${r.status}`);
    return r.ok;
  } catch (e: any) { await logSend('document', false, null, e?.message || 'network'); return false; }
}

// Alerta a un usuario respetando sus preferencias.
// `kind` decide qué interruptor se comprueba antes de enviar.
type Kind = 'blocks' | 'limits' | 'manager' | 'funding' | 'daily' | 'offline' | 'goal' | 'weekly'
  | 'copy_paused' | 'copy_error';

const PREF_COL: Record<Kind, string> = {
  blocks: 'tg_blocks', limits: 'tg_limits', manager: 'tg_manager',
  funding: 'tg_funding', daily: 'tg_daily', offline: 'tg_offline', goal: 'tg_goal',
  weekly: 'tg_weekly',
  copy_paused: 'tg_copy_paused', copy_error: 'tg_copy_error',
};

export async function alertUser(userId: string, kind: Kind, text: string) {
  try {
    const { data: p } = await supabaseAdmin
      .from('profiles')
      .select('telegram_chat_id,tg_alerts,tg_blocks,tg_limits,tg_manager,tg_funding,tg_daily,tg_offline,tg_goal,tg_weekly,tg_copy_paused,tg_copy_error,plan')
      .eq('id', userId).maybeSingle() as any;

    if (!p?.telegram_chat_id) return false;
    if (!p.tg_alerts) return false;                 // interruptor general apagado

    // Telegram es de Elite: si el plan cambió, dejamos de mandar
    const { data: plan } = await supabaseAdmin
      .from('plans').select('capabilities').eq('id', p.plan || 'free').maybeSingle();
    if (!(plan?.capabilities as any)?.telegram) return false;

    if (!p[PREF_COL[kind]]) return false;

    return await sendMessage(p.telegram_chat_id, text, { kind, userId });
  } catch { return false; }
}

// Alerta "una vez al día": para avisos que no queremos repetir en cada
// heartbeat (cerca de un límite, EA caído…). `key` distingue el tipo y el día.
export async function alertOncePerDay(userId: string, kind: Kind, key: string, text: string) {
  try {
    const { data: p } = await supabaseAdmin.from('profiles')
      .select('tg_sent').eq('id', userId).maybeSingle() as any;
    const sent = (p?.tg_sent as any) || {};
    const today = new Date().toISOString().slice(0, 10);
    const stamp = `${key}:${today}`;
    if (sent[key] === today) return false;          // ya avisado hoy

    const ok = await alertUser(userId, kind, text);
    if (ok) {
      sent[key] = today;
      await supabaseAdmin.from('profiles').update({ tg_sent: sent }).eq('id', userId);
    }
    return ok;
  } catch { return false; }
}

// Código de vínculo corto y legible (evita 0/O y 1/I para que no se confundan)
export function makeLinkCode(): string {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 8; i++) s += c[Math.floor(Math.random() * c.length)];
  return s;
}
