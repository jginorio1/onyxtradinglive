import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getProduct, feeForMentor } from '@/lib/academyPay';
import { checkoutForProduct } from '@/lib/stripeConnect';
import { enrollByCode } from '@/lib/academy';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST · el alumno compra un nivel → devuelve la URL de Stripe Checkout.
export async function POST(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  if (!process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: 'stripe_off' }, { status: 400 });
  const b = await req.json().catch(() => ({}));
  const product = await getProduct(String(b.product_id || ''));
  if (!product || !product.active) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { data: mentor } = await supabaseAdmin.from('mentors').select('stripe_account_id,charges_enabled,code').eq('user_id', product.mentor_id).maybeSingle();
  if (!mentor || !(mentor as any).stripe_account_id || !(mentor as any).charges_enabled) return NextResponse.json({ error: 'mentor_not_ready' }, { status: 400 });

  // Asegura la inscripción (para que aparezca en su lista aunque aún no haya pagado).
  await enrollByCode(user.id, (mentor as any).code);

  const feePct = await feeForMentor(product.mentor_id);
  const session = await checkoutForProduct(product, (mentor as any).stripe_account_id, user.id, user.email || undefined, feePct);
  return NextResponse.json({ url: session.url });
}
