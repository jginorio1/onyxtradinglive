import { cookies } from 'next/headers';

// ¿El visitante actual está en Modo beta? Se activa con un PIN de 6 dígitos
// y se guarda en la cookie onyx_beta durante 2 horas.
export function serverBeta(): boolean {
  try {
    return cookies().get('onyx_beta')?.value === '1';
  } catch {
    return false;
  }
}
