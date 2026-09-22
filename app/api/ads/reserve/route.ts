import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { slotByKey } from '@/lib/ads';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST · un anunciante reserva un espacio desde la página pública /publicidad.
// Crea una campaña en estado 'draft' con sus datos; aparece en el panel Admin
// como solicitud pendiente para que el dueño confirme el pago y la active.
export async function POST(req: Request) {
  try {
    const b = await req.json().catch(() => ({} as any));
    const slot = String(b.slot || '');
    if (!slotByKey(slot)) return NextResponse.json({ error: 'slot inválido' }, { status: 400 });
    const advertiser = String(b.advertiser || '').slice(0, 120).trim();
    const contact = String(b.contact || '').slice(0, 160).trim();
    if (!advertiser || !contact) return NextResponse.json({ error: 'faltan datos' }, { status: 400 });
    await supabaseAdmin.from('ad_campaigns').insert({
      advertiser, contact, slot_key: slot,
      link_url: String(b.link || '').slice(0, 500),
      alt: String(b.message || '').slice(0, 300),
      status: 'draft',
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
