import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { parseSignal } from '@/lib/tradingview';
import { normalizeSymbol, aliasesOf } from '@/lib/copySymbols';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ¿El símbolo está en la lista blanca? (vacía = todos)
function symbolAllowed(symbol: string, whitelist: any): boolean {
  const wl = Array.isArray(whitelist) ? whitelist : [];
  if (!wl.length) return true;
  const base = normalizeSymbol(symbol);
  const al = aliasesOf(symbol);
  return wl.some((w: string) => { const nb = normalizeSymbol(w); return nb === base || al.includes(nb); });
}

// ============================================================
// Webhook de TradingView. La alerta manda aquí un JSON; nosotros validamos el
// token, aplicamos límites y metemos un comando en la cola del EA de copy.
// El EA esclavo que el trader ya tiene lo ejecuta en su cuenta real.
//   URL: https://TU-DOMINIO/api/tradingview/webhook?token=tv_xxxx
// ============================================================
export async function POST(req: Request) {
  let b: any = {};
  try { b = await req.json(); } catch { try { b = { action: (await req.text()).trim() }; } catch {} }

  const url = new URL(req.url);
  const token = String(b.token || url.searchParams.get('token') || '').trim();
  if (!token) return NextResponse.json({ ok: false, error: 'missing token' }, { status: 401 });

  const { data: acc } = await supabaseAdmin.from('trading_accounts')
    .select('id,user_id,login,tv_enabled,tv_default_lot,tv_max_lot,tv_symbols,copy_paused')
    .eq('tv_token', token).maybeSingle();
  if (!acc) return NextResponse.json({ ok: false, error: 'invalid token' }, { status: 401 });

  const logRejected = async (error: string) =>
    supabaseAdmin.from('tv_signals').insert({ account_id: acc.id, user_id: acc.user_id, status: 'rejected', error, raw: b }).then(() => {}, () => {});

  if (!acc.tv_enabled) { await logRejected('disabled'); return NextResponse.json({ ok: false, error: 'tradingview disabled' }, { status: 403 }); }

  // ¿El plan del trader incluye TradingView? (o Copy, del que depende)
  const { data: prof } = await supabaseAdmin.from('profiles').select('plan,copy_paused').eq('id', acc.user_id).maybeSingle();
  const { data: planRow } = await supabaseAdmin.from('plans').select('capabilities').eq('id', prof?.plan || 'free').maybeSingle();
  const caps: any = planRow?.capabilities || {};
  if (!caps.tv && !caps.copy) { await logRejected('plan'); return NextResponse.json({ ok: false, error: 'plan does not include TradingView' }, { status: 403 }); }

  // Kill switch global o de la cuenta → no se manda nada.
  if (prof?.copy_paused || acc.copy_paused) { await logRejected('paused'); return NextResponse.json({ ok: true, queued: false, paused: true }); }

  const sig = parseSignal(b);
  if (!sig) { await logRejected('bad_signal'); return NextResponse.json({ ok: false, error: 'could not read signal (need action + symbol)' }, { status: 400 }); }

  if (sig.action === 'open' && !symbolAllowed(sig.symbol, acc.tv_symbols)) {
    await logRejected('symbol_not_allowed');
    return NextResponse.json({ ok: false, error: 'symbol not in whitelist' }, { status: 200 });
  }

  // Lote: el de la alerta, o el por defecto; nunca por encima del tope.
  let lots = 0;
  if (sig.action === 'open') {
    lots = sig.lots > 0 ? sig.lots : (Number(acc.tv_default_lot) || 0.01);
    const cap = Number(acc.tv_max_lot) || 0;
    if (cap > 0 && lots > cap) lots = cap;
  }

  await supabaseAdmin.from('copy_commands').insert({
    link_id: null,
    source: 'tradingview',
    slave_account_id: acc.id,
    action: sig.action,
    master_ticket: '',
    base_symbol: sig.symbol,
    side: sig.side,
    volume_hint: lots,
    sl: sig.sl,
    tp: sig.tp,
    payload: { source: 'tradingview', limits: { max_lot: Number(acc.tv_max_lot) || 0 } },
    status: 'pending',
  });

  await supabaseAdmin.from('tv_signals').insert({
    account_id: acc.id, user_id: acc.user_id,
    action: sig.action, symbol: sig.symbol, lots, sl: sig.sl, tp: sig.tp,
    status: 'queued', raw: b,
  });

  return NextResponse.json({ ok: true, queued: true, action: sig.action, symbol: sig.symbol, side: sig.side, lots });
}

// Salud rápida para probar la URL desde el navegador.
export async function GET() {
  return NextResponse.json({ ok: true, hint: 'POST a JSON alert here with ?token=... — this is the Onyx TradingView webhook.' });
}
