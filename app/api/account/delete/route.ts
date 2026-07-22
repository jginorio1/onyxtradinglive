import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { stripe } from '@/lib/stripe';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST · el usuario elimina su propia cuenta y todos sus datos
export async function POST(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not signed in.', code: 'no_auth' }, { status: 401 });

    const { confirm } = await req.json();
    if (String(confirm || '').trim().toUpperCase() !== 'ELIMINAR') {
      return NextResponse.json({ error: 'Type ELIMINAR to confirm.', code: 'confirm_required' }, { status: 400 });
    }

    const { data: prof } = await supabaseAdmin.from('profiles').select('stripe_subscription_id').eq('id', user.id).single();

    // Cancelar la suscripción de Stripe para que no siga cobrando
    if (prof?.stripe_subscription_id) {
      try { await stripe.subscriptions.cancel(prof.stripe_subscription_id); } catch { /* ya cancelada */ }
    }

    // Borrar el usuario de auth: por las claves foráneas se llevan perfil, cuentas y operaciones
    const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
