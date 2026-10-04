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

    const { confirm, reason } = await req.json();
    if (String(confirm || '').trim().toUpperCase() !== 'ELIMINAR') {
      return NextResponse.json({ error: 'Type ELIMINAR to confirm.', code: 'confirm_required' }, { status: 400 });
    }

    const { data: prof } = await supabaseAdmin.from('profiles').select('stripe_subscription_id, full_name, plan, email').eq('id', user.id).maybeSingle();

    // Lápida: antes de borrar, dejamos constancia de la BAJA para poder contarla
    // y verla en Admin → Usuarios. No guarda datos sensibles.
    try {
      await supabaseAdmin.from('account_closures').insert({
        user_id: user.id,
        email: (prof as any)?.email || user.email || null,
        full_name: (prof as any)?.full_name || null,
        plan: (prof as any)?.plan || null,
        reason: (typeof reason === 'string' ? reason.slice(0, 300) : null),
      });
    } catch { /* si la tabla aún no existe, no bloquea el borrado */ }

    // Cancelar la suscripción de Stripe para que no siga cobrando
    if (prof?.stripe_subscription_id) {
      try { await stripe.subscriptions.cancel(prof.stripe_subscription_id); } catch { /* ya cancelada */ }
    }

    // Borrar el usuario de auth: por las claves foráneas se llevan perfil, cuentas y operaciones
    const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Cerrar la sesión en el SERVIDOR: invalida los tokens y limpia las cookies.
    // Sin esto, el JWT de la sesión sigue siendo válido unos minutos y el usuario
    // "parece seguir dentro" aunque la cuenta ya no exista.
    try { await sb.auth.signOut(); } catch {}

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
