import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { payoutNodeStatus, payoutOnboardingLink, payoutExpressLoginLink, savedWallets, saveWallets } from '@/lib/payoutProfile';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · estado del nodo de cobro + wallets guardadas.
export async function GET() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const [status, wallets] = await Promise.all([payoutNodeStatus(user.id), savedWallets(user.id)]);
  return NextResponse.json({ status, wallets }, { headers: { 'Cache-Control': 'no-store' } });
}

// POST · acciones: connect (onboarding), express (panel), save_wallets.
export async function POST(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const b = await req.json().catch(() => ({} as any));
  try {
    if (b.action === 'connect') {
      const url = await payoutOnboardingLink(user.id, user.email || undefined);
      return NextResponse.json({ url });
    }
    if (b.action === 'express') {
      const url = await payoutExpressLoginLink(user.id);
      return NextResponse.json({ url });
    }
    if (b.action === 'save_wallets') {
      const w = await saveWallets(user.id, { trc20: b.trc20, erc20: b.erc20, network: b.network });
      return NextResponse.json({ ok: true, wallets: w });
    }
    return NextResponse.json({ error: 'acción no válida' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
