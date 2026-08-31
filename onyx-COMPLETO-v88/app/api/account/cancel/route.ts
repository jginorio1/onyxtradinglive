import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { stripe } from '@/lib/stripe';
import { retentionSettings } from '@/lib/settings';
import { discountEligibility, recordGrant, penalizeIfAbuse } from '@/lib/retention';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const REASONS = ['price', 'unused', 'missing', 'stopped', 'other'];
const MONTH = 30 * 864e5;

// Meses que lleva pagando (por la fecha de alta de la suscripción en Stripe).
async function tenureMonths(subId?: string | null): Promise<number> {
  if (!subId) return 0;
  try { const sub: any = await stripe.subscriptions.retrieve(subId); return sub?.created ? (Date.now() - sub.created * 1000) / MONTH : 0; } catch { return 0; }
}

async function me() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { user: null as any, prof: null as any };
  const { data: prof } = await supabaseAdmin.from('profiles').select('id,email,plan,stripe_subscription_id,stripe_customer_id').eq('id', user.id).maybeSingle();
  return { user, prof };
}

export async function POST(req: Request) {
  try {
    const { user, prof } = await me();
    if (!user) return NextResponse.json({ error: 'Not signed in.', code: 'no_auth' }, { status: 401 });

    const b = await req.json();
    const s = await retentionSettings();
    const subId = prof?.stripe_subscription_id;

    // 1) Guardar el motivo y devolver las ofertas que le tocan
    if (b.action === 'reason') {
      const reason = REASONS.includes(b.reason) ? b.reason : 'other';
      const { data: row } = await supabaseAdmin.from('cancellations').insert({
        user_id: user.id, email: prof?.email || user.email, plan: prof?.plan || 'free',
        reason, detail: String(b.detail || '').slice(0, 500), outcome: 'pending',
      }).select('id').single();

      // Planes más baratos a los que podría bajar
      let downgrades: any[] = [];
      if (s.allow_downgrade) {
        const { data: plans } = await supabaseAdmin.from('plans').select('id,name,name_en,price_month').eq('active', true).order('sort', { ascending: true });
        const cur = (plans || []).find((p: any) => p.id === prof?.plan);
        downgrades = (plans || []).filter((p: any) => (p.price_month || 0) < (cur?.price_month || 0));
      }
      // ¿Le toca descuento? (antigüedad, cooldown, tope de veces, tope global, bloqueo)
      const discount = subId ? await discountEligibility(user.id, await tenureMonths(subId)) : { eligible: false, percent: 0, months: 0, tier: 0, reason: 'new' as const };
      return NextResponse.json({ ok: true, id: row?.id, settings: s, downgrades, discount });
    }

    if (!subId) return NextResponse.json({ error: 'No active subscription.', code: 'no_sub' }, { status: 400 });

    // 2) Se queda con descuento — SIEMPRE se re-verifica en el servidor (no se
    //    confía en el cliente). Corta el bucle de farmear el descuento.
    if (b.action === 'discount') {
      const elig = await discountEligibility(user.id, await tenureMonths(subId));
      if (!elig.eligible) {
        return NextResponse.json({ error: 'No elegible para descuento ahora.', code: 'not_eligible', reason: elig.reason, nextEligibleAt: elig.nextEligibleAt || null }, { status: 403 });
      }
      // Cupón REUTILIZABLE por combinación %/meses (mismo id → no se acumulan en
      // Stripe). Si no existe todavía, se crea una sola vez; luego se reusa.
      const couponId = `onyx_ret_${elig.percent}p_${elig.months}m`;
      try {
        await stripe.coupons.retrieve(couponId);
      } catch {
        await stripe.coupons.create({
          id: couponId,
          percent_off: elig.percent,
          duration: 'repeating',
          duration_in_months: elig.months,
          name: `Retención Onyx (${elig.percent}% · ${elig.months}m)`,
        } as any);
      }
      await stripe.subscriptions.update(subId, { coupon: couponId } as any);
      await recordGrant(user.id, prof?.email || user.email, elig.tier, elig.percent, elig.months);
      await close(b.id, 'saved_discount', user.id);
      return NextResponse.json({ ok: true, outcome: 'saved_discount', percent: elig.percent, months: elig.months });
    }

    // 3) Se queda pero pausa el cobro
    if (b.action === 'pause') {
      const months = Number(s.pause_months) || 2;
      const resumes = Math.floor((Date.now() + months * 30 * 864e5) / 1000);
      await stripe.subscriptions.update(subId, { pause_collection: { behavior: 'void', resumes_at: resumes } } as any);
      await close(b.id, 'saved_pause', user.id);
      return NextResponse.json({ ok: true, outcome: 'saved_pause', resumes: resumes * 1000 });
    }

    // 4) Baja a un plan más barato
    if (b.action === 'downgrade') {
      const { data: target } = await supabaseAdmin.from('plans').select('id,stripe_price_id,price_month').eq('id', b.plan).maybeSingle();
      if (!target) return NextResponse.json({ error: 'Plan not found.', code: 'no_price' }, { status: 400 });

      // Si el plan destino es gratis, simplemente se cancela al final del periodo
      if (!target.stripe_price_id || Number(target.price_month) === 0) {
        await stripe.subscriptions.update(subId, { cancel_at_period_end: true });
      } else {
        const sub: any = await stripe.subscriptions.retrieve(subId);
        const itemId = sub.items.data[0].id;
        await stripe.subscriptions.update(subId, {
          items: [{ id: itemId, price: target.stripe_price_id }],
          proration_behavior: 'create_prorations',
        });
      }
      await close(b.id, 'saved_downgrade', user.id);
      return NextResponse.json({ ok: true, outcome: 'saved_downgrade' });
    }

    // 5) Cancelar de verdad (mantiene el acceso hasta fin de periodo)
    if (b.action === 'cancel') {
      const sub: any = await stripe.subscriptions.update(subId, { cancel_at_period_end: true });
      await close(b.id, 'canceled', user.id);
      await supabaseAdmin.from('profiles').update({ canceled_at: new Date().toISOString(), cancel_reason: b.reason || null }).eq('id', user.id);
      // Si tomó el descuento y ahora se va dentro de la ventana, queda inelegible a futuro.
      await penalizeIfAbuse(user.id);
      return NextResponse.json({ ok: true, outcome: 'canceled', endsAt: sub.current_period_end ? sub.current_period_end * 1000 : null });
    }

    // 6) Arrepentirse: reactivar la suscripción
    if (b.action === 'resume') {
      await stripe.subscriptions.update(subId, { cancel_at_period_end: false, pause_collection: '' as any });
      await supabaseAdmin.from('profiles').update({ canceled_at: null }).eq('id', user.id);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: `Stripe: ${e?.message || 'error'}`, code: 'stripe' }, { status: 500 });
  }
}

// Cierra el registro de cancelacion. Filtra por usuario para que nadie pueda
// tocar el registro de otro pasando un id cualquiera.
async function close(id: string | undefined, outcome: string, userId?: string) {
  if (!id || !userId) return;
  await supabaseAdmin.from('cancellations')
    .update({ outcome, resolved_at: new Date().toISOString() })
    .eq('id', id).eq('user_id', userId);
}
