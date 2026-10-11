// ============================================================
// Fuente ÚNICA de los planes por defecto + helpers de copy.
//
// Antes cada página (landing, /pricing, keys) tenía su propia lista quemada de
// planes y sus propios textos de "plataformas" y "qué plan incluye Guardian".
// Cuando cambiabas un plan en Admin, esas copias se desincronizaban (p. ej.
// "Onyx Builder" desaparecía o el badge seguía diciendo "Pro y Elite").
//
// Ahora:
//  - DEFAULT_PLANS: el respaldo que se usa SOLO si el API aún no devolvió planes.
//  - guardianBadge(): arma el badge del Guardian leyendo qué planes EN VIVO
//    tienen la capacidad `manager` (Guardian). Nunca se queda viejo.
//  - PLATFORMS / platformsStr(): la lista de plataformas en un solo lugar.
//  - accountsRange(): el rango de cuentas conectables leído de los planes.
// ============================================================

export type DefPlan = {
  id: string; name: string; name_en: string;
  desc_es: string | null; desc_en: string | null;
  price_month: number; price_year: number; max_accounts: number;
  features: string[]; features_en: string[];
  badge: string | null; badge_en: string | null;
  capabilities?: { manager?: boolean; [k: string]: any };
};

// Respaldo mínimo (los 5 planes actuales). Solo se usa si el API no respondió.
export const DEFAULT_PLANS: DefPlan[] = [
  { id: 'free', name: 'Free', name_en: 'Free', desc_es: null, desc_en: null, price_month: 0, price_year: 0, max_accounts: 1,
    features: ['1 cuenta conectada', 'Estadísticas básicas', '30 días de historial'],
    features_en: ['1 connected account', 'Basic stats', '30 days of history'], badge: null, badge_en: null,
    capabilities: { manager: false } },
  { id: 'trader', name: 'Onyx Builder', name_en: 'Onyx Builder', desc_es: null, desc_en: null, price_month: 49, price_year: 490, max_accounts: 5,
    features: ['Construye robots ilimitados', '5 cuentas conectadas · MT4 · MT5 · cTrader', 'Gatillos, salidas, riesgo y frenos', 'Reglas de fondeo + candado de activación', 'Filtro de noticias integrado'],
    features_en: ['Build unlimited robots', '5 connected accounts · MT4 · MT5 · cTrader', 'Triggers, exits, risk & brakes', 'Firm rules + activation lock', 'Built-in news filter'], badge: null, badge_en: null,
    capabilities: { manager: false } },
  { id: 'pro', name: 'Guardian Pro', name_en: 'Guardian Pro', desc_es: null, desc_en: null, price_month: 19, price_year: 190, max_accounts: 5,
    features: ['5 cuentas conectadas', 'Onyx Guardian: freno de riesgo', 'Historial ilimitado y reglas de fondeo', 'Diario, costes y exportar CSV', 'Crea tu academia (Onyx Academy)'],
    features_en: ['5 connected accounts', 'Onyx Guardian: risk brake', 'Unlimited history & funding rules', 'Journal, costs & CSV export', 'Build your academy (Onyx Academy)'], badge: 'Más popular', badge_en: 'Most popular',
    capabilities: { manager: true } },
  { id: 'elite', name: 'Guardian Elite', name_en: 'Guardian Elite', desc_es: null, desc_en: null, price_month: 79, price_year: 790, max_accounts: 999,
    features: ['Cuentas ilimitadas', 'Copy trading (1 master · 5 esclavas)', 'Cierres parciales y bloqueo por noticias', 'Alertas e informe por Telegram', 'Soporte prioritario'],
    features_en: ['Unlimited accounts', 'Copy trading (1 master · 5 slaves)', 'Partial closes & news blackout', 'Telegram alerts & report', 'Priority support'], badge: null, badge_en: null,
    capabilities: { manager: true } },
  { id: 'black', name: 'Black Onyx', name_en: 'Black Onyx', desc_es: null, desc_en: null, price_month: 199, price_year: 1990, max_accounts: 999,
    features: ['Copy trading ilimitado (masters y esclavas)', 'Todo sin límites', 'Soporte prioritario'],
    features_en: ['Unlimited copy trading (masters & slaves)', 'Everything with no limits', 'Priority support'], badge: null, badge_en: null,
    capabilities: { manager: true } },
];

// Lista canónica de plataformas soportadas (un solo lugar).
export const PLATFORMS = ['MT4', 'MT5', 'cTrader', 'MatchTrader', 'TradeLocker', 'DXtrade'];

// Une una lista con comas y "y"/"&" antes del último elemento.
function joinList(items: string[], lang: 'es' | 'en'): string {
  const arr = items.filter(Boolean);
  if (arr.length === 0) return '';
  if (arr.length === 1) return arr[0];
  const last = arr[arr.length - 1];
  const sep = lang === 'es' ? ' y ' : ' & ';
  return arr.slice(0, -1).join(', ') + sep + last;
}

// "MT4, MT5, cTrader, MatchTrader, TradeLocker y DXtrade".
export function platformsStr(lang: 'es' | 'en'): string {
  return joinList(PLATFORMS, lang);
}

// Nombres de los planes (EN VIVO) que incluyen Guardian (capabilities.manager).
export function guardianPlanNames(plans: any[] | null | undefined, lang: 'es' | 'en'): string[] {
  const list = Array.isArray(plans) && plans.length ? plans : DEFAULT_PLANS;
  return list
    .filter((p) => p?.capabilities?.manager)
    .map((p) => (lang === 'es' ? (p.name || p.name_en) : (p.name_en || p.name)))
    .filter(Boolean);
}

// Badge del Guardian: "Módulo activo · Guardian Pro, Guardian Elite y Black Onyx".
export function guardianBadge(plans: any[] | null | undefined, lang: 'es' | 'en'): string {
  const names = guardianPlanNames(plans, lang);
  const head = lang === 'es' ? 'Módulo activo · ' : 'Live module · ';
  if (!names.length) return lang === 'es' ? 'Módulo activo' : 'Live module';
  return head + joinList(names, lang);
}

// Rango de cuentas conectables: "desde 1 cuenta en el plan gratis hasta ilimitadas".
export function accountsRange(plans: any[] | null | undefined, lang: 'es' | 'en'): string {
  const list = Array.isArray(plans) && plans.length ? plans : DEFAULT_PLANS;
  const nums = list.map((p) => Number(p.max_accounts) || 0).filter((n) => n > 0);
  const min = nums.length ? Math.min(...nums) : 1;
  const max = nums.length ? Math.max(...nums) : 1;
  const unlimited = max >= 999;
  if (lang === 'es') {
    return `desde ${min} ${min === 1 ? 'cuenta' : 'cuentas'} en el plan gratis hasta ${unlimited ? 'cuentas ilimitadas' : max + ' cuentas'}`;
  }
  return `from ${min} ${min === 1 ? 'account' : 'accounts'} on Free up to ${unlimited ? 'unlimited accounts' : max + ' accounts'}`;
}
