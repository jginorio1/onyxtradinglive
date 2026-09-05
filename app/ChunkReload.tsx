'use client';
import { useEffect } from 'react';

// Tras publicar una versión nueva, una pestaña vieja puede pedir una "pieza" de
// código que ya no existe y falla (ChunkLoadError). En vez de dejar la pantalla
// rota (y tener que decirle al usuario que borre el caché), recargamos UNA sola
// vez de forma automática. El candado en sessionStorage evita bucles.
export default function ChunkReload() {
  useEffect(() => {
    const KEY = 'onyx_chunk_reload';
    const isChunkError = (msg: string) =>
      /ChunkLoadError|Loading chunk [\d]+ failed|Loading CSS chunk|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i.test(msg || '');

    const recover = (msg: string) => {
      if (!isChunkError(msg)) return;
      let n = 0;
      try { n = Number(sessionStorage.getItem(KEY) || '0'); } catch {}
      if (n >= 2) return; // ya lo intentamos: no entrar en bucle
      try { sessionStorage.setItem(KEY, String(n + 1)); } catch {}
      window.location.reload();
    };

    const onError = (e: ErrorEvent) => recover(e?.message || String(e?.error || ''));
    const onRej = (e: PromiseRejectionEvent) => { const r: any = e?.reason; recover(r?.message || String(r || '')); };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRej);
    // Si la app cargó bien un rato, limpiamos el contador para el próximo deploy.
    const t = setTimeout(() => { try { sessionStorage.removeItem(KEY); } catch {} }, 12000);
    return () => { window.removeEventListener('error', onError); window.removeEventListener('unhandledrejection', onRej); clearTimeout(t); };
  }, []);
  return null;
}
