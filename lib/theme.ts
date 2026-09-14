import { cookies } from 'next/headers';

// Tema elegido por el usuario (cookie onyx_theme). Si no hay elección, devuelve
// null y la app "sigue el sistema" mediante @media (prefers-color-scheme) en CSS,
// sin JavaScript y sin parpadeo.
export function serverTheme(): 'light' | 'dark' | null {
  try {
    const v = cookies().get('onyx_theme')?.value;
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}
