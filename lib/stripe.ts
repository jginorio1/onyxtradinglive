import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2024-06-20',
});

// Devuelve el Price ID de Stripe de un plan, leyéndolo de la tabla `plans`.
// annual=true usa el precio anual si está configurado.
export async function priceIdForPlan(planId: string, annual = false): Promise<string> {
  const { data } = await supabaseAdmin
    .from('plans')
    .select('stripe_price_id, stripe_price_id_year')
    .eq('id', planId)
    .single();
  if (!data) return '';
  return (annual ? data.stripe_price_id_year : data.stripe_price_id) || '';
}

// Dado un priceId de Stripe, devuelve el id del plan (para el webhook).
export async function planFromPriceId(priceId?: string): Promise<string> {
  if (!priceId) return 'free';
  const { data } = await supabaseAdmin
    .from('plans')
    .select('id')
    .or(`stripe_price_id.eq.${priceId},stripe_price_id_year.eq.${priceId}`)
    .maybeSingle();
  return data?.id || 'free';
}
