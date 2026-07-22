import { NextResponse } from 'next/server';
import { getAdmin, logAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { stripe } from '@/lib/stripe';
import { ambSettings, rateFor, balances } from '@/lib/ambassadors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Crea el cupón de descuento del embajador en Stripe (no rompe si falla)
async function createPromo(code: string, settings: any) {
  try {
    const percent = Number(settings.coupon_percent) || 0;
    if (percent <= 0) return null;
    const months = Number(settings.coupon_months) || 1;
    const coupon = await stripe.coupons.create(
      months > 1
        ? { percent_off: percent, duration: 'repeating', duration_in_months: months, name: `Embajador ${code}` }
        : { percent_off: percent, duration: 'once', name: `Embajador ${code}` }
    );
    const promo = await stripe.promotionCodes.create({ coupon: coupon.id, code: code.toUpperCase() });
    return promo.id;
  } catch { return null; }
}

// GET · lista de embajadores con sus métricas + ajustes del programa
export async function GET() {
  try {
    const { isAdmin } = await getAdmin();
    if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });

    const settings = await ambSettings();
    const { data: rows } = await supabaseAdmin.from('ambassadors').select('*').order('created_at', { ascending: false });

    const list: any[] = [];
    for (const a of rows || []) {
      const { data: prof } = await supabaseAdmin.from('profiles').select('email').eq('id', a.user_id).maybeSingle();
      const { rate, tier, active } = await rateFor(a, settings);
      const bal = await balances(a.id);
      const { count: clicks } = await supabaseAdmin.from('ref_clicks').select('*', { count: 'exact', head: true }).eq('code', a.code);
      const { count: signups } = await supabaseAdmin.from('referrals').select('*', { count: 'exact', head: true }).eq('ambassador_id', a.id);
      list.push({ ...a, email: prof?.email || '', rate, tier, active, clicks: clicks || 0, signups: signups || 0, balances: bal });
    }

    const { data: payouts } = await supabaseAdmin.from('ambassador_payouts').select('*').eq('status', 'requested').order('requested_at', { ascending: true });
    return NextResponse.json({ ambassadors: list, payouts: payouts || [], settings });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}

// PATCH · aprobar, rechazar, pausar, cambiar comisión, pagar, o guardar ajustes
export async function PATCH(req: Request) {
  try {
    const { isAdmin, user } = await getAdmin();
    if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
    const b = await req.json();
    const settings = await ambSettings();

    // Ajustes globales del programa
    if (b.action === 'settings') {
      const merged = { ...settings, ...(b.value || {}) };
      await supabaseAdmin.from('app_settings').upsert({ key: 'ambassadors', value: merged, updated_at: new Date().toISOString() });
      await logAdmin(user.email, 'amb_settings', 'ambassadors', merged);
      return NextResponse.json({ ok: true });
    }

    if (b.action === 'approve') {
      if (!b.id) return NextResponse.json({ error: 'falta id' }, { status: 400 });
      const { data: amb } = await supabaseAdmin.from('ambassadors').select('code,promo_code_id').eq('id', b.id).maybeSingle();
      if (!amb) return NextResponse.json({ error: 'embajador no encontrado' }, { status: 404 });
      const promoId = amb.promo_code_id || (await createPromo(amb.code, settings));
      await supabaseAdmin.from('ambassadors').update({ status: 'approved', approved_at: new Date().toISOString(), promo_code_id: promoId }).eq('id', b.id);
      await logAdmin(user.email, 'amb_approve', b.id, {});
      return NextResponse.json({ ok: true, promo: !!promoId });
    }

    if (b.action === 'status') {
      const st = ['pending', 'approved', 'rejected', 'paused'].includes(b.value) ? b.value : 'pending';
      await supabaseAdmin.from('ambassadors').update({ status: st }).eq('id', b.id);
      await logAdmin(user.email, 'amb_status', b.id, { status: st });
      return NextResponse.json({ ok: true });
    }

    if (b.action === 'rate') {
      const rate = b.value === '' || b.value == null ? null : Number(b.value);
      await supabaseAdmin.from('ambassadors').update({ rate }).eq('id', b.id);
      await logAdmin(user.email, 'amb_rate', b.id, { rate });
      return NextResponse.json({ ok: true });
    }

    if (b.action === 'note') {
      await supabaseAdmin.from('ambassadors').update({ note: String(b.value || '').slice(0, 500) }).eq('id', b.id);
      return NextResponse.json({ ok: true });
    }

    // Marcar un pago como realizado: las comisiones de ese pago pasan a 'paid'
    if (b.action === 'pay') {
      const { data: pay } = await supabaseAdmin.from('ambassador_payouts').select('*').eq('id', b.id).maybeSingle();
      if (!pay) return NextResponse.json({ error: 'payout not found' }, { status: 404 });
      await supabaseAdmin.from('ambassador_payouts').update({ status: 'paid', paid_at: new Date().toISOString(), note: b.note || null }).eq('id', pay.id);
      await supabaseAdmin.from('commissions').update({ status: 'paid' }).eq('payout_id', pay.id);
      await logAdmin(user.email, 'amb_payout_paid', pay.id, { amount: pay.amount });
      return NextResponse.json({ ok: true });
    }

    if (b.action === 'reject_payout') {
      await supabaseAdmin.from('ambassador_payouts').update({ status: 'rejected', note: b.note || null }).eq('id', b.id);
      await supabaseAdmin.from('commissions').update({ payout_id: null }).eq('payout_id', b.id);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'acción desconocida' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
