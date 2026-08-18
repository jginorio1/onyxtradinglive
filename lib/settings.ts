import { supabaseAdmin } from '@/lib/supabaseAdmin';

export type Retention = {
  enabled: boolean; discount_percent: number; discount_months: number; pause_months: number; allow_downgrade: boolean;
  // --- Anti-abuso ---
  repeat_percent: number;    // % de la 2ª+ vez (oferta decreciente)
  repeat_months: number;     // meses de la 2ª+ vez
  cooldown_months: number;   // no repetir descuento antes de N meses
  max_grants: number;        // veces de descuento por usuario de por vida (0 = sin tope)
  min_tenure_months: number; // antigüedad mínima pagando para poder recibir descuento
  monthly_cap: number;       // tope GLOBAL de descuentos por mes natural (0 = sin tope)
};
export type Addons = {
  extra_account_enabled: boolean; extra_account_price: number; extra_account_price_id: string;
  extra_slave_enabled: boolean; extra_slave_price: number; extra_slave_price_id: string;
  extra_master_enabled: boolean; extra_master_price: number; extra_master_price_id: string;
  algo_enabled: boolean; algo_price: number; algo_price_id: string;
};

const R: Retention = {
  enabled: true, discount_percent: 50, discount_months: 3, pause_months: 2, allow_downgrade: true,
  repeat_percent: 20, repeat_months: 1, cooldown_months: 12, max_grants: 2, min_tenure_months: 1, monthly_cap: 0,
};
const A: Addons = {
  extra_account_enabled: true, extra_account_price: 4, extra_account_price_id: '',
  extra_slave_enabled: false, extra_slave_price: 9, extra_slave_price_id: '',
  extra_master_enabled: false, extra_master_price: 15, extra_master_price_id: '',
  algo_enabled: true, algo_price: 15, algo_price_id: '',
};

// ¿El usuario tiene el módulo de bots? Por plan (capabilities.algo) o por add-on.
export async function hasAlgo(userId: string): Promise<boolean> {
  const { data: prof } = await supabaseAdmin.from('profiles').select('plan,addon_algo').eq('id', userId).maybeSingle();
  if ((prof as any)?.addon_algo) return true;
  const { data: plan } = await supabaseAdmin.from('plans').select('capabilities').eq('id', (prof as any)?.plan || 'free').maybeSingle();
  return !!(plan?.capabilities as any)?.algo;
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  try {
    const { data } = await supabaseAdmin.from('app_settings').select('value').eq('key', key).maybeSingle();
    return { ...fallback, ...(data?.value || {}) };
  } catch { return fallback; }
}
export async function saveSetting(key: string, value: any) {
  await supabaseAdmin.from('app_settings').upsert({ key, value, updated_at: new Date().toISOString() });
}
export const retentionSettings = () => getSetting<Retention>('retention', R);
export const addonSettings = () => getSetting<Addons>('addons', A);

// Prompt editable de Onyx AI (soporte/chat) desde el Admin. Si un campo está vacío,
// se usa el valor por defecto del código. `extra` se AÑADE a las instrucciones;
// `brief` REEMPLAZA el conocimiento de marca (los hechos que la IA da sobre Onyx).
export type AiPrompt = { brief_es: string; brief_en: string; extra_es: string; extra_en: string };
export const aiPromptSettings = () => getSetting<AiPrompt>('support_ai_prompt', { brief_es: '', brief_en: '', extra_es: '', extra_en: '' });

// "Invita y gana" — referidos del usuario común (recompensa en crédito de cuenta)
export type MemberReferral = {
  enabled: boolean;
  referrer_credit: number;   // crédito para quien invita (por cada amigo que paga)
  friend_credit: number;     // crédito para el amigo en su primer pago
  hold_days: number;         // ventana anti-reembolso antes de aplicar el crédito
  max_per_month: number;     // tope de recompensas por invitador al mes (0 = sin tope)
  max_lifetime: number;      // tope de recompensas por invitador de por vida (0 = sin tope)
  bridge_threshold: number;  // referidos que pagan para invitar a ser Embajador
};
const MR: MemberReferral = {
  enabled: true, referrer_credit: 10, friend_credit: 10, hold_days: 21,
  max_per_month: 0, max_lifetime: 0, bridge_threshold: 5,
};
export const memberReferralSettings = () => getSetting<MemberReferral>('member_referral', MR);

// "En línea ahora" — burbuja de prueba social (abajo-izquierda, solo escritorio).
// El número es SIMULADO: se mantiene entre `min` y `max` y sube/baja suave.
export type OnlineNow = {
  enabled: boolean;
  min: number;        // piso: el número nunca baja de aquí
  max: number;        // techo
  speed: 'slow' | 'normal' | 'fast';
  color: string;      // color de la luz/punto
  hideMobile: boolean;
  label_es: string;
  label_en: string;
};
const ON: OnlineNow = {
  enabled: true, min: 197, max: 1448, speed: 'normal', color: '#22c55e', hideMobile: true,
  label_es: 'en línea ahora', label_en: 'online now',
};
export const onlineNowSettings = () => getSetting<OnlineNow>('online_now', ON);

// Chat de soporte (burbuja "Onyx AI"): totalmente editable desde Admin → Módulos.
// Marca, colores, textos (ES/EN), pestañas/acciones, temas rápidos, mensaje
// proactivo y ajustes por dispositivo. Se lee al vuelo (sin volver a desplegar).
export type ChatTopic = { q_es: string; q_en: string; label_es: string; label_en: string };
export type ChatWidget = {
  enabled: boolean;
  // Marca
  name_es: string; name_en: string;                 // título del asistente (IA)
  humanName_es: string; humanName_en: string;        // título cuando atiende una persona
  subOn_es: string; subOn_en: string;                // subtítulo "en línea"
  subOff_es: string; subOff_en: string;              // subtítulo cuando no hay agentes
  avatarUrl: string;                                 // foto del avatar ('' = usa emoji/iniciales)
  headerEmoji: string;                               // emoji del avatar en la cabecera
  launcher: string;                                  // emoji del botón flotante
  helpLabel_es: string; helpLabel_en: string;        // etiqueta junto al botón
  greeting_es: string; greeting_en: string;          // primer mensaje del bot
  placeholder_es: string; placeholder_en: string;    // placeholder del input
  humanLabel_es: string; humanLabel_en: string;      // botón "hablar con una persona"
  topicsTitle_es: string; topicsTitle_en: string;    // título de "temas frecuentes"
  // Colores
  c1: string; c2: string; gradient: boolean; fg: string; accent: string;
  // Pestañas / acciones visibles
  showTopics: boolean; showHuman: boolean; showTicket: boolean; showPulse: boolean;
  // Temas rápidos (visitante vs usuario)
  topicsGuest: ChatTopic[];
  topicsUser: ChatTopic[];
  // Mensaje proactivo (globo sobre el botón tras unos segundos)
  proactiveOn: boolean; proactiveDelay: number; proactive_es: string; proactive_en: string;
  // Por dispositivo
  side: 'right' | 'left';
  hideDesktop: boolean; hideTablet: boolean; hideMobile: boolean;
  launcherSize: number;                              // px del botón (escritorio)
  offsetX: number; offsetY: number;                  // separación de los bordes (px)
};
const CW: ChatWidget = {
  enabled: true,
  name_es: 'Onyx AI', name_en: 'Onyx AI',
  humanName_es: 'Equipo Onyx', humanName_en: 'Onyx team',
  subOn_es: 'En línea · responde al instante', subOn_en: 'Online · instant answers',
  subOff_es: 'Te respondemos por correo', subOff_en: 'We reply by email',
  avatarUrl: '', headerEmoji: '🤖', launcher: '💬',
  helpLabel_es: '¿Necesitas ayuda?', helpLabel_en: 'Need help?',
  greeting_es: '¡Hola! ¿Sobre qué te ayudo?', greeting_en: 'Hi! How can I help?',
  placeholder_es: 'Escribe tu pregunta…', placeholder_en: 'Type your question…',
  humanLabel_es: '🙋 Hablar con una persona', humanLabel_en: '🙋 Talk to a person',
  topicsTitle_es: 'Temas frecuentes', topicsTitle_en: 'Popular topics',
  c1: '#7c8cff', c2: '#9a6bff', gradient: true, fg: '#ffffff', accent: '#7c8cff',
  showTopics: true, showHuman: true, showTicket: true, showPulse: true,
  topicsGuest: [
    { q_es: '¿Cuáles son los precios y planes?', q_en: 'What are the prices and plans?', label_es: '💳 Precios', label_en: '💳 Pricing' },
    { q_es: '¿Cómo me hago embajador?', q_en: 'How do I become an ambassador?', label_es: '🎁 Embajador', label_en: '🎁 Ambassador' },
    { q_es: '¿Cómo conecto mi cuenta (MetaTrader/cTrader)?', q_en: 'How do I connect my account (MetaTrader/cTrader)?', label_es: '🔌 Conectar', label_en: '🔌 Connect' },
    { q_es: '¿Qué hace Onyx Guardian?', q_en: 'What does Onyx Guardian do?', label_es: '🛡️ Guardian', label_en: '🛡️ Guardian' },
    { q_es: '¿Sirve para cuentas de fondeo?', q_en: 'Does it work for funded accounts?', label_es: '🏆 Fondeo', label_en: '🏆 Funded' },
  ],
  topicsUser: [
    { q_es: '¿Cómo conecto mi cuenta (MetaTrader/cTrader)?', q_en: 'How do I connect my account (MetaTrader/cTrader)?', label_es: '🔌 Conectar', label_en: '🔌 Connect' },
    { q_es: '¿Qué hace Onyx Guardian?', q_en: 'What does Onyx Guardian do?', label_es: '🛡️ Guardian', label_en: '🛡️ Guardian' },
    { q_es: '¿Sirve para cuentas de fondeo?', q_en: 'Does it work for funded accounts?', label_es: '🏆 Fondeo', label_en: '🏆 Funded' },
    { q_es: '¿Cómo cambio de plan?', q_en: 'How do I change my plan?', label_es: '💳 Mi plan', label_en: '💳 My plan' },
  ],
  proactiveOn: false, proactiveDelay: 12, proactive_es: '¿Tienes dudas? Pregúntame lo que sea 👋', proactive_en: 'Any questions? Ask me anything 👋',
  side: 'right', hideDesktop: false, hideTablet: false, hideMobile: false,
  launcherSize: 54, offsetX: 18, offsetY: 18,
};
export const chatWidgetSettings = () => getSetting<ChatWidget>('chat_widget', CW);

// Palabras clave prioritarias del blog. El AI apunta a UNA objetivo por artículo
// (rotando para cubrir todas) y teje el resto solo donde encajan, sin relleno.
export type BlogKeywords = {
  enabled: boolean;
  intensity: 'soft' | 'normal' | 'strong';
  variants: boolean;         // permitir sinónimos/variantes naturales
  internalLinks: boolean;    // enlazar la keyword a la página pilar (precios/guía)
  es: string[]; en: string[];
};
const BK: BlogKeywords = { enabled: false, intensity: 'normal', variants: true, internalLinks: true, es: [], en: [] };
export const blogKeywordsSettings = () => getSetting<BlogKeywords>('blog_keywords', BK);

// Autor del blog (E-E-A-T). Se muestra la firma con foto, cargo y bio, y alimenta
// el schema BlogPosting (author Person con jobTitle). Clave para YMYL/finanzas.
export type BlogAuthor = {
  name: string; role_es: string; role_en: string;
  bio_es: string; bio_en: string; avatar_url: string; url: string;
};
const BA: BlogAuthor = {
  name: 'Equipo Onyx', role_es: 'Analistas de trading en Onyx', role_en: 'Trading analysts at Onyx',
  bio_es: 'Escribimos sobre disciplina, gestión de riesgo y cuentas de fondeo con años de experiencia operando y acompañando a traders.',
  bio_en: 'We write about discipline, risk management and funded accounts, with years of experience trading and coaching traders.',
  avatar_url: '', url: '',
};
export const blogAuthorSettings = () => getSetting<BlogAuthor>('blog_author', BA);

// A dónde llega el "recordatorio" con el copy listo para pegar a la hora programada.
export type SocialReminder = { viaTelegram: boolean; telegramChatId: string; viaEmail: boolean; email: string };
const SR2: SocialReminder = { viaTelegram: false, telegramChatId: '', viaEmail: true, email: '' };
export const socialReminderSettings = () => getSetting<SocialReminder>('social_reminder', SR2);

// Onyx Academy · comisión por defecto (editable por el dueño en el panel).
export type AcademyFee = { default_pct: number };
const AF: AcademyFee = { default_pct: Number(process.env.ONYX_ACADEMY_FEE_PCT || 10) };
export const academyFeeSettings = () => getSetting<AcademyFee>('academy_fee', AF);

// Onyx Academy · perks. ¿Un nivel VIP puede conceder Onyx Guardian automáticamente?
// APAGADO por defecto: regala una feature de pago de Onyx, el dueño lo activa a mano.
export type AcademyPerks = { guardian_autogrant: boolean };
export const academyPerksSettings = () => getSetting<AcademyPerks>('academy_perks', { guardian_autogrant: false });

// Finanzas · precios de la IA por modelo (USD por 1M de tokens), editables por el
// dueño. Como Anthropic cambia tarifas, se ajustan sin volver a desplegar.
// 'default' se usa para cualquier modelo no listado.
export type AiPrices = { [model: string]: { in: number; out: number } };
const AI_PRICES_DEF: AiPrices = {
  'claude-haiku-4-5': { in: 1.0, out: 5.0 },
  'default': { in: 1.0, out: 5.0 },
};
export const aiPricesSettings = () => getSetting<AiPrices>('ai_prices', AI_PRICES_DEF);

// Onyx Academy · Guardian DE PAGO dentro de la comunidad. El alumno se suscribe
// (Pro o Elite) y el cobro va a la cuenta de Onyx. El dueño fija precios y on/off.
// enabled=false por defecto: no se muestra nada hasta que el dueño lo activa.
export type GuardianAcademy = {
  enabled: boolean;
  pro_cents: number;    // precio mensual del nivel Pro (en centavos)
  elite_cents: number;  // precio mensual del nivel Elite (en centavos)
  currency: string;     // 'usd'
};
const GA_DEF: GuardianAcademy = { enabled: false, pro_cents: 1900, elite_cents: 3900, currency: 'usd' };
export const guardianAcademySettings = () => getSetting<GuardianAcademy>('guardian_academy', GA_DEF);

// Onyx Academy · Copy del mentor DE PAGO. El alumno se suscribe para copiar las
// operaciones del mentor. El mentor cobra por ACCESO (no performance fee) y Onyx
// toma su % (onyx_fee_pct). El dueño controla el % y el on/off desde el panel;
// cualquier cambio se refleja en el landing y donde se promocione (leen este valor).
export type CopyMentor = {
  enabled: boolean;
  onyx_fee_pct: number;      // % que toma Onyx de cada copy vendido (editable por el dueño)
  min_price_cents: number;   // precio mínimo mensual que puede fijar el mentor
  currency: string;          // 'usd'
};
const COPY_DEF: CopyMentor = { enabled: false, onyx_fee_pct: 15, min_price_cents: 900, currency: 'usd' };
export const copyMentorSettings = () => getSetting<CopyMentor>('copy_mentor', COPY_DEF);

// Cuántas cuentas MT puede tener: las del plan + las compradas como complemento
export async function accountLimit(userId: string) {
  const { data: prof } = await supabaseAdmin.from('profiles').select('plan,extra_accounts').eq('id', userId).maybeSingle();
  const planId = prof?.plan || 'free';
  const { data: planRow } = await supabaseAdmin.from('plans').select('id,name,name_en,max_accounts').eq('id', planId).maybeSingle();
  const base = Number(planRow?.max_accounts ?? 1);
  const extra = Number(prof?.extra_accounts || 0);
  // Copy del mentor autocontenido: cada suscripción de copy ACTIVA otorga +1 cupo
  // para la cuenta que copia, sin depender del plan del alumno (se quita al cancelar).
  let copySlots = 0;
  try {
    const { count } = await supabaseAdmin.from('academy_copy_subs').select('id', { count: 'exact', head: true }).eq('student_id', userId).eq('status', 'active');
    copySlots = Number(count || 0);
  } catch { /* si la tabla no existe aún, no suma */ }
  const unlimited = base >= 999;
  return {
    planId, planName: planRow?.name || planId, planNameEn: planRow?.name_en || planRow?.name || planId,
    base, extra, copySlots, unlimited, max: unlimited ? 9999 : base + extra + copySlots,
  };
}

// Si el usuario no tiene fila en profiles, la crea. Evita que todo caiga a 'free'
// cuando el disparador de registro no llego a ejecutarse.
export async function ensureProfile(userId: string, email?: string | null) {
  const { data } = await supabaseAdmin.from('profiles').select('id').eq('id', userId).maybeSingle();
  if (data) return false;
  await supabaseAdmin.from('profiles').insert({ id: userId, email: email || null, plan: 'free' });
  return true;
}
