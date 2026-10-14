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
  if (['referral_reward', 'member_reward', 'became_ambassador', 'ambassador_invite', 'academy_reward_credited', 'academy_reward_paid', 'new_commission', 'bot_sold'].includes(key)) return 'onyx_ingresos';
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
    let isStaff = false;   // dueño/admin: siempre recibe push, aunque su plan sea Free
    try {
      const { data } = await supabaseAdmin.from('profiles').select('notif_prefs,plan,is_admin').eq('id', userId).maybeSingle();
      pref = (data as any)?.notif_prefs?.[key] || {};
      planId = (data as any)?.plan || null;
      isStaff = !!(data as any)?.is_admin;
    } catch { /* si no existe la columna aún, no filtra */ }
    // El dueño puede no tener is_admin en la BD (solo en ADMIN_EMAILS). Lo cubrimos.
    if (!isStaff) { try { isStaff = await emailIsOwner(userId); } catch {} }

    if (d.bell && pref.bell !== false) { try { await notify(userId, { kind: key, title, body, url }); } catch {} }
    // La categoría define el CANAL de la push nativa (Android) para que el usuario
    // pueda activar/silenciar cada tipo por separado y se vea el nombre del canal.
    // PUSH además exige que el PLAN lo incluya (capabilities.push): si el plan no lo
    // cubre (p. ej. Free), no se envía push aunque el tipo y las prefs lo permitan.
    // Así se hace cumplir el candado que ya muestra la UI, y queda configurable por plan.
    // ignorePlan = envíos del dueño/admin (prueba "Probar ahora", difusión manual):
    // esos no deben respetar el candado de plan, deben poder llegar a cualquiera.
    if (d.push && pref.push !== false && (opts.ignorePlan || isStaff || await planAllowsPush(planId))) {
      try { await sendPush(userId, { title, body, url, category: notifCategory(key) }); } catch {}
    }
    if (d.telegram) { try { await alertUser(userId, d.tgKind as any, `<b>${title}</b>\n${body}`); } catch {} }
  } catch { /* nunca romper el flujo que llamó */ }
}

// ¿El email del usuario está en ADMIN_EMAILS (dueño)? Así el dueño recibe push
// automática aunque su perfil no tenga is_admin ni un plan de pago. Cacheado.
const _ownerById = new Map<string, boolean>();
async function emailIsOwner(userId: string): Promise<boolean> {
  if (_ownerById.has(userId)) return _ownerById.get(userId)!;
  const admins = (process.env.ADMIN_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!admins.length) { _ownerById.set(userId, false); return false; }
  let owner = false;
  try {
    const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
    const email = ((data as any)?.user?.email || '').toLowerCase();
    owner = !!email && admins.includes(email);
  } catch { owner = false; }
  _ownerById.set(userId, owner);
  return owner;
}

// ¿El PLAN del usuario incluye PUSH? Regla simple y robusta: CUALQUIER plan de pago
// activo (el efectivo profiles.plan != 'free') recibe push automática; 'free' no.
// profiles.plan ya es el EFECTIVO (lib/entitlements.applyEffectivePlan): combina
// Stripe, Apple/RevenueCat, prueba de cortesía y el ajuste MANUAL del admin
// (plan_override) y se queda con el de mayor rango. Así un Black Onyx puesto a mano
// cuenta igual que uno pagado por Stripe. Antes dependíamos de plans.capabilities.push,
// lo que cortaba las push a clientes de pago si esa capacidad no estaba definida o
// quedaba en false por error; el dueño pidió que TODO plan de pago activo las reciba.
function planAllowsPush(planId: string | null | undefined): boolean {
  const id = (planId || 'free').toLowerCase();
  return !!id && id !== 'free';
}

// DIAGNÓSTICO: ¿este usuario recibirá push AUTOMÁTICA? Devuelve plan, si es staff y
// si el candado de plan lo permite. Lo usa Admin → Notificaciones para explicar por
// qué llega (o no) una automática, ya que el botón "Probar" salta estos filtros.
export async function pushDiagForUser(userId: string): Promise<{
  planId: string; isStaff: boolean; planAllowsPush: boolean; willReceiveAuto: boolean;
}> {
  let planId: string | null = null;
  let isStaff = false;
  try {
    const { data } = await supabaseAdmin.from('profiles').select('plan,is_admin').eq('id', userId).maybeSingle();
    planId = (data as any)?.plan || null;
    isStaff = !!(data as any)?.is_admin;
  } catch {}
  if (!isStaff) { try { isStaff = await emailIsOwner(userId); } catch {} }
  const planPush = await planAllowsPush(planId);
  return { planId: planId || 'free', isStaff, planAllowsPush: planPush, willReceiveAuto: isStaff || planPush };
}

// Reexport útil para precargar la config una vez en bucles (crons).
export { loadNotifConfig } from '@/lib/notifConfig';
