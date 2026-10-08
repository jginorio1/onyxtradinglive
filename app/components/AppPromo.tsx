'use client';
// Avisos de "descarga la app" para usuarios nuevos. Dos piezas:
//  - GetAppBanner: banner dentro del dashboard, se muestra una vez y se cierra (lo recuerda).
//  - AppSmartBanner: barra inferior SOLO en web móvil (teléfono con navegador).
// Ambos se ocultan dentro de la app nativa (no tiene sentido ofrecer bajar la app estando en ella).
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/lang';
import { isNativeApp } from '@/lib/native';
import GooglePlayBadge from './GooglePlayBadge';
import AppStoreBadge from './AppStoreBadge';

// ---- Banner del dashboard (una vez) --------------------------------------
export function GetAppBanner() {
  const { lang } = useLang();
  const es = lang === 'es';
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (isNativeApp()) return;                 // dentro de la app: nada
      if (localStorage.getItem('onyx_getapp_banner') === 'off') return; // ya cerrado
      setShow(true);
    } catch {}
  }, []);

  if (!show) return null;
  const close = () => { try { localStorage.setItem('onyx_getapp_banner', 'off'); } catch {} setShow(false); };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      background: 'linear-gradient(120deg,#1b2033,#141828)', border: '1px solid var(--line,#2b3250)',
      borderRadius: 12, padding: '11px 14px', marginBottom: 14,
    }}>
      <span style={{ fontSize: 20, flex: 'none' }}>📱</span>
      <div style={{ flex: 1, lineHeight: 1.3 }}>
        <b style={{ fontSize: 14 }}>{es ? 'Llévanos en el móvil' : 'Carry us on your phone'}</b>
        <div className="muted" style={{ fontSize: 12 }}>
          {es ? 'Tu Guardian, tus robots y tus cuentas en el bolsillo.' : 'Your Guardian, robots and accounts in your pocket.'}
        </div>
      </div>
      <span style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}><GooglePlayBadge size="xs" /><AppStoreBadge size="xs" /></span>
      <button aria-label={es ? 'Cerrar' : 'Close'} onClick={close}
        style={{ background: 'none', border: 'none', color: 'var(--mut,#8a90a2)', fontSize: 16, cursor: 'pointer', flex: 'none' }}>✕</button>
    </div>
  );
}

// ---- Smart banner inferior (solo web móvil) ------------------------------
export function AppSmartBanner() {
  const { lang } = useLang();
  const es = lang === 'es';
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (isNativeApp()) return;
      const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches;
      if (!isMobile) return;
      if (localStorage.getItem('onyx_smartbanner') === 'off') return;
      setShow(true);
    } catch {}
  }, []);

  if (!show) return null;
  const close = () => { try { localStorage.setItem('onyx_smartbanner', 'off'); } catch {} setShow(false); };

  return (
    <div style={{
      position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1200,
      display: 'flex', alignItems: 'center', gap: 10,
      background: 'var(--card2,#161b28)', borderTop: '1px solid var(--line,#2b3250)',
      padding: '9px 12px', paddingBottom: 'calc(9px + env(safe-area-inset-bottom, 0px))',
    }}>
      <img src="/onyx-symbol.png" alt="" style={{ width: 30, height: 30, borderRadius: 8, flex: 'none' }} />
      <div style={{ flex: 1, lineHeight: 1.2 }}>
        <b style={{ fontSize: 12.5 }}>Onyx Trading Live</b>
        <div className="muted" style={{ fontSize: 10.5 }}>{es ? 'Gratis · Android e iPhone' : 'Free · Android & iPhone'}</div>
      </div>
      <span style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 7 }}><GooglePlayBadge size="xs" /><AppStoreBadge size="xs" /></span>
      <button aria-label={es ? 'Cerrar' : 'Close'} onClick={close}
        style={{ background: 'none', border: 'none', color: 'var(--mut,#8a90a2)', fontSize: 15, cursor: 'pointer', flex: 'none' }}>✕</button>
    </div>
  );
}
