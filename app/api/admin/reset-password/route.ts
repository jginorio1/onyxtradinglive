import { NextResponse } from 'next/server';
import { getAdmin, logAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST · genera un enlace de recuperación de contraseña para un usuario.
// Devuelve el enlace para que el admin lo copie/envíe (Supabase también puede
// enviarlo por email si tienes el SMTP configurado).
export async function POST(req: Request) {
  const { isAdmin, user } = await getAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });

  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: 'falta email' }, { status: 400 });

  try {
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: (process.env.NEXT_PUBLIC_APP_URL || '') + '/login' },
    });
    if (error) throw error;
    await logAdmin(user.email, 'reset_password', email, {});
    return NextResponse.json({ ok: true, link: data?.properties?.action_link || '' });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
