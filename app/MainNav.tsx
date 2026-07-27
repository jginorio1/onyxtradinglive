'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type NavItem = { href: string; label: string; dot?: 'on' | 'off'; dim?: boolean; icon?: string; dotTitle?: string };

// ============================================================
// Enlaces de la barra.
//
// Antes esto era un div que se ocultaba entero bajo 900px de ancho, sin
// nada que lo sustituyera: en un portátil pequeño te quedabas sin
// navegación. Ahora, cuando no caben, se recogen en un menú.
//
// Además marca en qué página estás, que antes no se sabía.
// ============================================================
export default function MainNav({ items, authItems }: { items: NavItem[]; authItems?: NavItem[] }) {
  const pathname = usePathname() || '/';
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // Cierra al navegar
  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  // /dashboard no debe marcarse activo estando en /dashboard/keys
  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href;

  return (
    <>
      <div className="navl">
        {items.map((i) => {
          const dt = i.dot ? (i.dotTitle || (i.dot === 'on' ? 'activo' : 'inactivo')) : undefined;
          return (
            <Link key={i.href} className={'navlink' + (isActive(i.href) ? ' on' : '') + (i.dim ? ' dim' : '')} href={i.href} title={dt}>
              {i.icon && <span aria-hidden="true" style={{ marginRight: 6 }}>{i.icon}</span>}
              {i.label}
              {i.dot && <span className={'navdotmini ' + i.dot} role="img" aria-label={dt} />}
            </Link>
          );
        })}
      </div>

      <div ref={box} className="navburger-wrap">
        <button className="navburger" onClick={() => setOpen(!open)} aria-label="Menú" aria-expanded={open}>
          <span /><span /><span />
        </button>
        {open && (
          <div className="menu" style={{ minWidth: 180 }}>
            {items.map((i) => (
              <Link key={i.href} className={'menu-item' + (isActive(i.href) ? ' on' : '')} href={i.href}>
                {i.icon && <span aria-hidden="true" style={{ marginRight: 8 }}>{i.icon}</span>}
                {i.label}
                {i.dot && <span className={'navdotmini ' + i.dot} style={{ marginLeft: 8 }} />}
              </Link>
            ))}
            {authItems && authItems.length > 0 && (
              <div style={{ borderTop: '1px solid var(--line)', margin: '6px 0 0', paddingTop: 6 }}>
                {authItems.map((i) => (
                  <Link key={i.href} className="menu-item" href={i.href}>{i.label}</Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
