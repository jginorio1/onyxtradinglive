'use client';
import { useEffect } from 'react';

// Guarda el desfase horario del trader (una vez por sesión) para entregar el
// reporte de Telegram a SU hora local. Si no hay sesión, la API lo ignora.
export default function TzSync() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem('onyx_tz') === '1') return;
      const off = -new Date().getTimezoneOffset(); // local = UTC + off (UTC-3 = -180)
      fetch('/api/account/tz', { method: 'POST', body: JSON.stringify({ off }) })
        .then(() => { try { sessionStorage.setItem('onyx_tz', '1'); } catch {} })
        .catch(() => {});
    } catch {}
  }, []);
  return null;
}
