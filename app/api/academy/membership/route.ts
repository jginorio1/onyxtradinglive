import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { enrollByCode, subsStatus, addToWaitlist } from '@/lib/academy';
import { feeForMentor, membershipInfo, hasMembership } from '@/lib/academyPay';
import { checkoutForMembership } from '@/lib/stripeConnect';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST · { code } → suscribirse a la membresía de una comunidad de pago.
// Devuelve la URL de Stripe Checkout (o { free:true } si es gratis).
export async function POST(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const code = String(b.code || '');
  const { data: mentor } = await supabaseAdmin.from('mentors').select('user_id,code,active,stripe_account_id,charges_enabled').eq('code', code).maybeSingle();
  if (!mentor || !(mentor as any).active) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const mid = (mentor as any).user_id;

  // Lista de espera: solo apuntar el correo, no inscribir.
  if (b.action === 'waitlist') { return NextResponse.json(await addToWaitlist(mid, String(b.email || user.email || ''))); }

  const info = await membershipInfo(mid);
  const alreadyMember = await hasMembership(user.id, mid);
  // Puertas cerradas: bloquea NUEVOS suscriptores (los que ya son miembros pasan).
  if (!alreadyMember) {
    const subs = await subsStatus(mid);
    if (!subs.open) return NextResponse.json({ closed: true, reopenAt: subs.reopenAt, note: subs.note, mentor_id: mid });
  }
  // Gratis → inscribir directo.
  if (!info.paid) { await enrollByCode(user.id, code); return NextResponse.json({ free: true, mentor_id: mid }); }
  // Ya tiene membresía activa.
  if (alreadyMember) { await enrollByCode(user.id, code); return NextResponse.json({ already: true, mentor_id: mid }); }
  if (!process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: 'stripe_off' }, { status: 400 });
  if (!(mentor as any).stripe_account_id || !(mentor as any).charges_enabled) return NextResponse.json({ error: 'mentor_not_ready' }, { status: 400 });

  await enrollByCode(user.id, code); // inscribe (el acceso lo abre la membresía activa)
  const feePct = await feeForMentor(mid);
  // Plan anual (si el mentor lo ofrece y el alumno lo elige).
  const wantsYear = b.plan === 'year' && info.yearCents > 0;
  const session = await checkoutForMembership({
    mentorId: mid, mentorAccount: (mentor as any).stripe_account_id,
    priceCents: wantsYear ? info.yearCents : info.priceCents, currency: info.currency,
    interval: wantsYear ? 'year' : 'month', code, studentId: user.id, customerEmail: user.email || undefined, feePct,
  });
  return NextResponse.json({ url: session.url });
}
