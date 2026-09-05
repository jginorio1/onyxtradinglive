import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendMessage, sendPhoto, sendPhotoFile, sendDocument, telegramEnabled } from '@/lib/telegram';
import { computeTraderReport, traderCsv, traderChartUrl, traderCardPng, traderPdf } from '@/lib/traderReport';
import { reportConfig, fillTemplate, type ReportConfig } from '@/lib/reportConfig';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const APP = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.onyxtradinglive.com').replace(/\/$/, '');

// Hora local del trader a partir de UTC + su desfase en minutos.
const localOf = (tzMin: number, at = new Date()) => new Date(at.getTime() + tzMin * 60000);
const money = (cur: string, n: number) => `${cur} ${n >= 0 ? '' : '-'}${Math.abs(n).toFixed(2)}`;

// Arma y envía el reporte de un trader. `es` según idioma. No lanza.
async function sendReport(p: any, cadence: 'weekly' | 'monthly', cfg: ReportConfig) {
  const days = cadence === 'monthly' ? 30 : 7;
  const toISO = new Date().toISOString();
  const fromISO = new Date(Date.now() - days * 86400000).toISOString();
  const rep = await computeTraderReport(supabaseAdmin, p.id, fromISO, toISO);
  const es = (p.lang || 'es') !== 'en';
  const cur = rep.currency;
  const best = rep.bySym[0];
  const worst = rep.bySym.length > 1 ? rep.bySym[rep.bySym.length - 1] : null;
  const cadLabel = cadence === 'monthly' ? (es ? 'mensual' : 'monthly') : (es ? 'semanal' : 'weekly');
  const vars: Record<string, string> = {
    cadencia: cadLabel,
    neto: money(cur, rep.netTotal),
    ops: String(rep.total),
    winrate: String(rep.winRate),
    pf: String(rep.pf),
    mejor_par: best ? `${best.sym} (${money(cur, best.net)})` : '—',
    peor_par: worst ? `${worst.sym} (${money(cur, worst.net)})` : '—',
    nombre: p.full_name || '',
  };
  const title = fillTemplate(es ? cfg.title_es : cfg.title_en, vars);
  const body = fillTemplate(es ? cfg.body_es : cfg.body_en, vars);
  const txt = `<b>${title}</b>\n\n${body}\n\n${es ? 'Reporte completo' : 'Full report'}: ${APP}/dashboard`;
  await sendMessage(p.telegram_chat_id, txt, { kind: 'report', userId: p.id });

  if (rep.total > 0) {
    const meta = { name: p.full_name || '', from: fromISO.slice(0, 10), to: toISO.slice(0, 10), es };
    if (cfg.attachImage) {
      try {
        const card = await traderCardPng(rep, meta);
        if (card) await sendPhotoFile(p.telegram_chat_id, card, es ? 'Tu resumen en imagen' : 'Your summary');
        else await sendPhoto(p.telegram_chat_id, traderChartUrl(rep, es), es ? 'Neto por instrumento' : 'Net by instrument');
      } catch {}
    }
    if (cfg.attachPdf) {
      try {
        const pdf = await traderPdf(rep, meta);
        await sendDocument(p.telegram_chat_id, `onyx-reporte-${toISO.slice(0, 10)}.pdf`, pdf, 'application/pdf', es ? 'Tu reporte en PDF' : 'Your PDF report');
      } catch {}
    }
    if (cfg.attachCsv) {
      try { await sendDocument(p.telegram_chat_id, `onyx-operaciones-${toISO.slice(0, 10)}.csv`, traderCsv(rep), 'text/csv', es ? 'Tus operaciones (CSV)' : 'Your trades (CSV)'); } catch {}
    }
  }
}

// POST · lo llama la tarea programada CADA HORA (CRON_SECRET). A cada trader le
// llega a SU hora local (sábado 5pm por defecto, editable en Admin → Módulos).
export async function POST(req: Request) {
  const secret = req.headers.get('x-cron-secret') || new URL(req.url).searchParams.get('secret');
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  if (!telegramEnabled()) return NextResponse.json({ ok: true, skipped: 'telegram off' });

  const cfg = await reportConfig();
  if (!cfg.enabled) return NextResponse.json({ ok: true, skipped: 'reportes off' });

  const force = new URL(req.url).searchParams.get('force'); // 'weekly' | 'monthly' → ignora la hora

  // Traders con reporte activado y Telegram vinculado. Intenta traer tz_offset_min
  // (lo capta la app al entrar); si la columna aún no existe, reintenta sin ella.
  let people: any[] | null = null;
  {
    const withTz = await supabaseAdmin.from('profiles')
      .select('id,full_name,telegram_chat_id,plan,tg_report,tg_sent,lang,tz_offset_min')
      .in('tg_report', ['weekly', 'monthly']).not('telegram_chat_id', 'is', null);
    if (withTz.error) {
      const base = await supabaseAdmin.from('profiles')
        .select('id,full_name,telegram_chat_id,plan,tg_report,tg_sent,lang')
        .in('tg_report', ['weekly', 'monthly']).not('telegram_chat_id', 'is', null);
      people = base.data as any[];
    } else people = withTz.data as any[];
  }

  if (!people?.length) return NextResponse.json({ ok: true, sent: 0 });

  // Desfase horario por trader: 1º el del Guardian (si lo configuró) como respaldo
  // del que trae el perfil. Último respaldo: la zona por defecto de la config.
  const ids = people.map((p: any) => p.id);
  const tzByUser: Record<string, number> = {};
  try {
    const { data: mc } = await supabaseAdmin.from('manager_configs').select('user_id,config').in('user_id', ids);
    for (const m of mc || []) { const off = (m as any)?.config?.plan?.tz_offset_min; if (Number.isFinite(off)) tzByUser[(m as any).user_id] = off; }
  } catch {}

  let sent = 0;
  for (const p of people as any[]) {
    if (!p.telegram_chat_id) continue;
    // El plan debe incluir Telegram.
    try {
      const { data: plan } = await supabaseAdmin.from('plans').select('capabilities').eq('id', p.plan || 'free').maybeSingle();
      if (!(plan?.capabilities as any)?.telegram) continue;
    } catch { continue; }

    // Prioridad: perfil (capturado por la app) → Guardian → zona por defecto.
    const tz = Number.isFinite(p.tz_offset_min) ? p.tz_offset_min
      : (Number.isFinite(tzByUser[p.id]) ? tzByUser[p.id] : cfg.defaultTzMin);
    const loc = localOf(tz);
    const locDay = loc.getUTCDay();
    const locHour = loc.getUTCHours();
    const locDate = loc.getUTCDate();
    const ymd = loc.toISOString().slice(0, 10);
    const ym = ymd.slice(0, 7);
    const sentMap = (p.tg_sent as any) || {};

    // ¿Toca semanal? día local == cfg.day y ya pasó (o es) la hora local elegida.
    let cadence: 'weekly' | 'monthly' | null = null;
    let key = '';
    if (force === 'monthly') { cadence = 'monthly'; key = `rep_monthly:${ym}`; }
    else if (force === 'weekly') { cadence = 'weekly'; key = `rep_weekly:${ymd}`; }
    else if (cfg.monthly && locDate === 1 && locHour >= cfg.hour) { cadence = 'monthly'; key = `rep_monthly:${ym}`; }
    else if (locDay === cfg.day && locHour >= cfg.hour) { cadence = 'weekly'; key = `rep_weekly:${ymd}`; }

    if (!cadence) continue;
    if (!force && sentMap[key]) continue;   // ya enviado en este ciclo

    try {
      await sendReport(p, cadence, cfg);
      sent++;
      if (!force) { sentMap[key] = true; await supabaseAdmin.from('profiles').update({ tg_sent: sentMap }).eq('id', p.id); }
    } catch { /* siguiente */ }
  }
  return NextResponse.json({ ok: true, sent, checked: people.length });
}
