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
      { id: 'support_v1', label: 'Soporte · tickets', label_en: 'Support · tickets', ok: await tableCheck('support_tickets') },
      { id: 'support_v2', label: 'Soporte · leads', label_en: 'Support · leads', ok: await tableCheck('support_tickets', 'is_lead') },
      { id: 'onboarding_v1', label: 'Perfil del trader', label_en: 'Trader profile', ok: await tableCheck('profiles', 'onboarded_at') },
      { id: 'diagnostics_v1', label: 'Registro de errores', label_en: 'Error log', ok: await tableCheck('app_errors') },
      { id: 'manager', label: 'Onyx Guardian (config)', label_en: 'Onyx Guardian (config)', ok: await tableCheck('manager_configs') },
      { id: 'telegram_v3', label: 'Telegram · informe semanal', label_en: 'Telegram · weekly report', ok: await tableCheck('profiles', 'tg_weekly') },
      { id: 'telegram_log', label: 'Telegram · registro de envíos', label_en: 'Telegram · send log', ok: await tableCheck('telegram_log') },
      { id: 'campaigns_v1', label: 'Campañas · tablas', label_en: 'Campaigns · tables', ok: await tableCheck('campaigns') },
      { id: 'campaigns_tracking', label: 'Campañas · tracking (aperturas/clics)', label_en: 'Campaigns · tracking (opens/clicks)', ok: await tableCheck('campaign_sends', 'opened_at') },
      { id: 'bots_v1', label: 'Bots · tabla', label_en: 'Bots · table', ok: await tableCheck('bots') },
    ];

    // --- Freshness del último backup (para avisar si se quedó viejo) ---
    let backupOk = false, backupWarn = false, backupDetail = 'Sin copias registradas', backupDetailEn = 'No backups recorded';
    try {
      const { data: bk } = await supabaseAdmin.from('app_settings').select('value').eq('key', 'backup').maybeSingle();
      const lastAt = (bk as any)?.value?.last_at;
      if (lastAt) {
        const ageDays = (Date.now() - new Date(lastAt).getTime()) / 86400000;
        backupWarn = ageDays > 2;                 // más de 2 días sin copia → aviso
        backupOk = !backupWarn;
        const ago = ageDays < 1 ? Math.round(ageDays * 24) + ' h' : Math.round(ageDays) + ' d';
        backupDetail = `Última: hace ${ago}`;
        backupDetailEn = `Last: ${ago} ago`;
      }
    } catch {}

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

    const aiModel = process.env.ONYX_AI_MODEL || 'claude-haiku-4-5';
    const tgErr = wh?.result?.last_error_message;
    const services = [
      { key: 'ai', name: 'Onyx AI', name_en: 'Onyx AI', ok: has(process.env.ANTHROPIC_API_KEY), warn: false,
        detail: has(process.env.ANTHROPIC_API_KEY) ? `Conectada · ${aiModel}` : 'Sin clave (modo buscador)',
        detail_en: has(process.env.ANTHROPIC_API_KEY) ? `Connected · ${aiModel}` : 'No key (search mode)' },
      { key: 'mail', name: 'Correo (Resend)', name_en: 'Email (Resend)', ok: has(process.env.RESEND_API_KEY), warn: false,
        detail: has(process.env.RESEND_API_KEY) ? 'Clave puesta · prueba el envío' : 'Sin clave: no envía correos',
        detail_en: has(process.env.RESEND_API_KEY) ? 'Key set · test sending' : 'No key: emails are not sent' },
      { key: 'telegram', name: 'Telegram', name_en: 'Telegram', ok: !!me?.ok, warn: !!tgErr,
        detail: !me?.ok ? 'Sin token o token inválido' : tgErr ? `Último error: ${tgErr}` : (wh?.result?.url ? 'Webhook OK · sin errores' : 'Sin webhook'),
        detail_en: !me?.ok ? 'Missing or invalid token' : tgErr ? `Last error: ${tgErr}` : (wh?.result?.url ? 'Webhook OK · no errors' : 'No webhook') },
      { key: 'stripe', name: 'Stripe', name_en: 'Stripe', ok: stripeMode !== 'missing', warn: stripeMode === 'test',
        detail: stripeMode === 'live' ? 'Modo LIVE' : stripeMode === 'test' ? 'Modo prueba' : 'Sin clave',
        detail_en: stripeMode === 'live' ? 'LIVE mode' : stripeMode === 'test' ? 'Test mode' : 'No key' },
      { key: 'db', name: 'Base de datos', name_en: 'Database', ok: dbOk, warn: false,
        detail: dbOk ? 'Conectada' : 'No responde', detail_en: dbOk ? 'Connected' : 'Not responding' },
      { key: 'cron', name: 'Cron', name_en: 'Cron', ok: has(process.env.CRON_SECRET), warn: false,
        detail: has(process.env.CRON_SECRET) ? 'Tareas programadas · secreto puesto' : 'Falta CRON_SECRET',
        detail_en: has(process.env.CRON_SECRET) ? 'Scheduled tasks · secret set' : 'Missing CRON_SECRET' },
      { key: 'ea', name: 'EA / sync', name_en: 'EA / sync', ok: true, warn: eaLive === 0,
        detail: `${eaLive} en línea ahora`, detail_en: `${eaLive} online now` },
      { key: 'news', name: 'Noticias', name_en: 'News', ok: newsOk, warn: false,
        detail: newsOk ? 'Feed accesible' : 'Feed no responde', detail_en: newsOk ? 'Feed reachable' : 'Feed not responding' },
      { key: 'resend_webhook', name: 'Webhook de correos', name_en: 'Email webhook', ok: has(process.env.RESEND_WEBHOOK_SECRET), warn: false,
        detail: has(process.env.RESEND_WEBHOOK_SECRET) ? 'Secreto puesto · aperturas/clics' : 'Sin RESEND_WEBHOOK_SECRET: no llegan aperturas/clics',
        detail_en: has(process.env.RESEND_WEBHOOK_SECRET) ? 'Secret set · opens/clicks' : "No RESEND_WEBHOOK_SECRET: opens/clicks won't arrive" },
      { key: 'backup', name: 'Backups', name_en: 'Backups', ok: backupOk, warn: backupWarn, detail: backupDetail, detail_en: backupDetailEn },
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
        RESEND_WEBHOOK_SECRET: has(process.env.RESEND_WEBHOOK_SECRET),
        CRON_SECRET: has(process.env.CRON_SECRET),
        BACKUP_SECRET: has(process.env.BACKUP_SECRET),
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
