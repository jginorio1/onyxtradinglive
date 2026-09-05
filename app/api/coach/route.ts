import { pickLang, langFromCookie } from '@/lib/i18n';
import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { weeklyReview, fallbackReview, type CoachSummary } from '@/lib/coachAI';
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
    const planId = (prof as any)?.plan || 'free';
    const { data: plan } = await supabaseAdmin.from('plans').select('name,name_en,capabilities').eq('id', planId).maybeSingle();
    const capsObj: any = (plan?.capabilities as any) || {};
    if (!capsObj.coach) return NextResponse.json({ locked: true });

    // Idioma y parámetros primero (los usan las descripciones de features).
    const url = new URL(req.url);
    const lang = pickLang(url.searchParams.get('lang'));
    const qFrom = url.searchParams.get('from') || '';
    const qTo = url.searchParams.get('to') || '';
    const qAccount = url.searchParams.get('account') || '';   // '' o 'all' = portafolio; si no, una cuenta

    // Features del plan del trader → el coach LEE qué incluye cada una para no
    // sugerir lo que su plan no tiene, y para recomendar usar lo que SÍ tiene.
    const FEATURE_DESC: Record<string, { es: string; en: string }> = {
      manager: { es: 'Onyx Guardian: freno de riesgo, break even que cubre costes, trailing stop, límites con margen de seguridad, bloqueo por noticias y cierres parciales', en: 'Onyx Guardian: risk brake, cost-covering break even, trailing stop, limits with safety margin, news blackout and partial closes' },
      copy: { es: 'Copy trading: cuentas master y esclavas, control remoto (web y Telegram)', en: 'Copy trading: master and slave accounts, remote control (web & Telegram)' },
      algo: { es: 'Mis robots: detecta cada EA por su magic y mide su rendimiento real (portafolio y divergencia con backtest)', en: 'My robots: detects each EA by its magic and measures real performance (portfolio and backtest divergence)' },
      tv: { es: 'Señales de TradingView ejecutadas en tu cuenta (con tope de lote y símbolos)', en: 'TradingView signals executed on your account (with lot cap and symbols)' },
      expenses: { es: 'Ganancia neta (bruto de trading − gastos) y ROI de tus retos de fondeo', en: 'Net profit (trading gross − expenses) and ROI of your funding challenges' },
      academy: { es: 'Onyx Academy: crea o sigue una academia (cursos, comunidad, en vivo)', en: 'Onyx Academy: build or follow an academy (courses, community, live)' },
      journal: { es: 'Diario de operaciones con fotos y notas', en: 'Trade journal with photos and notes' },
      compare: { es: 'Comparar cuentas y ver el portafolio junto', en: 'Compare accounts and see the portfolio together' },
      funding: { es: 'Reglas de fondeo, retiros y costes (comisión y swap)', en: 'Funding rules, payouts and costs (commission and swap)' },
    };
    const FEAT_KEYS = Object.keys(FEATURE_DESC);
    const planFeatures = FEAT_KEYS.filter((k) => capsObj[k]);
    const desc = (k: string) => enWindow(lang) ? FEATURE_DESC[k].en : FEATURE_DESC[k].es;
    const planIncludes = planFeatures.map(desc);
    const planMissing = FEAT_KEYS.filter((k) => !capsObj[k]).map(desc);

    // Traemos las cuentas con su balance y límite diario de la firma, para dar
    // contexto real al coach. Si esas columnas no existen en la BD desplegada,
    // reintentamos con solo el id para que el coach NUNCA se rompa por eso.
    let accs: any[] = [];
    const rAcc = await supabaseAdmin.from('trading_accounts')
      .select('id,nickname,balance,fund_max_daily').eq('user_id', user.id);
    if (rAcc.error) {
      const r2 = await supabaseAdmin.from('trading_accounts').select('id').eq('user_id', user.id);
      accs = (r2.data || []) as any[];
    } else {
      accs = (rAcc.data || []) as any[];
    }
    const allIds = accs.map((a: any) => a.id);
    if (!allIds.length) return NextResponse.json({ ok: false, empty: true });

    // Alcance: portafolio (todas) o una cuenta seleccionada del dashboard.
    const isPortfolio = !qAccount || qAccount === 'all' || !allIds.includes(qAccount);
    const ids = isPortfolio ? allIds : [qAccount];
    const scopeAccs = (accs || []).filter((a: any) => ids.includes(a.id));
    const scopeBalance = scopeAccs.reduce((s: number, a: any) => s + (Number(a.balance) || 0), 0);
    const dailyRule = (!isPortfolio && scopeAccs[0]?.fund_max_daily) ? Number(scopeAccs[0].fund_max_daily) : null;
    const scopeLabel = isPortfolio
      ? (enWindow(lang) ? `Portfolio (${allIds.length} accounts)` : `Portafolio (${allIds.length} cuentas)`)
      : (scopeAccs[0]?.nickname || (enWindow(lang) ? 'account' : 'cuenta'));

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
    const perDate: Record<string, number> = {};         // nº de ops por día (para adherencia al plan)
    const perDateWins: Record<string, number> = {};      // ops ganadoras por día
    const tradingDates = new Set<string>();
    for (const t of rows) {
      const p = Number(t.net_profit) || 0;
      net += p;
      equity += p; if (equity > peak) peak = equity; if (peak - equity > maxDD) maxDD = peak - equity;
      if (p > 0) { wins++; grossWin += p; streak = 0; }
      else if (p < 0) { losses++; grossLoss += Math.abs(p); streak++; maxStreak = Math.max(maxStreak, streak); if (p < biggestLoss) biggestLoss = p; }
      const s = String(t.symbol || '?'); bySym[s] = (bySym[s] || 0) + p;
      const dt = new Date(t.close_time);
      const dstr = t.close_time.slice(0, 10);
      tradingDates.add(dstr); perDate[dstr] = (perDate[dstr] || 0) + 1; if (p > 0) perDateWins[dstr] = (perDateWins[dstr] || 0) + 1;
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
    const wFrac = wins + losses ? wins / (wins + losses) : 0;
    // R:R MÍNIMO para no perder a este win rate (punto de equilibrio) = (1−w)/w.
    // A 36% da ~1.78, no 1.5. Se lo damos calculado para que no invente un número.
    const breakevenRR = wFrac > 0 && wFrac < 1 ? r2((1 - wFrac) / wFrac) : 0;

    // ¿El trader usa "Mi plan y hábitos"? Solo si tiene un plan guardado. Si es así,
    // medimos si LO ESTÁ SIGUIENDO: días que pasó del máx de operaciones, mayor
    // atracón en un día, y adherencia de hábitos/racha (ligero, sin consultas pesadas).
    let planBlock: any = undefined;
    try {
      const { data: planRow } = await supabaseAdmin.from('trading_plans').select('data').eq('user_id', user.id).maybeSingle();
      const pd: any = (planRow as any)?.data;
      if (pd) {
        const maxTD = Number(pd.max_trades_day) || 0;   // máx de ops/día del plan del trader
        // Adherencia calculada con LAS MISMAS operaciones ya analizadas (sin consultas extra):
        // días que pasó del límite y win rate respetando vs rompiendo el límite.
        let overLimitDays = 0, maxTradesInADay = 0, rW = 0, rN = 0, bW = 0, bN = 0;
        for (const d in perDate) {
          const n = perDate[d], w = perDateWins[d] || 0;
          if (n > maxTradesInADay) maxTradesInADay = n;
          if (maxTD > 0 && n > maxTD) { overLimitDays++; bW += w; bN += n; } else { rW += w; rN += n; }
        }
        // Cumplimiento de hábitos: UNA sola consulta de check-ins (14 días).
        let habitCheckinRate: number | undefined, hstreak: number | undefined;
        try {
          const habitIds = [...(Array.isArray(pd.habits) ? pd.habits : []), ...((Array.isArray(pd.custom_habits) ? pd.custom_habits : []).map((h: any) => h.id))];
          const enabled = habitIds.length || 1;
          const fromD = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
          const { data: ch } = await supabaseAdmin.from('plan_checkins').select('day,items').eq('user_id', user.id).gte('day', fromD);
          const byDay: Record<string, number> = {};
          for (const c of (ch || []) as any[]) { const it = c.items || {}; byDay[c.day] = habitIds.filter((h: string) => it[h]).length / enabled; }
          const vals = Object.values(byDay);
          habitCheckinRate = vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) : 0;
          let s = 0; const today = new Date();
          let cur = (byDay[today.toISOString().slice(0, 10)] || 0) >= 0.8 ? new Date(today) : new Date(today.getTime() - 86400000);
          for (let i = 0; i < 60; i++) { const k = cur.toISOString().slice(0, 10); if ((byDay[k] || 0) >= 0.8) { s++; cur = new Date(cur.getTime() - 86400000); } else break; }
          hstreak = s;
        } catch { /* sin check-ins, seguimos */ }
        planBlock = {
          hasPlan: true, style: pd.style,
          maxTradesDay: maxTD || undefined, maxDailyLossPct: Number(pd.max_daily_loss_pct) || undefined,
          sessions: Array.isArray(pd.sessions) && pd.sessions.length ? pd.sessions.join(', ') : undefined,
          rules: Array.isArray(pd.rules) ? pd.rules.slice(0, 4) : [], goal: pd.goal || undefined,
          overLimitDays, maxTradesInADay,
          followedMaxTrades: maxTD > 0 ? overLimitDays === 0 : undefined,
          habitCheckinRate, streak: hstreak,
          winRateRespectingLimit: rN ? Math.round((rW / rN) * 100) : undefined,
          winRateBreakingLimit: bN ? Math.round((bW / bN) * 100) : undefined,
        };
      }
    } catch { /* si no hay plan, el coach simplemente no habla de adherencia */ }

    // ¿Tiene "Mis metas de ganancia" (semanal/mensual/anual)? Si sí, medimos su
    // progreso REAL contra cada meta para que el coach diga si va encaminado.
    let goalsBlock: any = undefined;
    try {
      const { data: gp } = await supabaseAdmin.from('profiles').select('goal_week,goal_month,goal_year').eq('id', user.id).maybeSingle();
      const gw = Number((gp as any)?.goal_week) || 0, gm = Number((gp as any)?.goal_month) || 0, gy = Number((gp as any)?.goal_year) || 0;
      if (gw > 0 || gm > 0 || gy > 0) {
        const now = new Date();
        const yStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
        const mStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
        const dow = (now.getUTCDay() + 6) % 7;   // lunes = 0 (semana ISO)
        const wStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - dow);
        const { data: gt } = await supabaseAdmin.from('trades').select('net_profit,close_time')
          .in('account_id', ids).gte('close_time', yStart.toISOString()).limit(50000);
        let ny = 0, nm = 0, nw = 0;
        for (const t of (gt || []) as any[]) { const p = Number(t.net_profit) || 0; const tm = new Date(t.close_time).getTime(); ny += p; if (tm >= mStart) nm += p; if (tm >= wStart) nw += p; }
        const g = (target: number, val: number) => target > 0 ? { target, net: r2(val), pct: Math.round((val / target) * 100) } : undefined;
        goalsBlock = { note: enWindow(lang) ? 'progress vs the trader\'s own profit goals (approx, UTC)' : 'progreso vs las metas de ganancia del trader (aprox, UTC)', week: g(gw, nw), month: g(gm, nm), year: g(gy, ny) };
      }
    } catch { /* sin metas, el coach no habla de metas */ }

    const summary: CoachSummary = {
      net: r2(net), trades: rows.length,
      winRate: wins + losses ? Math.round(wFrac * 100) : 0,
      pf: grossLoss ? r2(grossWin / grossLoss) : 0,
      avgWin: r2(avgWin), avgLoss: r2(avgLoss),
      maxLossStreak: maxStreak, biggestLoss: r2(biggestLoss),
      bestPair: pairs[0]?.[0], worstPair: pairs.length > 1 ? pairs[pairs.length - 1][0] : undefined,
      from: firstDate, to: lastDate, days: spanDays, tradingDays,
      perDay: tradingDays ? r2(rows.length / tradingDays) : rows.length,
      expectancy: r2(net / rows.length), rr: avgLoss ? r2(avgWin / avgLoss) : 0,
      breakevenRR, maxDrawdown: r2(maxDD),
      scope: scopeLabel, isPortfolio, balance: scopeBalance ? r2(scopeBalance) : undefined,
      dailyLossRule: dailyRule || undefined, smallSample: rows.length < 30, plan: planBlock, goals: goalsBlock,
      planTier: (enWindow(lang) ? (plan?.name_en || plan?.name) : plan?.name) || planId,
      planIncludes, planMissing,
      worstDay: worstDayEntry && worstDayEntry[1] < 0 ? DOW[Number(worstDayEntry[0])] : undefined,
      bestHour: bestHourEntry ? `${bestHourEntry[0]}:00 UTC` : undefined,
      periodLabel: (hasFrom || hasTo) ? `${firstDate} → ${lastDate}` : (enWindow(lang) ? 'last 90 days' : 'últimos 90 días'),
    };

    // Acciones sugeridas: botones que llevan al lugar de configuración según los
    // hallazgos (rompió el plan, está perdiendo, no tiene plan, sin Guardian…).
    const losing = (summary.pf > 0 && summary.pf < 1) || summary.net < 0;
    const A = (es: string, en: string, href: string) => ({ label: enWindow(lang) ? en : es, href });
    const actions: { label: string; href: string }[] = [];
    if (planBlock?.followedMaxTrades === false) actions.push(A('Ajustar mis límites', 'Adjust my limits', '/dashboard?view=plan&tab=limites'));
    else if (losing && capsObj.manager) actions.push(A('Poner mi freno diario', 'Set my daily stop', '/dashboard?view=plan&tab=limites'));
    else if (!planBlock && capsObj.manager) actions.push(A('Crear mi plan', 'Create my plan', '/dashboard?view=plan'));
    if (losing && !capsObj.manager) actions.push(A('Desbloquear Onyx Guardian', 'Unlock Onyx Guardian', '/pricing'));
    if (!actions.length) actions.push(A('Ir a Mi plan y hábitos', 'Go to My plan & habits', '/dashboard?view=plan'));

    // La IA con red de seguridad: si falla, no responde o tarda >12s, devolvemos
    // un repaso determinista con los mismos números → la cápsula SIEMPRE funciona.
    let reviewText: string | undefined;
    try {
      const r: any = await Promise.race([
        weeklyReview(summary, lang),
        new Promise((res) => setTimeout(() => res({ ok: false }), 12000)),
      ]);
      if (r?.ok && r.text) reviewText = r.text;
    } catch { /* caemos al repaso determinista */ }
    if (!reviewText) reviewText = fallbackReview(summary, lang);
    return NextResponse.json({ ok: true, review: reviewText, summary, actions });
  } catch (e: any) {
    await logError('coach_get', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
function enWindow(lang: string) { return lang === 'en'; }
