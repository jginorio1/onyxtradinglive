import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { saveSetting, trackSettings, type TrackConfig } from '@/lib/settings';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · config global del trackrecord público (qué campos se muestran).
export async function GET() {
  const { ok } = await requirePerm('ajustes', 'view');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  return NextResponse.json(await trackSettings());
}

// PATCH · guardar la config (solo owner/ajustes).
export async function PATCH(req: Request) {
  const { ok } = await requirePerm('ajustes', 'manage');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const cur = await trackSettings();
  const b = await req.json().catch(() => ({} as any));
  const bool = (k: keyof TrackConfig) => (b[k] === undefined ? (cur as any)[k] : !!b[k]);
  const next: TrackConfig = {
    enabled: bool('enabled'), show_money: bool('show_money'), show_accounts: bool('show_accounts'),
    show_equity: bool('show_equity'), show_winrate: bool('show_winrate'), show_pf: bool('show_pf'),
    show_dd: bool('show_dd'), show_bysym: bool('show_bysym'), show_trades: bool('show_trades'),
    show_avatar: bool('show_avatar'), verified_badge: bool('verified_badge'),
    min_trades: b.min_trades === undefined ? cur.min_trades : Math.min(1000, Math.max(0, Math.round(Number(b.min_trades) || 0))),
  };
  await saveSetting('trackrecord', next);
  return NextResponse.json({ ok: true, ...next });
}
