'use client';
import { useEffect } from 'react';

// Guarda el desfase horario del trader (una vez por sesión) para entregar el
// reporte de Telegram a SU hora local, y AUTO-SINCRONIZA su zona IANA
// (ej. 'America/Puerto_Rico') mientras no la haya fijado a mano en el perfil.
// Si no hay sesión, la API lo ignora.
export default function TzSync() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem('onyx_tz') === '1') return;
      const off = -new Date().getTimezoneOffset(); // local = UTC + off (UTC-3 = -180)
      // Nombre IANA real del navegador (ej. 'America/Puerto_Rico'). Puede faltar
      // en navegadores muy viejos → va vacío y la API solo actualiza el desfase.
      let zone = '';
      try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch {}
      fetch('/api/account/tz', { method: 'POST', body: JSON.stringify({ off, zone }) })
        .then(() => { try { sessionStorage.setItem('onyx_tz', '1'); } catch {} })
        .catch(() => {});
    } catch {}
  }, []);
  return null;
}
