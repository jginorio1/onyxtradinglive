import crypto from 'crypto';
import { cookies } from 'next/headers';
import { getSetting, saveSetting } from '@/lib/settings';

// ============================================================
// Seguridad del panel admin: bloqueo por inactividad + PIN.
//
// Cada admin/empleado fija un PIN de 6 dígitos. Tras X minutos sin actividad
// el panel se bloquea (cookie httpOnly onyx_lock) y hay que reentrar con el PIN.
// El PIN se guarda CIFRADO (hash pbkdf2 + salt) en app_settings, nunca en claro.
// ============================================================

export const LOCK_COOKIE = 'onyx_lock';
export const IDLE_MIN = 20;        // minutos de inactividad para admins/equipo
export const MAX_TRIES = 5;        // intentos de PIN antes de cerrar sesión

type Rec = { h: string; s: string; tries: number };
type Store = { users: Record<string, Rec> };
const S0: Store = { users: {} };

function hash(pin: string, salt: string) {
  return crypto.pbkdf2Sync(pin, salt, 100000, 32, 'sha256').toString('hex');
}

export async function getStore(): Promise<Store> {
  return getSetting<Store>('admin_sec', S0);
}

export async function userHasPin(userId: string): Promise<boolean> {
  const s = await getStore();
  return !!s.users[userId]?.h;
}

// Fija o cambia el PIN de un usuario (vacío = quitarlo).
export async function setPin(userId: string, pin: string) {
  const s = await getStore();
  if (!pin) { delete s.users[userId]; }
  else {
    const salt = crypto.randomBytes(16).toString('hex');
    s.users[userId] = { h: hash(pin, salt), s: salt, tries: 0 };
  }
  await saveSetting('admin_sec', s);
}

// Verifica el PIN. Devuelve 'ok', 'bad' (aún con intentos) o 'locked' (agotó intentos).
export async function verifyPin(userId: string, pin: string): Promise<'ok' | 'bad' | 'locked' | 'nopin'> {
  const s = await getStore();
  const rec = s.users[userId];
  if (!rec?.h) return 'nopin';
  const candidate = hash(pin, rec.s);
  const good = crypto.timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(rec.h, 'hex'));
  if (good) { rec.tries = 0; await saveSetting('admin_sec', s); return 'ok'; }
  rec.tries = (rec.tries || 0) + 1;
  const locked = rec.tries >= MAX_TRIES;
  if (locked) rec.tries = 0; // se reinicia; el cliente cerrará sesión
  await saveSetting('admin_sec', s);
  return locked ? 'locked' : 'bad';
}

// ¿El panel está bloqueado ahora mismo? (cookie httpOnly)
export function serverLocked(): boolean {
  try { return cookies().get(LOCK_COOKIE)?.value === '1'; } catch { return false; }
}
