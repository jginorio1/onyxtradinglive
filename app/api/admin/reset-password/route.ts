import { NextResponse } from 'next/server';
import { getAdmin, logAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendEmail, mailEnabled } from '@/lib/mail';
import { emailTplLive, userLangByEmail } from '@/lib/emailTemplates';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST · genera un enlace de recuperación de contraseña para un usuario Y SE LO
// ENVÍA POR CORREO con nuestro propio mailer (Resend), usando la plantilla
// editable `password_reset` en el idioma del perfil del usuario.
//
// Antes esta ruta solo generaba el enlace y lo devolvía para copiar a mano
// (generateLink NO envía correo), por eso el usuario nunca recibía nada.
// Ahora: genera el enlace → lo mete en la plantilla → lo envía al usuario.
// También devuelve el enlace por si el admin lo quiere copiar igualmente.
export async function POST(req: Request) {
  const { isAdmin, user } = await getAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });

  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: 'falta email' }, { status: 400 });

  try {
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: (process.env.NEXT_PUBLIC_APP_URL || '') + '/reset-password' },
    });
    if (error) throw error;
    const link = data?.properties?.action_link || '';

    // Enviar el correo al usuario en su idioma. El nombre se saca del perfil si lo hay.
    let sent = false;
    if (link && mailEnabled()) {
      const lang = await userLangByEmail(email);
      let nombre = '';
      try {
        const { data: p } = await supabaseAdmin.from('profiles').select('first_name,full_name').eq('email', email).maybeSingle();
        nombre = ((p as any)?.first_name || (p as any)?.full_name || '').toString().split(' ')[0] || '';
      } catch {}
      const t = await emailTplLive('password_reset', lang, { nombre, enlace: link });
      sent = await sendEmail(email, t.subject, t.text, { kind: 'security', meta: { what: 'admin_reset' } });
    }

    await logAdmin(user.email, 'reset_password', email, { sent });
    return NextResponse.json({ ok: true, sent, link });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
