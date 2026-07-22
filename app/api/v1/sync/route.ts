// Endpoint que recibe los datos del conector EA (MT4/MT5).
// POST /api/v1/sync   ·   Authorization: Bearer <API_KEY>
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

// epoch (segundos) -> ISO para timestamptz
const toISO = (s?: number) =>
  s && s > 0 ? new Date(s * 1000).toISOString() : null;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // --- Autenticacion por API key (header Bearer o campo apiKey) ---
    const auth = req.headers.get('authorization') || '';
    const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    const apiKey = bearer || body.apiKey;
    if (!apiKey)
      return NextResponse.json({ ok: false, error: 'missing api key' }, { status: 401 });

    const { data: keyRow } = await supabaseAdmin
      .from('api_keys')
      .select('id,user_id,revoked')
      .eq('key', apiKey)
      .single();

    if (!keyRow || keyRow.revoked)
      return NextResponse.json({ ok: false, error: 'invalid api key' }, { status: 401 });

    const userId = keyRow.user_id;
    const acc = body.account;
    if (!acc?.login)
      return NextResponse.json({ ok: false, error: 'missing account' }, { status: 400 });

    // --- Límite de cuentas según el plan del usuario ---
    // ¿esta cuenta (login) ya existe para el usuario?
    const { data: existingAcc } = await supabaseAdmin
      .from('trading_accounts')
      .select('id')
      .eq('user_id', userId)
      .eq('login', acc.login)
      .limit(1)
      .maybeSingle();

    if (!existingAcc) {
      // cuenta nueva: comprobar el límite del plan
      const { data: prof } = await supabaseAdmin.from('profiles').select('plan').eq('id', userId).single();
      const planId = prof?.plan || 'free';
      const { data: planRow } = await supabaseAdmin.from('plans').select('max_accounts,name').eq('id', planId).maybeSingle();
      const maxAccounts = planRow?.max_accounts ?? 1;
      const { count } = await supabaseAdmin.from('trading_accounts').select('*', { count: 'exact', head: true }).eq('user_id', userId);
      if ((count || 0) >= maxAccounts) {
        return NextResponse.json({
          ok: false,
          error: `Limite del plan ${planRow?.name || planId}: permite ${maxAccounts} cuenta(s). Mejora tu plan para conectar mas.`,
        }, { status: 403 });
      }
    }

    // --- Upsert de la cuenta de trading ---
    const { data: accountRow, error: accErr } = await supabaseAdmin
      .from('trading_accounts')
      .upsert(
        {
          user_id: userId,
          login: acc.login,
          broker: acc.broker,
          server: acc.server,
          name: acc.name,
          currency: acc.currency,
          leverage: acc.leverage,
          platform: acc.platform || 'MT5',
          balance: acc.balance,
          equity: acc.equity,
          last_sync_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,login,server' }
      )
      .select('id')
      .single();

    if (accErr) throw accErr;
    const accountId = accountRow!.id;

    // --- Operaciones cerradas (idempotente por ticket) ---
    const closed = Array.isArray(body.closedTrades) ? body.closedTrades : [];
    if (closed.length) {
      const rows = closed.map((t: any) => ({
        account_id: accountId,
        ticket: t.ticket,
        symbol: t.symbol,
        side: t.side,
        volume: t.volume,
        open_time: toISO(t.openTime),
        open_price: t.openPrice,
        close_time: toISO(t.closeTime),
        close_price: t.closePrice,
        profit: t.profit,
        commission: t.commission,
        swap: t.swap,
        net_profit: t.netProfit,
      }));
      await supabaseAdmin
        .from('trades')
        .upsert(rows, { onConflict: 'account_id,ticket' });
    }

    // --- Posiciones abiertas (reemplazamos la foto actual) ---
    const opens = Array.isArray(body.openPositions) ? body.openPositions : [];
    await supabaseAdmin.from('open_positions').delete().eq('account_id', accountId);
    if (opens.length) {
      const rows = opens.map((p: any) => ({
        account_id: accountId,
        ticket: p.ticket,
        symbol: p.symbol,
        side: p.side,
        volume: p.volume,
        open_time: toISO(p.openTime),
        open_price: p.openPrice,
        sl: p.sl,
        tp: p.tp,
        profit: p.profit,
      }));
      await supabaseAdmin.from('open_positions').insert(rows);
    }

    // --- Marca la key como usada ---
    await supabaseAdmin
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', keyRow.id);

    return NextResponse.json({ ok: true, received: closed.length, accountId });
  } catch (e: any) {
    console.error('sync error', e);
    return NextResponse.json({ ok: false, error: e?.message || 'server error' }, { status: 500 });
  }
}
