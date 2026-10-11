'use client';
import { useEffect, useState } from 'react';
import OnyxIcon from '@/app/components/OnyxIcon';

// Interruptor sol/luna. Cambia el tema al instante (atributo data-theme en <html>)
// y lo recuerda en la cookie onyx_theme para que el servidor lo aplique sin
// parpadeo en la siguiente carga. Si el usuario nunca elige, la app sigue el
// sistema (lo maneja el CSS con prefers-color-scheme).
function currentTheme(): 'light' | 'dark' {
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'light' || attr === 'dark') return attr;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [ready, setReady] = useState(false);

  useEffect(() => { setTheme(currentTheme()); setReady(true); }, []);

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    document.cookie = `onyx_theme=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    // En la app nativa, NativeInit fija un fondo inline en html/body (anti-flash del
    // splash) que PISA al del tema. Si no lo actualizamos aquí, al cambiar a claro el
    // cuerpo se quedaba oscuro. Solo tocamos el inline si ya estaba puesto (nativo).
    try {
      if (document.body.style.backgroundColor) {
        const bg = next === 'light' ? '#e7ebf3' : '#0b0f1a';
        document.documentElement.style.backgroundColor = bg;
        document.body.style.backgroundColor = bg;
      }
    } catch {}
    setTheme(next);
  }

  const isDark = theme === 'dark';
  return (
    <button
      className="themetoggle" onClick={toggle}
      aria-label={isDark ? 'Modo claro' : 'Modo oscuro'}
      title={isDark ? 'Modo claro' : 'Modo oscuro'}
      suppressHydrationWarning
      style={{ opacity: ready ? 1 : 0.85, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: isDark ? 'var(--amber)' : '#f5b301' }}
    >
      <OnyxIcon name={isDark ? 'moon' : 'sun'} size={18} />
    </button>
  );
}
