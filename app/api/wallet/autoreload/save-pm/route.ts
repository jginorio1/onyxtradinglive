import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { setAutoReloadCard } from '@/lib/wallet';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST { paymentMethodId } · guarda la tarjeta de auto-recarga tras confirmar el
// SetupIntent en el cliente (Payment Element). El cliente Stripe se lee de la
// base (lo fijó /setup-intent), no se confía en el navegador.
export async function POST(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'auth' }, { status: 401 });

    const b = await req.json().catch(() => ({} as any));
    const pm = String(b.paymentMethodId || '').trim();
    if (!pm) return NextResponse.json({ error: 'falta paymentMethodId' }, { status: 400 });

    const { data } = await supabaseAdmin.from('wallet_autoreload').select('stripe_customer').eq('user_id', user.id).maybeSingle();
    const customer = (data as any)?.stripe_customer || null;
    if (!customer) return NextResponse.json({ error: 'sin cliente' }, { status: 400 });

    await setAutoReloadCard(user.id, customer, pm);
    return NextResponse.json({ ok: true });
  } catch (e: any) { await logError('wallet_save_pm', e); return NextResponse.json({ error: e?.message || 'error' }, { status: 500 }); }
}
