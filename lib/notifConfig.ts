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
  // Módulo al que pertenece el aviso. El panel del TRADER (Mi cuenta → Avisos) solo
  // muestra los tipos cuyo módulo el usuario tiene/usa; sin 'feature' = universal (todos).
  // El panel del ADMIN siempre muestra todo. 'academy' | 'copy' | 'bots' | 'botlab'.
  feature?: 'academy' | 'copy' | 'bots' | 'botlab';
  // Urgente: lo marca el dueño en Admin. Los urgentes se resaltan en rojo en la
  // campanita (y pueden tratarse distinto). Por defecto, false.
  urgent?: boolean;
};

// Catálogo por defecto. {vars} se sustituyen al enviar (p. ej. {days}, {name}).
export const NOTIF_CATALOG: NotifDef[] = [
  {
    key: 'checkin', group: 'Plan y hábitos',
    es: { title: '✅ Tu check-in de hoy', body: 'Marca tus hábitos para no perder tu racha.' },
    en: { title: '✅ Your daily check-in', body: 'Mark your habits to keep your streak alive.' },
    // Único recordatorio rutinario con push de fábrica: un empujón diario por la racha.
    // ?checkin=open → al tocar la notificación se abre directo el popup del check-in.
    bell: true, push: true, telegram: true, tgKind: 'daily', url: '/dashboard?view=plan&checkin=open',
    editableChannels: ['bell', 'push', 'telegram'],
  },
  {
    key: 'checkin_evening', group: 'Plan y hábitos', extra: true,
    es: { title: '🌙 Cierra tu check-in', body: 'Antes de terminar el día, marca los hábitos que te falten y guarda tu racha.' },
    en: { title: '🌙 Close your check-in', body: 'Before the day ends, tick your remaining habits and keep your streak.' },
    bell: true, push: false, telegram: false, tgKind: 'daily', url: '/dashboard?view=plan&checkin=open',
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
    feature: 'bots',
  },
  {
    key: 'support_reply', group: 'Soporte',
    es: { title: '💬 Respondimos tu consulta', body: '{body}' },
    en: { title: '💬 We replied to your ticket', body: '{body}' },
    // Alto valor y poco frecuente: al cliente le sirve enterarse al instante.
    bell: true, push: true, telegram: false, tgKind: 'manager', url: '/dashboard/soporte',
    editableChannels: ['bell', 'push'],
  },
  {
    key: 'referral_reward', group: 'Referidos',
    es: { title: '🎉 Recompensa de afiliado (Academia)', body: 'Tu invitado pagó una membresía. Estará disponible tras la ventana de espera.' },
    en: { title: '🎉 Affiliate reward (Academy)', body: 'Your invite paid for a membership. It unlocks after the holding window.' },
    // Afiliado de la ACADEMIA (lib/academyReferral). Lleva al panel de ganancias de la academia.
    bell: true, push: true, telegram: false, tgKind: 'manager', url: '/dashboard/academy',
    editableChannels: ['bell', 'push'],
    feature: 'academy',
  },
  {
    key: 'member_reward', group: 'Referidos',
    es: { title: '🎉 Invita y gana: ¡ganaste crédito!', body: 'Tu amigo se suscribió a Onyx. Tu crédito se aplica en unos días.' },
    en: { title: '🎉 Invite & earn: you got credit!', body: 'Your friend subscribed to Onyx. Your credit applies in a few days.' },
    // "Invita y gana" (lib/memberReferral). Lleva a Mi cuenta → Referidos. Crece el
    // funnel, así que va con push de fábrica (incluye a usuarios Free: ver emitNotif).
    bell: true, push: true, telegram: false, tgKind: 'manager', url: '/account#referidos',
    editableChannels: ['bell', 'push'],
  },
  {
    key: 'became_ambassador', group: 'Referidos',
    es: { title: '🚀 ¡Ya eres Embajador!', body: 'Ahora ganas comisión en efectivo por cada suscriptor. Conecta tu cobro para retirar.' },
    en: { title: '🚀 You are now an Ambassador!', body: 'You now earn cash commission per subscriber. Connect your payout to withdraw.' },
    // Hito de ascenso (lib/memberReferral). Lleva a Mi cuenta → Retiros. Push de fábrica.
    bell: true, push: true, telegram: false, tgKind: 'manager', url: '/account#retiros',
    editableChannels: ['bell', 'push'],
  },
  {
    key: 'ambassador_invite', group: 'Referidos', extra: true,
    es: { title: '🚀 Puedes hacerte Embajador', body: 'Sube a comisión en efectivo recurrente por cada suscriptor que traigas.' },
    en: { title: '🚀 You can become an Ambassador', body: 'Step up to recurring cash commission for every subscriber you bring.' },
    // Invitación/puente a Embajador (lib/memberReferral.notifyBridge). El correo y el
    // Telegram los maneja notifyBridge aparte; aquí solo campana + push (telegram off).
    bell: true, push: true, telegram: false, tgKind: 'manager', url: '/embajadores',
    editableChannels: ['bell', 'push'],
  },
  {
    key: 'academy_reward_credited', group: 'Referidos',
    es: { title: '💸 Recompensa acreditada', body: 'Aplicamos tu recompensa como crédito en tu cuenta.' },
    en: { title: '💸 Reward credited', body: 'We applied your reward as account credit.' },
    // Afiliado de academia · recompensa ya disponible como crédito (lib/academyReferral).
    bell: true, push: true, telegram: false, tgKind: 'manager', url: '/dashboard/academy',
    editableChannels: ['bell', 'push'],
    feature: 'academy',
  },
  {
    key: 'academy_reward_paid', group: 'Referidos',
    es: { title: '💸 Te pagaron tu recompensa', body: 'Recibiste el pago de tus referidos de academia.' },
    en: { title: '💸 Your reward was paid', body: 'You received the payout for your academy referrals.' },
    // Afiliado de academia · el mentor te liquidó (lib/academyReferral.payReferrer).
    bell: true, push: true, telegram: false, tgKind: 'manager', url: '/dashboard/academy',
    editableChannels: ['bell', 'push'],
    feature: 'academy',
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
    es: { title: '🏆 ¡Pasaste el reto!', body: 'Cumpliste el objetivo. Genera y comparte tu tarjeta verificada: muestra tu track record.' },
    en: { title: '🏆 Challenge passed!', body: 'You hit the objective. Generate and share your verified card — show off your track record.' },
    bell: true, push: true, telegram: true, tgKind: 'challenge', url: '/dashboard/mi-tarjeta',
    editableChannels: ['bell', 'push', 'telegram'],
  },
  {
    key: 'payment_failed', group: 'Cuenta y pagos',
    es: { title: '💳 No pudimos cobrar tu plan', body: 'Actualiza tu tarjeta para no perder el acceso.' },
    en: { title: '💳 We could not charge your plan', body: 'Update your card so you do not lose access.' },
    bell: true, push: true, telegram: false, tgKind: 'manager', url: '/account',
    editableChannels: ['bell', 'push'],
  },
  {
    // Upsell honesto por uso: a un usuario del plan GRATIS que ya gastó por uso más
    // de lo que costaría un plan, le avisamos que le saldría más barato suscribirse.
    // Lo dispara el cron /api/cron/usage-upsell (mensual). El email equivalente vive
    // en Admin → Correos (plantilla 'usage_upsell'). {plan} y {price} se rellenan.
    key: 'usage_upsell', group: 'Cuenta y pagos',
    es: { title: '💡 Un plan te saldría más barato', body: 'Por tu uso de este mes, el plan {plan} (${price}/mes) te sale más barato que seguir pagando por uso. Tú decides.' },
    en: { title: '💡 A plan would be cheaper for you', body: 'Based on this month’s usage, the {plan} plan (${price}/mo) is cheaper than paying per use. You decide.' },
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
    feature: 'academy',
  },
  {
    key: 'academy_activity', group: 'Academia', extra: true,
    es: { title: '🎓 Novedad en tu academia', body: '{body}' },
    en: { title: '🎓 New in your academy', body: '{body}' },
    bell: true, push: true, telegram: false, tgKind: 'manager', url: '/dashboard/academy',
    editableChannels: ['bell', 'push'],
    feature: 'academy',
  },
  {
    key: 'bot_sold', group: 'Ingresos y referidos', extra: true,
    es: { title: '🛒 ¡Vendiste un robot!', body: '{name} generó una venta. Ya está en tu saldo.' },
    en: { title: '🛒 You sold a robot!', body: '{name} made a sale. It is in your balance.' },
    bell: true, push: true, telegram: false, tgKind: 'manager', url: '/dashboard/bot-lab',
    editableChannels: ['bell', 'push'],
    feature: 'botlab',
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
    feature: 'copy',
  },
  {
    // Activación: se registró y abrió la app (tiene dispositivo), para encaminarlo.
    key: 'welcome', group: 'Activación',
    es: { title: '👋 Bienvenido a Onyx, {name}', body: 'Entra y arma tu plan de trading. Tu panel te espera.' },
    en: { title: '👋 Welcome to Onyx, {name}', body: 'Jump in and set up your trading plan. Your dashboard is ready.' },
    bell: true, push: true, telegram: false, tgKind: 'manager', url: '/dashboard',
    editableChannels: ['bell', 'push'],
  },
  {
    // Activación: lleva días registrado y aún NO conectó una cuenta de bróker.
    key: 'connect_reminder', group: 'Activación',
    es: { title: '🔌 Te falta un paso para empezar', body: 'Conecta tu cuenta de bróker y Onyx empieza a cuidarte. Son 2 minutos.' },
    en: { title: '🔌 One step left to start', body: 'Connect your broker account and Onyx starts protecting you. Takes 2 minutes.' },
    bell: true, push: true, telegram: false, tgKind: 'manager', url: '/dashboard/keys',
    editableChannels: ['bell', 'push'],
  },
  {
    // Reenganche: no entra hace varios días (last_seen_at).
    key: 'comeback', group: 'Activación',
    es: { title: '👋 Te extrañamos, {name}', body: 'Tu plan y tus métricas te esperan. Vuelve cuando quieras.' },
    en: { title: '👋 We miss you, {name}', body: 'Your plan and your stats are waiting. Come back anytime.' },
    bell: true, push: true, telegram: false, tgKind: 'manager', url: '/dashboard',
    editableChannels: ['bell', 'push'],
  },
  // ── Avisos que antes iban con texto fijo en código; ahora editables en Admin.
  // El cuerpo lleva {body} (contenido dinámico que llega al enviar). Puedes
  // cambiar el prefijo/título y encender/apagar o marcar urgente.
  {
    key: 'challenge_alert', group: 'Trading y reto',
    es: { title: '⚠️ Tu reto · {name}', body: '{body}' },
    en: { title: '⚠️ Your challenge · {name}', body: '{body}' },
    bell: true, push: true, telegram: false, tgKind: 'challenge', url: '/dashboard?view=reto',
    editableChannels: ['bell', 'push'],
  },
  {
    key: 'plan_change', group: 'Cuenta y pagos',
    es: { title: '💳 Cambio en tu plan', body: '{body}' },
    en: { title: '💳 Your plan is changing', body: '{body}' },
    bell: true, push: true, telegram: false, tgKind: 'manager', url: '/account',
    editableChannels: ['bell', 'push'],
  },
  {
    key: 'team_mention', group: 'Equipo',
    es: { title: '💬 {name} te mencionó', body: '{body}' },
    en: { title: '💬 {name} mentioned you', body: '{body}' },
    bell: true, push: true, telegram: false, tgKind: 'manager', url: '/admin',
    editableChannels: ['bell', 'push'],
  },
  {
    key: 'course_passed', group: 'Capacitación',
    es: { title: '🎓 Curso aprobado', body: '{body}' },
    en: { title: '🎓 Course passed', body: '{body}' },
    bell: true, push: true, telegram: false, tgKind: 'manager', url: '/entrenamiento',
    editableChannels: ['bell', 'push'],
  },
  {
    key: 'training_pending', group: 'Capacitación',
    es: { title: '📚 Formación pendiente', body: '{body}' },
    en: { title: '📚 Training pending', body: '{body}' },
    bell: true, push: true, telegram: false, tgKind: 'manager', url: '/entrenamiento',
    editableChannels: ['bell', 'push'],
  },
  {
    key: 'cert_expiring', group: 'Capacitación',
    es: { title: '⏳ Certificado por vencer', body: '{body}' },
    en: { title: '⏳ Certificate expiring', body: '{body}' },
    bell: true, push: true, telegram: false, tgKind: 'manager', url: '/entrenamiento',
    editableChannels: ['bell', 'push'],
  },
  {
    key: 'cert_expired', group: 'Capacitación',
    es: { title: '❌ Certificado vencido', body: '{body}' },
    en: { title: '❌ Certificate expired', body: '{body}' },
    bell: true, push: true, telegram: false, tgKind: 'manager', url: '/entrenamiento',
    editableChannels: ['bell', 'push'],
  },
  {
    key: 'sales_alert', group: 'Ventas (equipo)',
    es: { title: '{title}', body: '{body}' },
    en: { title: '{title}', body: '{body}' },
    bell: true, push: true, telegram: false, tgKind: 'manager', url: '/sales',
    editableChannels: ['bell', 'push'],
  },
  {
    key: 'academy_announcement', group: 'Academia',
    es: { title: '📣 {name}', body: '{body}' },
    en: { title: '📣 {name}', body: '{body}' },
    bell: false, push: true, telegram: false, tgKind: 'manager', url: '/dashboard/academy',
    editableChannels: ['bell', 'push'], feature: 'academy',
  },
  {
    key: 'academy_dm', group: 'Academia',
    es: { title: '💬 {name}', body: '{body}' },
    en: { title: '💬 {name}', body: '{body}' },
    bell: false, push: true, telegram: false, tgKind: 'manager', url: '/dashboard/academy',
    editableChannels: ['bell', 'push'], feature: 'academy',
  },
  {
    key: 'academy_win', group: 'Academia',
    es: { title: '🏆 Logro', body: '{body}' },
    en: { title: '🏆 Achievement', body: '{body}' },
    bell: false, push: true, telegram: false, tgKind: 'manager', url: '/dashboard/academy',
    editableChannels: ['bell', 'push'], feature: 'academy',
  },
  {
    key: 'academy_class', group: 'Academia',
    es: { title: '🔴 Clase en vivo pronto', body: '{body}' },
    en: { title: '🔴 Live class soon', body: '{body}' },
    bell: false, push: true, telegram: false, tgKind: 'manager', url: '/dashboard/academy',
    editableChannels: ['bell', 'push'], feature: 'academy',
  },
];

export type NotifOverride = { on?: boolean; title_es?: string; title_en?: string; body_es?: string; body_en?: string; bell?: boolean; push?: boolean; telegram?: boolean; urgent?: boolean };

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
      urgent: o.urgent ?? d.urgent ?? false,
      es: { title: o.title_es || d.es.title, body: o.body_es ?? d.es.body },
      en: { title: o.title_en || d.en.title, body: o.body_en ?? d.en.body },
    };
  }
  return out;
}
