import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · tras el pago, la página de "gracias" llama aquí con el session_id. Verifica
// con Stripe que se pagó y ACTIVA la campaña (idempotente). Devuelve el token del
// reporte para que el anunciante siga sus resultados.
export async function GET(req: Request) {
  try {
    const sid = new URL(req.url).searchParams.get('session_id') || '';
    if (!sid) return NextResponse.json({ ok: false, error: 'falta session_id' }, { status: 400 });
    const session = await stripe.checkout.sessions.retrieve(sid);
    const campaignId = (session.metadata as any)?.campaignId;
    if ((session.metadata as any)?.kind !== 'ad' || !campaignId) return NextResponse.json({ ok: false, error: 'sesión no válida' }, { status: 400 });
    if (session.payment_status !== 'paid') return NextResponse.json({ ok: false, paid: false });

    const { data: camp } = await supabaseAdmin.from('ad_campaigns').select('status,report_token,slot_key,ends_at').eq('id', campaignId).maybeSingle();
    if (!camp) return NextResponse.json({ ok: false, error: 'campaña no encontrada' }, { status: 404 });
    if ((camp as any).status !== 'active') {
      await supabaseAdmin.from('ad_campaigns').update({ status: 'active' }).eq('id', campaignId);
    }
    return NextResponse.json({ ok: true, paid: true, reportToken: (camp as any).report_token, endsAt: (camp as any).ends_at });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500 });
  }
}
