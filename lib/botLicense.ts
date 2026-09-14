import { supabaseAdmin } from '@/lib/supabaseAdmin';

// ============================================================
// Onyx Bot Lab · candado de LICENCIA para robots vendidos.
// El robot construido pide permiso a /api/v1/activate antes de operar.
// Si su magic corresponde a un producto del marketplace, el comprador debe
// tener una licencia ACTIVA y AL DÍA. Si deja de pagar, se le niega y el bot
// se detiene solo. El creador siempre puede correr su propio robot.
// ============================================================

export type LicenseCheck = {
  gated: boolean;                 // ¿este robot es un producto vendido?
  allowed: boolean;               // ¿puede operar?
  reason?: string;                // no_license | expired | past_due | canceled
  productId?: string;
  until?: string | null;          // vigencia
};

export async function licenseForMagic(runnerUserId: string, magic: number): Promise<LicenseCheck> {
  if (!magic || !runnerUserId) return { gated: false, allowed: true };
  // ¿Hay un producto del marketplace ligado a este magic?
  const { data: prod } = await supabaseAdmin
    .from('bot_products').select('id,seller_id').eq('bot_magic', magic).limit(1).maybeSingle();
  if (!prod) return { gated: false, allowed: true }; // robot personal (no está a la venta) → libre

  // El creador siempre puede correr su propio robot.
  if ((prod as any).seller_id && (prod as any).seller_id === runnerUserId) {
    return { gated: true, allowed: true, productId: (prod as any).id };
  }

  // El comprador necesita licencia activa y no vencida.
  const { data: lic } = await supabaseAdmin
    .from('bot_purchases').select('status,current_period_end')
    .eq('buyer_id', runnerUserId).eq('product_id', (prod as any).id).maybeSingle();
  if (!lic) return { gated: true, allowed: false, reason: 'no_license', productId: (prod as any).id };

  const end = (lic as any).current_period_end;
  const notExpired = !end || new Date(end).getTime() > Date.now();
  if ((lic as any).status === 'active' && notExpired) {
    return { gated: true, allowed: true, productId: (prod as any).id, until: end };
  }
  const reason = !notExpired ? 'expired' : ((lic as any).status || 'inactive');
  return { gated: true, allowed: false, reason, productId: (prod as any).id, until: end };
}

// Marca VENCIDAS las suscripciones cuya vigencia ya pasó (cron diario).
// Cubre USDT mensual y cualquier licencia que Stripe no haya renovado.
export async function expireLapsedLicenses(): Promise<number> {
  const now = new Date().toISOString();
  const { data } = await supabaseAdmin
    .from('bot_purchases').update({ status: 'expired' })
    .eq('kind', 'subscription').eq('status', 'active').lt('current_period_end', now).select('id');
  return (data || []).length;
}
