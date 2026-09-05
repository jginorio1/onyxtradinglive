import crypto from 'crypto';

// Token secreto que va en la URL del webhook de TradingView. No es la clave
// del EA: si se filtra, solo permite mandar señales (con tope de lote y lista
// blanca), y se puede rotar con un clic desde el panel.
export const newTvToken = () => 'tv_' + crypto.randomBytes(20).toString('hex');

export type TvSignal = {
  action: 'open' | 'close';
  side: 'buy' | 'sell';
  symbol: string;
  lots: number;
  sl: number | null;
  tp: number | null;
};

// Interpreta el cuerpo de una alerta de TradingView. Acepta varias formas
// comunes para que el usuario pueda pegar casi cualquier plantilla:
//   { "action":"buy", "symbol":"EURUSD", "lots":0.10, "sl":0, "tp":0 }
//   { "side":"sell", "ticker":"XAUUSD", "qty":0.05 }
//   { "action":"close", "symbol":"EURUSD" }
export function parseSignal(b: any): TvSignal | null {
  if (!b || typeof b !== 'object') return null;
  const raw = String(b.action ?? b.side ?? b.order ?? b['strategy.order.action'] ?? '').toLowerCase().trim();
  const symbol = String(b.symbol ?? b.ticker ?? b['ticker'] ?? '')
    .toUpperCase().replace(/[^A-Z0-9._]/g, '').trim();
  if (!symbol) return null;

  let action: 'open' | 'close';
  let side: 'buy' | 'sell';
  if (['buy', 'long'].includes(raw)) { action = 'open'; side = 'buy'; }
  else if (['sell', 'short'].includes(raw)) { action = 'open'; side = 'sell'; }
  else if (['close', 'exit', 'flat', 'closeall', 'close_all'].includes(raw)) { action = 'close'; side = 'buy'; }
  else return null;

  const num = (v: any): number | null => {
    if (v == null || v === '') return null;
    const n = Number(v);
    return isFinite(n) ? n : null;
  };
  const lots = num(b.lots ?? b.qty ?? b.volume ?? b.size) ?? 0;
  const sl = num(b.sl ?? b.stop ?? b.stoploss ?? b.stop_loss);
  const tp = num(b.tp ?? b.take ?? b.takeprofit ?? b.take_profit);

  return { action, side, symbol, lots: Math.max(0, lots), sl, tp };
}
