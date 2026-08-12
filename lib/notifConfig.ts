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
    key: 'no_trade', group: 'Plan y hábitos', extra: true,
    es: { title: '📉 Llevas {days} días sin operar', body: 'Vuelve cuando tu plan lo diga; la paciencia también es estrategia.' },
    en: { title: '📉 {days} days without trading', body: 'Come back when your plan says so — patience is a strategy too.' },
    bell: false, push: false, telegram: false, tgKind: 'daily', url: '/dashboard?view=plan',
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
