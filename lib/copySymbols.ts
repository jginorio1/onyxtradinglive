// Mapeo inteligente de símbolos para el copy trading.
// El mismo instrumento cambia de nombre entre brokers (EURUSD, EURUSD.sim, EURUSD.m,
// GOLD vs XAUUSD, US100 vs NAS100…). Estas funciones normalizan y resuelven el nombre
// local para que la copia no falle por el nombre. La resolución final la hace la EA
// esclava contra SU Market Watch; esto sirve en el servidor (panel, validación) y la
// misma lógica se replica en MQL.

// Grupos de alias: todos los nombres de una fila son el mismo instrumento.
const ALIAS_GROUPS: string[][] = [
  ['XAUUSD', 'GOLD', 'GOLDUSD'],
  ['XAGUSD', 'SILVER'],
  ['US100', 'NAS100', 'USTEC', 'NDX', 'NAS', 'USTECH'],
  ['US30', 'DOW', 'YM', 'DJ30', 'WS30'],
  ['US500', 'SPX500', 'SP500', 'SPX', 'ES'],
  ['GER40', 'DE40', 'GER30', 'DE30', 'DAX', 'DAX40'],
  ['UK100', 'FTSE100', 'FTSE'],
  ['JP225', 'JPN225', 'NIKKEI', 'NI225'],
  ['USOIL', 'WTI', 'CL', 'OIL', 'CRUDE'],
  ['UKOIL', 'BRENT'],
  ['BTCUSD', 'BTC', 'BITCOIN'],
  ['ETHUSD', 'ETH', 'ETHEREUM'],
];

// Quita sufijos/prefijos comunes y deja el símbolo base en mayúsculas.
// "EURUSD.sim" → "EURUSD" · "#EURUSDm" → "EURUSD" · "EURUSD-ECN" → "EURUSD"
export function normalizeSymbol(raw: string): string {
  let s = (raw || '').toUpperCase().trim();
  s = s.replace(/^[#._-]+/, '');                     // prefijos
  s = s.replace(/[._-][A-Z0-9]{1,6}$/i, (m) =>       // sufijos tipo .SIM .M -ECN _RAW
    /^[._-](PRO|ECN|RAW|STP|CENT|MICRO|SIM|M|C|Z|R|I|E|FX|USD)?$/i.test(m) ? '' : m);
  s = s.replace(/[._\-\s]/g, '');                    // separadores restantes
  return s;
}

// Todos los alias conocidos de un símbolo (incluye el propio, normalizado).
export function aliasesOf(raw: string): string[] {
  const base = normalizeSymbol(raw);
  for (const g of ALIAS_GROUPS) if (g.includes(base)) return Array.from(new Set([base, ...g]));
  return [base];
}

// ¿Son el mismo instrumento a pesar del nombre?
export function sameInstrument(a: string, b: string): boolean {
  const na = normalizeSymbol(a), nb = normalizeSymbol(b);
  if (na === nb) return true;
  const setA = new Set(aliasesOf(a));
  return setA.has(nb) || aliasesOf(b).some((x) => setA.has(x));
}

// Resuelve el nombre real en el broker esclavo. `available` = símbolos de su Market Watch.
// `manualMap` = overrides del enlace (base → nombre exacto). Devuelve null si no hay match
// (entonces la EA NO ejecuta: marca 'skipped' y avisa en el log).
export function resolveLocalSymbol(masterSymbol: string, available: string[], manualMap: Record<string, string> = {}): string | null {
  const base = normalizeSymbol(masterSymbol);
  if (manualMap[base] && available.includes(manualMap[base])) return manualMap[base];
  if (manualMap[masterSymbol.toUpperCase()]) return manualMap[masterSymbol.toUpperCase()];

  // 1) coincidencia exacta
  if (available.includes(masterSymbol)) return masterSymbol;
  // 2) por nombre base normalizado
  let byBase = available.find((s) => normalizeSymbol(s) === base);
  if (byBase) return byBase;
  // 3) por alias del instrumento
  const wanted = new Set(aliasesOf(masterSymbol));
  const byAlias = available.find((s) => wanted.has(normalizeSymbol(s)));
  return byAlias || null;
}
