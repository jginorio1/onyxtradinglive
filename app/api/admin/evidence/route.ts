import { NextResponse } from 'next/server';
import { getAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { submitEvidence } from '@/lib/evidence';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · evidencia de pagos para el admin.
//   ?userId=<uuid>  → compras/evidencia de ese usuario.
//   ?disputes=1     → solo las que están en disputa (para revisar y enviar).
//   (sin params)    → últimas 100 compras.
export async function GET(req: Request) {
  try {
    const { isAdmin } = await getAdmin();
    if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId') || '';
    const onlyDisputes = url.searchParams.get('disputes') === '1';

    let q = supabaseAdmin.from('payment_evidence').select('*').order('created_at', { ascending: false }).limit(100);
    if (userId) q = q.eq('user_id', userId);
    if (onlyDisputes) q = q.eq('status', 'disputed');
    const { data } = await q;

    const rows = (data || []).map((r: any) => ({
      id: r.id,
      sessionId: r.session_id,
      kind: r.kind,
      product: r.product_description || r.product_id || '',
      amount: r.amount_cents != null ? r.amount_cents / 100 : null,
      currency: (r.currency || 'usd').toUpperCase(),
      email: r.email,
      ip: r.ip,
      userAgent: r.user_agent,
      consent: r.consent,
      termsVersion: r.terms_version,
      termsAcceptedAt: r.terms_accepted_at,
      status: r.status,
      paymentIntent: r.payment_intent,
      chargeId: r.charge_id,
      disputeId: r.dispute_id,
      deliveryAt: r.delivery_at,
      deliveryLog: Array.isArray(r.delivery_log) ? r.delivery_log : [],
      createdAt: r.created_at,
      stripePayUrl: r.payment_intent ? `https://dashboard.stripe.com/payments/${r.payment_intent}` : null,
      stripeDisputeUrl: r.dispute_id ? `https://dashboard.stripe.com/disputes/${r.dispute_id}` : null,
    }));
    return NextResponse.json({ rows });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}

// POST · acciones sobre una disputa.
//   { action: 'draft' | 'submit', disputeId }
//     draft  → guarda/actualiza el borrador de evidencia en Stripe.
//     submit → ENVÍA la evidencia a Stripe (definitivo, no se deshace).
export async function POST(req: Request) {
  try {
    const { isAdmin } = await getAdmin();
    if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
    const b = await req.json().catch(() => ({}));
    const disputeId = String(b.disputeId || '').trim();
    if (!disputeId) return NextResponse.json({ error: 'Falta disputeId' }, { status: 400 });
    if (b.action !== 'draft' && b.action !== 'submit') return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
    const r = await submitEvidence(disputeId, b.action === 'submit');
    if (!r.ok) return NextResponse.json({ error: r.note }, { status: 400 });
    return NextResponse.json({ ok: true, note: r.note });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
