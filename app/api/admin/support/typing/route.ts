import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// El agente está ESCRIBIENDO: marca un sello de tiempo en el ticket para que el
// widget del cliente muestre "… está escribiendo". Barato e idempotente; el
// widget lo lee en su sondeo. Si la columna agent_typing_at no existe aún, no
// rompe (simplemente no se verá el indicador hasta correr el SQL).
export async function POST(req: Request) {
  try {
    const g = await requirePerm('soporte', 'manage');
    if (!g.ok) return NextResponse.json({ ok: false }, { status: 403 });
    const b = await req.json().catch(() => ({} as any));
    const ticketId = String(b.ticket_id || '');
    if (!ticketId) return NextResponse.json({ ok: false }, { status: 400 });
    try { await supabaseAdmin.from('support_tickets').update({ agent_typing_at: new Date().toISOString() }).eq('id', ticketId); } catch {}
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
