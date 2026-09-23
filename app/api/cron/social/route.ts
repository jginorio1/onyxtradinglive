import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/mail';
import { sendMessage } from '@/lib/telegram';
import { socialReminderSettings } from '@/lib/settings';
import { dueSocial, markSocialSent, NETWORK_LABEL } from '@/lib/social';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Recordatorio de redes: cada 15 min busca publicaciones programadas ya vencidas
// y te manda el copy LISTO para pegar (Telegram y/o email), luego las marca enviadas.
// Protegido con CRON_SECRET.
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.get('authorization') || '';
  const q = new URL(req.url).searchParams.get('key') || '';
  return auth === `Bearer ${secret}` || q === secret;
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });

  const due = await dueSocial();
  if (!due.length) return NextResponse.json({ ok: true, sent: 0 });

  const rem = await socialReminderSettings();
  let telegramOk = 0, emailOk = 0;

  for (const p of due) {
    const net = NETWORK_LABEL[p.network] || p.network;
    const langLbl = p.lang === 'en' ? 'EN' : 'ES';
    const header = `📣 Toca publicar en ${net} (${langLbl})`;
    const bodyText = `${p.copy}${p.url ? `\n\n${p.url}` : ''}`;

    if (rem.viaTelegram && rem.telegramChatId) {
      try { await sendMessage(rem.telegramChatId, `${header}\n\n${bodyText}`, { kind: 'social', plain: true }); telegramOk++; } catch {}
    }
    if (rem.viaEmail && rem.email) {
      try {
        const ok = await sendEmail(rem.email, `${header}`,
          `Programaste una publicación para ${net} (${langLbl}). Cópiala y pégala:\n\n${bodyText}\n\n— Onyx Trading Live`);
        if (ok) emailOk++;
      } catch {}
    }
    await markSocialSent(p.id);
  }

  return NextResponse.json({ ok: true, sent: due.length, telegramOk, emailOk });
}
