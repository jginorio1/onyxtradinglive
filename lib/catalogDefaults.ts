// Catálogos editables desde el panel admin: países, plataformas, tipos de trader
// y prop firms / brokers. Se guardan en app_settings (clave catalog_<kind>) como
// { items: [{ code, es, en }] }. Si no hay nada guardado, se usan estos por defecto.
import { COUNTRIES } from '@/app/components/countries';

export type CatalogItem = { code: string; es: string; en: string };
export type CatalogKind = 'country' | 'platform' | 'trader_type' | 'firm';
export const CATALOG_KINDS: CatalogKind[] = ['country', 'platform', 'trader_type', 'firm'];

export const CATALOG_LABEL: Record<CatalogKind, { es: string; en: string }> = {
  country: { es: 'Países', en: 'Countries' },
  platform: { es: 'Plataformas', en: 'Platforms' },
  trader_type: { es: 'Tipos de trader', en: 'Trader types' },
  firm: { es: 'Prop firms / brokers', en: 'Prop firms / brokers' },
};

const PLATFORMS: CatalogItem[] = [
  { code: 'mt5', es: 'MetaTrader 5', en: 'MetaTrader 5' },
  { code: 'mt4', es: 'MetaTrader 4', en: 'MetaTrader 4' },
  { code: 'ctrader', es: 'cTrader', en: 'cTrader' },
  { code: 'matchtrader', es: 'MatchTrader', en: 'MatchTrader' },
];

const TRADER_TYPES: CatalogItem[] = [
  { code: 'scalping', es: 'Scalping', en: 'Scalping' },
  { code: 'day', es: 'Day trading', en: 'Day trading' },
  { code: 'swing', es: 'Swing', en: 'Swing' },
  { code: 'position', es: 'Position', en: 'Position' },
  { code: 'algo', es: 'Trader algorítmico (bots)', en: 'Algo trader (bots)' },
];

const FIRMS: CatalogItem[] = [
  'FTMO', 'The5ers', 'FundingPips', 'FundedNext', 'Alpha Capital', 'MyFundedFX', 'E8 Markets',
  'Funded Trading Plus', 'Blue Guardian', 'Goat Funded Trader', 'Maven', 'Apex Trader Funding',
  'OANDA', 'Axi', 'IC Markets', 'Pepperstone', 'Exness', 'XM', 'FxPro', 'Vantage', 'Tickmill',
  'Admiral Markets', 'Darwinex', 'RoboForex', 'Eightcap', 'ThinkMarkets',
].map((n) => ({ code: n.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''), es: n, en: n }));

const COUNTRY_ITEMS: CatalogItem[] = COUNTRIES.map((c) => ({ code: c[0], es: c[1], en: c[1] }));

export const CATALOG_DEFAULTS: Record<CatalogKind, CatalogItem[]> = {
  country: COUNTRY_ITEMS,
  platform: PLATFORMS,
  trader_type: TRADER_TYPES,
  firm: FIRMS,
};

export function catalogKey(kind: string) { return 'catalog_' + kind; }
export function isCatalogKind(k: any): k is CatalogKind { return CATALOG_KINDS.includes(k); }
