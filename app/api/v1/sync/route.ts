// Endpoint que recibe los datos del conector EA (MT4/MT5).
// POST /api/v1/sync   ·   Authorization: Bearer <API_KEY>
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { accountLimit } from '@/lib/settings';
import { forEA } from '@/lib/manager';

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
      .select('id,user_id,revoked,account_login,acc_type,acc_size,broker')
      .eq('key', apiKey)
      .single();

    if (!keyRow || keyRow.revoked)
      return NextResponse.json({ ok: false, error: 'invalid api key' }, { status: 401 });

    const userId = keyRow.user_id;
    const acc = body.account;
    if (!acc?.login)
      return NextResponse.json({ ok: false, error: 'missing account' }, { status: 400 });

    // --- Cada clave pertenece a UNA cuenta ---
    // Si ya está atada y el numero no coincide, se rechaza.
    // Si aun no lo esta (clave nueva o antigua), se ata a esta cuenta para siempre.
    if (keyRow.account_login != null) {
      if (Number(keyRow.account_login) !== Number(acc.login)) {
        return NextResponse.json({
          ok: false,
          error: `Esta clave pertenece a la cuenta ${keyRow.account_login}, no a la ${acc.login}. Crea una clave nueva en Conectar cuenta. | This key belongs to account ${keyRow.account_login}, not ${acc.login}. Create a new key in Connect account.`,
        }, { status: 403 });
      }
    } else {
      await supabaseAdmin.from('api_keys').update({ account_login: Number(acc.login), broker: keyRow.broker || acc.broker || null }).eq('id', keyRow.id);
    }

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
      const lim = await accountLimit(userId);
      const planRow = { name: lim.planName };
      const planId = lim.planId;
      const maxAccounts = lim.max;
      const { count } = await supabaseAdmin.from('trading_accounts').select('*', { count: 'exact', head: true }).eq('user_id', userId);
      if (!lim.unlimited && (count || 0) >= maxAccounts) {
        return NextResponse.json({
          ok: false,
          error: `Limite del plan ${planRow?.name || planId}: ${maxAccounts} cuenta(s). Mejora tu plan para conectar mas. | ${planRow?.name || planId} plan limit: ${maxAccounts} account(s). Upgrade your plan to connect more.`,
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

    // Datos declarados al crear la clave (tipo y tamaño de la cuenta).
    // Solo se rellenan si el usuario aún no los ha puesto a mano en el panel.
    if (keyRow.acc_type || keyRow.acc_size) {
      const { data: cur } = await supabaseAdmin.from('trading_accounts').select('acc_type,acc_size').eq('id', accountId).maybeSingle();
      const patch: any = {};
      if (keyRow.acc_type && !cur?.acc_type) patch.acc_type = keyRow.acc_type;
      if (keyRow.acc_size && !cur?.acc_size) patch.acc_size = keyRow.acc_size;
      if (Object.keys(patch).length) await supabaseAdmin.from('trading_accounts').update(patch).eq('id', accountId);
    }

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

    // --- Datos que reporta el EA sobre sí mismo ---
    const eaPatch: any = {};
    if (body.serverOffset !== undefined) eaPatch.server_offset = Number(body.serverOffset) || 0;
    if (body.eaVersion) eaPatch.ea_version = String(body.eaVersion).slice(0, 20);
    if (Object.keys(eaPatch).length) await supabaseAdmin.from('trading_accounts').update(eaPatch).eq('id', accountId);

    // --- Eventos que nos manda el EA (lo que hizo y por qué) ---
    if (Array.isArray(body.events) && body.events.length) {
      const rows = body.events.slice(0, 50).map((e: any) => ({
        user_id: userId,
        account_id: accountId,
        kind: ['breakeven', 'trailing', 'partial', 'close_all', 'blocked', 'info'].includes(e.kind) ? e.kind : 'info',
        detail: e.detail ? String(e.detail).slice(0, 300) : null,
        symbol: e.symbol ? String(e.symbol).slice(0, 20) : null,
        ticket: e.ticket ? Number(e.ticket) : null,
        amount: e.amount != null ? Number(e.amount) : null,
      }));
      await supabaseAdmin.from('manager_events').insert(rows);
    }

    // --- Confirmación de comandos ejecutados ---
    if (Array.isArray(body.doneCommands) && body.doneCommands.length) {
      await supabaseAdmin.from('manager_commands')
        .update({ status: 'done', done_at: new Date().toISOString() })
        .in('id', body.doneCommands.slice(0, 20));
    }

    // --- Configuración vigente del gestor + órdenes pendientes ---
    let managerCfg: any = null;
    let commands: any[] = [];
    try {
      const { data: prof } = await supabaseAdmin.from('profiles').select('plan').eq('id', userId).single();
      const { data: planRow } = await supabaseAdmin.from('plans').select('capabilities').eq('id', prof?.plan || 'free').maybeSingle();
      const caps = planRow?.capabilities || {};

      if (caps.manager) {
        const { data: cfgRow } = await supabaseAdmin.from('manager_configs').select('*').eq('account_id', accountId).maybeSingle();
        managerCfg = forEA(cfgRow, caps);

        const { data: cmds } = await supabaseAdmin.from('manager_commands')
          .select('id,command,params').eq('account_id', accountId).eq('status', 'pending')
          .order('created_at', { ascending: true }).limit(5);
        commands = cmds || [];
      }
    } catch { /* si algo falla aquí, el sync de datos no debe romperse */ }

    return NextResponse.json({ ok: true, received: closed.length, accountId, config: managerCfg, commands });
  } catch (e: any) {
    console.error('sync error', e);
    return NextResponse.json({ ok: false, error: e?.message || 'server error' }, { status: 500 });
  }
}
