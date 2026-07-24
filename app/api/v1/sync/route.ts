// Endpoint que recibe los datos del conector EA (MT4/MT5).
// POST /api/v1/sync   ·   Authorization: Bearer <API_KEY>
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { accountLimit } from '@/lib/settings';
import { forEA, mergeConfig } from '@/lib/manager';
import { evaluate, registerClosedTrades, newsNear } from '@/lib/managerGuard';
import { alertUser, alertOncePerDay } from '@/lib/telegram';
import { logError } from '@/lib/errlog';

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
      .maybeSingle();

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

    // --- Limite de cuentas segun el plan del usuario ---
    // El cupo se cuenta por CLAVES activas, que es lo mismo que mide la web.
    // Si el plan baja, siguen valiendo las claves mas antiguas; las que sobran quedan fuera de cupo.
    {
      const lim = await accountLimit(userId);
      if (!lim.unlimited) {
        const { data: myKeys } = await supabaseAdmin
          .from('api_keys').select('id').eq('user_id', userId).eq('revoked', false)
          .order('created_at', { ascending: true });
        const rank = (myKeys || []).findIndex((k: any) => k.id === keyRow.id) + 1;   // 1 = la mas antigua
        if (rank > lim.max) {
          return NextResponse.json({
            ok: false,
            error: `Limite del plan ${lim.planName}: ${lim.max} cuenta(s). Mejora tu plan o revoca otra clave. | ${lim.planName} plan limit: ${lim.max} account(s). Upgrade your plan or revoke another key.`,
          }, { status: 403 });
        }
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
      .maybeSingle();

    if (accErr) throw accErr;
    if (!accountRow?.id) return NextResponse.json({ ok: false, error: 'no se pudo guardar la cuenta' }, { status: 500 });
    const accountId = accountRow.id;

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
      const clean = body.events.slice(0, 50).map((e: any) => ({
        user_id: userId,
        account_id: accountId,
        kind: ['breakeven', 'trailing', 'partial', 'close_all', 'blocked', 'override', 'limit', 'news', 'schedule', 'tilt', 'info'].includes(e.kind) ? e.kind : 'info',
        detail: e.detail ? String(e.detail).slice(0, 300) : null,
        symbol: e.symbol ? String(e.symbol).slice(0, 20) : null,
        ticket: e.ticket ? Number(e.ticket) : null,
        amount: e.amount != null ? Number(e.amount) : null,
      }));
      await supabaseAdmin.from('manager_events').insert(clean);

      // Avisos a Telegram por lo que hizo el gestor con la operación abierta.
      // Solo los tres tipos que interesa notificar; el resto se queda en el historial.
      for (const e of clean) {
        if (e.kind === 'breakeven' || e.kind === 'trailing' || e.kind === 'partial') {
          const icon = e.kind === 'partial' ? '💰' : '🎯';
          const line = e.symbol ? `${e.detail} · ${e.symbol}` : e.detail;
          alertUser(userId, 'manager', `${icon} Onyx Guardian\n${line}`).catch(() => {});
        } else if (e.kind === 'override') {
          // "Te saltaste una regla" — deja constancia
          alertUser(userId, 'blocks', `⚠️ Onyx Guardian\n${e.detail || 'Te saltaste una regla del plan.'}`).catch(() => {});
        }
      }
    }

    // --- Confirmación de comandos ejecutados ---
    if (Array.isArray(body.doneCommands) && body.doneCommands.length) {
      await supabaseAdmin.from('manager_commands')
        .update({ status: 'done', done_at: new Date().toISOString() })
        .in('id', body.doneCommands.slice(0, 20));
    }

    // --- Objetivo de fondeo alcanzado / challenge pasado ---
    // Usa los campos fund_* que el usuario metió en el dashboard. Se avisa
    // una sola vez (marcamos goal_notified_at) para no felicitar en cada sync.
    try {
      const { data: fa } = await supabaseAdmin.from('trading_accounts')
        .select('nickname,login,acc_type,fund_target,fund_start,goal_notified_at,balance,equity')
        .eq('id', accountId).maybeSingle() as any;
      const target = Number(fa?.fund_target || 0);
      const start = Number(fa?.fund_start || 0);
      if (target > 0 && start > 0 && !fa?.goal_notified_at) {
        const pnl = Number(acc.equity ?? acc.balance ?? 0) - start;
        if (pnl >= target) {
          const name = fa.nickname || fa.login;
          alertUser(userId, 'goal',
            `🏆 Onyx Guardian\n¡Objetivo alcanzado en ${name}! Llevas +$${pnl.toFixed(0)} sobre tu inicio de $${start.toFixed(0)}.\nAhora protege lo conseguido: activa tus límites y no lo devuelvas.`).catch(() => {});
          await supabaseAdmin.from('trading_accounts')
            .update({ goal_notified_at: new Date().toISOString() }).eq('id', accountId);
        }
      }
    } catch { /* si falla, no rompe el sync */ }

    // --- Configuración vigente del gestor + veredicto + órdenes pendientes ---
    let managerCfg: any = null;
    let commands: any[] = [];
    let verdict: any = null;
    try {
      const { data: prof } = await supabaseAdmin.from('profiles').select('plan').eq('id', userId).maybeSingle();
      const { data: planRow } = await supabaseAdmin.from('plans').select('capabilities').eq('id', prof?.plan || 'free').maybeSingle();
      const caps = planRow?.capabilities || {};

      if (caps.manager) {
        const { data: cfgRow } = await supabaseAdmin.from('manager_configs').select('*').eq('account_id', accountId).maybeSingle();
        managerCfg = forEA(cfgRow, caps);

        // Fase 2: contamos las operaciones cerradas y decidimos si puede seguir
        if (cfgRow?.enabled) {
          try {
            await registerClosedTrades(accountId, closed);

            // ¿Hay una noticia de alto impacto encima? Solo si su plan lo incluye.
            let newsTitle: string | null = null;
            const cfgMerged = mergeConfig(cfgRow.config);
            if (caps.manager_news && cfgMerged.news.on) {
              try {
                const base = new URL(req.url);
                const nr = await fetch(`${base.protocol}//${base.host}/api/news`, { next: { revalidate: 900 } } as any);
                const nj = await nr.json();
                newsTitle = newsNear(nj.events || [], cfgMerged);
              } catch { /* si el calendario falla, no bloqueamos por noticias */ }
            }

            verdict = await evaluate({
              userId,
              accountId,
              serverOffsetMin: Number(body.serverOffset || 0),
              balance: Number(acc.balance || 0),
              equity: Number(acc.equity || acc.balance || 0),
              openCount: Array.isArray(body.openPositions) ? body.openPositions.length : 0,
              rawConfig: cfgRow.config,
              enabled: true,
              newsBlocked: !!newsTitle,
              newsTitle: newsTitle || undefined,
            });
          } catch (e) { console.error('guard error', e); }
        }

        const { data: cmds } = await supabaseAdmin.from('manager_commands')
          .select('id,command,params').eq('account_id', accountId).eq('status', 'pending')
          .order('created_at', { ascending: true }).limit(5);
        commands = cmds || [];
      }
    } catch { /* si algo falla aquí, el sync de datos no debe romperse */ }

    return NextResponse.json({ ok: true, received: closed.length, accountId, config: managerCfg, verdict, commands });
  } catch (e: any) {
    console.error('sync error', e);
    await logError('ea_sync', e);
    return NextResponse.json({ ok: false, error: e?.message || 'server error' }, { status: 500 });
  }
}
