import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Traduce un error técnico a una explicación en claro (qué hacer).
function hintFor(source: string, code: string, message: string): string {
  const m = (message || '').toLowerCase();
  const c = String(code || '');
  if (c === '404' || m.includes('404')) return 'El EA pega a una URL que no existe. Suele ser ServidorUrl con la ruta duplicada. Deja solo el dominio base.';
  if (c === '308' || m.includes('308') || m.includes('permanent redirect')) return 'Redirección del dominio. Usa https://www.onyxtradinglive.com (con www).';
  if (c === '401' || m.includes('unauthorized') || m.includes('api key')) return 'Clave/API no autorizada. Revisa la variable de entorno correspondiente en Vercel.';
  if (source === 'support_ai' || m.includes('anthropic')) return 'Fallo llamando a la IA. Revisa ANTHROPIC_API_KEY y que haya saldo en Anthropic.';
  if (source === 'mail' || m.includes('resend')) return 'Fallo enviando correo. Verifica el dominio en Resend y la RESEND_API_KEY.';
  if (source === 'telegram') return 'Fallo con Telegram. Revisa el token y el webhook (Diagnóstico → Probar Telegram).';
  if (m.includes('timeout') || m.includes('etimedout')) return 'La conexión tardó demasiado. Reintenta; si persiste, revisa el servicio externo.';
  if (m.includes('does not exist') || m.includes('column') || m.includes('relation')) return 'Falta una tabla o columna: probablemente no corriste algún SQL. Mira Diagnóstico → Base de datos.';
  return '';
}

// Registra un error del servidor. NUNCA lanza (si el logger falla, se ignora).
export async function logError(source: string, err: any, meta: any = {}) {
  try {
    const message = String(err?.message || err || 'error').slice(0, 1000);
    const code = meta?.code ? String(meta.code).slice(0, 40) : null;
    const hint = hintFor(source, code || '', message) || null;
    await supabaseAdmin.from('app_errors').insert({ source, code, message, hint, meta });
  } catch { /* nunca romper por el logger */ }
}
