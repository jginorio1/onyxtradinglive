// @ts-ignore  (web-push se instala en el deploy; el tipo no hace falta aquí)
import webpush from 'web-push';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// ============================================================
// Notificaciones push (Web Push con VAPID).
// Se activa SOLO si están las claves en Vercel:
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:...)
// Si faltan, todo queda desactivado sin romper nada.
// ============================================================
const PUB = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const PRIV = process.env.VAPID_PRIVATE_KEY || '';
const SUBJECT = process.env.VAPID_SUBJECT || 'mailto:soporte@onyxtradinglive.com';

export function pushEnabled() { return !!(PUB && PRIV); }
export function pushPublicKey() { return PUB; }

let ready = false;
function ensure() {
  if (ready || !pushEnabled()) return pushEnabled();
  try { (webpush as any).setVapidDetails(SUBJECT, PUB, PRIV); ready = true; } catch { ready = false; }
  return ready;
}

type Payload = { title: string; body: string; url?: string };

// Envía una push a TODOS los dispositivos del usuario. Borra los que ya no valen.
export async function sendPush(userId: string, payload: Payload) {
  if (!ensure()) return;
  try {
    const { data: subs } = await supabaseAdmin.from('push_subscriptions')
      .select('id,endpoint,p256dh,auth').eq('user_id', userId);
    if (!subs?.length) return;

    const body = JSON.stringify({ title: payload.title, body: payload.body, url: payload.url || '/dashboard' });
    for (const s of subs as any[]) {
      try {
        await (webpush as any).sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body
        );
      } catch (e: any) {
        // 404/410 = suscripción muerta → la limpiamos
        const code = e?.statusCode || 0;
        if (code === 404 || code === 410) {
          await supabaseAdmin.from('push_subscriptions').delete().eq('id', s.id);
        }
      }
    }
  } catch { /* nunca romper el flujo por un aviso */ }
}
