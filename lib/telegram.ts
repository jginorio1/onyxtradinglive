import { supabaseAdmin } from '@/lib/supabaseAdmin';

// ============================================================
// Telegram. Todo pasa por el bot cuyo token está en la variable de
// entorno TELEGRAM_BOT_TOKEN. El token NO va en el código — si esta
// variable falta, las funciones no hacen nada y no rompen la app.
// ============================================================

const API = (method: string) =>
  `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`;

export const telegramEnabled = () => !!process.env.TELEGRAM_BOT_TOKEN;

// Nombre de usuario del bot, para armar el enlace de vinculación.
// t.me/<bot>?start=<codigo> abre Telegram con el /start ya rellenado.
export const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || 'OnyxGuardianLive_bot';

// Envía un mensaje a un chat. Nunca lanza: si falla, lo registra y sigue.
export async function sendMessage(chatId: string, text: string) {
  if (!telegramEnabled() || !chatId) return false;
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
    return r.ok;
  } catch { return false; }
}

// Alerta a un usuario respetando sus preferencias.
// `kind` decide qué interruptor se comprueba antes de enviar.
type Kind = 'blocks' | 'limits' | 'manager' | 'funding' | 'daily' | 'offline' | 'goal';

const PREF_COL: Record<Kind, string> = {
  blocks: 'tg_blocks', limits: 'tg_limits', manager: 'tg_manager',
  funding: 'tg_funding', daily: 'tg_daily', offline: 'tg_offline', goal: 'tg_goal',
};

export async function alertUser(userId: string, kind: Kind, text: string) {
  try {
    const { data: p } = await supabaseAdmin
      .from('profiles')
      .select('telegram_chat_id,tg_alerts,tg_blocks,tg_limits,tg_manager,tg_funding,tg_daily,tg_offline,tg_goal,plan')
      .eq('id', userId).maybeSingle() as any;

    if (!p?.telegram_chat_id) return false;
    if (!p.tg_alerts) return false;                 // interruptor general apagado

    // Telegram es de Elite: si el plan cambió, dejamos de mandar
    const { data: plan } = await supabaseAdmin
      .from('plans').select('capabilities').eq('id', p.plan || 'free').maybeSingle();
    if (!(plan?.capabilities as any)?.telegram) return false;

    if (!p[PREF_COL[kind]]) return false;

    return await sendMessage(p.telegram_chat_id, text);
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
