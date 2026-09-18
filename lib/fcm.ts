import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// ============================================================
// Notificaciones push NATIVAS (app Android/iOS) vía Firebase Cloud Messaging,
// API HTTP v1. Firma un JWT con la cuenta de servicio de Firebase, obtiene un
// token OAuth y envía el mensaje a cada token de dispositivo del usuario.
//
// Se activa SOLO si están las variables en Vercel (si faltan, no hace nada y no
// rompe el flujo — igual que el web-push):
//   FCM_PROJECT_ID     = el ID del proyecto de Firebase (ej. onyx-trading-live)
//   FCM_CLIENT_EMAIL   = client_email del JSON de la cuenta de servicio
//   FCM_PRIVATE_KEY    = private_key del JSON (con \n reales o escapados)
//
// El JSON sale de: Firebase → Configuración del proyecto → Cuentas de servicio →
// "Generar nueva clave privada". De ahí copias project_id, client_email y
// private_key a esas tres variables.
//
// Los tokens de dispositivo los registra la app al abrir (NativeInit) contra
// /api/push/native y se guardan en la tabla `native_push_tokens`.
// ============================================================

export function fcmEnabled(): boolean {
  return !!(process.env.FCM_PROJECT_ID && process.env.FCM_CLIENT_EMAIL && process.env.FCM_PRIVATE_KEY);
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Token OAuth con caché en memoria (dura ~1h; lo renovamos un poco antes).
let _tok = { value: '', exp: 0 };
async function getToken(): Promise<string | null> {
  if (_tok.value && Date.now() < _tok.exp - 60000) return _tok.value;
  const email = process.env.FCM_CLIENT_EMAIL;
  let key = process.env.FCM_PRIVATE_KEY || '';
  if (!email || !key) return null;
  key = key.replace(/\\n/g, '\n');
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({
    iss: email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600,
  }));
  const unsigned = `${header}.${claim}`;
  let sig: string;
  try { sig = b64url(crypto.createSign('RSA-SHA256').update(unsigned).sign(key)); } catch { return null; }
  try {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${encodeURIComponent(unsigned + '.' + sig)}`,
    });
    if (!r.ok) return null;
    const j = await r.json();
    if (!j.access_token) return null;
    _tok = { value: j.access_token, exp: Date.now() + (Number(j.expires_in || 3600) * 1000) };
    return _tok.value;
  } catch { return null; }
}

type Payload = { title: string; body: string; url?: string; category?: string };

// Envía a un token concreto. Devuelve 'ok' | 'dead' (token inválido → borrar) | 'err'.
async function sendToToken(token: string, projectId: string, oauth: string, p: Payload): Promise<'ok' | 'dead' | 'err'> {
  const message = {
    message: {
      token,
      notification: { title: p.title, body: p.body },
      data: { url: p.url || '/dashboard' },
      android: {
        priority: 'HIGH',
        notification: {
          sound: 'default',
          default_vibrate_timings: true,
          // Identidad Onyx en la notificación:
          //  • icon: ícono chico monocromo de la barra de estado (drawable ic_stat_onyx del APK).
          //  • color: acento morado de marca (tiñe el ícono y el nombre).
          //  • channel_id: la categoría → canal (Plan, Robots, Soporte…), creado en NativeInit.
          icon: 'ic_stat_onyx',
          color: '#4B3FF0',
          channel_id: p.category || 'onyx_default',
        },
      },
      apns: { payload: { aps: { sound: 'default' } } },
    },
  };
  try {
    const r = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
      method: 'POST',
      headers: { authorization: `Bearer ${oauth}`, 'content-type': 'application/json' },
      body: JSON.stringify(message),
    });
    if (r.ok) return 'ok';
    // 404 (UNREGISTERED) o 400 (INVALID_ARGUMENT por token) → token muerto.
    if (r.status === 404) return 'dead';
    let txt = '';
    try { txt = await r.text(); } catch {}
    if (r.status === 400 && /registration-token|not a valid FCM|InvalidArgument|UNREGISTERED/i.test(txt)) return 'dead';
    return 'err';
  } catch { return 'err'; }
}

// Envía una push nativa a TODOS los dispositivos del usuario. Limpia los muertos.
export async function sendFcmToUser(userId: string, payload: Payload): Promise<void> {
  if (!fcmEnabled()) return;
  try {
    const { data: rows } = await supabaseAdmin.from('native_push_tokens')
      .select('id,token').eq('user_id', userId);
    if (!rows?.length) return;
    const oauth = await getToken();
    if (!oauth) return;
    const projectId = process.env.FCM_PROJECT_ID as string;
    for (const row of rows as any[]) {
      const res = await sendToToken(row.token, projectId, oauth, payload);
      if (res === 'dead') { try { await supabaseAdmin.from('native_push_tokens').delete().eq('id', row.id); } catch {} }
    }
  } catch { /* nunca romper el flujo del aviso */ }
}
