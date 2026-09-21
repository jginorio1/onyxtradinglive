'use client';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

// Seguridad del panel admin por inactividad.
//
// Clave: el BLOQUEO lo decide el servidor por la ANTIGÜEDAD de la marca de
// actividad (cookie onyx_seen), no por un temporizador de JavaScript. Este
// componente solo hace dos cosas:
//   1) renovar la marca cuando hay actividad real (ping, como mucho 1/min),
//   2) al volver a la pestaña o si pasa el tiempo, pedir un re-render para que
//      el servidor muestre el bloqueo si la marca ya quedó vieja.
// Así funciona aunque el móvil congele el JS en segundo plano.
export default function AdminLock({ hasPin, idleMin }: { hasPin: boolean; idleMin: number }) {
  const router = useRouter();
  const lastActive = useRef(Date.now());
  const lastPing = useRef(0);

  useEffect(() => {
    if (!hasPin) return;
    const idleMs = Math.max(1, idleMin) * 60 * 1000;

    async function ping() {
      lastPing.current = Date.now();
      try {
        await fetch('/api/admin/security', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'ping' }),
        });
      } catch {}
    }

    function onActivity() {
      lastActive.current = Date.now();
      if (Date.now() - lastPing.current > 60 * 1000) ping(); // renueva como mucho 1/min
    }

    function checkStale() {
      if (Date.now() - lastActive.current > idleMs) router.refresh(); // el servidor mostrará el bloqueo
    }

    ping(); // deja la marca fresca al entrar

    const evs = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
    evs.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    const onVis = () => { if (document.visibilityState === 'visible') checkStale(); };
    document.addEventListener('visibilitychange', onVis);
    const onShow = (e: any) => { if (e && e.persisted) checkStale(); }; // vuelta desde bfcache
    window.addEventListener('pageshow', onShow);
    const iv = setInterval(checkStale, 30 * 1000); // por si la pestaña sigue abierta pero inactiva

    return () => {
      evs.forEach((e) => window.removeEventListener(e, onActivity));
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pageshow', onShow);
      clearInterval(iv);
    };
  }, [hasPin, idleMin, router]);

  return null;
}
