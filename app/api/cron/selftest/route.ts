import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendEmail } from '@/lib/mail';
import { sendMessage } from '@/lib/telegram';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ============================================================
// Auto-test diario: ejecuta en segundo plano las mismas pruebas que hay en
// Diagnóstico (BD, IA, Telegram, correo, Stripe, freshness de backup) y SOLO
// avisa (correo + Telegram) si algo está roto. Si todo va bien, no molesta.
// Protegido con CRON_SECRET.
// ============================================================
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.get('authorization') || '';
  const q = new URL(req.url).searchParams.get('key') || '';
  return auth === `Bearer ${secret}` || q === secret;
}
const has = (v?: string) => !!(v && v.trim());

async function alertAdmins(subject: string, body: string) {
  const emails = (process.env.ADMIN_EMAILS || '').split(',').map((s) => s.trim()).filter(Boolean);
  for (const e of emails) { try { await sendEmail(e, subject, body, { kind: 'admin' }); } catch {} }
  try {
    const { data: admins } = await supabaseAdmin.from('profiles').select('telegram_chat_id').eq('is_admin', true).not('telegram_chat_id', 'is', null);
    for (const a of (admins || [])) {
      const cid = (a as any).telegram_chat_id;
      if (cid) { try { await sendMessage(cid, `🩺 ${subject}\n\n${body}`, { kind: 'selftest' }); } catch {} }
    }
  } catch {}
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });

  const fails: string[] = [];

  // 1) Base de datos
  try {
    const { error } = await supabaseAdmin.from('profiles').select('id').limit(1);
    if (error) fails.push('Base de datos: no responde — ' + (error.message || '').slice(0, 120));
  } catch (e: any) { fails.push('Base de datos: excepción — ' + (e?.message || '').slice(0, 120)); }

  // 2) Onyx AI (solo si hay clave: si está configurada, debe responder)
  if (has(process.env.ANTHROPIC_API_KEY)) {
    try {
      const model = process.env.ONYX_AI_MODEL || 'claude-haiku-4-5';
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: 10, messages: [{ role: 'user', content: 'OK' }] }),
      });
      if (!r.ok) fails.push(`Onyx AI: Anthropic respondió ${r.status}.`);
    } catch { fails.push('Onyx AI: no se pudo conectar con Anthropic.'); }
  }

  // 3) Telegram (solo si hay token)
  if (has(process.env.TELEGRAM_BOT_TOKEN)) {
    try {
      const r = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getMe`);
      const j = await r.json();
      if (!j?.ok) fails.push('Telegram: token inválido o bot caído.');
    } catch { fails.push('Telegram: no responde.'); }
  }

  // 4) Config crítica presente
  if (!has(process.env.RESEND_API_KEY)) fails.push('Correo: falta RESEND_API_KEY (no se envían correos).');
  if (!has(process.env.STRIPE_SECRET_KEY)) fails.push('Stripe: falta STRIPE_SECRET_KEY (no cobra).');

  // 5) Backup fresco (menos de 3 días)
  try {
    const { data: bk } = await supabaseAdmin.from('app_settings').select('value').eq('key', 'backup').maybeSingle();
    const lastAt = (bk as any)?.value?.last_at;
    if (!lastAt) fails.push('Backups: sin copias registradas.');
    else if ((Date.now() - new Date(lastAt).getTime()) / 86400000 > 3) fails.push('Backups: la última copia tiene más de 3 días.');
  } catch {}

  if (fails.length) {
    await alertAdmins(
      `Onyx · ${fails.length} problema(s) en el auto-test`,
      `El chequeo automático detectó:\n\n${fails.map((f) => '• ' + f).join('\n')}\n\nRevisa Admin → Diagnóstico.`,
    );
  }
  return NextResponse.json({ ok: fails.length === 0, fails });
}
