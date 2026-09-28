'use client';
// ============================================================
// IAP (In-App Purchase de Apple) vía RevenueCat — SOLO iOS.
//
// Envoltorio seguro: el paquete @revenuecat/purchases-capacitor se importa de forma
// DINÁMICA y solo cuando corremos dentro de la app de iOS. En la web y en Android
// estas funciones no hacen nada (no rompen el build ni cargan el plugin).
//
// Flujo:
//   1) configureIAP(userId)  → arranca RevenueCat con la clave pública iOS y ata la
//      compra al usuario de Onyx (appUserID = profiles.id). Así el webhook de
//      RevenueCat sabe a quién activarle el plan.
//   2) getIapPlans()         → precios reales de App Store por plan.
//   3) buyPlan(planId)        → lanza la compra nativa de Apple (Face ID / Apple Pay).
//   4) restoreIap()           → restaura compras (obligatorio por Apple).
// El plan se activa en el servidor por el webhook; tras comprar refrescamos la cuenta.
// ============================================================
import { nativePlatform } from '@/lib/native';

let _configured = false;

function iosOnly(): boolean { return nativePlatform() === 'ios'; }

// Carga dinámica del plugin (no existe en web).
async function rc(): Promise<any | null> {
  if (!iosOnly()) return null;
  try { const m = await import('@revenuecat/purchases-capacitor'); return (m as any).Purchases || (m as any).default || null; }
  catch { return null; }
}

// Arranca RevenueCat y ata la compra al usuario de Onyx.
export async function configureIAP(userId: string): Promise<boolean> {
  if (_configured || !iosOnly()) return _configured;
  const apiKey = process.env.NEXT_PUBLIC_REVENUECAT_IOS_KEY || '';
  if (!apiKey) return false;
  const P = await rc(); if (!P) return false;
  try {
    await P.configure({ apiKey, appUserID: userId || undefined });
    if (userId) { try { await P.logIn({ appUserID: userId }); } catch {} }
    _configured = true;
    return true;
  } catch { return false; }
}

export type IapPlan = { planId: string; priceString: string; productId: string; pkg: any };

// Busca en la oferta actual de RevenueCat el paquete de cada plan (por convención,
// el product identifier contiene el id del plan: onyx_pro_month → 'pro').
export async function getIapPlans(planIds: string[]): Promise<IapPlan[]> {
  const P = await rc(); if (!P) return [];
  try {
    const off = await P.getOfferings();
    const pkgs = off?.current?.availablePackages || off?.all?.default?.availablePackages || [];
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
  const P = await rc(); if (!P) return { ok: false, error: 'no_iap' };
  try {
    await P.purchasePackage({ aPackage: pkg });
    return { ok: true };
  } catch (e: any) {
    if (e?.userCancelled || /cancel/i.test(String(e?.message || ''))) return { ok: false, cancelled: true };
    return { ok: false, error: String(e?.message || 'purchase') };
  }
}

// Restaura compras previas (requisito de Apple).
export async function restoreIap(): Promise<boolean> {
  const P = await rc(); if (!P) return false;
  try { await P.restorePurchases(); return true; } catch { return false; }
}
