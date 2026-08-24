import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { reportConfig, saveReportConfig, fillTemplate, type ReportConfig } from '@/lib/reportConfig';
import { computeTraderReport, traderCsv, traderChartUrl, traderCardPng, traderPdf } from '@/lib/traderReport';
import { sendMessage, sendPhoto, sendPhotoFile, sendDocument, telegramEnabled } from '@/lib/telegram';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const APP = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.onyxtradinglive.com').replace(/\/$/, '');
const money = (cur: string, n: number) => `${cur} ${n >= 0 ? '' : '-'}${Math.abs(n).toFixed(2)}`;

// GET · config actual del reporte de Telegram.
export async function GET() {
  const { ok } = await requirePerm('modulos', 'view');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  return NextResponse.json({ config: await reportConfig() });
}

// POST · guardar config  o  enviarme una prueba ahora (a MI Telegram).
export async function POST(req: Request) {
  const a = await requirePerm('modulos', 'manage');
  if (!a.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  try {
    const b = await req.json().catch(() => ({} as any));
    const action = String(b.action || 'save');

    if (action === 'save') {
      const cfg = await saveReportConfig(b.config || {});
      return NextResponse.json({ ok: true, config: cfg });
    }

    if (action === 'test') {
      if (!telegramEnabled()) return NextResponse.json({ ok: false, error: 'Telegram no está configurado' });
      const { data: me } = await supabaseAdmin.from('profiles')
        .select('id,full_name,telegram_chat_id,lang').eq('id', a.user.id).maybeSingle() as any;
      if (!me?.telegram_chat_id) return NextResponse.json({ ok: false, error: 'Vincula tu Telegram primero en Mi cuenta.' });
      const cfg: ReportConfig = await saveReportConfig(b.config || (await reportConfig()));
      await sendTestReport(me, cfg);
      return NextResponse.json({ ok: true, sentTo: 'you' });
    }

    return NextResponse.json({ ok: false, error: 'acción inválida' }, { status: 400 });
  } catch (e: any) {
    await logError('admin_reports', e);
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500 });
  }
}

async function sendTestReport(me: any, cfg: ReportConfig) {
  const toISO = new Date().toISOString();
  const fromISO = new Date(Date.now() - 7 * 86400000).toISOString();
  const rep = await computeTraderReport(supabaseAdmin, me.id, fromISO, toISO);
  const es = (me.lang || 'es') !== 'en';
  const cur = rep.currency;
  const best = rep.bySym[0];
  const worst = rep.bySym.length > 1 ? rep.bySym[rep.bySym.length - 1] : null;
  const vars: Record<string, string> = {
    cadencia: es ? 'semanal' : 'weekly',
    neto: money(cur, rep.netTotal), ops: String(rep.total), winrate: String(rep.winRate), pf: String(rep.pf),
    mejor_par: best ? `${best.sym} (${money(cur, best.net)})` : '—',
    peor_par: worst ? `${worst.sym} (${money(cur, worst.net)})` : '—',
    nombre: me.full_name || '',
  };
  const title = fillTemplate(es ? cfg.title_es : cfg.title_en, vars);
  const body = fillTemplate(es ? cfg.body_es : cfg.body_en, vars);
  const pre = es ? '🧪 Prueba · ' : '🧪 Test · ';
  await sendMessage(me.telegram_chat_id, `<b>${pre}${title}</b>\n\n${body}\n\n${es ? 'Reporte completo' : 'Full report'}: ${APP}/dashboard`, { kind: 'report', userId: me.id });
  const meta = { name: me.full_name || '', from: fromISO.slice(0, 10), to: toISO.slice(0, 10), es };
  if (cfg.attachImage) {
    try { const card = await traderCardPng(rep, meta); if (card) await sendPhotoFile(me.telegram_chat_id, card, es ? 'Tu resumen en imagen' : 'Your summary'); else await sendPhoto(me.telegram_chat_id, traderChartUrl(rep, es), 'Net'); } catch {}
  }
  if (cfg.attachPdf) { try { const pdf = await traderPdf(rep, meta); await sendDocument(me.telegram_chat_id, 'onyx-reporte.pdf', pdf, 'application/pdf', es ? 'Tu reporte en PDF' : 'Your PDF report'); } catch {} }
  if (cfg.attachCsv) { try { await sendDocument(me.telegram_chat_id, 'onyx-operaciones.csv', traderCsv(rep), 'text/csv', es ? 'Tus operaciones (CSV)' : 'Your trades (CSV)'); } catch {} }
}
