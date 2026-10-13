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
        vp.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover, interactive-widget=resizes-content');
      } catch {}

      try {
        const { StatusBar, Style } = await import('@capacitor/status-bar');
        await StatusBar.setStyle({ style: Style.Dark });
        // setBackgroundColor solo existe en Android; en iOS se ignora sin error.
        try { await StatusBar.setBackgroundColor({ color: '#121829' }); } catch {}
      } catch {}

      // Splash: lo ocultamos SOLO cuando la web ya pintó, con un fundido. Antes se
      // escondía de inmediato (apenas cargaba este script) y, como la web remota aún
      // no había pintado, se veía: logo → flash del fondo → logo otra vez. Con
      // launchAutoHide:false en capacitor.config el splash nativo se queda puesto
      // hasta que lo escondemos aquí; así la transición es una sola, fluida.
      try {
        // Fondo garantizado desde ya para que, al fundirse el splash, NUNCA se asome
        // un flash del WebView mientras la web termina de pintar. OJO: este fondo
        // inline PISA al del tema, así que DEBE seguir el tema; si no, en modo claro
        // el cuerpo quedaba oscuro y solo las tarjetas salían claras (se veía roto).
        // Oscuro por defecto (marca Onyx); claro solo si el tema elegido es claro.
        try {
          const isLight = document.documentElement.getAttribute('data-theme') === 'light';
          const appBg = isLight ? '#e7ebf3' : '#0b0f1a';
          document.documentElement.style.backgroundColor = appBg;
          document.body.style.backgroundColor = appBg;
        } catch {}

        const { SplashScreen } = await import('@capacitor/splash-screen');
        // Fundido más largo (400ms) para que el paso splash→app sea suave, sin brinco.
        const hideSplash = () => { SplashScreen.hide({ fadeOutDuration: 400 }).catch(() => {}); };

        // No ocultamos en 'load' (eso es solo "recursos cargados", la app aún no pintó
        // su primera pantalla → se veía el salto). Esperamos a que el CONTENIDO real de
        // la app esté en el DOM (login o panel), y recién ahí fundimos el splash. Como
        // el splash y la app comparten el mismo logo sobre azul marino, la transición es
        // una sola, sin parpadeo. Red de seguridad a 6 s por si algo tardara.
        let done = false;
        const go = () => { if (done) return; done = true; hideSplash(); };
        const ready = () => !!document.querySelector('main, .wrap, .wrap-wide, .is-auth, [data-app-ready], form, .card');
        let tries = 0;
        const waitReady = () => {
          if (done) return;
          if (ready()) { requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(go, 120))); return; }
          if (tries++ > 360) { go(); return; }   // ~6 s máx (360 frames)
          requestAnimationFrame(waitReady);
        };
        waitReady();
        setTimeout(go, 6000);
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
      // Publica la ALTURA real del teclado a toda la web: pone --onyx-kb en <html>
      // y dispara el evento 'onyxkb'. Así cualquier panel fijo (p. ej. el chat) puede
      // pegar su campo justo encima del teclado, sin hueco y sin depender de medir
      // el visualViewport (que dentro del webview de iOS no es fiable).
      const setKb = (h: number) => {
        kbH = Math.max(0, Math.round(h || 0));
        try { document.documentElement.style.setProperty('--onyx-kb', kbH + 'px'); } catch {}
        // iOS (resize:none): el WebView NO encoge, así que si la página no tiene scroll
        // sobrante, el campo enfocado se queda DETRÁS del teclado y no se puede subir.
        // Le damos al <body> un relleno inferior = altura del teclado para que SIEMPRE
        // haya espacio que desplazar y revealActive/scrollIntoView pueda levantar
        // cualquier campo por encima del teclado. En reposo (h=0) lo quitamos. La barra
        // inferior y el chat son position:fixed, así que este relleno no los afecta.
        try {
          if (isIOS) document.body.style.paddingBottom = kbH > 0 ? kbH + 'px' : '';
        } catch {}
        try { window.dispatchEvent(new CustomEvent('onyxkb', { detail: { h: kbH } })); } catch {}
      };
      try { setKb(0); } catch {}
      try {
        const { Keyboard, KeyboardResize } = await import('@capacitor/keyboard');
        // iOS: modo 'none' (su WebView no encoge el viewport; subimos el campo con la
        // altura real del teclado y pegamos el panel del chat). Android: modo 'native'
        // (adjustResize) — el WebView SÍ se encoge con el teclado, que es lo fiable ahí
        // y hace que el campo del chat quede siempre visible sobre el teclado.
        try {
          const isAndroid = (() => { try { return (window as any)?.Capacitor?.getPlatform?.() === 'android'; } catch { return false; } })();
          await Keyboard.setResizeMode({ mode: isAndroid ? KeyboardResize.Native : KeyboardResize.None });
        } catch {}
        // Sin barra de accesorios ("Done"): se ve más app y quita el hueco gris que
        // esa barra dejaba entre el campo y el teclado.
        try { await Keyboard.setAccessoryBarVisible({ isVisible: false }); } catch {}
        // willShow trae la altura del teclado ANTES de que termine la animación.
        try { Keyboard.addListener('keyboardWillShow', (info: any) => { setKb((info && info.keyboardHeight) || 0); setTimeout(revealActive, 60); }); } catch {}
        // didShow: confirma la altura cuando el teclado ya está arriba del todo.
        try { Keyboard.addListener('keyboardDidShow', (info: any) => { setKb((info && info.keyboardHeight) || kbH); revealActive(); }); } catch {}
        try { Keyboard.addListener('keyboardWillHide', () => { setKb(0); }); } catch {}
        try { Keyboard.addListener('keyboardDidHide', () => { setKb(0); }); } catch {}
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
      // Reenvía el token de push al servidor; se asigna dentro del bloque de abajo.
      // Lo llamamos también al volver del segundo plano (App 'resume'), para que el
      // token quede atado al usuario aunque al primer intento aún no hubiera sesión.
      let resendPush = () => {};
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
          // Token del dispositivo. Lo recordamos (localStorage) y lo mandamos al
          // servidor CON REINTENTOS: en iOS el 'registration' puede dispararse antes
          // de que el WebView tenga la sesión lista, y entonces el POST da 401 y el
          // token se perdía (en Android la sesión ya está → por eso allí sí llegaban).
          let pushTok = '';
          try { pushTok = localStorage.getItem('onyx_push_tok') || ''; } catch {}
          const sendTok = async (tries = 8): Promise<void> => {
            if (!pushTok) return;
            try {
              const r = await fetch('/api/push/native', {
                method: 'POST', credentials: 'include',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ token: pushTok, platform: plat }),
              });
              if (r && r.ok) return;                       // guardado bajo el usuario
            } catch {}
            if (tries > 0) setTimeout(() => { sendTok(tries - 1); }, 3000); // sin sesión aún → reintenta
          };
          resendPush = () => { sendTok(); };
          await PushNotifications.addListener('registration', async (t: any) => {
            pushTok = t?.value || '';
            try { localStorage.setItem('onyx_push_tok', pushTok); } catch {}
            sendTok();
          });
          if (pushTok) sendTok();   // por si el token ya estaba guardado de un arranque previo
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
        try { App.addListener('resume', () => { syncIap(); resendPush(); }); } catch {}
      } catch {}
    })();

    return () => { if (removeBack) removeBack(); if (removeHomeGuard) removeHomeGuard(); };
  }, []);

  return null;
}
