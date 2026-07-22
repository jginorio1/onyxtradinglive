import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { stripe } from '@/lib/stripe';
import { retentionSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const REASONS = ['price', 'unused', 'missing', 'stopped', 'other'];

async function me() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { user: null as any, prof: null as any };
  const { data: prof } = await supabaseAdmin.from('profiles').select('id,email,plan,stripe_subscription_id,stripe_customer_id').eq('id', user.id).single();
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
      return NextResponse.json({ ok: true, id: row?.id, settings: s, downgrades });
    }

    if (!subId) return NextResponse.json({ error: 'No active subscription.', code: 'no_sub' }, { status: 400 });

    // 2) Se queda con descuento
    if (b.action === 'discount') {
      const coupon = await stripe.coupons.create({
        percent_off: Number(s.discount_percent) || 50,
        duration: 'repeating',
        duration_in_months: Number(s.discount_months) || 3,
        name: 'Retención Onyx',
      });
      await stripe.subscriptions.update(subId, { coupon: coupon.id } as any);
      await close(b.id, 'saved_discount');
      return NextResponse.json({ ok: true, outcome: 'saved_discount' });
    }

    // 3) Se queda pero pausa el cobro
    if (b.action === 'pause') {
      const months = Number(s.pause_months) || 2;
      const resumes = Math.floor((Date.now() + months * 30 * 864e5) / 1000);
      await stripe.subscriptions.update(subId, { pause_collection: { behavior: 'void', resumes_at: resumes } } as any);
      await close(b.id, 'saved_pause');
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
      await close(b.id, 'saved_downgrade');
      return NextResponse.json({ ok: true, outcome: 'saved_downgrade' });
    }

    // 5) Cancelar de verdad (mantiene el acceso hasta fin de periodo)
    if (b.action === 'cancel') {
      const sub: any = await stripe.subscriptions.update(subId, { cancel_at_period_end: true });
      await close(b.id, 'canceled');
      await supabaseAdmin.from('profiles').update({ canceled_at: new Date().toISOString(), cancel_reason: b.reason || null }).eq('id', user.id);
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

async function close(id: string | undefined, outcome: string) {
  if (!id) return;
  await supabaseAdmin.from('cancellations').update({ outcome, resolved_at: new Date().toISOString() }).eq('id', id);
}
