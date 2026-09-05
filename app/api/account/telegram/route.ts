import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { makeLinkCode, BOT_USERNAME, telegramEnabled, sendMessage, sendPhoto, sendPhotoFile, sendDocument, accName } from '@/lib/telegram';
import { computeTraderReport, traderCsv, traderChartUrl, traderCardPng, traderPdf } from '@/lib/traderReport';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PREFS = ['tg_alerts', 'tg_blocks', 'tg_limits', 'tg_manager', 'tg_funding', 'tg_daily', 'tg_offline', 'tg_goal', 'tg_weekly', 'tg_copy_paused', 'tg_copy_error'];

// GET · estado del vínculo + preferencias, para pintar la pantalla
export async function GET() {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not signed in.', code: 'no_auth' }, { status: 401 });

    const { data: p } = await supabaseAdmin.from('profiles')
      .select('telegram_chat_id,telegram_username,telegram_linked_at,plan,tg_alerts,tg_blocks,tg_limits,tg_manager,tg_funding,tg_daily,tg_offline,tg_goal,tg_weekly,tg_copy_paused,tg_copy_error,tg_report')
      .eq('id', user.id).maybeSingle() as any;

    const { data: plan } = await supabaseAdmin.from('plans')
      .select('capabilities').eq('id', p?.plan || 'free').maybeSingle();

    const prefs: any = {};
    // Por defecto ON: el interruptor general y los avisos de copy.
    const onByDefault = ['tg_alerts', 'tg_copy_paused', 'tg_copy_error'];
    PREFS.forEach((k) => { prefs[k] = (p as any)?.[k] ?? onByDefault.includes(k); });

    return NextResponse.json({
      available: telegramEnabled(),
      inPlan: !!plan?.capabilities?.telegram,
      linked: !!p?.telegram_chat_id,
      username: p?.telegram_username || '',
      linkedAt: p?.telegram_linked_at || null,
      bot: BOT_USERNAME,
      prefs,
      report: (p as any)?.tg_report || 'off',
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error', code: 'generic' }, { status: 500 });
  }
}

// POST · acciones: generar enlace, desvincular, guardar preferencias
export async function POST(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not signed in.', code: 'no_auth' }, { status: 401 });

    const b = await req.json().catch(() => ({} as any));

    // Generar el enlace de vinculación (deep-link que abre el bot con el código)
    if (b.action === 'link') {
      const code = makeLinkCode();
      await supabaseAdmin.from('profiles').update({ telegram_link_code: code }).eq('id', user.id);
      return NextResponse.json({ ok: true, url: `https://t.me/${BOT_USERNAME}?start=${code}`, code });
    }

    // Desvincular desde la web
    if (b.action === 'unlink') {
      await supabaseAdmin.from('profiles')
        .update({ telegram_chat_id: null, telegram_username: null, telegram_linked_at: null, telegram_link_code: null })
        .eq('id', user.id);
      return NextResponse.json({ ok: true });
    }

    // Enviar un mensaje de prueba, para confirmar que llega
    if (b.action === 'test') {
      const { data: p } = await supabaseAdmin.from('profiles')
        .select('telegram_chat_id').eq('id', user.id).maybeSingle() as any;
      if (!p?.telegram_chat_id) return NextResponse.json({ error: 'no vinculado', code: 'not_found' }, { status: 400 });
      const ok = await sendMessage(p.telegram_chat_id,
        '✅ Onyx Guardian\nEsto es un mensaje de prueba. Si lo ves, tus avisos están funcionando.');
      return NextResponse.json({ ok });
    }

    // Probar el aviso CON el nombre de la cuenta. Envía un aviso de Guardian de
    // prueba por cada cuenta (máx 3), para confirmar que el nombre sale bien.
    if (b.action === 'test_account') {
      const { data: p } = await supabaseAdmin.from('profiles')
        .select('telegram_chat_id').eq('id', user.id).maybeSingle() as any;
      if (!p?.telegram_chat_id) return NextResponse.json({ error: 'Telegram no está vinculado.', code: 'not_linked' }, { status: 400 });
      const { data: accs } = await supabaseAdmin.from('trading_accounts')
        .select('nickname,login,broker').eq('user_id', user.id).order('created_at', { ascending: true }).limit(3);
      if (!accs || !accs.length) {
        await sendMessage(p.telegram_chat_id, '🛡️ <b>Onyx Guardian</b>\nPrueba de aviso. Aún no tienes cuentas conectadas, así que no puedo mostrarte el nombre de una cuenta todavía.');
        return NextResponse.json({ ok: true, accounts: 0 });
      }
      for (const a of accs) {
        await sendMessage(p.telegram_chat_id,
          `🛡️ <b>Onyx Guardian · ${accName(a)}</b>\nMensaje de prueba: así se identificará esta cuenta en tus avisos (bloqueos, límites y fondeo).`,
          { kind: 'status', userId: user.id });
      }
      return NextResponse.json({ ok: true, accounts: accs.length });
    }

    // Enviar un reporte de rendimiento de prueba (texto + gráfico + PDF + CSV)
    if (b.action === 'report_test') {
      const { data: p } = await supabaseAdmin.from('profiles')
        .select('telegram_chat_id,full_name,plan').eq('id', user.id).maybeSingle() as any;
      if (!p?.telegram_chat_id) return NextResponse.json({ error: 'Telegram no está vinculado.', code: 'not_linked' }, { status: 400 });
      const { data: pl } = await supabaseAdmin.from('plans').select('capabilities').eq('id', p.plan || 'free').maybeSingle();
      if (!pl?.capabilities?.telegram) return NextResponse.json({ error: 'Tu plan no incluye Telegram.', code: 'no_plan' }, { status: 403 });

      const fromISO = new Date(Date.now() - 7 * 86400000).toISOString();
      const toISO = new Date().toISOString();
      const rep = await computeTraderReport(supabaseAdmin, user.id, fromISO, toISO);
      const cur = rep.currency;
      const okMsg = await sendMessage(p.telegram_chat_id,
        `📊 <b>Reporte de prueba · últimos 7 días</b>\n\n`
        + `Resultado neto: <b>${cur} ${rep.netTotal.toFixed(2)}</b>\n`
        + `Operaciones: ${rep.total}\nAciertos: ${rep.winRate}%\nFactor de beneficio: ${rep.pf}`,
        { kind: 'report', userId: user.id });
      let photo = false, pdf = false, csv = false;
      if (rep.total > 0) {
        try {
          const card = await traderCardPng(rep, { name: p.full_name || '', from: fromISO.slice(0, 10), to: toISO.slice(0, 10), es: true });
          photo = card ? await sendPhotoFile(p.telegram_chat_id, card, 'Tu resumen en imagen') : await sendPhoto(p.telegram_chat_id, traderChartUrl(rep, true), 'Neto por instrumento');
        } catch {}
        try { const bytes = await traderPdf(rep, { name: p.full_name || '', from: fromISO.slice(0, 10), to: toISO.slice(0, 10), es: true }); pdf = await sendDocument(p.telegram_chat_id, 'onyx-reporte.pdf', bytes, 'application/pdf', 'Tu reporte en PDF'); } catch {}
        try { csv = await sendDocument(p.telegram_chat_id, 'onyx-operaciones.csv', traderCsv(rep), 'text/csv', 'Tus operaciones (CSV)'); } catch {}
      }
      return NextResponse.json({ ok: okMsg, photo, pdf, csv, trades: rep.total });
    }

    // Guardar preferencias de alertas
    if (b.action === 'prefs') {
      const fields: any = {};
      PREFS.forEach((k) => { if (b[k] !== undefined) fields[k] = !!b[k]; });
      if (['off', 'weekly', 'monthly'].includes(b.tg_report)) fields.tg_report = b.tg_report;
      if (Object.keys(fields).length) {
        await supabaseAdmin.from('profiles').update(fields).eq('id', user.id);
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'unknown action', code: 'generic' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error', code: 'generic' }, { status: 500 });
  }
}
