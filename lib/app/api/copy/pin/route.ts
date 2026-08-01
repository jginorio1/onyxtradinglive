import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { copyPinSet, copyPinClear, copyPinHas, copyPinCheck } from '@/lib/copyPin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function me() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

// GET · ¿tiene PIN de copy puesto?
export async function GET() {
  const user = await me();
  if (!user) return NextResponse.json({ error: 'no auth' }, { status: 401 });
  return NextResponse.json({ hasPin: await copyPinHas(user.id) });
}

// POST · poner o cambiar el PIN (si ya hay uno, pide el actual). O quitarlo.
//   body: { pin?, current?, clear? }
export async function POST(req: Request) {
  const user = await me();
  if (!user) return NextResponse.json({ error: 'no auth' }, { status: 401 });
  const b = await req.json().catch(() => ({} as any));

  const already = await copyPinHas(user.id);
  if (already) {
    const ok = await copyPinCheck(user.id, String(b.current || ''));
    if (!ok) return NextResponse.json({ error: 'PIN actual incorrecto.', code: 'bad_current' }, { status: 403 });
  }

  if (b.clear) { await copyPinClear(user.id); return NextResponse.json({ ok: true, hasPin: false }); }

  const ok = await copyPinSet(user.id, String(b.pin || ''));
  if (!ok) return NextResponse.json({ error: 'El PIN debe tener entre 4 y 8 dígitos.', code: 'bad_pin' }, { status: 400 });
  return NextResponse.json({ ok: true, hasPin: true });
}
