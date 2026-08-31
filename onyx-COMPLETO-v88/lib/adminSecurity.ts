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

// ============================================================
// Códigos de respaldo del 2FA (por si pierdes el teléfono) + prueba de que la
// sesión ya superó el 2FA por esa vía (cookie firmada, corta y httpOnly).
// ============================================================
const TFA_COOKIE = 'onyx_2fa';
const TFA_TTL_MS = 8 * 60 * 60 * 1000;   // 8 h, como la sesión de trabajo
function tfaSecret() { return process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'onyx-2fa'; }

// Marca esta sesión como "2FA satisfecho" (tras usar un código de respaldo).
export function set2faOk(userId: string) {
  const exp = Date.now() + TFA_TTL_MS;
  const sig = crypto.createHmac('sha256', tfaSecret()).update(`${userId}.${exp}`).digest('hex');
  cookies().set(TFA_COOKIE, `${exp}.${sig}`, { path: '/', maxAge: Math.floor(TFA_TTL_MS / 1000), httpOnly: true, sameSite: 'lax', secure: true });
}
// ¿La sesión ya pasó el 2FA por código de respaldo (y no ha caducado)?
export function has2faOk(userId: string): boolean {
  try {
    const v = cookies().get(TFA_COOKIE)?.value; if (!v) return false;
    const [expS, sig] = v.split('.'); const exp = parseInt(expS, 10);
    if (!exp || Number.isNaN(exp) || Date.now() > exp) return false;
    const good = crypto.createHmac('sha256', tfaSecret()).update(`${userId}.${exp}`).digest('hex');
    return sig.length === good.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good));
  } catch { return false; }
}

type Backup = { codes: { h: string; s: string }[] };
type BackupStore = { users: Record<string, Backup> };

// Genera 8 códigos de un solo uso, los guarda CIFRADOS y devuelve el texto plano
// UNA vez para mostrarlos. Al regenerar se reemplazan los anteriores.
export async function genBackupCodes(userId: string): Promise<string[]> {
  const store = await getSetting<BackupStore>('admin_2fa_backup', { users: {} });
  const plain: string[] = []; const codes: { h: string; s: string }[] = [];
  for (let i = 0; i < 8; i++) {
    const c = crypto.randomBytes(5).toString('hex'); // 10 caracteres
    const salt = crypto.randomBytes(16).toString('hex');
    plain.push(c); codes.push({ h: hash(c, salt), s: salt });
  }
  store.users[userId] = { codes };
  await saveSetting('admin_2fa_backup', store);
  return plain;
}
export async function backupCodesLeft(userId: string): Promise<number> {
  const store = await getSetting<BackupStore>('admin_2fa_backup', { users: {} });
  return store.users[userId]?.codes?.length || 0;
}
// Verifica y CONSUME un código de respaldo (uno solo se puede usar una vez).
export async function verifyBackupCode(userId: string, code: string): Promise<boolean> {
  const clean = String(code || '').trim().toLowerCase().replace(/\s+/g, '');
  if (!clean) return false;
  const store = await getSetting<BackupStore>('admin_2fa_backup', { users: {} });
  const rec = store.users[userId]; if (!rec?.codes?.length) return false;
  const idx = rec.codes.findIndex((c) => {
    try { return crypto.timingSafeEqual(Buffer.from(hash(clean, c.s), 'hex'), Buffer.from(c.h, 'hex')); } catch { return false; }
  });
  if (idx < 0) return false;
  rec.codes.splice(idx, 1); await saveSetting('admin_2fa_backup', store);
  return true;
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
