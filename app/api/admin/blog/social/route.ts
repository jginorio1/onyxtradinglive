import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { scheduleSocial, listSocial, cancelSocial } from '@/lib/social';
import { socialReminderSettings, saveSetting, type SocialReminder } from '@/lib/settings';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET  ?post=<id>  → programaciones (todas o de un post) + ajustes de recordatorio.
export async function GET(req: Request) {
  const { ok } = await requirePerm('modulos', 'view');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const post = new URL(req.url).searchParams.get('post') || undefined;
  const [items, reminder] = await Promise.all([listSocial(post), socialReminderSettings()]);
  return NextResponse.json({ items, reminder });
}

// POST · programar (array de redes) o guardar ajustes de recordatorio.
export async function POST(req: Request) {
  const { ok } = await requirePerm('modulos', 'manage');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const b = await req.json().catch(() => ({} as any));

  if (b.reminder) {
    const prev = await socialReminderSettings();
    const r = b.reminder;
    const value: SocialReminder = {
      viaTelegram: r.viaTelegram == null ? prev.viaTelegram : !!r.viaTelegram,
      telegramChatId: String(r.telegramChatId ?? prev.telegramChatId).slice(0, 40),
      viaEmail: r.viaEmail == null ? prev.viaEmail : !!r.viaEmail,
      email: String(r.email ?? prev.email).slice(0, 160),
    };
    await saveSetting('social_reminder', value);
    return NextResponse.json({ ok: true, reminder: value });
  }

  const rows = Array.isArray(b.rows) ? b.rows : [];
  try {
    const res = await scheduleSocial(rows);
    return NextResponse.json({ ok: true, ...res });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}

// DELETE · cancelar una programación.
export async function DELETE(req: Request) {
  const { ok } = await requirePerm('modulos', 'manage');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const b = await req.json().catch(() => ({} as any));
  if (b.id) await cancelSocial(String(b.id));
  return NextResponse.json({ ok: true });
}
