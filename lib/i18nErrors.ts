// Mensajes de error traducidos. El servidor devuelve un `code`; aquí lo mostramos
// en el idioma del usuario. Si no conocemos el código, usamos el texto del servidor.
export type Lang = 'es' | 'en';

const MSG: Record<Lang, Record<string, string>> = {
  es: {
    no_auth: 'Debes iniciar sesión para continuar.',
    no_sub: 'Todavía no tienes una suscripción activa.',
    free_no_addon: 'Las cuentas extra son de los planes de pago. Mejora a un plan de pago para añadirlas.',
    no_price: 'Este plan aún no tiene precio configurado. Escríbenos y lo arreglamos.',
    stripe: 'No pudimos conectar con el pago. Inténtalo de nuevo en un momento.',
    pw_short: 'La contraseña debe tener al menos 8 caracteres.',
    confirm_required: 'Escribe ELIMINAR para confirmar.',
    limit: 'Has llegado al límite de cuentas de tu plan. Revoca una clave o mejora tu plan.',
    dup_account: 'Ya tienes una clave activa para esa cuenta.',
    need_label: 'Ponle un apodo a la cuenta.',
    need_broker: 'Indica la prop firm o el broker.',
    need_size: 'Indica el tamano de la cuenta.',
    need_amount: 'El importe tiene que ser mayor que cero.',
    need_date: 'Elige una fecha válida.',
    need_details: 'Escribe tus datos de cobro (PayPal o USDT).',
    need_audience: 'Cuéntanos dónde está tu comunidad.',
    need_email: 'Escribe tu correo.',
    bad_email: 'Ese correo no parece válido.',
    bad_number: 'Ese número no es válido.',
    not_found: 'No encontramos ese registro.',
    file_missing: 'Falta el archivo.',
    file_big: 'El archivo supera los 8 MB.',
    file_type: 'Solo se admiten imágenes o PDF.',
    missing_data: 'Faltan datos.',
    network: 'Error de conexión. Revisa tu internet e inténtalo otra vez.',
    generic: 'Algo salió mal. Inténtalo de nuevo.',
    no_plan: 'Tu plan no incluye copy trading.',
    same: 'Ya estás en ese plan.',
    slave_taken: 'Esa esclava ya recibe de una master. Una esclava solo puede tener una master.',
    role_conflict: 'Una cuenta no puede ser Master y Esclava a la vez.',
    master_limit: 'Llegaste al máximo de cuentas Master. Añade una Master extra como add-on.',
    below_used: 'Borra enlaces primero para poder bajar esa cantidad.',
    addon_below_used: 'Revoca claves primero para poder bajar esa cantidad.',
    addon_off: 'Ese complemento está desactivado.',
    need_accounts: 'Conecta al menos 2 cuentas (Master y Esclava) para esto.',
    bad_pin: 'PIN incorrecto.',
    bad_current: 'El PIN actual es incorrecto.',
    not_linked: 'Primero conecta tu Telegram desde Avisos.',
    invalid: 'Datos no válidos. Revísalos e inténtalo de nuevo.',
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
    need_label: 'Give the account a nickname.',
    need_broker: 'Enter the prop firm or broker.',
    need_size: 'Enter the account size.',
    need_amount: 'Amount must be greater than zero.',
    need_date: 'Pick a valid date.',
    need_details: 'Enter your payout details (PayPal or USDT).',
    need_audience: 'Tell us where your community lives.',
    need_email: 'Enter your email.',
    bad_email: 'That email does not look valid.',
    bad_number: 'That number is not valid.',
    not_found: 'We could not find that record.',
    file_missing: 'File is missing.',
    file_big: 'File is larger than 8 MB.',
    file_type: 'Only images or PDF are allowed.',
    missing_data: 'Missing data.',
    network: 'Connection error. Check your internet and try again.',
    generic: 'Something went wrong. Please try again.',
    no_plan: 'Your plan does not include copy trading.',
    same: 'You are already on that plan.',
    slave_taken: 'That slave already follows a master. A slave can only have one master.',
    role_conflict: 'An account cannot be Master and Slave at the same time.',
    master_limit: 'You reached your max Master accounts. Add an extra Master as an add-on.',
    below_used: 'Remove some links first to lower that amount.',
    addon_below_used: 'Revoke some keys first to lower that amount.',
    addon_off: 'That add-on is disabled.',
    need_accounts: 'Connect at least 2 accounts (Master and Slave) for this.',
    bad_pin: 'Wrong PIN.',
    bad_current: 'Your current PIN is wrong.',
    not_linked: 'Connect your Telegram first from Notifications.',
    invalid: 'Invalid data. Check it and try again.',
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
