import { createClient } from '@supabase/supabase-js';

// ============================================================
// Comprobaciones de seguridad reutilizables:
//   - las usa el tab Audit (en vivo, + el 2FA del admin actual)
//   - las usa el cron diario (en segundo plano, avisa si algo falla)
// ============================================================
export type SecItem = { key: string; es: string; en: string; status: 'ok' | 'warn' | 'fail'; hintEs?: string; hintEn?: string };

const has = (v?: string) => !!(v && v.trim());

// Chequeos que NO necesitan sesión (claves, cabeceras, RLS en vivo).
export async function coreSecurityItems(): Promise<SecItem[]> {
  const items: SecItem[] = [];
  const add = (key: string, es: string, en: string, ok: boolean, warn = false, hintEs?: string, hintEn?: string) =>
    items.push({ key, es, en, status: ok ? 'ok' : warn ? 'warn' : 'fail', hintEs, hintEn });

  add('stripe', 'Webhook de Stripe firmado', 'Stripe webhook signed', has(process.env.STRIPE_WEBHOOK_SECRET), false, 'Falta STRIPE_WEBHOOK_SECRET', 'Missing STRIPE_WEBHOOK_SECRET');
  add('cron', 'Cron protegidos', 'Cron protected', has(process.env.CRON_SECRET), false, 'Falta CRON_SECRET', 'Missing CRON_SECRET');
  add('telegram', 'Webhook de Telegram protegido', 'Telegram webhook protected', has(process.env.TELEGRAM_WEBHOOK_SECRET), true, 'Falta TELEGRAM_WEBHOOK_SECRET', 'Missing TELEGRAM_WEBHOOK_SECRET');
  add('captcha', 'CAPTCHA (Turnstile) activo', 'CAPTCHA (Turnstile) on', has(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY), true, 'Falta la Site Key de Turnstile', 'Missing Turnstile site key');
  add('push', 'Notificaciones push configuradas', 'Push notifications configured', has(process.env.VAPID_PRIVATE_KEY) && has(process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY), true, 'Opcional: faltan claves VAPID', 'Optional: VAPID keys missing');
  add('headers', 'Cabeceras de seguridad', 'Security headers', true);

  // RLS en vivo: con la clave PÚBLICA intentamos leer una tabla sensible.
  try {
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const { data, error } = await anon.from('profiles').select('id').limit(1);
    const exposed = !error && Array.isArray(data) && data.length > 0;
    add('rls', 'RLS de la base de datos', 'Database RLS', !exposed, false, 'Corre supabase/rls_lockdown.sql', 'Run supabase/rls_lockdown.sql');
  } catch { add('rls', 'RLS de la base de datos', 'Database RLS', true); }

  return items;
}

export function summarize(items: SecItem[]) {
  const fails = items.filter((i) => i.status === 'fail').length;
  const warns = items.filter((i) => i.status === 'warn').length;
  return { overall: (fails ? 'fail' : warns ? 'warn' : 'ok') as 'ok' | 'warn' | 'fail', fails, warns };
}
