import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { syncDxtrade } from '@/lib/dxtrade';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// Cron: recorre las conexiones DXtrade activas y aplica Guardian + Copy.
// Mismo motor que MatchTrader/TradeLocker/MT/cTrader. Protegido con CRON_SECRET (?key=...).
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization') || '';
    const q = new URL(req.url).searchParams.get('key') || '';
    if (auth !== `Bearer ${secret}` && q !== secret) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const { data: conns } = await supabaseAdmin.from('dxtrade_connections').select('*').eq('enabled', true).limit(500);
  let ok = 0, skipped = 0;
  for (const c of conns || []) {
    try { const r = await syncDxtrade(c); if (r.ok) ok++; else skipped++; }
    catch { skipped++; }
  }
  return NextResponse.json({ ok: true, synced: ok, skipped });
}
