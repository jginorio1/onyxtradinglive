import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendMessage, sendPhoto, sendDocument, telegramEnabled } from '@/lib/telegram';
import { computeTraderReport, traderCsv, traderChartUrl, traderPdf } from '@/lib/traderReport';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const APP = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.onyxtradinglive.com').replace(/\/$/, '');

// POST · lo llama la tarea programada (CRON_SECRET) cada día.
//   Envía a los trader con tg_report='weekly' los lunes, y 'monthly' el día 1.
export async function POST(req: Request) {
  const secret = req.headers.get('x-cron-secret') || new URL(req.url).searchParams.get('secret');
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  if (!telegramEnabled()) return NextResponse.json({ ok: true, skipped: 'telegram off' });

  const force = new URL(req.url).searchParams.get('force'); // 'weekly' | 'monthly' para probar
  const now = new Date();
  const isMonday = now.getUTCDay() === 1;
  const isFirst = now.getUTCDate() === 1;
  const cadences: string[] = [];
  if (force === 'weekly' || (!force && isMonday)) cadences.push('weekly');
  if (force === 'monthly' || (!force && isFirst)) cadences.push('monthly');
  if (!cadences.length) return NextResponse.json({ ok: true, sent: 0, note: 'nada que enviar hoy' });

  // Rango según cadencia
  const ranges: Record<string, [string, string]> = {};
  const to = now.toISOString();
  ranges.weekly = [new Date(Date.now() - 7 * 86400000).toISOString(), to];
  ranges.monthly = [new Date(Date.now() - 30 * 86400000).toISOString(), to];

  const { data: people } = await supabaseAdmin.from('profiles')
    .select('id,full_name,telegram_chat_id,plan,tg_report')
    .in('tg_report', cadences).not('telegram_chat_id', 'is', null);

  let sent = 0;
  for (const p of people || []) {
    if (!p.telegram_chat_id) continue;
    // El plan debe incluir Telegram
    try {
      const { data: plan } = await supabaseAdmin.from('plans').select('capabilities').eq('id', p.plan || 'free').maybeSingle();
      if (!plan?.capabilities?.telegram) continue;
    } catch { continue; }

    const [fromISO, toISO] = ranges[p.tg_report] || ranges.weekly;
    try {
      const rep = await computeTraderReport(supabaseAdmin, p.id, fromISO, toISO);
      const es = true;
      const cur = rep.currency;
      const label = p.tg_report === 'monthly' ? (es ? 'mensual' : 'monthly') : (es ? 'semanal' : 'weekly');
      const txt =
        `📊 <b>Tu reporte ${label}</b>\n\n` +
        `${es ? 'Resultado neto' : 'Net result'}: <b>${cur} ${rep.netTotal.toFixed(2)}</b>\n` +
        `${es ? 'Operaciones' : 'Trades'}: ${rep.total}\n` +
        `${es ? 'Aciertos' : 'Win rate'}: ${rep.winRate}%\n` +
        `${es ? 'Factor de beneficio' : 'Profit factor'}: ${rep.pf}\n\n` +
        `${es ? 'Reporte completo' : 'Full report'}: ${APP}/dashboard`;
      await sendMessage(p.telegram_chat_id, txt, { kind: 'report', userId: p.id });

      if (rep.total > 0) {
        try { await sendPhoto(p.telegram_chat_id, traderChartUrl(rep, es), es ? 'Neto por instrumento' : 'Net by instrument'); } catch {}
        try {
          const pdf = await traderPdf(rep, { name: p.full_name || '', from: fromISO.slice(0, 10), to: toISO.slice(0, 10), es });
          await sendDocument(p.telegram_chat_id, `onyx-reporte-${toISO.slice(0, 10)}.pdf`, pdf, 'application/pdf', es ? 'Tu reporte en PDF' : 'Your PDF report');
        } catch {}
        try { await sendDocument(p.telegram_chat_id, `onyx-operaciones-${toISO.slice(0, 10)}.csv`, traderCsv(rep), 'text/csv', es ? 'Tus operaciones (CSV)' : 'Your trades (CSV)'); } catch {}
      }
      sent++;
    } catch { /* seguimos con el siguiente */ }
  }
  return NextResponse.json({ ok: true, sent, cadences });
}
