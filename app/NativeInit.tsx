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
// - Login-first: el salto directo a /dashboard desde el landing lo hace ahora un
//   script inline en el layout (corre antes de pintar, sin parpadeo). Aquí solo
//   quedan las tareas nativas (barra de estado, splash, botón atrás, clase CSS).
//   /dashboard manda a /login si no hay sesión, así que el usuario ve
//   login/registro o su panel — nunca la página de ventas. Ayuda además a pasar
//   la revisión de Apple (regla 4.2).
export default function NativeInit() {
  useEffect(() => {
    if (!isNativeApp()) return;

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

      // Push NATIVA (FCM): pide permiso, registra el dispositivo y manda el token
      // a /api/push/native para atarlo a la sesión. Al tocar una notificación,
      // abre la URL que traiga (deep-link dentro de la app). Solo corre en nativo;
      // si el plugin o Firebase no están, no rompe nada.
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications');
        const plat = (() => { try { return (window as any).Capacitor?.getPlatform?.() || 'android'; } catch { return 'android'; } })();
        const perm = await PushNotifications.requestPermissions();
        if (perm.receive === 'granted') {
          await PushNotifications.addListener('registration', async (t: any) => {
            try {
              await fetch('/api/push/native', {
                method: 'POST', credentials: 'include',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ token: t?.value || '', platform: plat }),
              });
            } catch {}
          });
          await PushNotifications.addListener('registrationError', () => {});
          // Al tocar una notificación con la app abierta o en segundo plano →
          // navegar a su URL (o al panel).
          await PushNotifications.addListener('pushNotificationActionPerformed', (ev: any) => {
            const url = ev?.notification?.data?.url || '/dashboard';
            try { window.location.assign(url); } catch {}
          });
          await PushNotifications.register();
        }
      } catch { /* sin plugin/Firebase: se ignora */ }

      try {
        const { App } = await import('@capacitor/app');
        // Botón atrás de Android:
        //  · En la HOME de la app (el panel /dashboard) o en /login → minimiza la
        //    app (no retrocede al login ni la cierra de golpe).
        //  · En cualquier otra pantalla → retrocede en la web con normalidad.
        // Antes, estando logueado, "atrás" caía en /login con el menú visible.
        const h = await App.addListener('backButton', ({ canGoBack }) => {
          const p = window.location.pathname.replace(/\/+$/, '') || '/';
          const isHome = p === '/dashboard' || p === '/' || p.startsWith('/login');
          if (isHome || !canGoBack) { App.minimizeApp(); return; }
          window.history.back();
        });
        removeBack = () => { try { h.remove(); } catch {} };
      } catch {}
    })();

    return () => { if (removeBack) removeBack(); };
  }, []);

  return null;
}
