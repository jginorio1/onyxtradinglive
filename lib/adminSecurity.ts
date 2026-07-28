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

export const LOCK_COOKIE = 'onyx_lock';   // (heredado, ya no se usa)
export const SEEN_COOKIE = 'onyx_seen';   // marca de tiempo de última actividad del admin
export const IDLE_MIN = 20;        // minutos de inactividad para admins/equipo
export const MAX_TRIES = 5;        // intentos de PIN antes de cerrar sesión

type Rec = { h: string; s: string; tries: number; temp?: boolean };
type Store = { users: Record<string, Rec> };
const S0: Store = { users: {} };

function hash(pin: string, salt: string) {
  return crypto.pbkdf2Sync(pin, salt, 100000, 32, 'sha256').toString('hex');
}

// Genera un PIN temporal de 6 dígitos (para enviar por correo al nuevo empleado).
export function makeTempPin(): string {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

export async function getStore(): Promise<Store> {
  return getSetting<Store>('admin_sec', S0);
}

export async function userHasPin(userId: string): Promise<boolean> {
  const s = await getStore();
  return !!s.users[userId]?.h;
}

// ¿El PIN es temporal? (asignado por el Owner/sistema, debe cambiarlo al entrar)
export async function userPinIsTemp(userId: string): Promise<boolean> {
  const s = await getStore();
  return !!s.users[userId]?.temp;
}

// Fija o cambia el PIN de un usuario (vacío = quitarlo). temp=true marca que
// es provisional y hay que cambiarlo en el primer acceso.
export async function setPin(userId: string, pin: string, temp = false) {
  const s = await getStore();
  if (!pin) { delete s.users[userId]; }
  else {
    const salt = crypto.randomBytes(16).toString('hex');
    s.users[userId] = { h: hash(pin, salt), s: salt, tries: 0, temp };
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

// ¿El panel está bloqueado ahora mismo?
// Se basa en la MARCA DE TIEMPO de la última actividad (cookie onyx_seen), no en
// un temporizador de JavaScript. Así el bloqueo es determinista: si pasan más de
// IDLE_MIN minutos sin actividad, la marca queda "vieja" y el servidor bloquea —
// aunque el móvil haya congelado el JS de la pestaña en segundo plano.
// Si no hay marca (primer acceso), no está bloqueado; el cliente la crea al entrar.
export function serverLocked(): boolean {
  try {
    const v = cookies().get(SEEN_COOKIE)?.value;
    if (!v) return false;
    const t = parseInt(v, 10);
    if (!t || Number.isNaN(t)) return false;
    return Date.now() - t > IDLE_MIN * 60 * 1000;
  } catch { return false; }
}
