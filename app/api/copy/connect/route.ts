import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { copyOnboardingLink, copyConnectStatus } from '@/lib/copyFollow';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · estado de la cuenta Connect del trader (para cobrar copias).
export async function GET() {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'no autorizado', code: 'no_auth' }, { status: 401 });
    const st = await copyConnectStatus(user.id);
    return NextResponse.json({ ok: true, ...st });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}

// POST · genera el enlace de onboarding de Stripe Connect (Express).
export async function POST() {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'no autorizado', code: 'no_auth' }, { status: 401 });
    const url = await copyOnboardingLink(user.id, user.email || undefined);
    return NextResponse.json({ ok: true, url });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error', code: 'generic' }, { status: 500 });
  }
}
