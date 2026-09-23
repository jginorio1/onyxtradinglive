// Biblioteca central de plantillas de correo transaccional (ES/EN).
// Cada plantilla tiene un id, versión por idioma y variables {var}.
// Todos los envíos deberían pasar por aquí: así el copy vive en un solo lugar,
// es bilingüe, y mañana se puede exponer un editor sin tocar el resto del código.

type Tpl = { subject: string; body: string };
type Entry = { es: Tpl; en: Tpl };

const TEMPLATES: Record<string, Entry> = {
  // Becas ---------------------------------------------------------------
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
  // Prueba de pago (cortesía) por vencer -------------------------------
  comp_reminder: {
    es: { subject: 'Tu prueba del plan {plan} vence en {dias} día(s)', body: 'Hola,\n\nTu prueba del plan **{plan}** en Onyx Trading Live vence en **{dias} día(s)**. Cuando termine, tu cuenta volverá al plan gratis.\n\nSi quieres seguir sin interrupción, elige tu plan y suscríbete aquí:\n{enlace}\n\nGracias por probar Onyx.' },
    en: { subject: 'Your {plan} trial ends in {dias} day(s)', body: 'Hi,\n\nYour **{plan}** trial at Onyx Trading Live ends in **{dias} day(s)**. When it ends, your account will go back to the free plan.\n\nTo keep going without interruption, pick your plan and subscribe here:\n{enlace}\n\nThanks for trying Onyx.' },
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

// Metadatos para el editor del dueño: id + variables disponibles por plantilla.
export const TEMPLATE_META: { id: string; label: string; vars: string[] }[] = [
  { id: 'sch_apply_mentor', label: 'Beca · nueva solicitud (al mentor)', vars: ['academia', 'enlace'] },
  { id: 'sch_approved', label: 'Beca · aprobada (al alumno)', vars: ['academia', 'enlace'] },
  { id: 'sch_denied', label: 'Beca · rechazada (al alumno)', vars: ['academia', 'enlace'] },
  { id: 'sch_reminder', label: 'Beca · vence pronto (al alumno)', vars: ['academia', 'enlace', 'dias'] },
  { id: 'sch_expired', label: 'Beca · finalizó (al alumno)', vars: ['academia', 'enlace'] },
  { id: 'comp_reminder', label: 'Prueba de pago · vence pronto (al usuario)', vars: ['plan', 'dias', 'enlace'] },
];

export function defaultTemplates(): Record<string, Entry> { return TEMPLATES; }

// Igual que emailTpl pero aplica los overrides que el dueño guardó en Admin.
// overrides: { [id]: { es?:{subject?,body?}, en?:{subject?,body?} } }
export function emailTplWith(overrides: any, id: string, lang: string | undefined, vars: Record<string, string | number> = {}): { subject: string; text: string } {
  const e = TEMPLATES[id];
  if (!e) return { subject: '', text: '' };
  const l = lang === 'en' ? 'en' : 'es';
  const base = (e as any)[l] as Tpl;
  const o = overrides?.[id]?.[l] || {};
  return { subject: fill(o.subject || base.subject, vars), text: fill(o.body || base.body, vars) };
}

// Carga los overrides desde ajustes y renderiza (para usar en las rutas/cron).
export async function emailTplLive(id: string, lang: string | undefined, vars: Record<string, string | number> = {}): Promise<{ subject: string; text: string }> {
  let ov: any = {};
  try { const { getSetting } = await import('@/lib/settings'); ov = await getSetting('email_tpl_overrides', {} as any); } catch {}
  return emailTplWith(ov, id, lang, vars);
}
