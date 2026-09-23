import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// PIN del trader para reanudar la copia. Es independiente del PIN de bloqueo
// de admins/equipo: este vive en profiles.copy_pin_hash y solo protege la
// acción de VOLVER A ENCENDER la copia (pausar nunca pide PIN, por seguridad).
// Se guarda como "salt:hash" (pbkdf2), nunca en claro.

function hash(pin: string, salt: string) {
  return crypto.pbkdf2Sync(pin, salt, 100000, 32, 'sha256').toString('hex');
}

export async function copyPinSet(userId: string, pin: string): Promise<boolean> {
  const clean = String(pin || '').replace(/\D/g, '');
  if (clean.length < 4 || clean.length > 8) return false;
  const salt = crypto.randomBytes(16).toString('hex');
  const stored = `${salt}:${hash(clean, salt)}`;
  await supabaseAdmin.from('profiles').update({ copy_pin_hash: stored }).eq('id', userId);
  return true;
}

export async function copyPinClear(userId: string) {
  await supabaseAdmin.from('profiles').update({ copy_pin_hash: null }).eq('id', userId);
}

export async function copyPinHas(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin.from('profiles').select('copy_pin_hash').eq('id', userId).maybeSingle();
  return !!data?.copy_pin_hash;
}

// Devuelve true si el PIN es correcto, o si el usuario NO tiene PIN puesto
// (en ese caso no se exige; reanudar queda protegido solo por la sesión).
export async function copyPinCheck(userId: string, pin: string): Promise<boolean> {
  const { data } = await supabaseAdmin.from('profiles').select('copy_pin_hash').eq('id', userId).maybeSingle();
  const stored = data?.copy_pin_hash as string | null;
  if (!stored) return true;
  const [salt, want] = stored.split(':');
  if (!salt || !want) return true;
  const got = hash(String(pin || '').replace(/\D/g, ''), salt);
  try { return crypto.timingSafeEqual(Buffer.from(got, 'hex'), Buffer.from(want, 'hex')); } catch { return false; }
}
