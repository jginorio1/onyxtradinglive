'use client';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

// Manda un ping ligero en cada cambio de página (incluida la primera carga) para
// medir visitantes reales. No usa cookies. Se salta el panel de admin y refresca
// un "latido" cada 60s mientras la pestaña esté visible, para el contador "en línea".
export default function VisitorBeacon() {
  const path = usePathname();
  const last = useRef('');

  useEffect(() => {
    if (!path || /^\/admin/.test(path)) return;

    const ping = () => {
      try {
        const body = JSON.stringify({ path, ref: document.referrer || '' });
        // sendBeacon no espera y no bloquea la navegación; fetch como respaldo.
        if (navigator.sendBeacon) navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' }));
        else fetch('/api/track', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true });
      } catch {}
    };

    if (last.current !== path) { last.current = path; ping(); }

    // Latido para mantener vivo el "en línea ahora" sin recargar página.
    const iv = setInterval(() => { if (document.visibilityState === 'visible') ping(); }, 60000);
    return () => clearInterval(iv);
  }, [path]);

  return null;
}
