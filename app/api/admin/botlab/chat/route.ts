import { NextResponse } from 'next/server';
import { getAdmin } from '@/lib/admin';
import { adminListThreads, listMessages, postAdminMessage, markRead, getThreadById } from '@/lib/botlabChat';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function canManage(role: string | null, perms: any) { return role === 'owner' || perms?.modulos === 'manage' || perms?.soporte === 'manage'; }

// GET · bandeja (?thread= para abrir una conversación; marca leído).
export async function GET(req: Request) {
  const { isAdmin } = await getAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const threadId = new URL(req.url).searchParams.get('thread');
  if (threadId) {
    const th = await getThreadById(threadId);
    const msgs = await listMessages(threadId);
    await markRead(threadId);
    // Al admin le mostramos el ESPAÑOL (body_es); guarda también el original.
    return NextResponse.json({ thread: th, messages: msgs.map((m: any) => ({ sender: m.sender, es: m.body_es || m.body_orig, orig: m.body_orig, lang: m.lang, at: m.created_at })) });
  }
  return NextResponse.json({ threads: await adminListThreads() });
}

// POST · el admin responde en español; se traduce al idioma del cliente.
export async function POST(req: Request) {
  const { isAdmin, role, perms } = await getAdmin();
  if (!isAdmin || !canManage(role, perms)) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const thread = String(b.thread || ''); const text = String(b.text || '').trim();
  if (!thread || !text) return NextResponse.json({ error: 'faltan datos' }, { status: 400 });
  await postAdminMessage(thread, text.slice(0, 1500));
  const msgs = await listMessages(thread);
  return NextResponse.json({ ok: true, messages: msgs.map((m: any) => ({ sender: m.sender, es: m.body_es || m.body_orig, orig: m.body_orig, lang: m.lang, at: m.created_at })) });
}
