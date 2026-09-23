'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

// ============================================================
// GuidePanel · guía flotante REUTILIZABLE para cualquier sección del admin.
//
//  · Se abre con un botón "Guía" (chip dorado) y flota sobre el panel.
//  · Se ARRASTRA por la cabecera a donde quieras.
//  · Se AGRANDA (botón) para leer cómodo y se contrae igual.
//  · Se CIERRA con la X; recuerda posición y tamaño en localStorage.
//  · Cada paso apunta a una sección real del panel (por `target`, un selector
//    con data-guide). Al tocarlo: hace scroll, la RESALTA con un anillo dorado
//    y dibuja una FLECHA animada desde la guía hasta esa sección.
//
// Uso:
//   <GuidePanel storageKey="ads" title="Guía de Publicidad" steps={[
//     { target: '[data-guide="review"]', title: '...', body: '...' }, ...
//   ]} />
// ============================================================

// Cada paso puede llevar, además del texto:
//  · example: un caso concreto ("Ej: The5ers, $180/mes…") que se pinta en una
//    tarjeta resaltada para que se entienda con un ejemplo real.
//  · svg: un dibujo/diagrama (SVG en texto) que ilustra el paso. Se pinta tal cual.
export type GuideStep = { target: string; title: string; body: string; example?: string; svg?: string };

const GOLD = '#d9b661';

export default function GuidePanel({ storageKey, title, steps, es = true, onStep }: { storageKey: string; title: string; steps: GuideStep[]; es?: boolean; onStep?: (target: string) => void }) {
  const L = (a: string, b: string) => (es ? a : b);
  const [open, setOpen] = useState(false);
  const [big, setBig] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: -1, y: -1 });
  const [size, setSize] = useState<{ w: number; h: number } | null>(null); // tamaño a medida (estirado por el usuario)
  const [arrow, setArrow] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const ringRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const rez = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  // Restaurar posición y tamaño guardados.
  useEffect(() => {
    try {
      const raw = localStorage.getItem('guide_pos_' + storageKey);
      if (raw) { const p = JSON.parse(raw); if (typeof p.x === 'number') setPos(p); }
      if (localStorage.getItem('guide_big_' + storageKey) === '1') setBig(true);
      const rawSz = localStorage.getItem('guide_size_' + storageKey);
      if (rawSz) { const s = JSON.parse(rawSz); if (typeof s.w === 'number' && typeof s.h === 'number') setSize(s); }
    } catch {}
  }, [storageKey]);

  const savePos = (p: { x: number; y: number }) => { try { localStorage.setItem('guide_pos_' + storageKey, JSON.stringify(p)); } catch {} };

  // Coloca el anillo de resalte y la flecha sobre el elemento objetivo del paso.
  const spotlight = useCallback((idx: number) => {
    const step = steps[idx]; if (!step) return;
    onStep?.(step.target); // avisa al panel para cambiar de pestaña si hace falta
    let tries = 0;
    let didScroll = false;
    const place = () => {
      const el = document.querySelector(step.target) as HTMLElement | null;
      // La sección puede estar en otra pestaña; reintentamos hasta que aparezca.
      if (!el || el.offsetParent === null) { if (tries++ < 14) setTimeout(place, 60); else setArrow(null); return; }
      // Desplazamos UNA sola vez (evita que la página "brinque"); las demás
      // pasadas solo reposicionan el anillo/flecha sin volver a desplazar.
      if (!didScroll) { el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); didScroll = true; }
      const r = el.getBoundingClientRect();
      if (ringRef.current) {
        ringRef.current.style.top = r.top - 6 + 'px';
        ringRef.current.style.left = r.left - 6 + 'px';
        ringRef.current.style.width = r.width + 12 + 'px';
        ringRef.current.style.height = r.height + 12 + 'px';
        ringRef.current.style.opacity = '1';
      }
      const pr = panelRef.current?.getBoundingClientRect();
      if (pr) {
        // Punta hacia el centro del borde más cercano del objetivo.
        const tx = Math.max(r.left, Math.min(pr.left + pr.width / 2, r.right));
        const ty = r.top + r.height / 2;
        const sx = pr.left + pr.width / 2;
        const sy = pr.top < ty ? pr.bottom : pr.top;
        setArrow({ x1: sx, y1: sy, x2: tx, y2: ty });
      }
      tries++;
      if (tries < 8) requestAnimationFrame(() => setTimeout(place, 45));
    };
    place();
  }, [steps, onStep]);

  useEffect(() => { if (open) spotlight(active); }, [open, active, spotlight]);

  // Reposicionar resalte al hacer scroll / resize mientras está abierto.
  useEffect(() => {
    if (!open) return;
    const on = () => spotlight(active);
    window.addEventListener('scroll', on, true);
    window.addEventListener('resize', on);
    return () => { window.removeEventListener('scroll', on, true); window.removeEventListener('resize', on); };
  }, [open, active, spotlight]);

  // Arrastre por la cabecera.
  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!drag.current) return;
      const x = Math.max(4, Math.min(window.innerWidth - 60, e.clientX - drag.current.dx));
      const y = Math.max(4, Math.min(window.innerHeight - 40, e.clientY - drag.current.dy));
      setPos({ x, y });
    };
    const up = () => { if (drag.current) { drag.current = null; setPos((p) => { savePos(p); return p; }); } };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, []); // eslint-disable-line

  const startDrag = (e: React.MouseEvent) => {
    const pr = panelRef.current?.getBoundingClientRect();
    if (!pr) return;
    drag.current = { dx: e.clientX - pr.left, dy: e.clientY - pr.top };
  };

  // Estirar (redimensionar) tomando la esquina inferior derecha.
  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!rez.current) return;
      e.preventDefault();
      const w = Math.max(280, Math.min(window.innerWidth - 24, rez.current.w + (e.clientX - rez.current.x)));
      const h = Math.max(220, Math.min(window.innerHeight - 24, rez.current.h + (e.clientY - rez.current.y)));
      setSize({ w, h });
    };
    const up = () => {
      if (rez.current) { rez.current = null; setSize((s) => { if (s) { try { localStorage.setItem('guide_size_' + storageKey, JSON.stringify(s)); } catch {} } return s; }); }
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, [storageKey]);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const pr = panelRef.current?.getBoundingClientRect();
    if (!pr) return;
    rez.current = { x: e.clientX, y: e.clientY, w: pr.width, h: pr.height };
  };
  const resetSize = () => { setSize(null); try { localStorage.removeItem('guide_size_' + storageKey); } catch {} };

  const toggleBig = () => setBig((b) => { const n = !b; try { localStorage.setItem('guide_big_' + storageKey, n ? '1' : '0'); } catch {} return n; });
  const close = () => { setOpen(false); setArrow(null); if (ringRef.current) ringRef.current.style.opacity = '0'; };

  // Botón para abrir (chip dorado). Se ve siempre.
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, background: 'rgba(212,175,90,.15)', color: GOLD, border: '1px solid rgba(212,175,90,.4)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>
        <span aria-hidden>📖</span> {L('Abrir guía', 'Open guide')}
      </button>
    );
  }

  // Dimensiones: el tamaño a medida (estirado) manda sobre el modo grande/pequeño.
  const width = size ? size.w : (big ? Math.min(720, window.innerWidth - 24) : 320);
  const panelH = size ? size.h : undefined;                               // altura fija del panel (cuando se estira)
  const bodyH = size ? undefined : (big ? Math.min(560, window.innerHeight - 40) : undefined); // altura del cuerpo en modo grande
  const wide = big || (size ? size.w >= 520 : false); // layout de dos columnas cuando hay ancho de sobra
  const left = pos.x >= 0 ? pos.x : Math.max(12, window.innerWidth - width - 24);
  const top = pos.y >= 0 ? pos.y : 90;

  return (
    <>
      {/* Anillo de resalte sobre la sección objetivo */}
      <div ref={ringRef} style={{ position: 'fixed', top: -9999, left: -9999, border: `2px solid ${GOLD}`, borderRadius: 12, boxShadow: `0 0 0 4px rgba(212,175,90,.18)`, pointerEvents: 'none', zIndex: 5000, transition: 'all .18s ease', opacity: 0, animation: 'onyxGuidePulse 1.4s ease-in-out infinite' }} />

      {/* Flecha animada guía → sección */}
      {arrow && (
        <svg style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 5001 }}>
          <defs>
            <marker id="onyxArrowHead" markerWidth="10" markerHeight="10" refX="7" refY="3" orient="auto">
              <path d="M0,0 L7,3 L0,6 Z" fill={GOLD} />
            </marker>
          </defs>
          <line x1={arrow.x1} y1={arrow.y1} x2={arrow.x2} y2={arrow.y2} stroke={GOLD} strokeWidth={2.5} strokeDasharray="7 6" markerEnd="url(#onyxArrowHead)" style={{ animation: 'onyxGuideDash 0.8s linear infinite' }} />
        </svg>
      )}

      {/* Panel de la guía */}
      <div ref={panelRef} style={{ position: 'fixed', left, top, width, height: panelH, maxWidth: 'calc(100vw - 24px)', maxHeight: 'calc(100vh - 24px)', background: '#14151b', border: `1px solid rgba(212,175,90,.5)`, borderRadius: 12, zIndex: 5002, boxShadow: '0 18px 50px rgba(0,0,0,.55)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div onMouseDown={startDrag} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 11px', borderBottom: '1px solid var(--line,#262838)', background: 'rgba(212,175,90,.08)', cursor: 'grab' }}>
          <span style={{ color: GOLD }} aria-hidden>📖</span>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: GOLD }}>{title}</span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
            {size && <button title={L('Restaurar tamaño', 'Reset size')} onClick={resetSize} style={hbtn}>⟲</button>}
            <button title={big ? L('Contraer', 'Shrink') : L('Agrandar', 'Expand')} onClick={toggleBig} style={hbtn}>{big ? '❐' : '⤢'}</button>
            <button title={L('Cerrar', 'Close')} onClick={close} style={hbtn}>✕</button>
          </span>
        </div>

        <div style={{ display: wide ? 'grid' : 'block', gridTemplateColumns: wide ? '220px 1fr' : undefined, height: bodyH, minHeight: 0, flex: 1, overflowY: wide ? 'hidden' : 'auto' }}>
          {/* Lista de pasos */}
          <div style={{ padding: 6, overflowY: 'auto', borderRight: wide ? '1px solid var(--line,#262838)' : undefined }}>
            <div style={{ fontSize: 10.5, color: 'var(--mut,#7f8598)', padding: '5px 8px' }}>{L('Pasos · toca uno y se ilumina en el panel', 'Steps · tap one, it lights up in the panel')}</div>
            {steps.map((s, i) => (
              <button key={i} onClick={() => setActive(i)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '7px 8px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: i === active ? 700 : 400, background: i === active ? GOLD : 'transparent', color: i === active ? '#1a1400' : 'var(--tx,#c7ccda)' }}>
                <span style={{ width: 18, height: 18, borderRadius: '50%', flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, background: i === active ? 'rgba(0,0,0,.18)' : 'rgba(255,255,255,.06)' }}>{i + 1}</span>
                {s.title}
              </button>
            ))}
          </div>
          {/* Cuerpo del paso activo */}
          <div style={{ padding: 12, overflowY: 'auto' }}>
            {!wide && <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 6, color: 'var(--tx,#e8ecf5)' }}>{steps[active]?.title}</div>}
            <div style={{ fontSize: 12.5, color: 'var(--mut,#aab0c0)', lineHeight: 1.55, whiteSpace: 'pre-line' }}>{steps[active]?.body}</div>

            {/* Dibujo / diagrama del paso */}
            {steps[active]?.svg && (
              <div style={{ marginTop: 12, background: 'rgba(255,255,255,.03)', border: '1px solid var(--line,#262838)', borderRadius: 10, padding: 10, display: 'flex', justifyContent: 'center' }}
                   dangerouslySetInnerHTML={{ __html: steps[active]!.svg! }} />
            )}

            {/* Ejemplo concreto */}
            {steps[active]?.example && (
              <div style={{ marginTop: 12, background: 'rgba(212,175,90,.08)', border: `1px solid rgba(212,175,90,.35)`, borderLeft: `3px solid ${GOLD}`, borderRadius: 8, padding: '9px 11px' }}>
                <div style={{ fontSize: 10.5, fontWeight: 800, color: GOLD, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{L('Ejemplo', 'Example')}</div>
                <div style={{ fontSize: 12, color: 'var(--tx,#d6dae6)', lineHeight: 1.5, whiteSpace: 'pre-line' }}>{steps[active]!.example}</div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
              <button disabled={active === 0} onClick={() => setActive((a) => Math.max(0, a - 1))} style={{ flex: 1, fontSize: 11.5, background: 'transparent', border: '1px solid var(--line,#39405a)', color: 'var(--tx,#c7ccda)', borderRadius: 8, padding: 6, cursor: active === 0 ? 'default' : 'pointer', opacity: active === 0 ? 0.5 : 1 }}>{L('Anterior', 'Back')}</button>
              {active < steps.length - 1
                ? <button onClick={() => setActive((a) => Math.min(steps.length - 1, a + 1))} style={{ flex: 1, fontSize: 11.5, background: GOLD, border: 'none', color: '#1a1400', borderRadius: 8, padding: 6, fontWeight: 700, cursor: 'pointer' }}>{L('Siguiente', 'Next')}</button>
                : <button onClick={close} style={{ flex: 1, fontSize: 11.5, background: GOLD, border: 'none', color: '#1a1400', borderRadius: 8, padding: 6, fontWeight: 700, cursor: 'pointer' }}>{L('Listo', 'Done')}</button>}
            </div>
          </div>
        </div>

        {/* Tirador para estirar (ancho/alto) — esquina inferior derecha */}
        <div onMouseDown={startResize} onDoubleClick={resetSize}
             title={L('Arrastra para estirar · doble clic restaura', 'Drag to resize · double-click resets')}
             style={{ position: 'absolute', right: 2, bottom: 2, width: 18, height: 18, cursor: 'nwse-resize', zIndex: 3, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
          <svg width="14" height="14" viewBox="0 0 14 14" style={{ opacity: 0.6 }}>
            <path d="M13 5 L5 13 M13 9 L9 13 M13 1 L1 13" stroke={GOLD} strokeWidth="1.4" fill="none" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      <style>{`@keyframes onyxGuideDash{to{stroke-dashoffset:-26}}@keyframes onyxGuidePulse{0%,100%{box-shadow:0 0 0 4px rgba(212,175,90,.18)}50%{box-shadow:0 0 0 8px rgba(212,175,90,.28)}}`}</style>
    </>
  );
}

const hbtn: React.CSSProperties = { width: 22, height: 22, borderRadius: 6, border: 'none', background: 'rgba(255,255,255,.06)', color: 'var(--mut,#9aa6bd)', fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 };
