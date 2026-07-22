// Mensajes de error traducidos. El servidor devuelve un `code`; aquí lo mostramos
// en el idioma del usuario. Si no conocemos el código, usamos el texto del servidor.
export type Lang = 'es' | 'en';

const MSG: Record<Lang, Record<string, string>> = {
  es: {
    no_auth: 'Debes iniciar sesión para continuar.',
    no_sub: 'Todavía no tienes una suscripción activa.',
    no_price: 'Este plan aún no tiene precio configurado. Escríbenos y lo arreglamos.',
    stripe: 'No pudimos conectar con el pago. Inténtalo de nuevo en un momento.',
    pw_short: 'La contraseña debe tener al menos 8 caracteres.',
    confirm_required: 'Escribe ELIMINAR para confirmar.',
    limit: 'Has llegado al límite de cuentas de tu plan. Revoca una clave o mejora tu plan.',
    dup_account: 'Ya tienes una clave activa para esa cuenta.',
    file_missing: 'Falta el archivo.',
    file_big: 'El archivo supera los 8 MB.',
    missing_data: 'Faltan datos.',
    network: 'Error de conexión. Revisa tu internet e inténtalo otra vez.',
    generic: 'Algo salió mal. Inténtalo de nuevo.',
  },
  en: {
    no_auth: 'You need to sign in to continue.',
    no_sub: 'You do not have an active subscription yet.',
    no_price: 'This plan has no price configured yet. Contact us and we will fix it.',
    stripe: 'We could not reach the payment provider. Please try again in a moment.',
    pw_short: 'Password must be at least 8 characters.',
    confirm_required: 'Type ELIMINAR to confirm.',
    limit: 'You reached your plan account limit. Revoke a key or upgrade your plan.',
    dup_account: 'You already have an active key for that account.',
    file_missing: 'File is missing.',
    file_big: 'File is larger than 8 MB.',
    missing_data: 'Missing data.',
    network: 'Connection error. Check your internet and try again.',
    generic: 'Something went wrong. Please try again.',
  },
};

// Traduce la respuesta de una API. `j` es el JSON devuelto por el servidor.
export function errMsg(j: any, lang: Lang = 'es'): string {
  const dict = MSG[lang] || MSG.es;
  if (j?.code && dict[j.code]) return dict[j.code];
  return j?.error || dict.generic;
}

// Texto suelto por clave (para errores del propio navegador)
export function tErr(key: string, lang: Lang = 'es'): string {
  const dict = MSG[lang] || MSG.es;
  return dict[key] || dict.generic;
}

// Nombre del plan en el idioma del usuario (la BD guarda name y name_en)
export function planName(p: any, lang: Lang = 'es'): string {
  if (!p) return '';
  return (lang === 'en' ? (p.name_en || p.name) : (p.name || p.name_en)) || '';
}
