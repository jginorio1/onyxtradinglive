import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { stripe } from '@/lib/stripe';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · lista de facturas del cliente, para mostrarlas nativas dentro de Onyx.
export async function GET() {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'no auth' }, { status: 401 });

    const { data: prof } = await supabaseAdmin.from('profiles').select('stripe_customer_id').eq('id', user.id).maybeSingle();
    if (!prof?.stripe_customer_id) return NextResponse.json({ invoices: [] });

    const list = await stripe.invoices.list({ customer: prof.stripe_customer_id, limit: 24 });
    const invoices = list.data.map((i: any) => ({
      id: i.id,
      number: i.number || i.id,
      created: i.created ? i.created * 1000 : null,
      amount: (i.amount_paid ?? i.amount_due ?? 0) / 100,
      currency: (i.currency || 'usd').toUpperCase(),
      status: i.status,                        // paid | open | void | draft | uncollectible
      pdf: i.invoice_pdf || null,
      url: i.hosted_invoice_url || null,
    }));
    return NextResponse.json({ invoices });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error', invoices: [] }, { status: 500 });
  }
}
