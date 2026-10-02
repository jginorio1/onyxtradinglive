import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST · el usuario cambia su propia contraseña
export async function POST(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not signed in.', code: 'no_auth' }, { status: 401 });

    const { password, currentPassword } = await req.json();
    if (!password || String(password).length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.', code: 'pw_short' }, { status: 400 });
    }
    // Verificar la contraseña ACTUAL antes de cambiarla (Supabase lo exige y es
    // lo correcto por seguridad). Reautenticamos con el email del usuario.
    if (!currentPassword || String(currentPassword).length < 1) {
      return NextResponse.json({ error: 'Enter your current password.', code: 'current_required' }, { status: 400 });
    }
    if (user.email) {
      const { error: reauth } = await sb.auth.signInWithPassword({ email: user.email, password: String(currentPassword) });
      if (reauth) return NextResponse.json({ error: 'Your current password is incorrect.', code: 'current_wrong' }, { status: 400 });
    }
    const { error } = await sb.auth.updateUser({ password: String(password) });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
