'use client';
import { useEffect, useRef, useState } from 'react';
import OnyxIcon from './OnyxIcon';

// ============================================================
// Selector de sección para móvil (Admin, Mi cuenta, Academia).
//
// Sustituye al <select> nativo: un <select> nativo NO puede dibujar
// iconos SVG en sus <option> (el sistema operativo los pinta), así que
// salían emoji viejos o nada, y cerrado parecía un campo cualquiera.
// Este menú propio muestra el OnyxIcon en cada fila Y en el estado
// cerrado (con chevron), para que se vea claramente que es navegable.
// Usa la MISMA clase de visibilidad (adminnav-mobile / sk-nav-mobile),
// así el CSS lo enseña solo en móvil y lo oculta en escritorio.
// ============================================================
export type NavOpt = { value: string; label: string; icon: string; emoji?: boolean; badge?: string | number };
export type NavGroup = { label?: string; items: NavOpt[] };

export default function NavSelect({
  value, groups, onChange, className = 'adminnav-mobile',
}: {
  value: string; groups: NavGroup[]; onChange: (v: string) => void; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  const all = groups.flatMap((g) => g.items);
  const cur = all.find((o) => o.value === value) || all[0];
  const ic = (o: NavOpt, size = 16) => o.emoji ? <OnyxIcon emoji={o.icon} size={size} glow={false} /> : <OnyxIcon name={o.icon} size={size} glow={false} />;

  return (
    <div ref={box} className={className} style={{ position: 'relative', width: '100%' }}>
      {/* Botón cerrado: icono + sección actual + chevron */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '11px 12px', borderRadius: 12, border: '1px solid var(--line)',
          background: 'var(--card)', color: 'var(--tx)', fontSize: 14, fontWeight: 600,
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{ width: 26, height: 26, borderRadius: 8, background: 'color-mix(in srgb,var(--brand) 16%,transparent)', color: 'var(--brand)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{cur && ic(cur, 15)}</span>
        <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cur?.label}</span>
        <span style={{ color: 'var(--mut)', transform: open ? 'rotate(180deg)' : 'none', transition: '.15s', flex: 'none' }}>⌄</span>
      </button>

      {/* Lista desplegada */}
      {open && (
        <div
          role="listbox"
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 60,
            background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14,
            boxShadow: '0 18px 44px rgba(0,0,0,.5)', padding: 6, maxHeight: '60vh', overflowY: 'auto',
          }}
        >
          {groups.map((g, gi) => (
            <div key={gi}>
              {g.label && <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--mut)', margin: '10px 10px 4px' }}>{g.label}</div>}
              {g.items.map((o) => {
                const on = o.value === value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    role="option"
                    aria-selected={on}
                    onClick={() => { onChange(o.value); setOpen(false); }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 11px', borderRadius: 10, border: 'none', cursor: 'pointer',
                      textAlign: 'left', fontSize: 14, fontWeight: 600,
                      background: on ? 'var(--grad)' : 'transparent',
                      color: on ? '#fff' : 'var(--tx)',
                    }}
                  >
                    <span style={{ width: 20, display: 'inline-flex', justifyContent: 'center', color: on ? '#fff' : 'var(--brand)', flex: 'none' }}>{ic(o)}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>{o.label}</span>
                    {o.badge != null && o.badge !== '' && <span style={{ marginLeft: 'auto', fontSize: 10.5, fontWeight: 700, background: on ? 'rgba(255,255,255,.22)' : 'color-mix(in srgb,var(--brand) 22%,transparent)', color: on ? '#fff' : 'var(--brand)', padding: '1px 7px', borderRadius: 999, minWidth: 18, textAlign: 'center' }}>{o.badge}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
