import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2024-06-20',
});

export const PLANS: Record<string, { name: string; priceId: string; maxAccounts: number }> = {
  pro:   { name: 'Pro',   priceId: process.env.STRIPE_PRICE_PRO   || '', maxAccounts: 5 },
  elite: { name: 'Elite', priceId: process.env.STRIPE_PRICE_ELITE || '', maxAccounts: 999 },
};

// Dado un priceId de Stripe, devuelve el nombre del plan (para el webhook).
export function planFromPriceId(priceId?: string): string {
  if (priceId && priceId === PLANS.pro.priceId) return 'pro';
  if (priceId && priceId === PLANS.elite.priceId) return 'elite';
  return 'free';
}
