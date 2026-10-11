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
  const [cue, setCue] = useState(true);         // pista "tócalo — es interactivo"
  const [hover, setHover] = useState(false);    // realce al pasar el cursor

  useEffect(() => {
    const onChange = () => setFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // La pista se autodesvanece a los ~5 s para no estorbar.
  useEffect(() => {
    const t = setTimeout(() => setCue(false), 5000);
    return () => clearTimeout(t);
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
  const showCue = cue && !active;

  return (
    <div
      ref={wrapRef}
      className="vframe"
      onMouseEnter={() => { setHover(true); setCue(false); }}
      onMouseLeave={() => setHover(false)}
      onPointerDown={() => setCue(false)}
      style={{
        position: 'relative',
        // Más grande y que se ajuste al monitor: hasta 1180 en pantallas grandes.
        maxWidth: active ? '100%' : 1180,
        margin: '0 auto',
        display: 'flex', flexDirection: 'column',
        // Realce sutil al pasar el cursor: invita a interactuar.
        boxShadow: hover && !active ? '0 0 0 2px color-mix(in srgb, var(--brand) 55%, transparent), 0 16px 44px -18px rgba(0,0,0,.6)' : undefined,
        transition: 'box-shadow .18s ease',
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
          style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, background: active ? 'transparent' : 'linear-gradient(100deg,#ffe08a,#e8b923)', border: active ? '1px solid var(--line)' : 'none', color: active ? 'var(--tx)' : '#2a1e02', fontSize: 12.5, fontWeight: 600, padding: '6px 12px', borderRadius: 8, cursor: 'pointer' }}
        >
          <span aria-hidden style={{ fontSize: 13 }}>{active ? '✕' : '⛶'}</span>{label}
        </button>
      </div>

      <div style={{ position: 'relative', flex: active ? 1 : 'none', minHeight: 0, display: 'flex' }}>
        <iframe
          src="/demo"
          title={es ? 'Demo interactivo de Onyx' : 'Interactive Onyx demo'}
          loading="lazy"
          style={{ width: '100%', flex: active ? 1 : 'none', height: active ? 'auto' : 'min(78vh, 760px)', minHeight: 0, border: 0, background: 'var(--bg2)' }}
        />

        {/* Pista de interacción: píldora dorada + cursor; se autodesvanece. */}
        {showCue && (
          <div aria-hidden style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <div className="onyx-democue" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 600, color: '#2a1e02', background: 'linear-gradient(100deg,#ffe08a,#e8b923)', padding: '8px 15px', borderRadius: 999, boxShadow: '0 8px 22px -6px rgba(0,0,0,.55)' }}>
                👆 {es ? 'Tócalo — es interactivo' : "It's interactive — try it"}
              </span>
              <span className="onyx-democue-ptr" style={{ fontSize: 26 }}>🖱️</span>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes onyxDemoPulse { 0%,100%{ transform:scale(1); opacity:1 } 50%{ transform:scale(1.05); opacity:.9 } }
        @keyframes onyxDemoTap { 0%,70%,100%{ transform:translateY(0) } 82%{ transform:translateY(5px) } }
        .onyx-democue{ animation:onyxDemoPulse 2.2s ease-in-out infinite }
        .onyx-democue-ptr{ animation:onyxDemoTap 2.2s ease-in-out infinite }
      `}</style>
    </div>
  );
}
