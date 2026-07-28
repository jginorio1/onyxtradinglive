'use client';
import { useEffect } from 'react';

// Registra el service worker una vez, en el navegador. Silencioso: si el
// navegador no lo soporta o falla, no pasa nada (la web funciona igual).
export default function PWARegister() {
  useEffect(() => {
    // Guardamos el evento de "instalable" en cuanto el navegador lo lanza, para
    // que el botón "Instalar app" pueda usarlo aunque aparezca más tarde.
    const onPrompt = (e: any) => { e.preventDefault(); (window as any).__onyxInstall = e; window.dispatchEvent(new Event('onyx-installable')); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    const onInstalled = () => { (window as any).__onyxInstall = null; window.dispatchEvent(new Event('onyx-installed')); };
    window.addEventListener('appinstalled', onInstalled);

    let id: any;
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      id = setTimeout(() => { navigator.serviceWorker.register('/sw.js').catch(() => {}); }, 1200);
    }
    return () => { clearTimeout(id); window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);
  return null;
}
