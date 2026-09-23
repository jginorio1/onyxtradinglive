'use client';
import { useEffect } from 'react';
import { APP_VERSION } from '@/lib/version';

// Registra el service worker una vez, en el navegador. Silencioso: si el
// navegador no lo soporta o falla, no pasa nada (la web funciona igual).
// Además: detecta versiones nuevas y avisa a la UI para ofrecer "Actualizar"
// (así el usuario NUNCA tiene que borrar el caché a mano).
export default function PWARegister() {
  // Red de seguridad independiente del service worker: preguntamos al servidor
  // qué build corre AHORA y lo comparamos con el que trae este bundle. Si el
  // cliente está viejo (típico en PWA instalada que no recarga), forzamos UNA
  // recarga. Esto rompe el caso "no actualiza en app" aunque el SW se atasque.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let stop = false;
    const KEY = 'onyx_vreload';   // versión para la que ya intentamos recargar (evita bucles)
    async function check() {
      try {
        const r = await fetch('/api/version?t=' + Date.now(), { cache: 'no-store' });
        if (!r.ok) return;
        const j = await r.json();
        const server = String(j?.v || '');
        if (stop || !server || server === APP_VERSION) return;
        // Hay build nuevo en el servidor y este bundle es viejo.
        if (sessionStorage.getItem(KEY) === server) {
          // Ya recargamos una vez para esta versión y seguimos viejos (HTML/JS
          // muy cacheado): ofrecemos el botón en vez de recargar en bucle.
          window.dispatchEvent(new Event('onyx-update-available'));
          return;
        }
        sessionStorage.setItem(KEY, server);
        // Intentamos activar el SW en espera antes de recargar (por si lo hay).
        try { const reg = await navigator.serviceWorker?.getRegistration(); reg?.waiting?.postMessage('SKIP_WAITING'); } catch {}
        window.location.reload();
      } catch {}
    }
    check();
    const onVis = () => { if (document.visibilityState === 'visible') check(); };
    const onFocus = () => check();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onFocus);
    const iv = setInterval(check, 30 * 60 * 1000);
    return () => { stop = true; clearInterval(iv); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('focus', onFocus); };
  }, []);

  useEffect(() => {
    // Guardamos el evento de "instalable" en cuanto el navegador lo lanza, para
    // que el botón "Instalar app" pueda usarlo aunque aparezca más tarde.
    const onPrompt = (e: any) => { e.preventDefault(); (window as any).__onyxInstall = e; window.dispatchEvent(new Event('onyx-installable')); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    const onInstalled = () => { (window as any).__onyxInstall = null; window.dispatchEvent(new Event('onyx-installed')); };
    window.addEventListener('appinstalled', onInstalled);

    let id: any, poll: any;
    let onVis: any, onFocus: any;
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const hadController = !!navigator.serviceWorker.controller;
      // Cuando la versión nueva toma el control (tras activar el SW nuevo),
      // recargamos una sola vez. En la primera instalación no había control, así
      // que no recargamos (la página ya funciona).
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing || !hadController) return;
        refreshing = true;
        window.location.reload();
      });

      // Aplica la versión en espera (activa el SW nuevo → controllerchange → recarga).
      const applyWaiting = (reg: ServiceWorkerRegistration) => { try { reg.waiting?.postMessage('SKIP_WAITING'); } catch {} };

      const announce = (reg: ServiceWorkerRegistration) => {
        (window as any).__onyxWaiting = reg.waiting;
        // Ofrecemos el botón "Actualizar" (opt-in inmediato)...
        window.dispatchEvent(new Event('onyx-update-available'));
        // ...pero además auto-aplicamos cuando el usuario deja la app en segundo
        // plano: así la versión nueva entra sin recargar a mitad de uso y, al
        // volver a abrir el PWA, ya está fresca. Esto evita quedarse con precios
        // viejos / tarjetas desaparecidas en modo app.
        const applyOnHide = () => {
          if (document.visibilityState === 'hidden') applyWaiting(reg);
        };
        document.addEventListener('visibilitychange', applyOnHide);
      };

      id = setTimeout(() => {
        navigator.serviceWorker.register('/sw.js?v=' + encodeURIComponent(APP_VERSION), { updateViaCache: 'none' as any })
          .then((reg) => {
            (window as any).__onyxReg = reg;
            if (reg.waiting && navigator.serviceWorker.controller) announce(reg); // ya hay una lista
            reg.addEventListener('updatefound', () => {
              const nw = reg.installing;
              if (!nw) return;
              nw.addEventListener('statechange', () => {
                // "installed" + hay un SW controlando = es una ACTUALIZACIÓN (no la 1ª vez).
                if (nw.state === 'installed' && navigator.serviceWorker.controller) announce(reg);
              });
            });
            // Un PWA instalado casi nunca hace una navegación nueva, así que el
            // navegador no busca versiones por su cuenta. Forzamos la búsqueda
            // cada hora y cada vez que el usuario vuelve a la app.
            poll = setInterval(() => { reg.update().catch(() => {}); }, 60 * 60 * 1000);
            onVis = () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); };
            onFocus = () => reg.update().catch(() => {});
            document.addEventListener('visibilitychange', onVis);
            window.addEventListener('focus', onFocus);
          })
          .catch(() => {});
      }, 1200);
    }
    return () => {
      clearTimeout(id); clearInterval(poll);
      if (onVis) document.removeEventListener('visibilitychange', onVis);
      if (onFocus) window.removeEventListener('focus', onFocus);
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);
  return null;
}
