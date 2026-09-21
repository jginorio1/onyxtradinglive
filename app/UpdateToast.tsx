'use client';
import { useEffect, useState } from 'react';

// Aviso amable de "nueva versión". Al tocar Actualizar, activamos el service
// worker nuevo (SKIP_WAITING); PWARegister recarga la página una sola vez.
export default function UpdateToast() {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const es = typeof document !== 'undefined' ? (document.documentElement.lang || 'es').slice(0, 2) !== 'en' : true;

  useEffect(() => {
    const on = () => setShow(true);
    window.addEventListener('onyx-update-available', on);
    return () => window.removeEventListener('onyx-update-available', on);
  }, []);

  async function update() {
    setBusy(true);
    try {
      const w = (window as any).__onyxWaiting;
      if (w && w.postMessage) w.postMessage('SKIP_WAITING');
      else if ('serviceWorker' in navigator) { const reg = await navigator.serviceWorker.getRegistration(); reg?.waiting?.postMessage('SKIP_WAITING'); }
    } catch {}
    // Respaldo: si en 1.5s no cambió el control, recargamos igual.
    setTimeout(() => window.location.reload(), 1500);
  }

  if (!show) return null;
  return (
    <div style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 18, zIndex: 9999, maxWidth: 'calc(100vw - 24px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--card, #121829)', color: 'var(--tx, #fff)', border: '1px solid var(--brand, #5b6cff)', borderRadius: 12, padding: '11px 14px', boxShadow: '0 10px 30px rgba(0,0,0,.4)' }}>
        <span style={{ fontSize: 13.5 }}>{es ? 'Hay una versión nueva disponible.' : 'A new version is available.'}</span>
        <button onClick={update} disabled={busy} style={{ border: 'none', cursor: 'pointer', background: 'var(--brand, #5b6cff)', color: '#fff', borderRadius: 9, padding: '7px 13px', fontSize: 13, fontWeight: 600 }}>
          {busy ? (es ? 'Actualizando…' : 'Updating…') : (es ? 'Actualizar' : 'Update')}
        </button>
        <button onClick={() => setShow(false)} aria-label={es ? 'Cerrar' : 'Dismiss'} style={{ border: 'none', cursor: 'pointer', background: 'transparent', color: 'var(--mut, #8b93a7)', fontSize: 16, lineHeight: 1, padding: '0 2px' }}>✕</button>
      </div>
    </div>
  );
}
