'use client';
import { useEffect } from 'react';

// Registra el service worker una vez, en el navegador. Silencioso: si el
// navegador no lo soporta o falla, no pasa nada (la web funciona igual).
export default function PWARegister() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const id = setTimeout(() => {
      navigator.serviceWorker.register('/sw.js').catch(() => { /* opcional */ });
    }, 1200);   // esperamos a que cargue lo importante primero
    return () => clearTimeout(id);
  }, []);
  return null;
}
