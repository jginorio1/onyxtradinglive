'use client';
// ============================================================
// IAP (In-App Purchase de Apple) vía RevenueCat — SOLO iOS.
//
// IMPORTANTE: usamos import ESTÁTICO del plugin (no import() dinámico). El import
// dinámico hace que `Purchases.configure()` se CUELGUE para siempre en Capacitor
// (el proxy del plugin es "thenable" y el await nunca resuelve). Con import estático
// se resuelve bien. En web/Android no llamamos a ningún método (guardas iosOnly),
// así que el import es inofensivo fuera de iOS.
// ============================================================
import { Purchases } from '@revenuecat/purchases-capacitor';
import { nativePlatform, openExternal, isNativeApp } from '@/lib/native';

let _configured = false;

function iosOnly(): boolean { return nativePlatform() === 'ios'; }

// Arranca RevenueCat y ata la compra al usuario de Onyx.
export async function configureIAP(userId: string): Promise<boolean> {
  if (_configured || !iosOnly()) return _configured;
  const apiKey = process.env.NEXT_PUBLIC_REVENUECAT_IOS_KEY || '';
  if (!apiKey) return false;
  try {
    await Purchases.configure({ apiKey, appUserID: userId || undefined });
    if (userId) { try { await Purchases.logIn({ appUserID: userId }); } catch {} }
    _configured = true;
    return true;
  } catch { return false; }
}

// intro = oferta introductoria del producto (la PRUEBA GRATIS, si existe). La lee
// RevenueCat/StoreKit del propio producto; freeTrial=true cuando el precio es 0.
export type IapIntro = { freeTrial: boolean; priceString: string; units: number; unit: string };
export type IapPlan = { planId: string; priceString: string; productId: string; pkg: any; intro?: IapIntro | null };

// Extrae la oferta introductoria de un producto de RevenueCat, tolerando las
// distintas formas del SDK (introPrice clásico, o defaultOption/subscriptionOptions
// en versiones nuevas con Google Play). Devuelve null si no hay prueba.
function readIntro(product: any): IapIntro | null {
  try {
    // 1) Forma clásica: product.introPrice { price, priceString, periodUnit, periodNumberOfUnits }
    const ip = product?.introPrice;
    if (ip && (Number(ip.price) === 0 || /free|gratis|0[.,]00/i.test(String(ip.priceString || '')))) {
      return { freeTrial: true, priceString: String(ip.priceString || ''), units: Number(ip.periodNumberOfUnits) || Number(ip.cycles) || 1, unit: String(ip.periodUnit || ip.period || 'DAY').toUpperCase() };
    }
    // 2) Forma nueva (subscriptionOptions): busca una fase gratis.
    const opt = product?.defaultOption || (Array.isArray(product?.subscriptionOptions) ? product.subscriptionOptions[0] : null);
    const free = opt?.freePhase || (Array.isArray(opt?.pricingPhases) ? opt.pricingPhases.find((p: any) => Number(p?.price?.amountMicros) === 0 || Number(p?.price) === 0) : null);
    if (free) {
      const per = free.billingPeriod || free.period || {};
      return { freeTrial: true, priceString: '', units: Number(per.value) || Number(free.billingCycleCount) || 1, unit: String(per.unit || 'DAY').toUpperCase() };
    }
  } catch {}
  return null;
}

// Un plan a emparejar: su id, y palabras clave alternativas (p. ej. del nombre) por si
// el product identifier no contiene el id interno. Ej: plan id 'trader' con nombre
// "Onyx Builder" → el producto se llama onyx_builder_month (contiene 'builder', no 'trader').
export type PlanMatch = { id: string; aliases?: string[]; price?: number };

// Palabras demasiado genéricas que NO sirven para distinguir un plan de otro.
const GENERIC = new Set(['onyx', 'plan', 'guardian', 'the', 'de', 'el', 'la', 'monthly', 'mensual', 'month', 'mes']);

// Junta TODOS los paquetes de TODAS las offerings de RevenueCat (no solo la "current"),
// por si un producto (p. ej. Builder) quedó adjunto a otra offering. Deduplica por id.
function allPackages(off: any): any[] {
  const buckets: any[] = [];
  if (off?.current?.availablePackages) buckets.push(off.current.availablePackages);
  const all = off?.all || {};
  for (const key of Object.keys(all)) if (all[key]?.availablePackages) buckets.push(all[key].availablePackages);
  const seen = new Set<string>(); const out: any[] = [];
  for (const b of buckets) for (const k of b) {
    const id = String(k?.product?.identifier || '');
    if (id && !seen.has(id)) { seen.add(id); out.push(k); }
  }
  return out;
}

// Empareja un plan con su paquete de RevenueCat. 1º por id/alias en el identifier;
// 2º (último recurso) por precio ≈ price_month, por si el identifier es un SKU raro
// (ej. 'sku_49') que no contiene ninguna palabra del plan.
function matchPkg(pkgs: any[], m: PlanMatch): any {
  const tokens = [m.id, ...(m.aliases || [])]
    .map((s) => String(s || '').toLowerCase().trim())
    .filter((s) => s && !GENERIC.has(s));
  let best: any = null; let bestLen = Infinity;
  for (const k of pkgs) {
    const idf = String(k?.product?.identifier || '').toLowerCase();
    if (!idf) continue;
    if (tokens.some((tok) => idf.includes(tok)) && idf.length < bestLen) { best = k; bestLen = idf.length; }
  }
  if (best) return best;
  // Fallback por precio: el más cercano dentro de ±1.5 USD del precio del plan.
  if (m.price && m.price > 0) {
    let pick: any = null; let bestDiff = 1.5;
    for (const k of pkgs) {
      const price = Number(k?.product?.price);
      if (!price) continue;
      const diff = Math.abs(price - m.price);
      if (diff <= bestDiff) { pick = k; bestDiff = diff; }
    }
    if (pick) return pick;
  }
  return null;
}

// Busca en la oferta de RevenueCat el paquete de cada plan. StoreKit a veces devuelve
// la oferta incompleta (o vacía) en los primeros milisegundos tras arrancar, así que
// reintentamos hasta tener TODOS los planes pedidos o agotar los intentos. Acepta ids
// sueltos o {id, aliases, price} para casos donde el producto no lleva el id interno.
export async function getIapPlans(plans: Array<string | PlanMatch>, tries = 6, delayMs = 700): Promise<IapPlan[]> {
  if (!iosOnly()) return [];
  const list: PlanMatch[] = plans.map((p) => (typeof p === 'string' ? { id: p } : p));
  let best: IapPlan[] = [];
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      const off: any = await Purchases.getOfferings();
      const pkgs: any[] = allPackages(off);
      const out: IapPlan[] = [];
      const used = new Set<string>();
      for (const m of list) {
        const pkg = matchPkg(pkgs.filter((k: any) => !used.has(String(k?.product?.identifier || ''))), m);
        if (pkg) { used.add(String(pkg.product?.identifier || '')); out.push({ planId: m.id, priceString: pkg.product?.priceString || '', productId: pkg.product?.identifier || '', pkg, intro: readIntro(pkg.product) }); }
      }
      if (out.length > best.length) best = out;          // nos quedamos con la corrida más completa
      if (best.length >= list.length) return best;       // ya están todos → listo
    } catch {}
    if (attempt < tries - 1) await new Promise((r) => setTimeout(r, delayMs));
  }
  return best;
}

// Lanza la compra nativa de Apple del paquete indicado.
export async function buyPlan(pkg: any): Promise<{ ok: boolean; error?: string; cancelled?: boolean }> {
  if (!iosOnly()) return { ok: false, error: 'no_ios' };
  try {
    await Purchases.purchasePackage({ aPackage: pkg });
    return { ok: true };
  } catch (e: any) {
    if (e?.userCancelled || /cancel/i.test(String(e?.message || ''))) return { ok: false, cancelled: true };
    return { ok: false, error: String(e?.message || 'purchase') };
  }
}

// Devuelve el id del plan ACTIVO según Apple/RevenueCat (lo que el usuario realmente
// posee), sin depender de la base de datos. Sirve para marcar "Tu plan actual" en la
// pantalla de planes de iOS aunque la BD esté desincronizada. Mapea por convención:
// el product identifier contiene el id del plan (onyx_pro_month → 'pro', etc.).
export async function getActiveIapPlan(plans: Array<string | PlanMatch>): Promise<string> {
  if (!iosOnly()) return '';
  try {
    const info: any = await Purchases.getCustomerInfo();
    const ci: any = info?.customerInfo || info || {};
    const active: string[] = ci?.activeSubscriptions || [];
    const ent: any = ci?.entitlements?.active || {};
    const fromEnt = Object.values(ent).map((e: any) => e?.productIdentifier).filter(Boolean);
    const owned = [...active, ...fromEnt].map((x: any) => String(x).toLowerCase());
    if (!owned.length) return '';
    const list: PlanMatch[] = plans.map((p) => (typeof p === 'string' ? { id: p } : p));
    // Recorremos los planes de mayor a menor rango (los que llegan ordenados) y
    // devolvemos el primero cuyo id o alias aparezca en algún product identifier poseído.
    for (const m of list) {
      const tokens = [m.id, ...(m.aliases || [])].map((s) => String(s || '').toLowerCase().trim()).filter((s) => s && !GENERIC.has(s));
      if (owned.some((p) => tokens.some((tok) => p.includes(tok)))) return m.id;
    }
    return '';
  } catch { return ''; }
}

// Restaura compras previas (requisito de Apple).
export async function restoreIap(): Promise<boolean> {
  if (!iosOnly()) return false;
  try { await Purchases.restorePurchases(); return true; } catch { return false; }
}

// Abre la gestión de la suscripción SIN mandar al usuario a Safari.
//
// 1) Intenta la HOJA NATIVA de Apple/RevenueCat DENTRO de la app (showManageSubscriptions):
//    aparece encima de Onyx, muestra SOLO esta suscripción y deja cambiar/cancelar ahí
//    mismo. Si la versión del plugin no expone ese método, no pasa nada (seguimos).
// 2) Respaldo iOS: esquema `itms-apps://` → iOS abre la pantalla de Suscripciones de
//    Ajustes (NATIVA, dentro del teléfono, NUNCA el navegador).
// 3) Respaldo Android/web: la URL de gestión real (Google Play / cuenta de Apple).
export async function manageSubscription(): Promise<void> {
  // 1) Hoja nativa (lo ideal: no sale de la app).
  if (isNativeApp()) {
    try {
      const anyP: any = Purchases as any;
      if (typeof anyP.showManageSubscriptions === 'function') { await anyP.showManageSubscriptions(); return; }
    } catch { /* si falla, caemos al respaldo nativo */ }
  }
  // URL de gestión real (RevenueCat la expone en customerInfo).
  let url = 'https://apps.apple.com/account/subscriptions';
  try {
    const info: any = await Purchases.getCustomerInfo();
    const ci: any = info?.customerInfo || info || {};
    if (ci?.managementURL) url = String(ci.managementURL);
  } catch {}
  // 2) iOS: esquema nativo → Ajustes › Suscripciones (sin Safari).
  if (nativePlatform() === 'ios') {
    try { window.location.href = 'itms-apps://apps.apple.com/account/subscriptions'; return; } catch {}
  }
  // 3) Android (navegador del sistema → Play) / web (pestaña nueva).
  if (isNativeApp()) { if (!openExternal(url)) { try { window.open(url, '_blank'); } catch {} } }
  else { try { window.open(url, '_blank'); } catch { window.location.assign(url); } }
}
