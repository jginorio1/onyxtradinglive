import { NextResponse } from 'next/server';
import { getAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ============================================================
// SECCIÓN TEMPORAL — respaldo de variables/claves. SOLO EL DUEÑO.
//
// Seguridad en capas:
//   1) Solo el rol 'owner' puede acceder (403 para el resto).
//   2) El listado de estado va SIEMPRE enmascarado (solo se ve si está puesta
//      y una pista de 4 caracteres). Nunca el valor completo.
//   3) La DESCARGA con valores completos (?mode=export) solo funciona si en
//      Vercel existe la variable ENABLE_SECRETS_EXPORT=1. Apagado por defecto.
//
// Para borrar esta función después: elimina este archivo y app/admin/secrets/,
// y quita la variable ENABLE_SECRETS_EXPORT de Vercel.
// ============================================================

// Variables que usa la app (para el listado de estado y el backup).
const KEYS = [
  'CRON_SECRET', 'ADMIN_EMAILS', 'APP_URL',
  'NEXT_PUBLIC_APP_URL', 'NEXT_PUBLIC_PROD_URL', 'NEXT_PUBLIC_BETA_URL', 'NEXT_PUBLIC_APP_ENV',
  'ANTHROPIC_API_KEY', 'ONYX_AI_MODEL',
  'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'STRIPE_DESCRIPTOR_BOTLAB', 'STRIPE_TOS_ON',
  'RESEND_API_KEY', 'RESEND_WEBHOOK_SECRET', 'SUPPORT_EMAIL', 'SUPPORT_FROM_EMAIL', 'EMAIL_LOGO_URL',
  'TELEGRAM_BOT_TOKEN', 'TELEGRAM_BOT_USERNAME', 'TELEGRAM_WEBHOOK_SECRET',
  'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'VAPID_SUBJECT',
  'COINBASE_COMMERCE_API_KEY', 'COINBASE_COMMERCE_WEBHOOK_SECRET',
  'ETHERSCAN_API_KEY', 'TRONSCAN_API_KEY',
  'B2_KEY_ID', 'B2_APP_KEY', 'B2_BUCKET', 'BACKUP_SECRET',
  'GSC_CLIENT_EMAIL', 'GSC_PRIVATE_KEY', 'GSC_SITE_URL',
  'GOOGLE_SITE_VERIFICATION', 'BING_SITE_VERIFICATION', 'NEXT_PUBLIC_GA_ID',
  'NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'VISITOR_SALT', 'BETA_SWITCH_PIN',
  'ACADEMY_WEBHOOK_SECRET', 'BOTLAB_WEBHOOK_SECRET', 'DISPUTE_ALERT_EMAIL',
  'ONYX_ACADEMY_FEE_PCT', 'ONYX_COPY_FEE_PCT', 'TERMS_VERSION',
];

function mask(v?: string): string {
  if (!v) return '';
  const s = String(v);
  return s.length <= 4 ? '••••' : '••••' + s.slice(-4);
}

export async function GET(req: Request) {
  const a = await getAdmin();
  if (!a.user || a.role !== 'owner') return NextResponse.json({ error: 'solo el dueño' }, { status: 403 });

  const mode = new URL(req.url).searchParams.get('mode') || 'status';

  if (mode === 'export') {
    // Descarga con valores completos: solo si el interruptor está encendido en Vercel.
    if (process.env.ENABLE_SECRETS_EXPORT !== '1') {
      return NextResponse.json({ error: 'Descarga deshabilitada. Pon ENABLE_SECRETS_EXPORT=1 en Vercel y vuelve a desplegar.' }, { status: 403 });
    }
    const lines = KEYS.map((k) => { const v = process.env[k]; return v == null || v === '' ? null : `${k}=${v}`; }).filter(Boolean) as string[];
    const body = `# Onyx Trading Live — respaldo de variables\n# Generado: ${new Date().toISOString()}\n# GUÁRDALO EN UN LUGAR SEGURO (gestor de contraseñas). NUNCA lo subas a GitHub.\n\n${lines.join('\n')}\n`;
    return new NextResponse(body, {
      status: 200,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'content-disposition': 'attachment; filename="onyx-secrets-backup.env"',
        'cache-control': 'no-store',
      },
    });
  }

  // Estado (enmascarado) — seguro de ver.
  const items = KEYS.map((k) => { const v = process.env[k]; return { name: k, set: v != null && v !== '', hint: mask(v) }; });
  return NextResponse.json({ items, exportEnabled: process.env.ENABLE_SECRETS_EXPORT === '1' });
}
