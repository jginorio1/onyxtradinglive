// ============================================================
// Onyx · Catálogo de instrumentos para el constructor
// Símbolo canónico + nombre + categoría. El EA encuentra el símbolo aunque el
// bróker use otro sufijo (GOLD, XAUUSD.m, etc.), así que estos son nombres guía.
// Categorías: forex_major | forex_minor | forex_exotic | metal | index | energy | crypto
// ============================================================
export type InstrCat = 'forex_major' | 'forex_minor' | 'forex_exotic' | 'metal' | 'index' | 'energy' | 'crypto';
export type Instrument = { sym: string; es: string; en: string; cat: InstrCat };

export const CAT_LABELS: Record<InstrCat, { es: string; en: string; group: 'forex' | 'metal' | 'index' | 'energy' | 'crypto' }> = {
  forex_major: { es: 'Forex · mayores', en: 'Forex · majors', group: 'forex' },
  forex_minor: { es: 'Forex · menores', en: 'Forex · minors', group: 'forex' },
  forex_exotic: { es: 'Forex · exóticos', en: 'Forex · exotics', group: 'forex' },
  metal: { es: 'Metales', en: 'Metals', group: 'metal' },
  index: { es: 'Índices', en: 'Indices', group: 'index' },
  energy: { es: 'Energía', en: 'Energy', group: 'energy' },
  crypto: { es: 'Cripto', en: 'Crypto', group: 'crypto' },
};

// Grupos para los chips (Todos + estos).
export const INSTR_GROUPS: { key: 'forex' | 'metal' | 'index' | 'energy' | 'crypto'; es: string; en: string }[] = [
  { key: 'forex', es: 'Forex', en: 'Forex' },
  { key: 'metal', es: 'Metales', en: 'Metals' },
  { key: 'index', es: 'Índices', en: 'Indices' },
  { key: 'energy', es: 'Energía', en: 'Energy' },
  { key: 'crypto', es: 'Cripto', en: 'Crypto' },
];

const F = (sym: string, es: string, en: string, cat: InstrCat): Instrument => ({ sym, es, en, cat });

export const INSTRUMENTS: Instrument[] = [
  // ---- Metales ----
  F('XAUUSD', 'Oro / dólar', 'Gold / USD', 'metal'),
  F('XAGUSD', 'Plata / dólar', 'Silver / USD', 'metal'),
  F('XPTUSD', 'Platino / dólar', 'Platinum / USD', 'metal'),
  F('XPDUSD', 'Paladio / dólar', 'Palladium / USD', 'metal'),
  F('XAUEUR', 'Oro / euro', 'Gold / EUR', 'metal'),
  F('XAUGBP', 'Oro / libra', 'Gold / GBP', 'metal'),
  F('XAUAUD', 'Oro / dólar australiano', 'Gold / AUD', 'metal'),
  F('COPPER', 'Cobre', 'Copper', 'metal'),
  // ---- Forex mayores ----
  F('EURUSD', 'Euro / dólar', 'Euro / USD', 'forex_major'),
  F('GBPUSD', 'Libra / dólar', 'Pound / USD', 'forex_major'),
  F('USDJPY', 'Dólar / yen', 'USD / Yen', 'forex_major'),
  F('USDCHF', 'Dólar / franco suizo', 'USD / Swiss franc', 'forex_major'),
  F('AUDUSD', 'Dólar australiano / dólar', 'AUD / USD', 'forex_major'),
  F('USDCAD', 'Dólar / dólar canadiense', 'USD / CAD', 'forex_major'),
  F('NZDUSD', 'Dólar neozelandés / dólar', 'NZD / USD', 'forex_major'),
  // ---- Forex menores (cruces) ----
  F('EURGBP', 'Euro / libra', 'Euro / Pound', 'forex_minor'),
  F('EURJPY', 'Euro / yen', 'Euro / Yen', 'forex_minor'),
  F('GBPJPY', 'Libra / yen', 'Pound / Yen', 'forex_minor'),
  F('EURCHF', 'Euro / franco', 'Euro / Franc', 'forex_minor'),
  F('EURAUD', 'Euro / dólar australiano', 'Euro / AUD', 'forex_minor'),
  F('EURCAD', 'Euro / dólar canadiense', 'Euro / CAD', 'forex_minor'),
  F('EURNZD', 'Euro / dólar neozelandés', 'Euro / NZD', 'forex_minor'),
  F('GBPCHF', 'Libra / franco', 'Pound / Franc', 'forex_minor'),
  F('GBPAUD', 'Libra / dólar australiano', 'Pound / AUD', 'forex_minor'),
  F('GBPCAD', 'Libra / dólar canadiense', 'Pound / CAD', 'forex_minor'),
  F('GBPNZD', 'Libra / dólar neozelandés', 'Pound / NZD', 'forex_minor'),
  F('AUDJPY', 'Dólar australiano / yen', 'AUD / Yen', 'forex_minor'),
  F('AUDCAD', 'Dólar australiano / canadiense', 'AUD / CAD', 'forex_minor'),
  F('AUDCHF', 'Dólar australiano / franco', 'AUD / Franc', 'forex_minor'),
  F('AUDNZD', 'Dólar australiano / neozelandés', 'AUD / NZD', 'forex_minor'),
  F('CADJPY', 'Dólar canadiense / yen', 'CAD / Yen', 'forex_minor'),
  F('CADCHF', 'Dólar canadiense / franco', 'CAD / Franc', 'forex_minor'),
  F('CHFJPY', 'Franco / yen', 'Franc / Yen', 'forex_minor'),
  F('NZDJPY', 'Dólar neozelandés / yen', 'NZD / Yen', 'forex_minor'),
  F('NZDCAD', 'Dólar neozelandés / canadiense', 'NZD / CAD', 'forex_minor'),
  F('NZDCHF', 'Dólar neozelandés / franco', 'NZD / Franc', 'forex_minor'),
  // ---- Forex exóticos ----
  F('USDMXN', 'Dólar / peso mexicano', 'USD / Mexican peso', 'forex_exotic'),
  F('USDZAR', 'Dólar / rand sudafricano', 'USD / South African rand', 'forex_exotic'),
  F('USDTRY', 'Dólar / lira turca', 'USD / Turkish lira', 'forex_exotic'),
  F('USDSEK', 'Dólar / corona sueca', 'USD / Swedish krona', 'forex_exotic'),
  F('USDNOK', 'Dólar / corona noruega', 'USD / Norwegian krone', 'forex_exotic'),
  F('USDPLN', 'Dólar / zloty polaco', 'USD / Polish zloty', 'forex_exotic'),
  F('USDHUF', 'Dólar / florín húngaro', 'USD / Hungarian forint', 'forex_exotic'),
  F('USDCZK', 'Dólar / corona checa', 'USD / Czech koruna', 'forex_exotic'),
  F('USDSGD', 'Dólar / dólar de Singapur', 'USD / Singapore dollar', 'forex_exotic'),
  F('USDHKD', 'Dólar / dólar de Hong Kong', 'USD / Hong Kong dollar', 'forex_exotic'),
  F('USDCNH', 'Dólar / yuan', 'USD / Chinese yuan', 'forex_exotic'),
  F('USDDKK', 'Dólar / corona danesa', 'USD / Danish krone', 'forex_exotic'),
  F('EURTRY', 'Euro / lira turca', 'Euro / Turkish lira', 'forex_exotic'),
  F('EURPLN', 'Euro / zloty', 'Euro / Polish zloty', 'forex_exotic'),
  F('EURSEK', 'Euro / corona sueca', 'Euro / Swedish krona', 'forex_exotic'),
  F('EURNOK', 'Euro / corona noruega', 'Euro / Norwegian krone', 'forex_exotic'),
  F('GBPSEK', 'Libra / corona sueca', 'Pound / Swedish krona', 'forex_exotic'),
  // ---- Índices ----
  F('US30', 'Dow Jones · EE. UU.', 'Dow Jones · US', 'index'),
  F('NAS100', 'Nasdaq 100 · EE. UU.', 'Nasdaq 100 · US', 'index'),
  F('SPX500', 'S&P 500 · EE. UU.', 'S&P 500 · US', 'index'),
  F('US2000', 'Russell 2000 · EE. UU.', 'Russell 2000 · US', 'index'),
  F('GER40', 'DAX 40 · Alemania', 'DAX 40 · Germany', 'index'),
  F('UK100', 'FTSE 100 · Reino Unido', 'FTSE 100 · UK', 'index'),
  F('FRA40', 'CAC 40 · Francia', 'CAC 40 · France', 'index'),
  F('EU50', 'Euro Stoxx 50 · Europa', 'Euro Stoxx 50 · Europe', 'index'),
  F('ESP35', 'IBEX 35 · España', 'IBEX 35 · Spain', 'index'),
  F('ITA40', 'FTSE MIB · Italia', 'FTSE MIB · Italy', 'index'),
  F('NED25', 'AEX · Países Bajos', 'AEX · Netherlands', 'index'),
  F('SUI20', 'SMI · Suiza', 'SMI · Switzerland', 'index'),
  F('JP225', 'Nikkei 225 · Japón', 'Nikkei 225 · Japan', 'index'),
  F('HK50', 'Hang Seng · Hong Kong', 'Hang Seng · Hong Kong', 'index'),
  F('AUS200', 'ASX 200 · Australia', 'ASX 200 · Australia', 'index'),
  F('CHINA50', 'China A50 · China', 'China A50 · China', 'index'),
  F('IND50', 'Nifty 50 · India', 'Nifty 50 · India', 'index'),
  F('VIX', 'Índice de volatilidad', 'Volatility index', 'index'),
  // ---- Energía ----
  F('USOIL', 'Petróleo WTI', 'WTI crude oil', 'energy'),
  F('UKOIL', 'Petróleo Brent', 'Brent crude oil', 'energy'),
  F('NATGAS', 'Gas natural', 'Natural gas', 'energy'),
  F('GASOLINE', 'Gasolina', 'Gasoline', 'energy'),
  // ---- Cripto ----
  F('BTCUSD', 'Bitcoin / dólar', 'Bitcoin / USD', 'crypto'),
  F('ETHUSD', 'Ethereum / dólar', 'Ethereum / USD', 'crypto'),
  F('LTCUSD', 'Litecoin / dólar', 'Litecoin / USD', 'crypto'),
  F('XRPUSD', 'XRP / dólar', 'XRP / USD', 'crypto'),
  F('BCHUSD', 'Bitcoin Cash / dólar', 'Bitcoin Cash / USD', 'crypto'),
  F('ADAUSD', 'Cardano / dólar', 'Cardano / USD', 'crypto'),
  F('SOLUSD', 'Solana / dólar', 'Solana / USD', 'crypto'),
  F('DOGEUSD', 'Dogecoin / dólar', 'Dogecoin / USD', 'crypto'),
  F('DOTUSD', 'Polkadot / dólar', 'Polkadot / USD', 'crypto'),
  F('BNBUSD', 'BNB / dólar', 'BNB / USD', 'crypto'),
  F('AVAXUSD', 'Avalanche / dólar', 'Avalanche / USD', 'crypto'),
  F('LINKUSD', 'Chainlink / dólar', 'Chainlink / USD', 'crypto'),
  F('MATICUSD', 'Polygon / dólar', 'Polygon / USD', 'crypto'),
];

// Mercado del Bot Lab a partir del símbolo o su categoría (para prellenar la ficha).
export function marketOf(sym: string): string {
  const it = INSTRUMENTS.find((x) => x.sym === String(sym || '').toUpperCase());
  const cat = it?.cat;
  if (cat === 'metal') return 'oro';
  if (cat === 'index') return 'indices';
  if (cat === 'crypto') return 'cripto';
  if (cat === 'energy') return 'otro';
  if (cat && cat.startsWith('forex')) return 'forex';
  const s = String(sym || '').toUpperCase();
  if (/XAU|XAG|GOLD|SILVER|COPPER|XPT|XPD/.test(s)) return 'oro';
  if (/BTC|ETH|USDT|SOL|XRP|DOGE|ADA/.test(s)) return 'cripto';
  if (/US30|NAS|SPX|GER|UK100|FRA|JP225|HK50|AUS|IDX|US2000/.test(s)) return 'indices';
  if (/OIL|GAS|BRENT|WTI/.test(s)) return 'otro';
  return s ? 'forex' : '';
}

// Búsqueda por símbolo o nombre (ES/EN), opcionalmente filtrada por grupo.
export function searchInstruments(q: string, group?: string): Instrument[] {
  const t = q.trim().toLowerCase();
  return INSTRUMENTS.filter((i) => {
    if (group && group !== 'all' && CAT_LABELS[i.cat].group !== group) return false;
    if (!t) return true;
    return i.sym.toLowerCase().includes(t) || i.es.toLowerCase().includes(t) || i.en.toLowerCase().includes(t);
  });
}
