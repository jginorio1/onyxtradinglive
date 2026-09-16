'use client';
import { useEffect } from 'react';
import { isNativeApp } from '@/lib/native';

// Arranque nativo: solo hace algo cuando la app corre dentro de Capacitor
// (Android/iOS). En el navegador no ejecuta nada (isNativeApp() = false), así que
// no afecta a la web ni carga los plugins nativos.
//
// - Marca <html class="native-app"> para que el CSS aplique áreas seguras (notch).
// - Barra de estado con los colores de Onyx.
// - Oculta el splash cuando la web ya cargó.
// - Botón atrás de Android: retrocede en la web; si no hay a dónde, minimiza la
//   app en vez de cerrarla de golpe.
// - Login-first: al abrir la app (o si el usuario cae en el landing de marketing)
//   salta directo a /dashboard. /dashboard manda a /login si no hay sesión, así
//   que el usuario ve login/registro o su panel — nunca la página de ventas.
//   Esto hace la app más "app" y ayuda a pasar la revisión de Apple (regla 4.2).
export default function NativeInit() {
  useEffect(() => {
    if (!isNativeApp()) return;

    // Redirección login-first: solo desde el landing público (raíz o /en).
    const p = window.location.pathname.replace(/\/+$/, '') || '/';
    if (p === '' || p === '/' || p === '/en') {
      window.location.replace('/dashboard');
      return;
    }

    let removeBack: (() => void) | undefined;

    (async () => {
      document.documentElement.classList.add('native-app');

      try {
        const { StatusBar, Style } = await import('@capacitor/status-bar');
        await StatusBar.setStyle({ style: Style.Dark });
        // setBackgroundColor solo existe en Android; en iOS se ignora sin error.
        try { await StatusBar.setBackgroundColor({ color: '#121829' }); } catch {}
      } catch {}

      try {
        const { SplashScreen } = await import('@capacitor/splash-screen');
        await SplashScreen.hide();
      } catch {}

      try {
        const { App } = await import('@capacitor/app');
        const h = await App.addListener('backButton', ({ canGoBack }) => {
          if (canGoBack) window.history.back();
          else App.minimizeApp();
        });
        removeBack = () => { try { h.remove(); } catch {} };
      } catch {}
    })();

    return () => { if (removeBack) removeBack(); };
  }, []);

  return null;
}
