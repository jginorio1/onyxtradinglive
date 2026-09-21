import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { getThreadForUser, getThreadById, createAnonThread, listMessages, postUserMessage } from '@/lib/botlabChat';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function resolveThread(userId: string | null, tid: string | null, name?: string, email?: string, create = false) {
  if (userId) return getThreadForUser(userId, name, email);
  if (tid) { const t = await getThreadById(tid); if (t) return t; }
  return create ? createAnonThread(name, email) : null;
}

// GET · trae la conversación del cliente (en SU idioma). ?tid= para anónimos.
export async function GET(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const tid = new URL(req.url).searchParams.get('tid');
  const th = await resolveThread(user?.id || null, tid, undefined, undefined, false);
  if (!th) return NextResponse.json({ threadId: null, messages: [] });
  const msgs = await listMessages(th.id);
  return NextResponse.json({ threadId: th.id, messages: msgs.map((m: any) => ({ sender: m.sender, body: m.body_orig, at: m.created_at })) });
}

// POST · el cliente envía un mensaje (se detecta idioma y se traduce al español para ti).
export async function POST(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const b = await req.json().catch(() => ({}));
  const text = String(b.text || '').trim();
  if (!text) return NextResponse.json({ error: 'vacío' }, { status: 400 });
  const th = await resolveThread(user?.id || null, b.tid || null, b.name, b.email, true);
  if (!th) return NextResponse.json({ error: 'no thread' }, { status: 400 });
  await postUserMessage(th.id, text.slice(0, 1500));
  const msgs = await listMessages(th.id);
  return NextResponse.json({ threadId: th.id, messages: msgs.map((m: any) => ({ sender: m.sender, body: m.body_orig, at: m.created_at })) });
}
