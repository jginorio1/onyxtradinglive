'use client';
// Cliente de Supabase para el navegador (login, lecturas con RLS).
import { createBrowserClient } from '@supabase/ssr';

export const supabaseBrowser = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    // Opt-in de passkeys (experimental en Supabase). Si el SDK no lo soporta,
    // simplemente ignora la opción; la UI de passkeys se autodetecta y se oculta.
    { auth: { experimental: { passkey: true } } } as any
  );

// ¿Este navegador + SDK soportan passkeys? (comprobación rápida y síncrona).
export function passkeySupported(): boolean {
  if (typeof window === 'undefined') return false;
  if (!(window as any).PublicKeyCredential) return false;
  try {
    const sb: any = supabaseBrowser();
    return typeof sb?.auth?.registerPasskey === 'function' && typeof sb?.auth?.signInWithPasskey === 'function';
  } catch { return false; }
}

// ¿El EQUIPO puede DE VERDAD crear/usar un passkey? Además del soporte básico,
// pregunta al sistema si hay un autenticador de plataforma disponible (huella,
// Face ID o PIN del dispositivo). Esto es clave en Android dentro de la app:
// el WebView puede exponer la API pero no tener un autenticador usable → en ese
// caso devolvemos false y la tarjeta de passkey NO se muestra. En un iPhone o en
// un Android con biometría configurada devuelve true y sí se muestra.
export async function passkeyUsable(): Promise<boolean> {
  if (!passkeySupported()) return false;
  try {
    const PKC: any = (window as any).PublicKeyCredential;
    if (typeof PKC.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
      return !!(await PKC.isUserVerifyingPlatformAuthenticatorAvailable());
    }
    return true; // navegador viejo sin el método: nos quedamos con el soporte básico
  } catch { return false; }
}
