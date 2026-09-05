import { supabaseAdmin } from '@/lib/supabaseAdmin';

// ============================================================
// Onyx Bot Lab · Score de verificación con OPERACIONES REALES.
// El robot corre en nuestra plataforma, así que su EA nos reporta cada
// operación (tabla `trades`, por cuenta + magic). En vez de confiar en un
// link auto-declarado (Myfxbook), calculamos el track record nosotros.
//
// Devuelve un score 0–100, un veredicto (aprobar/revisar/rechazar) y los
// KPIs crudos para pintarlos en la tarjeta de revisión y en el marketplace.
// ============================================================

export type BotScore = {
  hasData: boolean;                 // ¿hay operaciones ligadas?
  score: number;                    // 0–100
  verdict: 'approve' | 'review' | 'reject';
  trades: number;
  days: number;
  pf: number;                       // profit factor
  winRate: number;                  // %
  ddPct: number;                    // drawdown máx (% del pico de equity)
  netProfit: number;
  live: boolean;                    // cuenta con balance real (no vacía)
  concentration: number;            // % del mejor trade sobre la ganancia bruta (menos = mejor)
  parts: { k: string; v: number; max: number; note: string }[]; // desglose para la UI
  flags: string[];                  // motivos de alerta (frases prohibidas, poca muestra…)
};

// Umbrales base (razonables; luego se pueden mover a Ajustes).
const MIN_TRADES = 100;   // muestra ideal
const MIN_DAYS = 30;      // tiempo ideal
const GOOD_PF = 1.5;      // PF ideal
const MAX_DD = 15;        // % de drawdown tolerado

const BANNED = ['ganancias garantizadas', 'sin riesgo', '100% ganad', 'rentabilidad garantizada', 'guaranteed profit', 'no risk', 'risk free', 'risk-free'];

export function textFlags(text?: string): string[] {
  const t = String(text || '').toLowerCase();
  return BANNED.filter((w) => t.includes(w));
}

// Score en blanco cuando el producto aún no está ligado a un robot real.
export function emptyScore(flags: string[] = []): BotScore {
  return { hasData: false, score: 0, verdict: 'review', trades: 0, days: 0, pf: 0, winRate: 0, ddPct: 0, netProfit: 0, live: false, concentration: 0, parts: [], flags };
}

export async function botScore(input: { sellerId?: string | null; accountId?: string | null; magic?: number | null; text?: string }): Promise<BotScore> {
  const textFlgs = textFlags(input.text);
  if (!input.accountId || input.magic == null) return emptyScore(textFlgs);

  // La cuenta debe ser del vendedor (anti-suplantación).
  let accQ = supabaseAdmin.from('trading_accounts').select('id,user_id,balance').eq('id', input.accountId);
  if (input.sellerId) accQ = accQ.eq('user_id', input.sellerId);
  const { data: acc } = await accQ.maybeSingle();
  if (!acc) return emptyScore([...textFlgs, 'cuenta no verificada']);

  const { data: trades } = await supabaseAdmin
    .from('trades').select('net_profit,open_time,close_time')
    .eq('account_id', input.accountId).eq('magic', input.magic)
    .order('close_time', { ascending: true }).limit(5000);

  const rows = (trades || []).filter((t: any) => t.close_time);
  const n = rows.length;
  if (!n) return emptyScore([...textFlgs, 'sin operaciones aún']);

  // KPIs.
  let gp = 0, gl = 0, wins = 0, best = 0, net = 0;
  const startBal = Number(acc.balance) || 10000;
  let cum = startBal, peak = startBal, ddAbs = 0;
  for (const t of rows) {
    const p = Number(t.net_profit) || 0;
    net += p;
    if (p >= 0) { gp += p; wins += 1; } else { gl += -p; }
    if (p > best) best = p;
    cum += p; if (cum > peak) peak = cum; ddAbs = Math.max(ddAbs, peak - cum);
  }
  const pf = gl > 0 ? gp / gl : (gp > 0 ? 3 : 0);
  const winRate = Math.round((wins / n) * 100);
  const ddPct = peak > 0 ? Math.round((ddAbs / peak) * 1000) / 10 : 0;
  const times = rows.map((t: any) => new Date(t.close_time).getTime()).filter(Boolean);
  const days = times.length ? Math.max(1, Math.round((Math.max(...times) - Math.min(...times)) / 86400000)) : 0;
  const concentration = gp > 0 ? Math.round((best / gp) * 100) : 100;
  const live = startBal > 0 && net !== 0;

  // Componentes del score (cada uno con su tope).
  const cap = (x: number, max: number) => Math.max(0, Math.min(max, x));
  const pTrades = cap((n / MIN_TRADES) * 25, 25);
  const pDays = cap((days / MIN_DAYS) * 20, 20);
  const pPf = pf >= GOOD_PF ? 20 : pf >= 1 ? cap(((pf - 1) / (GOOD_PF - 1)) * 20, 20) : 0;
  const pDd = ddPct <= MAX_DD ? 15 : cap(15 - (ddPct - MAX_DD), 15);
  const pConc = concentration <= 25 ? 10 : cap(10 - (concentration - 25) / 5, 10);
  const pLive = live ? 10 : 0;

  const flags: string[] = [...textFlgs];
  if (n < MIN_TRADES) flags.push(`pocas operaciones (${n})`);
  if (days < MIN_DAYS) flags.push(`poco tiempo (${days} d)`);
  if (pf < 1) flags.push('sin ganancia (PF < 1)');
  if (ddPct > MAX_DD) flags.push(`drawdown alto (${ddPct}%)`);
  if (concentration > 40) flags.push('depende de pocos trades');

  let score = Math.round(pTrades + pDays + pPf + pDd + pConc + pLive);
  if (textFlgs.length) score = Math.min(score, 35); // texto deshonesto ⇒ tope bajo
  score = Math.max(0, Math.min(100, score));
  const verdict: BotScore['verdict'] = score >= 70 && !textFlgs.length ? 'approve' : score >= 45 ? 'review' : 'reject';

  return {
    hasData: true, score, verdict, trades: n, days, pf: Math.round(pf * 100) / 100, winRate, ddPct, netProfit: Math.round(net), live, concentration,
    parts: [
      { k: 'Muestra', v: Math.round(pTrades), max: 25, note: `${n} ops` },
      { k: 'Tiempo', v: Math.round(pDays), max: 20, note: `${days} d` },
      { k: 'Profit factor', v: Math.round(pPf), max: 20, note: `PF ${Math.round(pf * 100) / 100}` },
      { k: 'Drawdown', v: Math.round(pDd), max: 15, note: `${ddPct}%` },
      { k: 'Consistencia', v: Math.round(pConc), max: 10, note: `${concentration}% top` },
      { k: 'Cuenta real', v: Math.round(pLive), max: 10, note: live ? 'sí' : 'no' },
    ],
    flags,
  };
}
