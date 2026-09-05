import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendEmail } from '@/lib/mail';
import { sendMessage } from '@/lib/telegram';
import { coreSecurityItems, summarize } from '@/lib/securityAudit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Vigilante diario de seguridad: corre en segundo plano (aunque nadie abra el
// panel) y AVISA por correo + Telegram si alguna protección se cayó.
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.get('authorization') || '';
  const q = new URL(req.url).searchParams.get('key') || '';
  return auth === `Bearer ${secret}` || q === secret;
}

async function alertAdmins(subject: string, body: string) {
  // Correo a los admins de ADMIN_EMAILS
  const emails = (process.env.ADMIN_EMAILS || '').split(',').map((s) => s.trim()).filter(Boolean);
  for (const e of emails) { try { await sendEmail(e, subject, body); } catch {} }
  // Telegram a los admins que lo tengan vinculado
  try {
    const { data: admins } = await supabaseAdmin.from('profiles').select('telegram_chat_id').eq('is_admin', true).not('telegram_chat_id', 'is', null);
    for (const a of (admins || [])) {
      const cid = (a as any).telegram_chat_id;
      if (cid) { try { await sendMessage(cid, `🔒 ${subject}\n\n${body}`, { kind: 'security' }); } catch {} }
    }
  } catch {}
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });

  const items = await coreSecurityItems();
  const s = summarize(items);

  if (s.fails > 0) {
    const broken = items.filter((i) => i.status === 'fail');
    const lines = broken.map((i) => `• ${i.es}${i.hintEs ? ' — ' + i.hintEs : ''}`).join('\n');
    await alertAdmins(
      `Onyx · ${s.fails} protección(es) de seguridad caída(s)`,
      `La auditoría automática detectó problemas de seguridad en Onyx Trading Live:\n\n${lines}\n\nRevisa Admin → Audit para el detalle.`
    );
  }

  return NextResponse.json({ ok: true, ...s });
}
