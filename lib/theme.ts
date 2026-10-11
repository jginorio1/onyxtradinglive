import { cookies } from 'next/headers';

// Tema elegido por el usuario (cookie onyx_theme). El DEFAULT de la marca es
// OSCURO: si el usuario nunca ha elegido, servimos 'dark' (no seguimos el modo
// del sistema), para que un iPhone/PC en modo claro NO abra la app en claro.
// El usuario puede cambiar a claro con el interruptor sol/luna (guarda cookie)
// y entonces respetamos su elección. Se renderiza en el servidor, sin parpadeo.
export function serverTheme(): 'light' | 'dark' {
  try {
    const v = cookies().get('onyx_theme')?.value;
    return v === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}
