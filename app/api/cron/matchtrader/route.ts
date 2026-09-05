import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { syncMatchtrader } from '@/lib/matchtrader';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Cron: recorre las conexiones MatchTrader activas y aplica Guardian + Copy.
// Mientras la API del broker no esté rellenada (lib/matchtrader.ts), cada
// sync devuelve 'not_configured' y no toca nada (falla seguro).
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && new URL(req.url).searchParams.get('key') !== secret) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const { data: conns } = await supabaseAdmin.from('matchtrader_connections').select('*').eq('enabled', true).limit(500);
  let ok = 0, skipped = 0;
  for (const c of conns || []) {
    try { const r = await syncMatchtrader(c); if (r.ok) ok++; else skipped++; } catch { skipped++; }
  }
  return NextResponse.json({ ok: true, synced: ok, skipped });
}
