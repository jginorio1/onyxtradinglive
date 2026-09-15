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

// ¿Este navegador + SDK soportan passkeys? La UI se muestra solo si es true.
export function passkeySupported(): boolean {
  if (typeof window === 'undefined') return false;
  if (!(window as any).PublicKeyCredential) return false;
  try {
    const sb: any = supabaseBrowser();
    return typeof sb?.auth?.registerPasskey === 'function' && typeof sb?.auth?.signInWithPasskey === 'function';
  } catch { return false; }
}
