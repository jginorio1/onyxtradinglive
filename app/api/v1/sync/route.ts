// Endpoint que recibe los datos del conector EA (MT4/MT5).
// POST /api/v1/sync   ·   Authorization: Bearer <API_KEY>
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { accountLimit } from '@/lib/settings';
import { forEA, mergeConfig } from '@/lib/manager';
import { evaluate, registerClosedTrades, newsNear } from '@/lib/managerGuard';
import { loadChallenge } from '@/lib/challenge';
import { isCopyMaster, relayMasterSnapshot } from '@/lib/copyRelay';
import { sendPush } from '@/lib/push';
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
      .select('id,user_id,revoked,account_login,acc_type,acc_size,broker,kind')
      .eq('key', apiKey)
      .maybeSingle();

    if (!keyRow || keyRow.revoked)
      return NextResponse.json({ ok: false, error: 'invalid api key' }, { status: 401 });

    // El sync del Guardian solo acepta claves Guardian. Si aquí llega una clave
    // de copy trading, se rechaza para no mezclar las dos EAs.
    if (keyRow.kind === 'copy')
      return NextResponse.json({ ok: false, error: 'Esta es una clave de Copy trading, no de Onyx Guardian. | This is a Copy trading key, not a Guardian key.' }, { status: 403 });

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

    // Cuenta pausada por el límite del plan (tras un downgrade): sigue "conectada"
    // pero NO se gestiona (ni Guardian, ni manager, ni copy). Se reactiva al subir de plan.
    {
      const { data: pp } = await supabaseAdmin.from('trading_accounts').select('plan_paused').eq('id', accountId).maybeSingle();
      if ((pp as any)?.plan_paused) {
        // Enviamos SIEMPRE el plan actual (aunque la cuenta esté pausada) para que el
        // panel del EA/cBot no se quede mostrando el nombre de un plan viejo tras un downgrade.
        const { data: prof } = await supabaseAdmin.from('profiles').select('plan').eq('id', userId).maybeSingle();
        const { data: planRow } = await supabaseAdmin.from('plans').select('name').eq('id', (prof as any)?.plan || 'free').maybeSingle();
        return NextResponse.json({
          ok: true, paused: true, reason: 'plan_limit',
          message: 'Cuenta pausada por el límite de tu plan. | Account paused by your plan limit.',
          features: { plan: (planRow as any)?.name || 'Free', guardian: false, copy: false, tv: false, copyRole: '', copyMaster: false },
        });
      }
    }

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
        magic: t.magic != null ? Number(t.magic) : null,
        ea_comment: t.comment ? String(t.comment).slice(0, 120) : null,
      }));
      const up = await supabaseAdmin
        .from('trades')
        .upsert(rows, { onConflict: 'account_id,ticket' });
      // Tolerante: si aún no existen las columnas magic/ea_comment (bots.sql sin
      // correr), reintentamos sin ellas para no perder ninguna operación.
      if (up.error) {
        const bare = rows.map(({ magic, ea_comment, ...r }: any) => r);
        await supabaseAdmin.from('trades').upsert(bare, { onConflict: 'account_id,ticket' });
      }
    }

    // --- Posiciones abiertas (reemplazamos la foto actual) ---
    const opens = Array.isArray(body.openPositions) ? body.openPositions : [];
    // Foto ANTERIOR de tickets: para el copy integrado (diff open/close del master).
    const { data: oldOpen } = await supabaseAdmin.from('open_positions').select('ticket').eq('account_id', accountId);
    const oldTickets = new Set((oldOpen || []).map((r: any) => String(r.ticket)));
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
        magic: p.magic != null ? Number(p.magic) : null,
        ea_comment: p.comment ? String(p.comment).slice(0, 120) : null,
      }));
      const ins = await supabaseAdmin.from('open_positions').insert(rows);
      if (ins.error) {
        const bare = rows.map(({ magic, ea_comment, ...r }: any) => r);
        await supabaseAdmin.from('open_positions').insert(bare);
      }
    }

    // --- Copy integrado: si esta cuenta es MASTER, genera órdenes desde el diff.
    // El master ya no necesita un EA aparte: Onyx Connect reporta sus posiciones.
    let copyMaster = false;
    try {
      copyMaster = await isCopyMaster(accountId);
      if (copyMaster) {
        const newTickets = new Set(opens.map((p: any) => String(p.ticket)));
        const nowSec = Math.floor(Date.now() / 1000);
        // Solo copiamos aperturas FRESCAS (evita copiar posiciones que ya
        // existían al enlazar o tras reiniciar el EA).
        const opened = opens
          .filter((p: any) => !oldTickets.has(String(p.ticket)) && (Number(p.openTime) || 0) >= nowSec - 90)
          .map((p: any) => ({ ticket: p.ticket, symbol: p.symbol, side: p.side, volume: p.volume, sl: p.sl, tp: p.tp, price: p.openPrice }));
        const closedTickets = Array.from(oldTickets).filter((tk) => !newTickets.has(tk)) as string[];
        await relayMasterSnapshot({ userId, masterAccountId: accountId, masterBalance: Number(acc.balance) || 0, opened, closedTickets });
      }
    } catch (e) { /* el relay de copy nunca rompe el sync */ }

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

    // Onyx Connect: AutoTrading permitido (para ejecutar) + spread en vivo.
    // Tolerante: si aún no existen las columnas (onyx_connect.sql sin correr), no rompe el sync.
    try {
      const acp: any = {};
      if (body.tradeAllowed !== undefined) acp.trade_allowed = !!body.tradeAllowed;
      if (body.spread !== undefined) acp.spread = Number(body.spread) || 0;
      if (Object.keys(acp).length) await supabaseAdmin.from('trading_accounts').update(acp).eq('id', accountId);
    } catch { /* columnas aún no creadas */ }

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
    let challenge: any = null;
    // Funciones activas del plan + rol de copy → para que el panel de Onyx Connect
    // muestre Journal/Guardian/Copy/TradingView con su estado real.
    let features: any = { journal: true, guardian: false, copy: false, tv: false, copyRole: '', plan: '', copyMaster };
    // Onyx Connect · próxima noticia de alto impacto para el panel (solo informativa).
    let news: any = null;
    let newsTimes: number[] = [];   // epochs (seg) de las noticias de alto impacto próximas → líneas en el gráfico
    let nextNewsAt: number | null = null;
    try {
      const { data: prof } = await supabaseAdmin.from('profiles').select('plan').eq('id', userId).maybeSingle();
      const { data: planRow } = await supabaseAdmin.from('plans').select('name,capabilities').eq('id', prof?.plan || 'free').maybeSingle();
      const caps = planRow?.capabilities || {};
      features.plan = planRow?.name || (prof?.plan || 'Free');
      features.guardian = !!caps.manager;
      features.copy = !!caps.copy;
      features.tv = !!(caps.tv || caps.copy);

      // Próxima noticia de alto impacto (informativa: si el plan tiene Guardian).
      // El feed está cacheado 15 min, así que no pesa aunque el sync sea frecuente.
      if (caps.manager || caps.manager_news) {
        try {
          const base = new URL(req.url);
          const nr = await fetch(`${base.protocol}//${base.host}/api/news`, { next: { revalidate: 900 } } as any);
          const nj = await nr.json();
          const now = Date.now();
          // Todas las de alto impacto en las próximas 24 h → líneas en el gráfico.
          const highSoon = (nj.events || [])
            .filter((e: any) => e.impact === 'High' && e.date)
            .map((e: any) => ({ ...e, ts: new Date(e.date).getTime() }))
            .filter((e: any) => e.ts > now && e.ts < now + 86400000)
            .sort((a: any, b: any) => a.ts - b.ts);
          newsTimes = highSoon.slice(0, 12).map((e: any) => Math.round(e.ts / 1000));
          const up = highSoon[0];
          if (up) {
            nextNewsAt = up.ts;
            news = { title: String(up.title).slice(0, 40), currency: String(up.currency || '').slice(0, 6), minutes: Math.max(0, Math.round((up.ts - now) / 60000)) };
          }
        } catch { /* si el calendario falla, el panel simplemente no muestra noticia */ }
      }
      // Rol de copy de esta cuenta (maestra/esclava), si aplica.
      try {
        if (caps.copy) {
          const { data: cl } = await supabaseAdmin.from('copy_links')
            .select('role').or(`master_account_id.eq.${accountId},slave_account_id.eq.${accountId}`).limit(1);
          if (cl && cl.length) features.copyRole = (cl[0] as any).role || '';
        }
      } catch { /* rol opcional */ }

      if (caps.manager) {
        const { data: cfgRow } = await supabaseAdmin.from('manager_configs').select('*').eq('account_id', accountId).maybeSingle();
        managerCfg = forEA(cfgRow, caps);

        // Fase 2: contamos las operaciones cerradas y decidimos si puede seguir
        if (cfgRow?.enabled) {
          try {
            await registerClosedTrades(accountId, Number(body.serverOffset || 0), Number(mergeConfig(cfgRow.config).limits.reset_hour || 0));

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

            // Aviso de bloqueo próximo por noticia + reanudación para el contador.
            if (news && cfgMerged.news.on && nextNewsAt) {
              const beforeMin = Number(cfgMerged.news.before_min || 15);
              const afterMin = Number(cfgMerged.news.after_min || 15);
              news.blockInMin = Math.max(0, (news.minutes ?? 0) - beforeMin);
              news.willBlock = (news.minutes ?? 999) <= beforeMin;   // ya dentro de la ventana previa
              if (verdict && verdict.reason === 'news' && !verdict.resume_at) {
                verdict.resume_at = new Date(nextNewsAt + afterMin * 60000).toISOString();
              }
            }
          } catch (e) { console.error('guard error', e); }
        }

        const { data: cmds } = await supabaseAdmin.from('manager_commands')
          .select('id,command,params').eq('account_id', accountId).eq('status', 'pending')
          .order('created_at', { ascending: true }).limit(5);
        commands = cmds || [];

        // "Mi reto": marcador en vivo. Se lo pasamos al EA (compacto) y avisamos
        // por Telegram una vez al día si una regla está en riesgo o rota.
        try {
          const sb = await loadChallenge(userId, accountId);
          if (sb) {
            challenge = { verdict: sb.verdict, title: sb.name, lines: sb.lines };
            if (sb.verdict === 'watch' || sb.verdict === 'breach') {
              const near = sb.closest ? ` (${sb.closest.es} / ${sb.closest.en})` : '';
              const head = sb.verdict === 'breach' ? '❌ Regla del reto rota / Challenge rule broken' : '⚠️ Cerca de romper una regla / Close to breaking a rule';
              const fired = await alertOncePerDay(userId, 'funding', 'challenge_' + sb.verdict, `🏁 Onyx · ${sb.name}\n${head}${near}.`).catch(() => false);
              if (fired) sendPush(userId, { title: `Onyx · ${sb.name}`, body: head, url: '/dashboard' }).catch(() => {});
            }
          }
        } catch { /* el marcador nunca rompe el sync */ }
      }
    } catch { /* si algo falla aquí, el sync de datos no debe romperse */ }

    // Segundos que faltan para reanudar (para el contador del panel del EA).
    if (verdict && (verdict as any).resume_at) {
      (verdict as any).resume_in_sec = Math.max(0, Math.round((new Date((verdict as any).resume_at).getTime() - Date.now()) / 1000));
    }

    return NextResponse.json({ ok: true, received: closed.length, accountId, config: managerCfg, verdict, challenge, commands, features, news, newsTimes });
  } catch (e: any) {
    console.error('sync error', e);
    await logError('ea_sync', e);
    return NextResponse.json({ ok: false, error: e?.message || 'server error' }, { status: 500 });
  }
}
