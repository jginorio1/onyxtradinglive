import { notify } from '@/lib/notify';
import { sendPush } from '@/lib/push';
import { alertUser } from '@/lib/telegram';
import { loadNotifConfig } from '@/lib/notifConfig';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Cada tipo de aviso cae en un CANAL de notificación de Android (los canales se
// crean en la app, ver NativeInit). Así el usuario controla cada categoría y
// cada push muestra su nombre de canal (Plan, Robots, Soporte…).
export function notifCategory(key: string): string {
  if (['checkin', 'checkin_evening', 'no_trade', 'journal_reminder'].includes(key)) return 'onyx_plan';
  if (['ea_down', 'goal_reached', 'funding_near', 'challenge_violation', 'challenge_passed', 'big_trade', 'news_high'].includes(key)) return 'onyx_trading';
  if (key === 'bot_alert') return 'onyx_robots';
  if (key === 'copy_stopped') return 'onyx_copy';
  if (['live_class', 'academy_activity'].includes(key)) return 'onyx_academia';
  if (['referral_reward', 'new_commission', 'bot_sold'].includes(key)) return 'onyx_ingresos';
  if (key === 'payment_failed') return 'onyx_cuenta';
  if (key === 'support_reply') return 'onyx_soporte';
  if (key === 'weekly_summary') return 'onyx_resumen';
  return 'onyx_default';
}

// Envía UN aviso por los canales que el dueño dejó activos (campana / push /
// Telegram), con los textos configurados en Admin → Notificaciones. Si el tipo
// está apagado, no hace nada. Nunca lanza: un fallo de un canal no rompe el resto.
export async function emitNotif(
  userId: string,
  key: string,
  opts: { lang?: string; url?: string; vars?: Record<string, string | number>; cfg?: any; title?: string; body?: string; once?: string } = {}
): Promise<void> {
  try {
    const all = opts.cfg || (await loadNotifConfig());
    const d = all[key];
    if (!d || !d.on) return;

    // Dedup opcional por día (para crons que podrían dispararse dos veces en la
    // misma franja): si `once` ya se marcó hoy en profiles.tg_sent, no reenvía.
    if (opts.once) {
      try {
        const { data } = await supabaseAdmin.from('profiles').select('tg_sent').eq('id', userId).maybeSingle();
        const sent = ((data as any)?.tg_sent as any) || {};
        const today = new Date().toISOString().slice(0, 10);
        if (sent[opts.once] === today) return;   // ya avisado hoy
        sent[opts.once] = today;
        await supabaseAdmin.from('profiles').update({ tg_sent: sent }).eq('id', userId);
      } catch { /* si no existe la columna, seguimos sin dedup */ }
    }
    const lang = opts.lang === 'en' ? 'en' : 'es';
    const sub = (s: string) => String(s || '').replace(/\{(\w+)\}/g, (_, k) => String(opts.vars?.[k] ?? ''));
    // Si el que llama pasa un texto específico (p. ej. el motivo del robot), se usa
    // ese; si no, el texto configurado en Admin. Los canales/on-off mandan igual.
    const title = sub(opts.title ?? d[lang].title);
    const body = sub(opts.body ?? d[lang].body);
    const url = opts.url || d.url;

    // Preferencias del propio trader: puede apagar campana/push de un tipo. Si no
    // ha tocado nada, recibe lo que el dueño dejó activo. (Telegram lo controla
    // aparte con sus interruptores de Mi cuenta → Avisos.)
    let pref: any = {};
    try {
      const { data } = await supabaseAdmin.from('profiles').select('notif_prefs').eq('id', userId).maybeSingle();
      pref = (data as any)?.notif_prefs?.[key] || {};
    } catch { /* si no existe la columna aún, no filtra */ }

    if (d.bell && pref.bell !== false) { try { await notify(userId, { kind: key, title, body, url }); } catch {} }
    // La categoría define el CANAL de la push nativa (Android) para que el usuario
    // pueda activar/silenciar cada tipo por separado y se vea el nombre del canal.
    if (d.push && pref.push !== false) { try { await sendPush(userId, { title, body, url, category: notifCategory(key) }); } catch {} }
    if (d.telegram) { try { await alertUser(userId, d.tgKind as any, `<b>${title}</b>\n${body}`); } catch {} }
  } catch { /* nunca romper el flujo que llamó */ }
}

// Reexport útil para precargar la config una vez en bucles (crons).
export { loadNotifConfig } from '@/lib/notifConfig';
