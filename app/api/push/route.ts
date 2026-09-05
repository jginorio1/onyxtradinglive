import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { pushEnabled, pushPublicKey, sendPush } from '@/lib/push';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function me() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

// GET · ¿está disponible el push? + clave pública + si ESTA suscrito ya
export async function GET(req: Request) {
  const user = await me();
  const endpoint = new URL(req.url).searchParams.get('endpoint') || '';
  let subscribed = false;
  if (user && endpoint) {
    const { data } = await supabaseAdmin.from('push_subscriptions').select('id').eq('user_id', user.id).eq('endpoint', endpoint).maybeSingle();
    subscribed = !!data;
  }
  return NextResponse.json({ enabled: pushEnabled(), publicKey: pushPublicKey(), subscribed });
}

// POST · guardar suscripción { subscription } | acción de prueba { test:true }
export async function POST(req: Request) {
  const user = await me();
  if (!user) return NextResponse.json({ error: 'no auth' }, { status: 401 });
  if (!pushEnabled()) return NextResponse.json({ error: 'Push no configurado.', code: 'push_off' }, { status: 400 });

  const b = await req.json().catch(() => ({} as any));

  if (b.test) {
    await sendPush(user.id, { title: 'Onyx Trading Live', body: '🔔 Las notificaciones están activas.', url: '/dashboard' });
    return NextResponse.json({ ok: true, sent: true });
  }

  const sub = b.subscription;
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) return NextResponse.json({ error: 'bad subscription', code: 'invalid' }, { status: 400 });

  await supabaseAdmin.from('push_subscriptions').upsert({
    user_id: user.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth,
    ua: (req.headers.get('user-agent') || '').slice(0, 200),
  }, { onConflict: 'endpoint' });

  return NextResponse.json({ ok: true });
}

// DELETE · quitar una suscripción por endpoint
export async function DELETE(req: Request) {
  const user = await me();
  if (!user) return NextResponse.json({ error: 'no auth' }, { status: 401 });
  const { endpoint } = await req.json().catch(() => ({}));
  if (endpoint) await supabaseAdmin.from('push_subscriptions').delete().eq('user_id', user.id).eq('endpoint', endpoint);
  return NextResponse.json({ ok: true });
}
