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
  opts: { lang?: string; url?: string; vars?: Record<string, string | number>; cfg?: any; title?: string; body?: string; once?: string; ignorePlan?: boolean } = {}
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
    // Idioma del aviso: si el que llama lo pasa, se respeta; si no, se toma el
    // idioma guardado en el perfil del propio destinatario (profiles.lang). Así
    // cada trader recibe sus push en su idioma sin que cada llamador tenga que
    // averiguarlo. Solo cae a 'es' si el perfil no tiene idioma.
    let lang: 'es' | 'en';
    if (opts.lang) lang = opts.lang === 'en' ? 'en' : 'es';
    else {
      let plang = '';
      try { const { data } = await supabaseAdmin.from('profiles').select('lang').eq('id', userId).maybeSingle(); plang = (data as any)?.lang || ''; } catch {}
      lang = plang === 'en' ? 'en' : 'es';
    }
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
    let planId: string | null = null;
    try {
      const { data } = await supabaseAdmin.from('profiles').select('notif_prefs,plan').eq('id', userId).maybeSingle();
      pref = (data as any)?.notif_prefs?.[key] || {};
      planId = (data as any)?.plan || null;
    } catch { /* si no existe la columna aún, no filtra */ }

    if (d.bell && pref.bell !== false) { try { await notify(userId, { kind: key, title, body, url }); } catch {} }
    // La categoría define el CANAL de la push nativa (Android) para que el usuario
    // pueda activar/silenciar cada tipo por separado y se vea el nombre del canal.
    // PUSH además exige que el PLAN lo incluya (capabilities.push): si el plan no lo
    // cubre (p. ej. Free), no se envía push aunque el tipo y las prefs lo permitan.
    // Así se hace cumplir el candado que ya muestra la UI, y queda configurable por plan.
    // ignorePlan = envíos del dueño/admin (prueba "Probar ahora", difusión manual):
    // esos no deben respetar el candado de plan, deben poder llegar a cualquiera.
    if (d.push && pref.push !== false && (opts.ignorePlan || await planAllowsPush(planId))) {
      try { await sendPush(userId, { title, body, url, category: notifCategory(key) }); } catch {}
    }
    if (d.telegram) { try { await alertUser(userId, d.tgKind as any, `<b>${title}</b>\n${body}`); } catch {} }
  } catch { /* nunca romper el flujo que llamó */ }
}

// ¿El PLAN del usuario incluye PUSH? Misma regla que la UI de Mi cuenta → Avisos
// (app/api/account/notif-prefs): si plans.capabilities.push está puesto, manda ese
// valor; si no, el push viene apagado en Free y encendido en los de pago. Así el
// candado de push NO está quemado en código: depende de las capacidades del plan,
// y el día que crees/edites un plan, el push se ajusta solo (UI y backend juntos).
// Cacheamos por planId durante la corrida (los crons avisan a muchos a la vez).
const _pushByPlan = new Map<string, boolean>();
async function planAllowsPush(planId: string | null | undefined): Promise<boolean> {
  const id = planId || 'free';
  if (_pushByPlan.has(id)) return _pushByPlan.get(id)!;
  let allowed = id !== 'free';   // respaldo si el plan no define la capacidad
  try {
    const { data } = await supabaseAdmin.from('plans').select('capabilities').eq('id', id).maybeSingle();
    const cap = (data as any)?.capabilities?.push;
    allowed = (cap === undefined || cap === null) ? (id !== 'free') : !!cap;
  } catch { /* si falla, usamos el respaldo por id */ }
  _pushByPlan.set(id, allowed);
  return allowed;
}

// Reexport útil para precargar la config una vez en bucles (crons).
export { loadNotifConfig } from '@/lib/notifConfig';
