// Biblioteca central de plantillas de correo transaccional (ES/EN).
// Cada plantilla tiene un id, versión por idioma y variables {var}.
// TODOS los envíos transaccionales pasan por aquí: el copy vive en un solo lugar,
// es bilingüe, editable desde el "Centro de correos" en Admin (overrides por id),
// y se envía en el idioma que tenga el perfil del usuario.

type Tpl = { subject: string; body: string };
type Entry = { es: Tpl; en: Tpl };

const TEMPLATES: Record<string, Entry> = {
  // === Cuenta y bienvenida ============================================
  onboard_welcome: {
    es: { subject: 'Bienvenido a Onyx Trading Live 🖤', body: 'Hola {nombre},\n\n¡Bienvenido! Onyx convierte tu cuenta de trading en un diario claro, con Onyx Guardian cuidando tu riesgo.\n\nEmpieza aquí — conecta tu cuenta en 2 minutos:\n{enlace}\n\n¿Dudas? Responde a este correo o abre el chat en la web.\n\n— El equipo de Onyx Trading Live' },
    en: { subject: 'Welcome to Onyx Trading Live 🖤', body: 'Hi {nombre},\n\nWelcome aboard! Onyx turns your trading account into a clear journal with Onyx Guardian watching your risk.\n\nStart here — connect your account in 2 minutes:\n{enlace}\n\nNeed help? Just reply to this email or open the chat on our site.\n\n— The Onyx Trading Live team' },
  },
  onboard_connect: {
    es: { subject: 'Conecta tu cuenta para ver tus números', body: 'Hola {nombre},\n\nVimos que aún no has conectado una cuenta. Toma unos 2 minutos y desbloquea tus estadísticas en vivo y Onyx Guardian.\n\nGuía paso a paso:\n{enlace}\n\n¿Atascado? Responde aquí y te ayuda una persona.' },
    en: { subject: 'Connect your account to see your numbers', body: 'Hi {nombre},\n\nWe noticed you haven\'t connected an account yet. It takes about 2 minutes and unlocks your live stats and Onyx Guardian.\n\nStep-by-step guide:\n{enlace}\n\nStuck? Reply here and a person will help.' },
  },
  onboard_guardian: {
    es: { subject: 'Saca más partido a Onyx Guardian', body: 'Hola {nombre},\n\nTip rápido: Onyx Guardian puede hacer respetar tu límite de pérdida diaria, proteger tus ganancias y avisarte antes de noticias de alto impacto — automáticamente.\n\nMira cómo funciona:\n{enlace}\n\nResponde cuando quieras si tienes dudas.' },
    en: { subject: 'Get more out of Onyx Guardian', body: 'Hi {nombre},\n\nQuick tip: Onyx Guardian can enforce your daily loss limit, protect your profits and warn you before high-impact news — automatically.\n\nSee how it works:\n{enlace}\n\nReply anytime if you have questions.' },
  },

  // === Pagos y suscripción ============================================
  plan_welcome: {
    es: { subject: 'Bienvenido a {plan} 🖤', body: 'Hola {nombre},\n\nTu plan **{plan}** ya está activo. ¡Gracias por confiar en Onyx Trading Live!\n\nEsto es lo que puedes hacer ahora mismo desde tu panel:\n{enlace}\n\nSi necesitas algo, responde a este correo y te contestamos.\n\n— El equipo de Onyx Trading Live' },
    en: { subject: 'Welcome to {plan} 🖤', body: 'Hi {nombre},\n\nYour **{plan}** plan is now active. Thanks for choosing Onyx Trading Live!\n\nHere\'s what you can do right now from your dashboard:\n{enlace}\n\nIf you need anything, just reply to this email.\n\n— The Onyx Trading Live team' },
  },
  payment_failed: {
    es: { subject: 'No pudimos cobrar tu suscripción', body: 'Hola {nombre},\n\nIntentamos cobrar tu plan **{plan}** pero el pago no pasó. Para no perder el acceso, actualiza tu método de pago aquí:\n{enlace}\n\nSi crees que es un error, responde a este correo.' },
    en: { subject: 'We couldn\'t charge your subscription', body: 'Hi {nombre},\n\nWe tried to charge your **{plan}** plan but the payment didn\'t go through. To avoid losing access, update your payment method here:\n{enlace}\n\nIf you think this is a mistake, reply to this email.' },
  },
  comp_reminder: {
    es: { subject: 'Tu prueba del plan {plan} vence en {dias} día(s)', body: 'Hola,\n\nTu prueba del plan **{plan}** en Onyx Trading Live vence en **{dias} día(s)**. Cuando termine, tu cuenta volverá al plan gratis.\n\nSi quieres seguir sin interrupción, elige tu plan y suscríbete aquí:\n{enlace}\n\nGracias por probar Onyx.' },
    en: { subject: 'Your {plan} trial ends in {dias} day(s)', body: 'Hi,\n\nYour **{plan}** trial at Onyx Trading Live ends in **{dias} day(s)**. When it ends, your account will go back to the free plan.\n\nTo keep going without interruption, pick your plan and subscribe here:\n{enlace}\n\nThanks for trying Onyx.' },
  },
  plan_downgrade: {
    es: { subject: 'Tu plan bajará a {plan}', body: 'Hola {nombre},\n\nEl cambio a **{plan}** se aplicará el **{fecha}**. Hasta entonces conservas tu plan actual y todas sus funciones.\n\nPuedes cancelar este cambio cuando quieras desde Mi cuenta → Suscripción:\n{enlace}' },
    en: { subject: 'Your plan will change to {plan}', body: 'Hi {nombre},\n\nThe change to **{plan}** will apply on **{fecha}**. Until then you keep your current plan and all its features.\n\nYou can cancel this change anytime from My account → Subscription:\n{enlace}' },
  },

  // === Crecimiento =====================================================
  referral_bridge: {
    es: { subject: '🚀 Ya puedes hacerte Embajador de Onyx', body: '¡Felicidades {nombre}! Ya has traído **{count}** amigos que se suscribieron.\n\nAhora puedes pasar al programa de Embajador y cobrar una comisión en efectivo recurrente por cada suscriptor, en vez de solo crédito.\n\nActívalo aquí:\n{enlace}' },
    en: { subject: '🚀 You can now become an Onyx Ambassador', body: 'Congrats {nombre}! You\'ve brought **{count}** friends who subscribed.\n\nYou can now move up to the Ambassador program and earn a recurring cash commission for every subscriber, instead of just credit.\n\nGet started here:\n{enlace}' },
  },

  // === Academia y becas ===============================================
  sch_apply_mentor: {
    es: { subject: 'Nueva solicitud de beca en {academia}', body: 'Un alumno ha solicitado una beca en **{academia}**.\n\nRevísala y apruébala o recházala en tu panel:\n{enlace}' },
    en: { subject: 'New scholarship request in {academia}', body: 'A student has requested a scholarship in **{academia}**.\n\nReview and approve or decline it in your panel:\n{enlace}' },
  },
  sch_approved: {
    es: { subject: '¡Tu beca en {academia} fue aprobada! 🎓', body: '¡Buenas noticias! Tu beca en **{academia}** fue aprobada. Ya puedes entrar y aprender:\n{enlace}' },
    en: { subject: 'Your scholarship in {academia} was approved! 🎓', body: 'Great news! Your scholarship in **{academia}** was approved. You can now jump in and learn:\n{enlace}' },
  },
  sch_denied: {
    es: { subject: 'Tu solicitud de beca en {academia}', body: 'Gracias por tu interés en **{academia}**. Esta vez tu solicitud no fue aprobada.\n\nSi quieres, puedes seguir aprendiendo con una suscripción:\n{enlace}' },
    en: { subject: 'Your scholarship request in {academia}', body: 'Thanks for your interest in **{academia}**. This time your request was not approved.\n\nIf you like, you can still learn with a subscription:\n{enlace}' },
  },
  sch_reminder: {
    es: { subject: 'Tu beca en {academia} vence pronto', body: 'Tu beca en **{academia}** vence en unos **{dias} día(s)**. Cuando termine, el acceso se cerrará.\n\nSi quieres seguir sin interrupción, continúa con una suscripción:\n{enlace}' },
    en: { subject: 'Your scholarship in {academia} ends soon', body: 'Your scholarship in **{academia}** ends in about **{dias} day(s)**. When it ends, access will close.\n\nTo keep going without interruption, continue with a subscription:\n{enlace}' },
  },
  sch_expired: {
    es: { subject: 'Tu beca en {academia} ha finalizado', body: 'Tu beca en **{academia}** ha llegado a su fin y el acceso se ha cerrado.\n\nSi quieres seguir aprendiendo, continúa con una suscripción:\n{enlace}' },
    en: { subject: 'Your scholarship in {academia} has ended', body: 'Your scholarship in **{academia}** has ended and access is now closed.\n\nIf you want to keep learning, continue with a subscription:\n{enlace}' },
  },
  training_cert: {
    es: { subject: 'Certificado: {titulo}', body: '¡Felicidades {nombre}! Aprobaste "**{titulo}**" con **{nota}/100**.\n\nDescarga tu certificado (inicia sesión primero):\n{enlace}' },
    en: { subject: 'Certificate: {titulo}', body: 'Congratulations {nombre}! You passed "**{titulo}**" with **{nota}/100**.\n\nDownload your certificate (sign in first):\n{enlace}' },
  },

  // === Seguridad y sistema ============================================
  password_reset: {
    es: { subject: 'Restablece tu contraseña · Onyx Trading Live', body: 'Hola {nombre},\n\nRecibimos una solicitud para restablecer la contraseña de tu cuenta en Onyx Trading Live.\n\nHaz clic en el botón para crear una nueva contraseña (el enlace caduca pronto):\n{enlace}\n\nSi no pediste esto, puedes ignorar este correo: tu contraseña no cambiará.\n\n— El equipo de Onyx Trading Live' },
    en: { subject: 'Reset your password · Onyx Trading Live', body: 'Hi {nombre},\n\nWe received a request to reset the password for your Onyx Trading Live account.\n\nClick the button to set a new password (the link expires soon):\n{enlace}\n\nIf you didn\'t request this, you can ignore this email — your password won\'t change.\n\n— The Onyx Trading Live team' },
  },
  security_locked: {
    es: { subject: '⚠️ Onyx · Cuenta bloqueada por PIN', body: 'Se bloqueó el acceso al panel por intentos de PIN fallidos.\n\nSi fuiste tú, espera unos minutos e inténtalo de nuevo. Si no reconoces esto, cambia tus credenciales cuanto antes.' },
    en: { subject: '⚠️ Onyx · Account locked by PIN', body: 'Access to the panel was locked due to failed PIN attempts.\n\nIf this was you, wait a few minutes and try again. If you don\'t recognize this, change your credentials as soon as possible.' },
  },
  dispute_alert: {
    es: { subject: '⚠️ Disputa de tarjeta (chargeback) · {id}', body: 'Se abrió una disputa de tarjeta.\n\nRevisa y envía la evidencia en tu panel de Stripe → Disputes → {id}.' },
    en: { subject: '⚠️ Card dispute (chargeback) · {id}', body: 'A card dispute was opened.\n\nReview and submit the evidence in your Stripe panel → Disputes → {id}.' },
  },
  mail_test: {
    es: { subject: 'Prueba de correo · Onyx', body: 'Si ves este correo, el envío con Resend funciona. — Onyx Trading Live' },
    en: { subject: 'Test email · Onyx', body: 'If you can read this, sending with Resend works. — Onyx Trading Live' },
  },
};

function fill(s: string, vars: Record<string, string | number>): string {
  return String(s).replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : ''));
}

// Devuelve { subject, text } listos para sendEmail, en el idioma pedido (defaults).
export function emailTpl(id: string, lang: string | undefined, vars: Record<string, string | number> = {}): { subject: string; text: string } {
  const e = TEMPLATES[id];
  if (!e) return { subject: '', text: '' };
  const t = lang === 'en' ? e.en : e.es;
  return { subject: fill(t.subject, vars), text: fill(t.body, vars) };
}

// Categorías del Centro de correos (orden + etiqueta + color + icono).
export const EMAIL_CATEGORIES: { id: string; es: string; en: string; color: string; icon: string }[] = [
  { id: 'account', es: 'Cuenta y bienvenida', en: 'Account & welcome', color: '#7a5cff', icon: '🙋' },
  { id: 'billing', es: 'Pagos y suscripción', en: 'Payments & billing', color: '#1d9e75', icon: '💳' },
  { id: 'academy', es: 'Academia y becas', en: 'Academy & scholarships', color: '#378add', icon: '🎓' },
  { id: 'growth', es: 'Crecimiento y referidos', en: 'Growth & referrals', color: '#d85a30', icon: '🚀' },
  { id: 'security', es: 'Seguridad y sistema', en: 'Security & system', color: '#888780', icon: '🛡️' },
];

// Metadatos para el editor: id + categoría + etiqueta bilingüe + variables + a quién va.
export const TEMPLATE_META: { id: string; cat: string; es: string; en: string; vars: string[]; to: string }[] = [
  // Cuenta
  { id: 'onboard_welcome', cat: 'account', es: 'Bienvenida al registrarse', en: 'Welcome on signup', vars: ['nombre', 'enlace'], to: 'usuario' },
  { id: 'onboard_connect', cat: 'account', es: 'Recordatorio: conecta tu cuenta', en: 'Reminder: connect your account', vars: ['nombre', 'enlace'], to: 'usuario' },
  { id: 'onboard_guardian', cat: 'account', es: 'Tip: saca más de Guardian', en: 'Tip: get more from Guardian', vars: ['nombre', 'enlace'], to: 'usuario' },
  // Pagos
  { id: 'plan_welcome', cat: 'billing', es: 'Plan activo · bienvenida', en: 'Plan active · welcome', vars: ['plan', 'nombre', 'enlace'], to: 'usuario' },
  { id: 'payment_failed', cat: 'billing', es: 'Pago fallido', en: 'Payment failed', vars: ['plan', 'nombre', 'enlace'], to: 'usuario' },
  { id: 'comp_reminder', cat: 'billing', es: 'Prueba de pago · vence pronto', en: 'Trial · ending soon', vars: ['plan', 'dias', 'enlace'], to: 'usuario' },
  { id: 'plan_downgrade', cat: 'billing', es: 'Bajada de plan programada', en: 'Scheduled downgrade', vars: ['plan', 'nombre', 'fecha', 'enlace'], to: 'usuario' },
  // Academia
  { id: 'sch_apply_mentor', cat: 'academy', es: 'Beca · nueva solicitud (al mentor)', en: 'Scholarship · new request (to mentor)', vars: ['academia', 'enlace'], to: 'mentor' },
  { id: 'sch_approved', cat: 'academy', es: 'Beca · aprobada (al alumno)', en: 'Scholarship · approved (to student)', vars: ['academia', 'enlace'], to: 'alumno' },
  { id: 'sch_denied', cat: 'academy', es: 'Beca · rechazada (al alumno)', en: 'Scholarship · declined (to student)', vars: ['academia', 'enlace'], to: 'alumno' },
  { id: 'sch_reminder', cat: 'academy', es: 'Beca · vence pronto (al alumno)', en: 'Scholarship · ending soon (to student)', vars: ['academia', 'enlace', 'dias'], to: 'alumno' },
  { id: 'sch_expired', cat: 'academy', es: 'Beca · finalizó (al alumno)', en: 'Scholarship · ended (to student)', vars: ['academia', 'enlace'], to: 'alumno' },
  { id: 'training_cert', cat: 'academy', es: 'Certificado de formación', en: 'Training certificate', vars: ['nombre', 'titulo', 'nota', 'enlace'], to: 'usuario' },
  // Crecimiento
  { id: 'referral_bridge', cat: 'growth', es: 'Puedes ser Embajador (al referidor)', en: 'You can become an Ambassador', vars: ['nombre', 'count', 'enlace'], to: 'usuario' },
  // Seguridad
  { id: 'password_reset', cat: 'security', es: 'Restablecer contraseña (al usuario)', en: 'Reset password (to user)', vars: ['nombre', 'enlace'], to: 'usuario' },
  { id: 'security_locked', cat: 'security', es: 'Cuenta bloqueada por PIN (al admin)', en: 'Account locked by PIN (to admin)', vars: [], to: 'admin' },
  { id: 'dispute_alert', cat: 'security', es: 'Disputa de tarjeta (al admin)', en: 'Card dispute (to admin)', vars: ['id'], to: 'admin' },
  { id: 'mail_test', cat: 'security', es: 'Correo de prueba', en: 'Test email', vars: [], to: 'admin' },
];

export function defaultTemplates(): Record<string, Entry> { return TEMPLATES; }

// Resuelve el marcador {firma}/{{firma}} con la firma elegida para la plantilla.
// En HTML inserta la firma tal cual; en texto, una versión sin etiquetas.
function applySig(s: string, sigHtml: string, asHtml: boolean): string {
  const rep = asHtml ? sigHtml : String(sigHtml || '').replace(/<br\s*\/?>(\s*)/gi, '\n').replace(/<[^>]+>/g, '').trim();
  return String(s || '').replace(/\{\{?\s*firma\s*\}?\}/gi, rep);
}

// Igual que emailTpl pero aplica los overrides que el dueño guardó en Admin.
// overrides: { [id]: { sig?:string, es?:{subject?,body?,html?}, en?:{subject?,body?,html?} } }
// Devuelve subject, text y (si el dueño lo editó) html — el HTML profesional.
// `sigs` opcional: lista de firmas guardadas, para resolver {firma}.
export function emailTplWith(overrides: any, id: string, lang: string | undefined, vars: Record<string, string | number> = {}, sigs?: { id: string; html: string }[]): { subject: string; text: string; html: string } {
  const e = TEMPLATES[id];
  if (!e) return { subject: '', text: '', html: '' };
  const l = lang === 'en' ? 'en' : 'es';
  const base = (e as any)[l] as Tpl;
  const o = overrides?.[id]?.[l] || {};
  const sigId = overrides?.[id]?.sig || '';
  const sigHtml = sigId && Array.isArray(sigs) ? (sigs.find((x) => x.id === sigId)?.html || '') : '';
  const subject = fill(o.subject || base.subject, vars);
  let text = fill(o.body || base.body, vars);
  let html = o.html ? fill(o.html, vars) : '';
  text = applySig(text, sigHtml, false);
  html = html ? applySig(html, sigHtml, true) : '';
  return { subject, text, html };
}

// Carga los overrides + firmas desde ajustes y renderiza (para rutas/cron).
export async function emailTplLive(id: string, lang: string | undefined, vars: Record<string, string | number> = {}): Promise<{ subject: string; text: string; html: string }> {
  let ov: any = {}; let sigs: any[] = [];
  try { const { getSetting } = await import('@/lib/settings'); ov = await getSetting('email_tpl_overrides', {} as any); sigs = await getSetting('email_signatures', [] as any); } catch {}
  return emailTplWith(ov, id, lang, vars, Array.isArray(sigs) ? sigs : []);
}

// Idioma del perfil del usuario ('es' por defecto). Para que cada correo salga
// en el idioma que el usuario eligió, sin importar quién lo dispare.
export async function userLang(userId?: string | null): Promise<'es' | 'en'> {
  if (!userId) return 'es';
  try {
    const { supabaseAdmin } = await import('@/lib/supabaseAdmin');
    const { data } = await supabaseAdmin.from('profiles').select('lang').eq('id', userId).maybeSingle();
    return (data as any)?.lang === 'en' ? 'en' : 'es';
  } catch { return 'es'; }
}

// Igual que userLang pero buscando por correo (cuando no tenemos el id a mano).
export async function userLangByEmail(email?: string | null): Promise<'es' | 'en'> {
  if (!email) return 'es';
  try {
    const { supabaseAdmin } = await import('@/lib/supabaseAdmin');
    const { data } = await supabaseAdmin.from('profiles').select('lang').eq('email', email).maybeSingle();
    return (data as any)?.lang === 'en' ? 'en' : 'es';
  } catch { return 'es'; }
}
