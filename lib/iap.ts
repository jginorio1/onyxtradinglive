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
import { nativePlatform } from '@/lib/native';

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

export type IapPlan = { planId: string; priceString: string; productId: string; pkg: any };

// Busca en la oferta actual de RevenueCat el paquete de cada plan (por convención,
// el product identifier contiene el id del plan: onyx_pro_month → 'pro').
export async function getIapPlans(planIds: string[]): Promise<IapPlan[]> {
  if (!iosOnly()) return [];
  try {
    const off: any = await Purchases.getOfferings();
    const pkgs: any[] = off?.current?.availablePackages || off?.all?.default?.availablePackages || [];
    const out: IapPlan[] = [];
    for (const id of planIds) {
      const low = id.toLowerCase();
      const pkg = pkgs.find((k: any) => String(k?.product?.identifier || '').toLowerCase().includes(low));
      if (pkg) out.push({ planId: id, priceString: pkg.product?.priceString || '', productId: pkg.product?.identifier || '', pkg });
    }
    return out;
  } catch { return []; }
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
export async function getActiveIapPlan(planIds: string[]): Promise<string> {
  if (!iosOnly()) return '';
  try {
    const info: any = await Purchases.getCustomerInfo();
    const ci: any = info?.customerInfo || info || {};
    const active: string[] = ci?.activeSubscriptions || [];
    const ent: any = ci?.entitlements?.active || {};
    const fromEnt = Object.values(ent).map((e: any) => e?.productIdentifier).filter(Boolean);
    const owned = [...active, ...fromEnt].map((x: any) => String(x).toLowerCase());
    if (!owned.length) return '';
    // Recorremos los planes de mayor a menor rango (los que llegan ordenados) y
    // devolvemos el primero cuyo id aparezca en algún product identifier poseído.
    for (const id of planIds) {
      const low = String(id).toLowerCase();
      if (owned.some((p) => p.includes(low))) return id;
    }
    return '';
  } catch { return ''; }
}

// Restaura compras previas (requisito de Apple).
export async function restoreIap(): Promise<boolean> {
  if (!iosOnly()) return false;
  try { await Purchases.restorePurchases(); return true; } catch { return false; }
}
