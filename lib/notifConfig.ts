import { getSetting } from '@/lib/settings';

// ============================================================
// Centro de notificaciones. Un catálogo con TODOS los avisos que la app puede
// mandar. Cada tipo tiene: textos ES/EN editables, y 3 canales que se pueden
// prender/apagar (campana in-app, push del móvil, Telegram). El dueño lo edita
// desde Admin → Notificaciones; aquí se mezclan sus cambios sobre los valores
// por defecto. Los "extra" vienen apagados y se activan con un toggle.
// ============================================================

export type NotifChannel = 'bell' | 'push' | 'telegram';
export type NotifDef = {
  key: string;
  group: string;                 // para agrupar en el panel
  es: { title: string; body: string };
  en: { title: string; body: string };
  bell: boolean; push: boolean; telegram: boolean;
  tgKind: string;                // qué interruptor de Telegram del trader respeta
  url: string;                   // a dónde lleva al hacer clic
  extra?: boolean;               // opcional (apagado por defecto)
  editableChannels?: NotifChannel[]; // canales que se pueden activar en este aviso
};

// Catálogo por defecto. {vars} se sustituyen al enviar (p. ej. {days}, {name}).
export const NOTIF_CATALOG: NotifDef[] = [
  {
    key: 'checkin', group: 'Plan y hábitos',
    es: { title: '✅ Tu check-in de hoy', body: 'Marca tus hábitos para no perder tu racha.' },
    en: { title: '✅ Your daily check-in', body: 'Mark your habits to keep your streak alive.' },
    bell: true, push: false, telegram: true, tgKind: 'daily', url: '/dashboard?view=plan',
    editableChannels: ['bell', 'push', 'telegram'],
  },
  {
    key: 'checkin_evening', group: 'Plan y hábitos', extra: true,
    es: { title: '🌙 Cierra tu check-in', body: 'Antes de terminar el día, marca los hábitos que te falten y guarda tu racha.' },
    en: { title: '🌙 Close your check-in', body: 'Before the day ends, tick your remaining habits and keep your streak.' },
    bell: true, push: false, telegram: false, tgKind: 'daily', url: '/dashboard?view=plan',
    editableChannels: ['bell', 'push', 'telegram'],
  },
  {
    key: 'no_trade', group: 'Plan y hábitos', extra: true,
    es: { title: '📉 Llevas {days} días sin operar', body: 'Vuelve cuando tu plan lo diga; la paciencia también es estrategia.' },
    en: { title: '📉 {days} days without trading', body: 'Come back when your plan says so — patience is a strategy too.' },
    bell: false, push: false, telegram: false, tgKind: 'daily', url: '/dashboard?view=plan',
    editableChannels: ['bell', 'push', 'telegram'],
  },
  {
    key: 'journal_reminder', group: 'Plan y hábitos',
    es: { title: '📓 Tienes operaciones sin diario', body: '{count} operaciones esperan tu diario. Documéntalas mientras las recuerdas.' },
    en: { title: '📓 You have trades without a journal', body: '{count} trades are waiting for your journal. Document them while you remember.' },
    bell: true, push: false, telegram: false, tgKind: 'daily', url: '/dashboard?view=operaciones',
    editableChannels: ['bell', 'push', 'telegram'],
  },
  {
    key: 'weekly_summary', group: 'Resúmenes', extra: true,
    es: { title: '📈 Tu semana en Onyx', body: 'Ya tienes tu resumen semanal listo para revisar.' },
    en: { title: '📈 Your week on Onyx', body: 'Your weekly recap is ready to review.' },
    bell: false, push: false, telegram: false, tgKind: 'weekly', url: '/dashboard?view=rendimiento',
    editableChannels: ['bell', 'push'],
  },
  {
    key: 'bot_alert', group: 'Robots',
    es: { title: '🤖 {bot}', body: 'Tu robot necesita tu atención (drawdown o divergencia).' },
    en: { title: '🤖 {bot}', body: 'Your robot needs attention (drawdown or divergence).' },
    bell: false, push: true, telegram: false, tgKind: 'manager', url: '/dashboard/bots',
    editableChannels: ['bell', 'push'],
  },
  {
    key: 'support_reply', group: 'Soporte',
    es: { title: '💬 Respondimos tu consulta', body: '{body}' },
    en: { title: '💬 We replied to your ticket', body: '{body}' },
    bell: true, push: false, telegram: false, tgKind: 'manager', url: '/dashboard/soporte',
    editableChannels: ['bell', 'push'],
  },
  {
    key: 'referral_reward', group: 'Referidos',
    es: { title: '🎉 Ganaste una recompensa por referido', body: 'Tu invitado pagó. Estará disponible tras la ventana de espera.' },
    en: { title: '🎉 You earned a referral reward', body: 'Your invite paid. It unlocks after the holding window.' },
    bell: true, push: false, telegram: false, tgKind: 'manager', url: '/dashboard/academy',
    editableChannels: ['bell', 'push'],
  },

  // ===== GRUPO 1 · encendidas por defecto (alto valor, baja frecuencia) =====
  {
    key: 'ea_down', group: 'Trading y reto',
    es: { title: '🔌 Tu conexión se cayó', body: 'Tu cuenta {acc} dejó de reportar. Revisa el EA o el VPS.' },
    en: { title: '🔌 Your connection dropped', body: 'Account {acc} stopped reporting. Check the EA or VPS.' },
    bell: true, push: true, telegram: true, tgKind: 'manager', url: '/dashboard/keys',
    editableChannels: ['bell', 'push', 'telegram'],
  },
  {
    key: 'goal_reached', group: 'Trading y reto',
    es: { title: '🎯 ¡Meta alcanzada!', body: 'Llegaste a tu objetivo del día. Sabe cuándo parar.' },
    en: { title: '🎯 Goal reached!', body: 'You hit your target for the day. Know when to stop.' },
    bell: true, push: true, telegram: true, tgKind: 'manager', url: '/dashboard',
    editableChannels: ['bell', 'push', 'telegram'],
  },
  {
    key: 'funding_near', group: 'Trading y reto',
    es: { title: '🛑 Cerca de tu límite de pérdida', body: 'Vas por -{pct}% hoy. Un paso más y rompes tu regla.' },
    en: { title: '🛑 Close to your loss limit', body: 'You are at -{pct}% today. One more step breaks your rule.' },
    bell: true, push: true, telegram: true, tgKind: 'funding', url: '/dashboard/manager',
    editableChannels: ['bell', 'push', 'telegram'],
  },
  {
    key: 'challenge_violation', group: 'Trading y reto',
    es: { title: '⛔ Rompiste una regla del reto', body: '{rule}. Revisa tu marcador antes de seguir.' },
    en: { title: '⛔ You broke a challenge rule', body: '{rule}. Check your scoreboard before continuing.' },
    bell: true, push: true, telegram: true, tgKind: 'challenge', url: '/dashboard?view=reto',
    editableChannels: ['bell', 'push', 'telegram'],
  },
  {
    key: 'challenge_passed', group: 'Trading y reto',
    es: { title: '🏆 ¡Pasaste el reto!', body: 'Cumpliste el objetivo. Enhorabuena, sigue tu plan.' },
    en: { title: '🏆 Challenge passed!', body: 'You hit the objective. Congrats — stick to your plan.' },
    bell: true, push: true, telegram: true, tgKind: 'challenge', url: '/dashboard?view=reto',
    editableChannels: ['bell', 'push', 'telegram'],
  },
  {
    key: 'payment_failed', group: 'Cuenta y pagos',
    es: { title: '💳 No pudimos cobrar tu plan', body: 'Actualiza tu tarjeta para no perder el acceso.' },
    en: { title: '💳 We could not charge your plan', body: 'Update your card so you do not lose access.' },
    bell: true, push: true, telegram: false, tgKind: 'manager', url: '/account',
    editableChannels: ['bell', 'push'],
  },

  // ===== GRUPO 2 · opt-in (apagadas por defecto; el usuario las activa) =====
  {
    key: 'big_trade', group: 'Trading y reto', extra: true,
    es: { title: '💰 Operación cerrada', body: '{sym} cerró en {net}. Revisa el detalle.' },
    en: { title: '💰 Trade closed', body: '{sym} closed at {net}. See the details.' },
    bell: false, push: true, telegram: false, tgKind: 'manager', url: '/dashboard?view=operaciones',
    editableChannels: ['bell', 'push', 'telegram'],
  },
  {
    key: 'news_high', group: 'Mercado', extra: true,
    es: { title: '📅 Noticia de alto impacto pronto', body: '{event} en ~{mins} min. Cuida tus posiciones.' },
    en: { title: '📅 High-impact news soon', body: '{event} in ~{mins} min. Mind your positions.' },
    bell: false, push: true, telegram: false, tgKind: 'news', url: '/dashboard',
    editableChannels: ['bell', 'push', 'telegram'],
  },
  {
    key: 'live_class', group: 'Academia', extra: true,
    es: { title: '🔴 Clase en vivo pronto', body: '{title} empieza en {mins} min. Entra a tiempo.' },
    en: { title: '🔴 Live class soon', body: '{title} starts in {mins} min. Join on time.' },
    bell: true, push: true, telegram: false, tgKind: 'manager', url: '/dashboard/academy',
    editableChannels: ['bell', 'push'],
  },
  {
    key: 'academy_activity', group: 'Academia', extra: true,
    es: { title: '🎓 Novedad en tu academia', body: '{body}' },
    en: { title: '🎓 New in your academy', body: '{body}' },
    bell: true, push: true, telegram: false, tgKind: 'manager', url: '/dashboard/academy',
    editableChannels: ['bell', 'push'],
  },
  {
    key: 'bot_sold', group: 'Ingresos y referidos', extra: true,
    es: { title: '🛒 ¡Vendiste un robot!', body: '{name} generó una venta. Ya está en tu saldo.' },
    en: { title: '🛒 You sold a robot!', body: '{name} made a sale. It is in your balance.' },
    bell: true, push: true, telegram: false, tgKind: 'manager', url: '/dashboard/bot-lab',
    editableChannels: ['bell', 'push'],
  },
  {
    key: 'new_commission', group: 'Ingresos y referidos', extra: true,
    es: { title: '💵 Nueva comisión', body: 'Ganaste {amount}. Se acredita tras la ventana de espera.' },
    en: { title: '💵 New commission', body: 'You earned {amount}. It credits after the holding window.' },
    bell: true, push: true, telegram: false, tgKind: 'manager', url: '/dashboard/earnings',
    editableChannels: ['bell', 'push'],
  },
  {
    key: 'copy_stopped', group: 'Copy', extra: true,
    es: { title: '⏸️ La copia se detuvo', body: 'Tu enlace de copia dejó de operar. Revisa la conexión.' },
    en: { title: '⏸️ Copy trading stopped', body: 'Your copy link stopped trading. Check the connection.' },
    bell: true, push: true, telegram: false, tgKind: 'manager', url: '/dashboard/copy',
    editableChannels: ['bell', 'push', 'telegram'],
  },
];

export type NotifOverride = { on?: boolean; title_es?: string; title_en?: string; body_es?: string; body_en?: string; bell?: boolean; push?: boolean; telegram?: boolean };

// Carga el catálogo con los cambios del dueño aplicados encima.
export async function loadNotifConfig(): Promise<Record<string, NotifDef & { on: boolean }>> {
  const ov = await getSetting<Record<string, NotifOverride>>('notif_config', {}) || {};
  const out: Record<string, NotifDef & { on: boolean }> = {};
  for (const d of NOTIF_CATALOG) {
    const o = ov[d.key] || {};
    out[d.key] = {
      ...d,
      on: o.on ?? !d.extra,                 // los "extra" nacen apagados
      bell: o.bell ?? d.bell,
      push: o.push ?? d.push,
      telegram: o.telegram ?? d.telegram,
      es: { title: o.title_es || d.es.title, body: o.body_es ?? d.es.body },
      en: { title: o.title_en || d.en.title, body: o.body_en ?? d.en.body },
    };
  }
  return out;
}
