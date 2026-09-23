import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { fcmEnabled, sendFcmToUser } from '@/lib/fcm';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Registro de tokens de push NATIVOS (app Android/iOS · FCM). La app manda su
// token de dispositivo al abrir (NativeInit) y aquí lo guardamos atado al usuario.
async function me() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

// GET · ¿está el push nativo configurado en el servidor?
export async function GET() {
  return NextResponse.json({ enabled: fcmEnabled() });
}

// POST · guardar/actualizar el token del dispositivo. { token, platform }
//        o prueba: { test:true } → se envía una push al propio usuario.
export async function POST(req: Request) {
  const user = await me();
  if (!user) return NextResponse.json({ error: 'no auth' }, { status: 401 });

  const b = await req.json().catch(() => ({} as any));

  if (b.test) {
    if (!fcmEnabled()) return NextResponse.json({ error: 'FCM no configurado.', code: 'fcm_off' }, { status: 400 });
    await sendFcmToUser(user.id, { title: 'Onyx Trading Live', body: '🔔 Notificaciones de la app activas.', url: '/dashboard' });
    return NextResponse.json({ ok: true, sent: true });
  }

  const token = String(b.token || '').trim();
  const platform = ['android', 'ios', 'web'].includes(b.platform) ? b.platform : 'android';
  if (!token || token.length < 20) return NextResponse.json({ error: 'bad token', code: 'invalid' }, { status: 400 });

  await supabaseAdmin.from('native_push_tokens').upsert({
    user_id: user.id, token, platform,
    ua: (req.headers.get('user-agent') || '').slice(0, 200),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'token' });

  return NextResponse.json({ ok: true });
}

// DELETE · quitar un token (al desactivar avisos o cerrar sesión). { token }
export async function DELETE(req: Request) {
  const user = await me();
  if (!user) return NextResponse.json({ error: 'no auth' }, { status: 401 });
  const { token } = await req.json().catch(() => ({}));
  if (token) await supabaseAdmin.from('native_push_tokens').delete().eq('user_id', user.id).eq('token', token);
  return NextResponse.json({ ok: true });
}
