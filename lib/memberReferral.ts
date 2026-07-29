import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { memberReferralSettings } from '@/lib/settings';
import { stripe } from '@/lib/stripe';
import { notify } from '@/lib/notify';

// ============================================================
// "Invita y gana" — referidos del usuario común. Recompensa en CRÉDITO de cuenta
// (Stripe customer balance), no en efectivo. Se paga solo cuando el amigo pasa
// su primer pago y supera la ventana anti-reembolso. Convive con Embajadores.
// ============================================================

const MONTH = 30 * 864e5;

// Devuelve (creando si hace falta) el código de referido del usuario.
export async function ensureRefCode(userId: string): Promise<string> {
  const { data: prof } = await supabaseAdmin.from('profiles').select('ref_code').eq('id', userId).maybeSingle();
  if ((prof as any)?.ref_code) return (prof as any).ref_code;
  for (let i = 0; i < 5; i++) {
    const code = 'x' + crypto.randomBytes(4).toString('hex'); // 9 chars, no colisiona con embajadores
    const { error } = await supabaseAdmin.from('profiles').update({ ref_code: code }).eq('id', userId);
    if (!error) return code;
  }
  return 'x' + userId.slice(0, 8);
}

// Ata a un usuario recién llegado con el MIEMBRO que lo invitó (por su ref_code).
// Solo si aún no está atribuido (ni a embajador ni a otro miembro) y no es él mismo.
export async function linkMemberByCode(userId: string, code: string): Promise<boolean> {
  try {
    const c = String(code || '').toLowerCase();
    if (!c) return false;
    const { data: me } = await supabaseAdmin.from('profiles').select('member_ref_by,referred_by').eq('id', userId).maybeSingle();
    if ((me as any)?.member_ref_by || (me as any)?.referred_by) return false;   // ya atribuido
    const { data: ref } = await supabaseAdmin.from('profiles').select('id').eq('ref_code', c).maybeSingle();
    if (!ref || ref.id === userId) return false;
    await supabaseAdmin.from('profiles').update({ member_ref_by: ref.id }).eq('id', userId);
    return true;
  } catch { return false; }
}

// Al primer pago del amigo: crea las recompensas pendientes (una por beneficiario).
// Idempotente por el índice único (referred_id, kind).
export async function qualifyOnPaid(invoice: any) {
  try {
    const s = await memberReferralSettings();
    if (!s.enabled) return;

    const { data: prof } = await supabaseAdmin.from('profiles')
      .select('id,email,member_ref_by').eq('stripe_customer_id', invoice.customer).maybeSingle();
    if (!prof || !(prof as any).member_ref_by) return;
    const referrerId = (prof as any).member_ref_by;
    if (referrerId === prof.id) return;

    // ¿ya se recompensó a este referido? (solo su primer pago cuenta)
    const { data: existing } = await supabaseAdmin.from('member_rewards').select('id').eq('referred_id', prof.id).limit(1);
    if (existing && existing.length) return;

    // Topes anti-abuso del invitador
    if (s.max_lifetime > 0) {
      const { count } = await supabaseAdmin.from('member_rewards').select('*', { count: 'exact', head: true }).eq('beneficiary', referrerId).eq('kind', 'referrer');
      if ((count || 0) >= s.max_lifetime) return;
    }
    if (s.max_per_month > 0) {
      const from = new Date(Date.now() - MONTH).toISOString();
      const { count } = await supabaseAdmin.from('member_rewards').select('*', { count: 'exact', head: true }).eq('beneficiary', referrerId).eq('kind', 'referrer').gte('created_at', from);
      if ((count || 0) >= s.max_per_month) return;
    }

    const currency = (invoice.currency || 'usd').toUpperCase();
    const availableAt = new Date(Date.now() + (s.hold_days || 21) * 864e5).toISOString();
    const rows: any[] = [];
    if (Number(s.referrer_credit) > 0) rows.push({ referrer_id: referrerId, referred_id: prof.id, beneficiary: referrerId, kind: 'referrer', invoice_id: invoice.id, amount: Number(s.referrer_credit), currency, available_at: availableAt });
    if (Number(s.friend_credit) > 0) rows.push({ referrer_id: referrerId, referred_id: prof.id, beneficiary: prof.id, kind: 'friend', invoice_id: invoice.id, amount: Number(s.friend_credit), currency, available_at: availableAt });
    if (!rows.length) return;
    await supabaseAdmin.from('member_rewards').insert(rows);

    // Aviso al invitador + puente a Embajador si llega al umbral.
    const { count: qualified } = await supabaseAdmin.from('member_rewards').select('*', { count: 'exact', head: true }).eq('referrer_id', referrerId).eq('kind', 'referrer');
    const q = qualified || 0;
    await notify(referrerId, { kind: 'info', title: '🎉 ¡Ganaste crédito por un referido!', body: `Tu amigo se suscribió. Tu crédito se aplica en unos días.`, url: '/account#referidos' });
    if (s.bridge_threshold > 0 && q === s.bridge_threshold) {
      await notify(referrerId, { kind: 'info', title: '🚀 Puedes hacerte Embajador', body: `Ya trajiste ${q} amigos. Sube a comisión en efectivo recurrente.`, url: '/embajadores' });
    }
  } catch { /* silencioso */ }
}

// Reembolso: anula las recompensas de esa factura si aún no se aplicaron.
export async function reverseMemberRewards(invoiceId: string) {
  if (!invoiceId) return;
  try { await supabaseAdmin.from('member_rewards').update({ status: 'reversed' }).eq('invoice_id', invoiceId).eq('status', 'pending'); } catch {}
}

// Cron: aplica el crédito (customer balance) de las recompensas ya vencidas.
export async function applyDueRewards(): Promise<{ applied: number }> {
  let applied = 0;
  try {
    const { data: due } = await supabaseAdmin.from('member_rewards')
      .select('id,beneficiary,amount,currency').eq('status', 'pending').lte('available_at', new Date().toISOString()).limit(200);
    for (const r of (due || []) as any[]) {
      const { data: p } = await supabaseAdmin.from('profiles').select('stripe_customer_id').eq('id', r.beneficiary).maybeSingle();
      const cust = (p as any)?.stripe_customer_id;
      if (!cust) continue;   // aún sin cliente en Stripe: el crédito espera a que tenga uno
      try {
        await stripe.customers.createBalanceTransaction(cust, {
          amount: -Math.round(Number(r.amount) * 100),   // negativo = crédito a favor del cliente
          currency: String(r.currency || 'usd').toLowerCase(),
          description: 'Onyx · crédito por referido',
        } as any);
        await supabaseAdmin.from('member_rewards').update({ status: 'applied', applied_at: new Date().toISOString() }).eq('id', r.id);
        applied++;
      } catch { /* reintenta en la próxima pasada */ }
    }
  } catch {}
  return { applied };
}
