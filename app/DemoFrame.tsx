'use client';
import { useEffect, useRef, useState } from 'react';

// Panel demo interactivo del landing: incrusta el dashboard real (ruta pública
// /demo, solo datos de ejemplo, sin login) y permite verlo a pantalla completa.
// Pantalla completa: usa la Fullscreen API del navegador donde existe; en iOS
// Safari (que no la soporta en divs) cae a un modo "expandido" por CSS.
export default function DemoFrame({ lang = 'es' }: { lang?: 'es' | 'en' }) {
  const es = lang === 'es';
  const wrapRef = useRef<HTMLDivElement>(null);
  const [fs, setFs] = useState(false);          // fullscreen real del navegador
  const [expanded, setExpanded] = useState(false); // fallback iOS (CSS)

  useEffect(() => {
    const onChange = () => setFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // Al expandir (fallback iOS) bloqueamos el scroll del fondo.
  useEffect(() => {
    if (expanded) { const p = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = p; }; }
  }, [expanded]);

  const toggleFull = () => {
    const el = wrapRef.current;
    if (!el) return;
    const doc: any = document;
    if (fs || doc.fullscreenElement) { try { doc.exitFullscreen?.(); } catch {} return; }
    if (expanded) { setExpanded(false); return; }
    const req = (el as any).requestFullscreen || (el as any).webkitRequestFullscreen;
    if (req) { try { req.call(el); return; } catch {} }
    // iOS Safari: no hay fullscreen en divs → modo expandido por CSS.
    setExpanded(true);
  };

  const active = fs || expanded;
  const label = active ? (es ? 'Salir de pantalla completa' : 'Exit full screen') : (es ? 'Pantalla completa' : 'Full screen');

  return (
    <div
      ref={wrapRef}
      className="vframe"
      style={{
        maxWidth: active ? '100%' : 940,
        margin: '0 auto',
        display: 'flex', flexDirection: 'column',
        // Pantalla completa real (Fullscreen API): el contenedor ocupa todo el alto.
        ...(active ? { width: '100%', height: '100dvh', borderRadius: 0, background: 'var(--bg)' } : {}),
        // Fallback iOS: además lo fijamos sobre todo lo demás.
        ...(expanded ? { position: 'fixed', inset: 0, zIndex: 9999, maxWidth: '100%', width: '100vw' } : {}),
      }}
    >
      <div className="row" style={{ gap: 7, padding: '11px 14px', borderBottom: '1px solid var(--line)', background: 'var(--bg)' }}>
        <span className="vdot" style={{ background: 'var(--red)' }} /><span className="vdot" style={{ background: 'var(--amber)' }} /><span className="vdot" style={{ background: 'var(--green)' }} />
        <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>onyxtradinglive.com/demo</span>
        <span className="pill green" style={{ marginLeft: 10, fontSize: 11, padding: '2px 9px' }}>{es ? 'EN VIVO · demo' : 'LIVE · demo'}</span>
        <button
          onClick={toggleFull}
          aria-label={label}
          style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', border: '1px solid var(--line)', color: 'var(--tx)', fontSize: 12.5, padding: '5px 11px', borderRadius: 8, cursor: 'pointer' }}
        >
          <span aria-hidden style={{ fontSize: 13 }}>{active ? '✕' : '⛶'}</span>{label}
        </button>
      </div>

      <iframe
        src="/demo"
        title={es ? 'Demo interactivo de Onyx' : 'Interactive Onyx demo'}
        loading="lazy"
        style={{ width: '100%', flex: active ? 1 : 'none', height: active ? 'auto' : 'min(72vh, 640px)', minHeight: 0, border: 0, background: 'var(--bg2)' }}
      />
    </div>
  );
}
