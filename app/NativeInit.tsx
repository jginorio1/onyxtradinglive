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
    let removeHomeGuard: (() => void) | undefined;

    (async () => {
      document.documentElement.classList.add('native-app');
      // Marca iOS aparte: en iPhone/iPad ocultamos por CSS los enlaces a pagar
      // (regla 3.1.1 de Apple). En Android no se añade, así que no cambia nada.
      const isIOS = (() => { try { return ((window as any).Capacitor?.getPlatform?.() || '') === 'ios'; } catch { return false; } })();
      try { if (isIOS) document.documentElement.classList.add('ios-app'); } catch {}

      // Auto-reconciliación del plan de Apple: al abrir (y al volver del segundo plano)
      // el servidor le pregunta a RevenueCat el plan real y sincroniza la base. Así el
      // plan nunca queda desincronizado aunque se pierda un webhook. Solo en iOS.
      const syncIap = () => { try { if (isIOS) fetch('/api/iap/refresh', { method: 'POST', credentials: 'include' }).catch(() => {}); } catch {} };
      syncIap();

      // En la app nativa NUNCA se muestra el landing de ventas: cualquier enlace al
      // inicio ('/' o '/en') —logo, "Inicio", "volver", footer— lleva al panel. Se
      // intercepta en fase de CAPTURA para adelantarse al <Link> de Next (que hace
      // navegación interna sin recargar y se saltaría el redirect del layout).
      const homeGuard = (e: any) => {
        try {
          const a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
          if (!a) return;
          let path = a.getAttribute('href') || '';
          try { path = new URL(a.href, window.location.origin).pathname; } catch {}
          if (path === '/' || path === '/en') {
            e.preventDefault(); e.stopImmediatePropagation();
            window.location.href = '/dashboard';
          }
        } catch {}
      };
      document.addEventListener('click', homeGuard, true);
      removeHomeGuard = () => { try { document.removeEventListener('click', homeGuard, true); } catch {} };

      // iOS: bloquea el pinch-zoom del WebView (gestos de pellizco) para que la
      // pantalla NO se quede ampliada y descuadrada al entrar/salir de tabs. Junto
      // con el CSS (16px en campos + touch-action) evita el zoom que se "pegaba".
      // Además, si por lo que sea la página quedó con zoom, lo reseteamos al volver
      // a la app (visibilitychange). Solo en iOS nativo; la web no se toca.
      if (isIOS) {
        const stopGesture = (e: Event) => { try { e.preventDefault(); } catch {} };
        document.addEventListener('gesturestart', stopGesture as any, { passive: false } as any);
        document.addEventListener('gesturechange', stopGesture as any, { passive: false } as any);
        document.addEventListener('gestureend', stopGesture as any, { passive: false } as any);
        // Doble-toque para hacer zoom: lo anulamos si dos toques llegan muy seguidos.
        let lastTouch = 0;
        const stopDoubleTap = (e: TouchEvent) => {
          const now = Date.now();
          if (now - lastTouch <= 300) { try { e.preventDefault(); } catch {} }
          lastTouch = now;
        };
        document.addEventListener('touchend', stopDoubleTap as any, { passive: false } as any);
      }

      // SOLO en la app nativa: bloquea el auto-zoom del webview. En iOS, al tocar
      // un <select>/<input> (p. ej. elegir cuenta de portafolio) el webview hacía
      // zoom y la pantalla dejaba de encajar (se veía "movida"/como móvil). Con
      // maximum-scale=1 + user-scalable=no el webview ya no escala. En el navegador
      // NO se toca (el viewport de la web permite zoom por accesibilidad).
      try {
        let vp = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
        if (!vp) { vp = document.createElement('meta'); vp.name = 'viewport'; document.head.appendChild(vp); }
        vp.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
      } catch {}

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

      // Teclado (iOS): el problema era que el campo enfocado quedaba TAPADO por el
      // teclado y no subía solo. Modo 'body' → el webview encoge el <body> al alto
      // visible (sin teclado), lo que reacomoda mejor el contenido web que 'native'.
      // Además, en cuanto el teclado va a abrir sabemos su ALTURA real; con eso
      // calculamos si el campo queda detrás y lo subimos justo lo necesario.
      let kbH = 0;
      // Sube el campo activo por encima del teclado. Recorre hacia arriba buscando el
      // primer contenedor con scroll y lo desplaza; si no hay, usa scrollIntoView.
      const revealActive = () => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || !/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
        try {
          const margin = 24;                                   // aire entre el campo y el teclado
          const visibleBottom = window.innerHeight - kbH - margin;
          const r = el.getBoundingClientRect();
          if (r.bottom <= visibleBottom && r.top >= 8) return; // ya se ve bien
          const delta = r.bottom - visibleBottom;
          // Busca el ancestro scrolleable más cercano.
          let sc: HTMLElement | null = el.parentElement;
          while (sc && sc !== document.body) {
            const st = getComputedStyle(sc);
            if (/(auto|scroll)/.test(st.overflowY) && sc.scrollHeight > sc.clientHeight) break;
            sc = sc.parentElement;
          }
          if (sc && sc !== document.body) { sc.scrollBy({ top: delta, behavior: 'smooth' }); }
          else { window.scrollBy({ top: delta, behavior: 'smooth' }); }
          // Red de seguridad: centra el campo por si el scrollBy no alcanzó.
          setTimeout(() => { try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch {} }, 120);
        } catch { try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch {} }
      };
      try {
        const { Keyboard, KeyboardResize } = await import('@capacitor/keyboard');
        // Modo 'native': el webview se encoge al abrir el teclado SIN desactivar el
        // scroll. (NO usar setScroll({isDisabled:true}): eso congela el scroll de toda
        // la app.) Con la altura del teclado empujamos el campo enfocado a la vista.
        try { await Keyboard.setResizeMode({ mode: KeyboardResize.Native }); } catch {}
        try { await Keyboard.setAccessoryBarVisible({ isVisible: true }); } catch {}
        // willShow trae la altura del teclado ANTES de que termine la animación.
        try { Keyboard.addListener('keyboardWillShow', (info: any) => { kbH = (info && info.keyboardHeight) || 0; setTimeout(revealActive, 60); }); } catch {}
        // didShow: reintento cuando el layout ya se encogió.
        try { Keyboard.addListener('keyboardDidShow', (info: any) => { kbH = (info && info.keyboardHeight) || kbH; revealActive(); }); } catch {}
        try { Keyboard.addListener('keyboardDidHide', () => { kbH = 0; }); } catch {}
      } catch {}
      // Respaldo web/webview (sin plugin nativo): al enfocar un campo, lo llevamos a
      // la vista. Aquí kbH puede ser 0, así que centramos.
      const onFocusIn = (e: Event) => {
        const el = e.target as HTMLElement | null;
        if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) {
          setTimeout(revealActive, 300);
          setTimeout(() => { try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch {} }, 350);
        }
      };
      document.addEventListener('focusin', onFocusIn);

      // Push NATIVA (FCM): pide permiso, registra el dispositivo y manda el token
      // a /api/push/native para atarlo a la sesión. Al tocar una notificación,
      // abre la URL que traiga (deep-link dentro de la app). Solo corre en nativo;
      // si el plugin o Firebase no están, no rompe nada.
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications');
        const plat = (() => { try { return (window as any).Capacitor?.getPlatform?.() || 'android'; } catch { return 'android'; } })();
        const perm = await PushNotifications.requestPermissions();
        if (perm.receive === 'granted') {
          // Canales de notificación (Android): un canal por categoría, para que el
          // usuario pueda activar/silenciar cada tipo y se muestre su nombre. El
          // servidor manda cada push a su channel_id (ver lib/fcm.ts / emitNotif).
          try {
            const chans = [
              { id: 'onyx_plan', name: 'Plan y hábitos' },
              { id: 'onyx_trading', name: 'Trading y reto' },
              { id: 'onyx_robots', name: 'Robots' },
              { id: 'onyx_copy', name: 'Copy trading' },
              { id: 'onyx_academia', name: 'Academia' },
              { id: 'onyx_ingresos', name: 'Ingresos y referidos' },
              { id: 'onyx_cuenta', name: 'Cuenta y pagos' },
              { id: 'onyx_soporte', name: 'Soporte' },
              { id: 'onyx_resumen', name: 'Resúmenes' },
              { id: 'onyx_default', name: 'Onyx Trading Live' },
            ];
            for (const c of chans) {
              try { await (PushNotifications as any).createChannel({ id: c.id, name: c.name, importance: 4, visibility: 1, vibration: true, lights: true }); } catch {}
            }
          } catch {}
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
        // Al volver del segundo plano, re-sincroniza el plan de Apple (por si cambió).
        try { App.addListener('resume', () => syncIap()); } catch {}
      } catch {}
    })();

    return () => { if (removeBack) removeBack(); if (removeHomeGuard) removeHomeGuard(); };
  }, []);

  return null;
}
