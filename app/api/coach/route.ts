import { pickLang, langFromCookie } from '@/lib/i18n';
import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { weeklyReview, type CoachSummary } from '@/lib/coachAI';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · repaso del rendimiento del trader por el AI (Coach). Gateado por
// capacidad "coach". Analiza el rango que le pase el dashboard (?from&to en
// YYYY-MM-DD); si no llega, cae a los últimos ~90 días. Devuelve el resumen
// enriquecido (rango, días operados, ops/día, expectancy, R:R, drawdown) para
// que la tarjeta muestre exactamente qué período analizó.
const YMD = /^\d{4}-\d{2}-\d{2}$/;
export async function GET(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });

    const { data: prof } = await supabaseAdmin.from('profiles').select('plan').eq('id', user.id).maybeSingle();
    const { data: plan } = await supabaseAdmin.from('plans').select('capabilities').eq('id', (prof as any)?.plan || 'free').maybeSingle();
    if (!(plan?.capabilities as any)?.coach) return NextResponse.json({ locked: true });

    const url = new URL(req.url);
    const lang = pickLang(url.searchParams.get('lang'));
    const qFrom = url.searchParams.get('from') || '';
    const qTo = url.searchParams.get('to') || '';
    const { data: accs } = await supabaseAdmin.from('trading_accounts').select('id').eq('user_id', user.id);
    const ids = (accs || []).map((a: any) => a.id);
    if (!ids.length) return NextResponse.json({ ok: false, empty: true });

    // Ventana: si el dashboard pasó un rango válido lo usamos; si no, 90 días.
    const hasFrom = YMD.test(qFrom), hasTo = YMD.test(qTo);
    const sinceIso = hasFrom ? qFrom + 'T00:00:00.000Z' : new Date(Date.now() - 90 * 86400000).toISOString();
    const untilIso = hasTo ? qTo + 'T23:59:59.999Z' : null;
    let q = supabaseAdmin.from('trades').select('net_profit,symbol,close_time')
      .in('account_id', ids).gte('close_time', sinceIso);
    if (untilIso) q = q.lte('close_time', untilIso);
    const { data: trades } = await q.order('close_time', { ascending: true }).limit(50000);
    const rows = (trades || []).filter((t: any) => t.close_time);
    if (rows.length < 3) return NextResponse.json({ ok: false, empty: true });

    let net = 0, wins = 0, losses = 0, grossWin = 0, grossLoss = 0, biggestLoss = 0, streak = 0, maxStreak = 0;
    let equity = 0, peak = 0, maxDD = 0;                 // curva de equity → drawdown máx
    const bySym: Record<string, number> = {};
    const byDay: Record<number, number> = {};           // net por día de la semana (0=dom)
    const byHour: Record<number, number> = {};          // net por hora UTC
    const tradingDates = new Set<string>();
    for (const t of rows) {
      const p = Number(t.net_profit) || 0;
      net += p;
      equity += p; if (equity > peak) peak = equity; if (peak - equity > maxDD) maxDD = peak - equity;
      if (p > 0) { wins++; grossWin += p; streak = 0; }
      else if (p < 0) { losses++; grossLoss += Math.abs(p); streak++; maxStreak = Math.max(maxStreak, streak); if (p < biggestLoss) biggestLoss = p; }
      const s = String(t.symbol || '?'); bySym[s] = (bySym[s] || 0) + p;
      const dt = new Date(t.close_time);
      tradingDates.add(t.close_time.slice(0, 10));
      byDay[dt.getUTCDay()] = (byDay[dt.getUTCDay()] || 0) + p;
      byHour[dt.getUTCHours()] = (byHour[dt.getUTCHours()] || 0) + p;
    }
    const pairs = Object.entries(bySym).sort((a, b) => b[1] - a[1]);
    const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const worstDayEntry = Object.entries(byDay).sort((a, b) => a[1] - b[1])[0];
    const bestHourEntry = Object.entries(byHour).sort((a, b) => b[1] - a[1])[0];
    const firstDate = rows[0].close_time.slice(0, 10);
    const lastDate = rows[rows.length - 1].close_time.slice(0, 10);
    const spanDays = Math.max(1, Math.round((new Date(lastDate).getTime() - new Date(firstDate).getTime()) / 86400000) + 1);
    const tradingDays = tradingDates.size;
    const avgWin = wins ? grossWin / wins : 0;
    const avgLoss = losses ? grossLoss / losses : 0;
    const r2 = (x: number) => Math.round(x * 100) / 100;

    const summary: CoachSummary = {
      net: r2(net), trades: rows.length,
      winRate: wins + losses ? Math.round((wins / (wins + losses)) * 100) : 0,
      pf: grossLoss ? r2(grossWin / grossLoss) : 0,
      avgWin: r2(avgWin), avgLoss: r2(avgLoss),
      maxLossStreak: maxStreak, biggestLoss: r2(biggestLoss),
      bestPair: pairs[0]?.[0], worstPair: pairs.length > 1 ? pairs[pairs.length - 1][0] : undefined,
      from: firstDate, to: lastDate, days: spanDays, tradingDays,
      perDay: tradingDays ? r2(rows.length / tradingDays) : rows.length,
      expectancy: r2(net / rows.length), rr: avgLoss ? r2(avgWin / avgLoss) : 0,
      maxDrawdown: r2(maxDD),
      worstDay: worstDayEntry && worstDayEntry[1] < 0 ? DOW[Number(worstDayEntry[0])] : undefined,
      bestHour: bestHourEntry ? `${bestHourEntry[0]}:00 UTC` : undefined,
      periodLabel: (hasFrom || hasTo) ? `${firstDate} → ${lastDate}` : (enWindow(lang) ? 'last 90 days' : 'últimos 90 días'),
    };

    const r = await weeklyReview(summary, lang);
    if (!r.ok) return NextResponse.json({ ok: false, reason: r.reason });
    return NextResponse.json({ ok: true, review: r.text, summary });
  } catch (e: any) {
    await logError('coach_get', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
function enWindow(lang: string) { return lang === 'en'; }
