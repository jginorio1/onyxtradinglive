import { NextResponse } from 'next/server';
import { getAdmin, requirePerm } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendEmail } from '@/lib/mail';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const has = (v?: string) => !!(v && v.trim());

async function tableCheck(table: string, column?: string): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin.from(table).select(column || 'id').limit(1);
    return !error;
  } catch { return false; }
}

async function tg(method: string): Promise<any> {
  const tok = process.env.TELEGRAM_BOT_TOKEN;
  if (!tok) return null;
  try { const r = await fetch(`https://api.telegram.org/bot${tok}/${method}`); return await r.json(); } catch { return null; }
}

// GET · foto de salud de todo el sistema
export async function GET() {
  try {
    const { isAdmin } = await getAdmin();
    if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
    const _p = await requirePerm('diag', 'view'); if (!_p.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });

    // --- Variables de entorno / claves ---
    const sk = process.env.STRIPE_SECRET_KEY || '';
    const stripeMode = sk.startsWith('sk_live') ? 'live' : sk.startsWith('sk_test') ? 'test' : 'missing';

    // --- Telegram ---
    const me = await tg('getMe');
    const wh = await tg('getWebhookInfo');

    // --- Base de datos + migraciones ---
    const dbOk = await tableCheck('profiles');
    const migrations = [
      { id: 'support_v1', label: 'Soporte · tickets', ok: await tableCheck('support_tickets') },
      { id: 'support_v2', label: 'Soporte · leads', ok: await tableCheck('support_tickets', 'is_lead') },
      { id: 'onboarding_v1', label: 'Perfil del trader', ok: await tableCheck('profiles', 'onboarded_at') },
      { id: 'diagnostics_v1', label: 'Registro de errores', ok: await tableCheck('app_errors') },
      { id: 'manager', label: 'Onyx Guardian (config)', ok: await tableCheck('manager_configs') },
      { id: 'telegram_v3', label: 'Telegram · informe semanal', ok: await tableCheck('profiles', 'tg_weekly') },
      { id: 'telegram_log', label: 'Telegram · registro de envíos', ok: await tableCheck('telegram_log') },
    ];

    // --- EA en línea ahora ---
    let eaLive = 0;
    try {
      const since = new Date(Date.now() - 120000).toISOString();
      const { count } = await supabaseAdmin.from('trading_accounts').select('id', { count: 'exact', head: true }).gte('last_sync_at', since);
      eaLive = count || 0;
    } catch {}

    // --- Noticias (feed externo) ---
    let newsOk = false;
    try {
      const r = await fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.json', { signal: (AbortSignal as any).timeout ? (AbortSignal as any).timeout(4000) : undefined });
      newsOk = r.ok;
    } catch {}

    // --- Últimos errores ---
    let errors: any[] = [];
    try {
      const { data } = await supabaseAdmin.from('app_errors').select('source,code,message,hint,created_at').order('created_at', { ascending: false }).limit(25);
      errors = data || [];
    } catch {}

    const services = [
      { key: 'ai', name: 'Onyx AI', ok: has(process.env.ANTHROPIC_API_KEY), warn: false, detail: has(process.env.ANTHROPIC_API_KEY) ? `Conectada · ${process.env.ONYX_AI_MODEL || 'claude-haiku-4-5'}` : 'Sin clave (modo buscador)' },
      { key: 'mail', name: 'Correo (Resend)', ok: has(process.env.RESEND_API_KEY), warn: false, detail: has(process.env.RESEND_API_KEY) ? 'Clave puesta · prueba el envío' : 'Sin clave: no envía correos' },
      { key: 'telegram', name: 'Telegram', ok: !!me?.ok, warn: !!(wh?.result?.last_error_message), detail: !me?.ok ? 'Sin token o token inválido' : wh?.result?.last_error_message ? `Último error: ${wh.result.last_error_message}` : (wh?.result?.url ? 'Webhook OK · sin errores' : 'Sin webhook') },
      { key: 'stripe', name: 'Stripe', ok: stripeMode !== 'missing', warn: stripeMode === 'test', detail: stripeMode === 'live' ? 'Modo LIVE' : stripeMode === 'test' ? 'Modo prueba' : 'Sin clave' },
      { key: 'db', name: 'Base de datos', ok: dbOk, warn: false, detail: dbOk ? 'Conectada' : 'No responde' },
      { key: 'cron', name: 'Cron', ok: has(process.env.CRON_SECRET), warn: false, detail: has(process.env.CRON_SECRET) ? '3 tareas · secreto puesto' : 'Falta CRON_SECRET' },
      { key: 'ea', name: 'EA / sync', ok: true, warn: eaLive === 0, detail: `${eaLive} en línea ahora` },
      { key: 'news', name: 'Noticias', ok: newsOk, warn: false, detail: newsOk ? 'Feed accesible' : 'Feed no responde' },
    ];

    return NextResponse.json({
      services,
      migrations,
      errors,
      env: {
        ANTHROPIC_API_KEY: has(process.env.ANTHROPIC_API_KEY),
        RESEND_API_KEY: has(process.env.RESEND_API_KEY),
        TELEGRAM_BOT_TOKEN: has(process.env.TELEGRAM_BOT_TOKEN),
        STRIPE_SECRET_KEY: has(process.env.STRIPE_SECRET_KEY),
        STRIPE_WEBHOOK_SECRET: has(process.env.STRIPE_WEBHOOK_SECRET),
        CRON_SECRET: has(process.env.CRON_SECRET),
        SUPABASE_SERVICE_ROLE_KEY: has(process.env.SUPABASE_SERVICE_ROLE_KEY),
      },
      telegram: { username: me?.result?.username || null, webhook: wh?.result?.url || null, lastError: wh?.result?.last_error_message || null },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}

// POST · pruebas en vivo (un clic)
export async function POST(req: Request) {
  try {
    const { user, isAdmin } = await getAdmin();
    if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
    const _p = await requirePerm('diag', 'view'); if (!_p.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
    const { action } = await req.json().catch(() => ({}));

    if (action === 'test_ai') {
      const key = process.env.ANTHROPIC_API_KEY;
      if (!key) return NextResponse.json({ ok: false, mode: 'search', message: 'Sin ANTHROPIC_API_KEY: la IA funciona en modo buscador.' });
      const t0 = Date.now();
      const model = process.env.ONYX_AI_MODEL || 'claude-haiku-4-5';
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: 30, messages: [{ role: 'user', content: 'Responde solo con: OK' }] }),
      });
      const ms = Date.now() - t0;
      if (!r.ok) { const txt = await r.text().catch(() => ''); return NextResponse.json({ ok: false, message: `Anthropic respondió ${r.status}. ${txt.slice(0, 160)}` }); }
      return NextResponse.json({ ok: true, message: `Onyx AI respondió en ${(ms / 1000).toFixed(1)} s · modelo ${model}` });
    }

    if (action === 'test_email') {
      const to = user?.email;
      if (!to) return NextResponse.json({ ok: false, message: 'No tengo tu correo.' });
      if (!process.env.RESEND_API_KEY) return NextResponse.json({ ok: false, message: 'Sin RESEND_API_KEY: no se envían correos todavía.' });
      const ok = await sendEmail(to, 'Prueba de correo · Onyx', 'Si ves este correo, el envío con Resend funciona. — Onyx Trading Live');
      return NextResponse.json({ ok, message: ok ? `Correo de prueba enviado a ${to}. Revisa tu bandeja (y spam).` : 'Resend rechazó el envío. ¿Está verificado el dominio?' });
    }

    if (action === 'test_telegram') {
      const me = await tg('getMe');
      const wh = await tg('getWebhookInfo');
      if (!me?.ok) return NextResponse.json({ ok: false, message: 'Token de Telegram ausente o inválido.' });
      return NextResponse.json({ ok: true, message: `Bot @${me.result?.username} OK. Webhook: ${wh?.result?.url || 'no configurado'}${wh?.result?.last_error_message ? ' · error: ' + wh.result.last_error_message : ''}` });
    }

    return NextResponse.json({ error: 'acción desconocida' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
