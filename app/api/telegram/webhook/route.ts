import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendMessage, sendPhoto, sendPhotoFile, sendDocument, accName } from '@/lib/telegram';
import { computeTraderReport, traderCsv, traderChartUrl, traderCardPng, traderPdf } from '@/lib/traderReport';
import { copyPinHas, copyPinCheck } from '@/lib/copyPin';

const APP = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.onyxtradinglive.com').replace(/\/$/, '');

const money = (n: number) => (n >= 0 ? '+' : '−') + '$' + Math.abs(n).toFixed(2);

// Desglose por cuenta del resultado neto en un rango. Devuelve una línea por
// cuenta con actividad, ordenadas de mejor a peor. Vacío si hay 0 o 1 cuenta.
async function perAccountLines(userId: string, fromISO: string, toISO: string): Promise<string[]> {
  const { data: accs } = await supabaseAdmin.from('trading_accounts')
    .select('id,nickname,login,broker').eq('user_id', userId);
  if (!accs || accs.length < 2) return [];
  const ids = accs.map((a: any) => a.id);
  const { data: tr } = await supabaseAdmin.from('trades')
    .select('account_id,profit,commission,swap,net_profit')
    .in('account_id', ids).gte('close_time', fromISO).lte('close_time', toISO);
  const agg: Record<string, { n: number; net: number }> = {};
  for (const t of tr || []) {
    const v = t.net_profit != null ? Number(t.net_profit)
      : Number(t.profit || 0) + Number(t.commission || 0) + Number(t.swap || 0);
    const a = (agg[t.account_id] ||= { n: 0, net: 0 }); a.n++; a.net += v;
  }
  return accs
    .filter((a: any) => agg[a.id])
    .map((a: any) => ({ name: accName(a), ...agg[a.id] }))
    .sort((x, y) => y.net - x.net)
    .map((x) => `• <b>${x.name}</b> — ${x.n} ${x.n === 1 ? 'operación' : 'operaciones'} · ${money(x.net)}`);
}

// Envía el reporte completo (texto + gráfico + PDF + CSV) para un rango.
async function sendFullReport(chatId: string, prof: any, days: number, label: string) {
  const fromISO = new Date(Date.now() - days * 86400000).toISOString();
  const toISO = new Date().toISOString();
  const rep = await computeTraderReport(supabaseAdmin, prof.id, fromISO, toISO);
  const cur = rep.currency;
  const accLines = rep.total > 0 ? await perAccountLines(prof.id, fromISO, toISO) : [];
  await sendMessage(chatId,
    `📊 <b>Tu reporte ${label}</b>\n\n`
    + `Resultado neto: <b>${rep.netTotal >= 0 ? '+' : '−'}$${Math.abs(rep.netTotal).toFixed(2)}</b>\n`
    + `Operaciones: ${rep.total}\n`
    + `Aciertos: ${rep.winRate}%\n`
    + `Factor de beneficio: ${rep.pf}\n`
    + (accLines.length ? `\n<b>Por cuenta</b>\n${accLines.join('\n')}\n` : '')
    + `\nReporte completo: ${APP}/dashboard`, { kind: 'report', userId: prof.id });
  if (rep.total > 0) {
    try {
      const card = await traderCardPng(rep, { name: prof.full_name || '', from: fromISO.slice(0, 10), to: toISO.slice(0, 10), es: true });
      if (card) await sendPhotoFile(chatId, card, 'Tu resumen en imagen'); else await sendPhoto(chatId, traderChartUrl(rep, true), 'Neto por instrumento');
    } catch {}
    try { const pdf = await traderPdf(rep, { name: prof.full_name || '', from: fromISO.slice(0, 10), to: toISO.slice(0, 10), es: true }); await sendDocument(chatId, `onyx-reporte-${toISO.slice(0, 10)}.pdf`, pdf, 'application/pdf', 'Tu reporte en PDF'); } catch {}
    try { await sendDocument(chatId, `onyx-operaciones-${toISO.slice(0, 10)}.csv`, traderCsv(rep), 'text/csv', 'Tus operaciones (CSV)'); } catch {}
  } else {
    await sendMessage(chatId, 'Todavía no tienes operaciones en ese período.');
  }
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ============================================================
// Webhook del bot de Telegram.
//
// Telegram llama aquí cada vez que alguien escribe al bot. Nos interesa
// sobre todo el /start con el código de vínculo, que llega cuando el
// usuario pulsa el enlace t.me/<bot>?start=<codigo> desde su cuenta.
//
// Seguridad: Telegram añade un token secreto en la cabecera si lo
// configuramos al registrar el webhook. Lo comprobamos aquí.
// ============================================================
export async function POST(req: Request) {
  try {
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (secret && req.headers.get('x-telegram-bot-api-secret-token') !== secret) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    const update = await req.json().catch(() => null);
    const msg = update?.message;
    const chatId = msg?.chat?.id ? String(msg.chat.id) : '';
    const text = String(msg?.text || '').trim();
    if (!chatId || !text) return NextResponse.json({ ok: true });

    const username = msg?.from?.username ? '@' + msg.from.username : '';

    // /stop  → desvincular desde el propio Telegram
    if (text === '/stop') {
      await supabaseAdmin.from('profiles')
        .update({ telegram_chat_id: null, telegram_linked_at: null })
        .eq('telegram_chat_id', chatId);
      await sendMessage(chatId, 'Listo, no volverás a recibir avisos. Puedes reconectar cuando quieras desde tu cuenta.');
      return NextResponse.json({ ok: true });
    }

    // /informe · /report (semana)  ·  /mes · /month (mes)  → reporte completo al momento
    const wantsWeek = text === '/informe' || text === '/report';
    const wantsMonth = text === '/mes' || text === '/month';
    if (wantsWeek || wantsMonth) {
      const { data: prof } = await supabaseAdmin.from('profiles')
        .select('id,full_name,plan').eq('telegram_chat_id', chatId).maybeSingle();
      if (!prof) {
        await sendMessage(chatId, 'No reconozco este chat. Conéctate primero desde tu cuenta → Avisos.');
        return NextResponse.json({ ok: true });
      }
      // El reporte con PDF/gráfico requiere un plan con Telegram
      let inPlan = false;
      try { const { data: pl } = await supabaseAdmin.from('plans').select('capabilities').eq('id', (prof as any).plan || 'free').maybeSingle(); inPlan = !!pl?.capabilities?.telegram; } catch {}
      if (!inPlan) {
        const { buildWeeklyReport } = await import('@/lib/weeklyReport');
        const rep = await buildWeeklyReport(prof.id);
        await sendMessage(chatId, (rep || 'Todavía no tienes operaciones esta semana.') + `\n\n📄 El reporte con PDF y gráfico está en los planes de pago.`);
        return NextResponse.json({ ok: true });
      }
      await sendMessage(chatId, '⏳ Preparando tu reporte…');
      await sendFullReport(chatId, prof, wantsMonth ? 30 : 7, wantsMonth ? 'mensual' : 'semanal');
      return NextResponse.json({ ok: true });
    }

    // /estado  → resumen rápido del día, sin abrir la web (desglosado por cuenta)
    if (text === '/estado' || text === '/status') {
      const { data: prof } = await supabaseAdmin.from('profiles')
        .select('id').eq('telegram_chat_id', chatId).maybeSingle();
      if (!prof) {
        await sendMessage(chatId, 'No reconozco este chat. Conéctate primero desde tu cuenta → Avisos.');
        return NextResponse.json({ ok: true });
      }
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { data: accs } = await supabaseAdmin.from('trading_accounts')
        .select('id,nickname,login,broker').eq('user_id', prof.id);
      const ids = (accs || []).map((a: any) => a.id);
      let n = 0, net = 0;
      const agg: Record<string, { n: number; net: number }> = {};
      if (ids.length) {
        const { data: tr } = await supabaseAdmin.from('trades')
          .select('account_id,profit,commission,swap,net_profit').in('account_id', ids).gte('close_time', since);
        for (const t of tr || []) {
          const v = t.net_profit != null ? Number(t.net_profit) : Number(t.profit || 0) + Number(t.commission || 0) + Number(t.swap || 0);
          const a = (agg[t.account_id] ||= { n: 0, net: 0 }); a.n++; a.net += v; n++; net += v;
        }
      }
      const { count: blocks } = await supabaseAdmin.from('manager_events')
        .select('*', { count: 'exact', head: true }).eq('user_id', prof.id).eq('kind', 'blocked').gte('created_at', since);
      // Líneas por cuenta (solo con actividad), de mejor a peor. Solo si hay >1.
      let perAcc = '';
      if ((accs || []).length > 1) {
        const lines = (accs || []).filter((a: any) => agg[a.id])
          .map((a: any) => ({ name: accName(a), ...agg[a.id] }))
          .sort((x, y) => y.net - x.net)
          .map((x) => `• <b>${x.name}</b> — ${x.n} ${x.n === 1 ? 'operación' : 'operaciones'} · ${money(x.net)}`);
        if (lines.length) perAcc = `\n\n<b>Por cuenta</b>\n${lines.join('\n')}`;
      }
      await sendMessage(chatId,
        `📊 <b>Últimas 24h</b>\n`
        + `Operaciones: ${n}\nResultado: ${money(net)}\nEl Guardian te frenó: ${blocks || 0} vez(ces)`
        + perAcc,
        { kind: 'status', userId: prof.id });
      return NextResponse.json({ ok: true });
    }

    // /cuentas  → lista de cuentas conectadas con su nombre, saldo y estado
    if (text === '/cuentas' || text === '/accounts') {
      const { data: prof } = await supabaseAdmin.from('profiles')
        .select('id').eq('telegram_chat_id', chatId).maybeSingle();
      if (!prof) {
        await sendMessage(chatId, 'No reconozco este chat. Conéctate primero desde tu cuenta → Avisos.');
        return NextResponse.json({ ok: true });
      }
      const { data: accs } = await supabaseAdmin.from('trading_accounts')
        .select('nickname,login,broker,balance,equity,trade_allowed,last_sync_at')
        .eq('user_id', prof.id).order('created_at', { ascending: true });
      if (!accs || !accs.length) {
        await sendMessage(chatId, 'Todavía no tienes cuentas conectadas. Conéctalas desde tu cuenta → Conectar cuenta.');
        return NextResponse.json({ ok: true });
      }
      const ago = (iso?: string) => {
        if (!iso) return 'sin señal';
        const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
        if (m < 1) return 'ahora';
        if (m < 60) return `hace ${m} min`;
        const h = Math.round(m / 60); if (h < 24) return `hace ${h} h`;
        return `hace ${Math.round(h / 24)} d`;
      };
      const body = accs.map((a: any) => {
        const bal = a.balance != null ? `$${Number(a.balance).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—';
        const op = a.trade_allowed === false ? 'AutoTrading OFF ⏸' : 'operando ✓';
        return `• <b>${accName(a)}</b>\n  ${a.broker || 'MT'} · #${a.login}\n  Saldo: ${bal} · ${op} · señal ${ago(a.last_sync_at)}`;
      }).join('\n\n');
      await sendMessage(chatId,
        `🗂️ <b>Tus cuentas (${accs.length})</b>\n\n${body}`,
        { kind: 'status', userId: prof.id });
      return NextResponse.json({ ok: true });
    }

    // ============================================================
    // Control remoto del COPY TRADING desde Telegram (sin la computadora).
    //   /copy            → estado + ayuda
    //   /copyoff         → pausa TODO al instante (acción segura)
    //   /copyon [PIN]    → reanuda; si hay PIN de copy, hay que ponerlo
    // Solo el chat vinculado del propio trader puede hacerlo.
    // ============================================================
    const cmd0 = text.split(/\s+/)[0].toLowerCase();
    if (cmd0 === '/copy' || cmd0 === '/copyoff' || cmd0 === '/copyon') {
      const { data: prof } = await supabaseAdmin.from('profiles')
        .select('id,plan,copy_paused').eq('telegram_chat_id', chatId).maybeSingle();
      if (!prof) {
        await sendMessage(chatId, 'No reconozco este chat. Conéctate primero desde tu cuenta → Avisos.');
        return NextResponse.json({ ok: true });
      }
      let inPlan = false;
      try { const { data: pl } = await supabaseAdmin.from('plans').select('capabilities').eq('id', (prof as any).plan || 'free').maybeSingle(); inPlan = !!(pl?.capabilities as any)?.copy; } catch {}
      if (!inPlan) {
        await sendMessage(chatId, 'El copy trading está en el plan Elite. Mejora tu plan para controlarlo desde aquí.');
        return NextResponse.json({ ok: true });
      }

      if (cmd0 === '/copyoff') {
        await supabaseAdmin.from('profiles').update({ copy_paused: true, copy_paused_at: new Date().toISOString() }).eq('id', prof.id);
        await supabaseAdmin.from('copy_control_log').insert({ owner_id: prof.id, action: 'pause_all', target: null, source: 'telegram' });
        await sendMessage(chatId, '⏸ <b>Copia PAUSADA</b>\nNo se replicará ninguna operación. Para reanudar: <code>/copyon</code>' + (await copyPinHas(prof.id) ? ' <code>tuPIN</code>' : ''), { kind: 'status', userId: prof.id });
        return NextResponse.json({ ok: true });
      }

      if (cmd0 === '/copyon') {
        const pin = text.split(/\s+/)[1] || '';
        if (await copyPinHas(prof.id)) {
          if (!pin) { await sendMessage(chatId, '🔒 Reanudar pide tu PIN de copy. Escribe: <code>/copyon TU_PIN</code>'); return NextResponse.json({ ok: true }); }
          if (!(await copyPinCheck(prof.id, pin))) { await sendMessage(chatId, '❌ PIN incorrecto. Intenta de nuevo: <code>/copyon TU_PIN</code>'); return NextResponse.json({ ok: true }); }
        }
        await supabaseAdmin.from('profiles').update({ copy_paused: false, copy_paused_at: null }).eq('id', prof.id);
        await supabaseAdmin.from('copy_control_log').insert({ owner_id: prof.id, action: 'resume_all', target: null, source: 'telegram' });
        await sendMessage(chatId, '▶ <b>Copia ACTIVA</b>\nVolverá a replicar las operaciones de tu master.', { kind: 'status', userId: prof.id });
        return NextResponse.json({ ok: true });
      }

      // /copy → estado
      const { count: linkCount } = await supabaseAdmin.from('copy_links').select('*', { count: 'exact', head: true }).eq('owner_id', prof.id).eq('enabled', true);
      await sendMessage(chatId,
        `📡 <b>Copia: ${prof.copy_paused ? 'PAUSADA ⏸' : 'ACTIVA ▶'}</b>\n`
        + `Enlaces activos: ${linkCount || 0}\n\n`
        + `Comandos:\n<code>/copyoff</code> — pausar todo\n<code>/copyon</code> — reanudar`,
        { kind: 'status', userId: prof.id });
      return NextResponse.json({ ok: true });
    }

    // Sacamos el código del mensaje. Vale de dos formas:
    //   · "/start CODIGO"  — cuando Telegram muestra el botón Start
    //   · "CODIGO" a secas  — cuando el chat ya existía y no aparece el Start,
    //                         así que el usuario lo pega a mano
    let code = '';
    if (text.startsWith('/start')) {
      code = text.split(/\s+/)[1]?.toUpperCase() || '';
    } else if (/^[A-Z0-9]{6,10}$/i.test(text)) {
      code = text.toUpperCase();
    }

    if (code) {
      const { data: prof } = await supabaseAdmin
        .from('profiles').select('id,telegram_chat_id').eq('telegram_link_code', code).maybeSingle();

      if (!prof) {
        await sendMessage(chatId, 'Ese código no es válido o ya caducó. Genera uno nuevo desde tu cuenta → Avisos.');
        return NextResponse.json({ ok: true });
      }

      // Un chat de Telegram no puede quedar atado a dos cuentas a la vez
      await supabaseAdmin.from('profiles')
        .update({ telegram_chat_id: null })
        .eq('telegram_chat_id', chatId).neq('id', prof.id);

      await supabaseAdmin.from('profiles').update({
        telegram_chat_id: chatId,
        telegram_username: username || null,
        telegram_link_code: null,
        telegram_linked_at: new Date().toISOString(),
      }).eq('id', prof.id);

      await sendMessage(chatId,
        '✅ <b>Conectado</b>\nYa recibirás aquí los avisos de Onyx Guardian: bloqueos, límites de riesgo y alertas de fondeo.\n\nElige qué avisos quieres en tu cuenta → Avisos. Para dejar de recibirlos escribe /stop.');
      return NextResponse.json({ ok: true });
    }

    // /start sin código, o cualquier otra cosa: ayuda
    await sendMessage(chatId,
      'Hola 👋 Soy Onyx Guardian.\nPara conectarte, entra en onyxtradinglive.com → Mi cuenta → Avisos → Conectar Telegram, y pega aquí el código que te dé.\n\nComandos: /estado (día, por cuenta) · /cuentas (tus cuentas) · /report (semana, con PDF y gráfico) · /mes (mes) · /copy (control copy trading) · /copyoff · /copyon · /stop (dejar de recibir).');
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    // Devolvemos 200 igualmente: si respondemos error, Telegram reintenta en bucle
    return NextResponse.json({ ok: true });
  }
}
