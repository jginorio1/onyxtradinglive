import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { computeStats } from '@/lib/stats';
import { alertUser } from '@/lib/telegram';

// ============================================================
// Informe semanal por Telegram.
//
// Reutiliza el mismo cálculo de estadísticas que el dashboard (computeStats),
// así que los números que llegan al chat cuadran con lo que el trader ve en
// la web. Nada nuevo que mantener aparte.
// ============================================================

const money = (n: number) => (n >= 0 ? '+' : '-') + '$' + Math.abs(n).toFixed(2);
const barFor = (winRate: number) => {
  // Una barra sencilla de 10 bloques para el win rate, legible en Telegram
  const filled = Math.round(winRate / 10);
  return '▓'.repeat(filled) + '░'.repeat(10 - filled);
};

// Genera el texto del informe de un usuario, o null si no hubo actividad
export async function buildWeeklyReport(userId: string): Promise<string | null> {
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  const { data: accs } = await supabaseAdmin.from('trading_accounts').select('id').eq('user_id', userId);
  const ids = (accs || []).map((a: any) => a.id);
  if (!ids.length) return null;

  const { data: rows } = await supabaseAdmin.from('trades')
    .select('net_profit,profit,commission,swap,close_time,symbol')
    .in('account_id', ids).gte('close_time', since).order('close_time', { ascending: true });

  const trades = (rows || []).map((t: any) => ({
    ...t,
    net_profit: t.net_profit != null ? Number(t.net_profit)
      : Number(t.profit || 0) + Number(t.commission || 0) + Number(t.swap || 0),
  }));
  if (!trades.length) return null;

  const s = computeStats(trades as any);

  // Mejor y peor par de la semana
  const byPair: Record<string, number> = {};
  for (const t of trades) byPair[t.symbol || '?'] = (byPair[t.symbol || '?'] || 0) + Number(t.net_profit || 0);
  const sortedPairs = Object.entries(byPair).sort((a, b) => b[1] - a[1]);
  const best = sortedPairs[0];
  const worst = sortedPairs[sortedPairs.length - 1];

  // Disciplina de la semana (del guardián)
  const { count: blocks } = await supabaseAdmin.from('manager_events')
    .select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('kind', 'blocked').gte('created_at', since);
  const { count: overrides } = await supabaseAdmin.from('manager_events')
    .select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('kind', 'override').gte('created_at', since);

  const pf = s.profitFactor >= 999 ? '∞' : s.profitFactor.toFixed(2);

  let msg = `📈 <b>Tu semana en Onyx</b>\n\n`;
  msg += `Resultado: <b>${money(s.net)}</b>\n`;
  msg += `Operaciones: ${s.trades}  ·  Aciertos: ${s.winRate.toFixed(0)}%\n`;
  msg += `${barFor(s.winRate)}\n\n`;
  msg += `Profit factor: ${pf}\n`;
  msg += `Media por operación: ${money(s.expectancy)}\n`;
  msg += `Racha máxima en contra: -$${s.maxDD.toFixed(2)}\n`;
  if (best) msg += `\nMejor par: ${best[0]} (${money(best[1])})\n`;
  if (worst && worst[0] !== best?.[0]) msg += `Peor par: ${worst[0]} (${money(worst[1])})\n`;
  if ((blocks || 0) + (overrides || 0) > 0) {
    msg += `\n🛡️ El Guardian te frenó ${blocks || 0} vez(ces)`;
    if (overrides) msg += ` · te lo saltaste ${overrides}`;
    msg += `\n`;
  }

  // Un cierre honesto según cómo fue la semana, sin exagerar
  if (s.net > 0 && s.expectancy > 0) msg += `\nSemana en verde. Mantén el mismo plan.`;
  else if (s.net < 0) msg += `\nSemana en rojo. Revisa el peor par antes de repetirlo.`;

  return msg;
}

// Manda el informe a todos los que lo tienen activado. Lo llama el cron.
export async function sendWeeklyReports(): Promise<{ users: number; sent: number }> {
  const { data: users } = await supabaseAdmin.from('profiles')
    .select('id').eq('tg_weekly', true).not('telegram_chat_id', 'is', null);

  let sent = 0;
  for (const u of users || []) {
    const msg = await buildWeeklyReport(u.id);
    if (!msg) continue;
    const ok = await alertUser(u.id, 'weekly', msg);
    if (ok) sent++;
  }
  return { users: (users || []).length, sent };
}
