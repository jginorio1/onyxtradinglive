'use client';
import { useState } from 'react';

// Ícono ⓘ con explicación al pasar el mouse o tocar: qué es el campo y qué poner.
// Se usa junto a las etiquetas del Motor de la fábrica.
export function Help({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', verticalAlign: 'middle' }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span
        role="button"
        aria-label={text}
        tabIndex={0}
        onClick={(e) => { e.preventDefault(); setOpen((o) => !o); }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((o) => !o); } }}
        onBlur={() => setOpen(false)}
        style={{ cursor: 'help', width: 15, height: 15, borderRadius: '50%', border: '1px solid color-mix(in srgb,var(--tx) 35%,transparent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, lineHeight: 1, color: 'color-mix(in srgb,var(--tx) 60%,transparent)', marginLeft: 5, userSelect: 'none' }}
      >i</span>
      {open && (
        <span
          role="tooltip"
          style={{ position: 'absolute', bottom: '135%', left: '50%', transform: 'translateX(-50%)', width: 230, maxWidth: '70vw', background: '#0b1220', color: '#e8f0ff', border: '1px solid rgba(255,255,255,.16)', borderRadius: 9, padding: '9px 11px', fontSize: 11.5, lineHeight: 1.55, fontWeight: 500, zIndex: 60, boxShadow: '0 8px 24px rgba(0,0,0,.4)', whiteSpace: 'normal', textAlign: 'left', pointerEvents: 'none' }}
        >{text}</span>
      )}
    </span>
  );
}
