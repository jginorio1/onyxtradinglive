'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

// ============================================================
// Popup de ayuda ROBUSTO (el "?" o la "i" al lado de las etiquetas).
// Arregla 3 molestias en móvil:
//  1) Se cierra tocando FUERA (capa invisible a pantalla completa), con la X
//     o con Escape — antes había que volver a tocar el mismo botón.
//  2) Nunca se corta en el borde: el globo es `position:fixed` y se mide el
//     botón para colocarlo SIEMPRE dentro de la pantalla (clamp horizontal y
//     preferencia arriba→abajo según el espacio disponible).
//  3) Si el texto es largo, hace scroll dentro del globo (maxHeight 60vh).
// ============================================================
export function HintPop({ text, glyph = '?' }: { text: string; glyph?: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const popRef = useRef<HTMLSpanElement | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const b = btnRef.current?.getBoundingClientRect();
      if (!b) return;
      const vw = window.innerWidth, vh = window.innerHeight;
      const width = Math.min(260, vw - 24);
      let left = b.left + b.width / 2 - width / 2;
      left = Math.max(12, Math.min(left, vw - width - 12));
      const h = popRef.current?.offsetHeight || 130;
      let top = b.top - h - 8;              // preferimos arriba
      if (top < 12) top = b.bottom + 8;     // si no cabe, abajo
      top = Math.max(12, Math.min(top, vh - h - 12));
      setPos({ top, left, width });
    };
    place();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, text]);

  return (
    <span style={{ position: 'relative', display: 'inline-flex', verticalAlign: 'middle', marginLeft: 5 }}>
      <button
        ref={btnRef} type="button" aria-label="Ayuda"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((o) => !o); }}
        style={{ width: 16, height: 16, borderRadius: '50%', border: '1px solid var(--line,#3a4363)', background: 'var(--card,#1b2338)', color: 'var(--mut,#9aa6bd)', fontSize: 10.5, lineHeight: '14px', cursor: 'pointer', padding: 0, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}
      >{glyph}</button>
      {open && (
        <>
          {/* Capa para cerrar tocando fuera */}
          <span
            onClick={(e) => { e.stopPropagation(); setOpen(false); }}
            style={{ position: 'fixed', inset: 0, zIndex: 4000, background: 'transparent' }}
          />
          <span
            ref={popRef} role="tooltip" onClick={(e) => e.stopPropagation()}
            style={{ position: 'fixed', top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: pos?.width ?? 260, background: 'var(--panel,#161c2e)', border: '1px solid var(--accent,#8b93ff)', borderRadius: 10, padding: '10px 12px', paddingRight: 28, fontSize: 12, color: 'var(--tx,#e8ecf5)', lineHeight: 1.5, zIndex: 4001, boxShadow: '0 10px 34px rgba(0,0,0,.5)', fontWeight: 400, whiteSpace: 'normal', textAlign: 'left', maxHeight: '60vh', overflowY: 'auto', visibility: pos ? 'visible' : 'hidden' }}
          >
            <button
              type="button" aria-label="Cerrar"
              onClick={(e) => { e.stopPropagation(); setOpen(false); }}
              style={{ position: 'absolute', top: 3, right: 3, width: 22, height: 22, borderRadius: '50%', border: 'none', background: 'transparent', color: 'var(--mut,#9aa6bd)', fontSize: 14, cursor: 'pointer', lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            >✕</button>
            {text}
          </span>
        </>
      )}
    </span>
  );
}

// Alias para las distintas superficies (mismo comportamiento).
export const Hint = ({ text }: { text: string }) => <HintPop text={text} glyph="?" />;
export const Help = ({ text }: { text: string }) => <HintPop text={text} glyph="i" />;
export default HintPop;
