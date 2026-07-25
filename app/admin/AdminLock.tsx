'use client';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

// Temporizador de inactividad del panel admin. Tras `idleMin` minutos sin
// mover ratón / teclear / hacer scroll, bloquea el panel (cookie httpOnly)
// y recarga para que el servidor muestre la pantalla de bloqueo.
// Solo se activa para quien tenga PIN (hasPin).
export default function AdminLock({ hasPin, idleMin }: { hasPin: boolean; idleMin: number }) {
  const router = useRouter();
  const timer = useRef<any>(null);
  const firing = useRef(false);

  useEffect(() => {
    if (!hasPin) return;
    const ms = Math.max(1, idleMin) * 60 * 1000;

    async function lock() {
      if (firing.current) return;
      firing.current = true;
      try {
        await fetch('/api/admin/security', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'lock' }),
        });
      } catch {}
      router.refresh(); // el servidor renderiza la pantalla de bloqueo
    }

    function reset() {
      if (firing.current) return;
      clearTimeout(timer.current);
      timer.current = setTimeout(lock, ms);
    }

    const evs = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
    evs.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => { clearTimeout(timer.current); evs.forEach((e) => window.removeEventListener(e, reset)); };
  }, [hasPin, idleMin, router]);

  return null;
}
