'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import OnyxIcon from '@/app/components/OnyxIcon';

export type NavItem = { href: string; label: string; dot?: 'on' | 'off'; dim?: boolean; icon?: string; dotTitle?: string; full?: boolean; gold?: boolean; tint?: string; sep?: boolean; children?: NavItem[] };
// Chip dorado (marca Onyx Bot Lab) para destacar un destino distinto en el nav.
const GOLD_CHIP: any = { background: 'linear-gradient(120deg,#ffd45e,#ffb020)', color: '#4a2b00', borderRadius: 99, padding: '4px 13px', fontWeight: 800, boxShadow: '0 4px 14px rgba(255,176,32,.28)' };

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
  const [openGroup, setOpenGroup] = useState<string | null>(null); // grupo desplegable abierto (desktop)
  const [menuTop, setMenuTop] = useState<number | null>(null);   // top del menú en móvil (px, relativo al bloque contenedor)
  const [menuMaxH, setMenuMaxH] = useState<number | null>(null); // alto máximo disponible en pantalla (px)
  const box = useRef<HTMLDivElement>(null);

  // Cierra al navegar
  useEffect(() => { setOpen(false); setOpenGroup(null); }, [pathname]);

  // Cierra el grupo desplegable (desktop) al hacer clic fuera o con Escape.
  useEffect(() => {
    if (!openGroup) return;
    const away = (e: MouseEvent) => { const t = e.target as HTMLElement; if (!t.closest('.navl-group')) setOpenGroup(null); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenGroup(null); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [openGroup]);

  // En móvil, ancla el menú al borde INFERIOR real de la barra (medido en vivo).
  // Así no depende de suponer 64px + alto de promo + muesca: siempre queda pegado
  // bajo la barra en cualquier iPhone/Android. En desktop no se aplica (top=null).
  useEffect(() => {
    if (!open) return;
    const compute = () => {
      const mobile = typeof window !== 'undefined' && window.matchMedia('(max-width:600px)').matches;
      if (!mobile) { setMenuTop(null); return; }
      // El menú va debajo de TODA la cabecera fija: barra + (si existe) sub-barra
      // de secciones. Tomamos el borde inferior más bajo de las dos.
      let bottom = 0;
      for (const sel of ['.topbar', '.secnav']) {
        const el = document.querySelector(sel) as HTMLElement | null;
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (r.height > 0 && r.bottom > bottom) bottom = r.bottom;
      }
      if (bottom <= 0) { setMenuTop(null); setMenuMaxH(null); return; }
      setMenuMaxH(Math.max(160, Math.round(window.innerHeight - bottom - 8)));
      // OJO: el menú vive DENTRO de .topbar, que tiene backdrop-filter. Eso convierte
      // a la barra en el "bloque contenedor" de los position:fixed hijos, así que el
      // top NO se mide desde la pantalla sino desde la barra. Si la barra crea ese
      // bloque, restamos su desplazamiento para clavar el menú en la posición real.
      const tb = document.querySelector('.topbar') as HTMLElement | null;
      let offsetY = 0;
      if (tb) {
        const cs = getComputedStyle(tb) as any;
        const creates = (cs.backdropFilter && cs.backdropFilter !== 'none')
          || (cs.webkitBackdropFilter && cs.webkitBackdropFilter !== 'none')
          || (cs.transform && cs.transform !== 'none')
          || (cs.filter && cs.filter !== 'none')
          || (cs.perspective && cs.perspective !== 'none')
          || (cs.willChange && /transform|filter/.test(cs.willChange));
        if (creates) offsetY = tb.getBoundingClientRect().top;
      }
      setMenuTop(Math.round(bottom - offsetY));
    };
    compute();
    window.addEventListener('resize', compute);
    window.addEventListener('scroll', compute, { passive: true });
    return () => { window.removeEventListener('resize', compute); window.removeEventListener('scroll', compute); };
  }, [open]);

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
        {items.map((i, idx) => {
          if (i.sep) return <span key={'sep' + idx} className="navsep" aria-hidden="true" />;
          // Grupo con desplegable: botón que abre un menú con sus hijos.
          if (i.children && i.children.length) {
            const gkey = i.label;
            const kids = i.children;
            const groupOn = kids.some((c) => isActive(c.href));
            const groupDot = kids.some((c) => c.dot === 'on');
            return (
              <span key={'g' + idx} className="navl-group" style={{ position: 'relative', display: 'inline-flex' }}>
                <button type="button" className={'navlink' + (groupOn ? ' on' : '')} aria-expanded={openGroup === gkey}
                  onClick={() => setOpenGroup((g) => (g === gkey ? null : gkey))}
                  style={{ background: 'transparent', border: 'none', font: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}>
                  {i.icon && <span aria-hidden="true" style={{ marginRight: 6, display: 'inline-flex', verticalAlign: '-3px' }}><OnyxIcon emoji={i.icon} size={16} /></span>}
                  {i.label}
                  {groupDot && <span className="navdotmini on" style={{ marginLeft: 6 }} />}
                  <span aria-hidden="true" style={{ marginLeft: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: 5, fontSize: 9, lineHeight: 1, color: openGroup === gkey ? '#fff' : 'var(--brand)', background: openGroup === gkey ? 'var(--brand)' : 'color-mix(in srgb, var(--brand) 18%, transparent)', transform: openGroup === gkey ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>▾</span>
                </button>
                {openGroup === gkey && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 60, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, padding: 6, minWidth: 210, boxShadow: '0 14px 34px -10px rgba(0,0,0,.55)' }}>
                    {kids.map((c) => {
                      const ccls = 'menu-item' + (isActive(c.href) ? ' on' : '');
                      const cst = c.gold ? { color: 'var(--gold,#ffd45e)', fontWeight: 800 } : c.tint ? { color: c.tint, fontWeight: 700 } : undefined;
                      const cinner = (<>
                        {c.icon && <span aria-hidden="true" style={{ marginRight: 8, display: 'inline-flex', verticalAlign: '-3px' }}><OnyxIcon emoji={c.icon} size={16} /></span>}
                        {c.label}
                        {c.dot && <span className={'navdotmini ' + c.dot} style={{ marginLeft: 8 }} />}
                      </>);
                      return c.full
                        ? <a key={c.href} className={ccls} href={c.href} style={cst} onClick={() => setOpenGroup(null)}>{cinner}</a>
                        : <Link key={c.href} className={ccls} href={c.href} style={cst} onClick={() => setOpenGroup(null)}>{cinner}</Link>;
                    })}
                  </div>
                )}
              </span>
            );
          }
          const dt = i.dot ? (i.dotTitle || (i.dot === 'on' ? 'activo' : 'inactivo')) : undefined;
          const cls = 'navlink' + (isActive(i.href) ? ' on' : '') + (i.dim ? ' dim' : '');
          const inner = (<>
            {i.icon && <span aria-hidden="true" style={{ marginRight: 6, display: 'inline-flex', verticalAlign: '-3px' }}><OnyxIcon emoji={i.icon} size={16} /></span>}
            {i.label}
            {i.dot && <span className={'navdotmini ' + i.dot} role="img" aria-label={dt} />}
          </>);
          // full: recarga completa (para cruzar hacia/desde superficies con barra propia como Bot Lab)
          const st = i.gold ? GOLD_CHIP : i.tint ? { color: i.tint } : undefined;
          return i.full
            ? <a key={i.href} className={cls} href={i.href} title={dt} style={st}>{inner}</a>
            : <Link key={i.href} className={cls} href={i.href} title={dt} style={st}>{inner}</Link>;
        })}
      </div>

      <div ref={box} className="navburger-wrap">
        <button className="navburger" onClick={() => setOpen(!open)} aria-label="Menú" aria-expanded={open}>
          <span /><span /><span />
        </button>
        {open && (
          <div className="menu" style={{ minWidth: 180, ...(menuTop != null ? { top: menuTop + 'px' } : {}), ...(menuMaxH != null ? { maxHeight: menuMaxH + 'px' } : {}) }}>
            {items.map((i, idx) => {
              if (i.sep) return <div key={'sep' + idx} style={{ borderTop: '1px solid var(--line)', margin: '6px 0' }} />;
              // Grupo: cabecera + hijos (en móvil el menú ya está abierto, no hay 2º nivel).
              if (i.children && i.children.length) {
                return (
                  <div key={'g' + idx}>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--mut)', padding: '8px 12px 2px', fontWeight: 700 }}>{i.label}</div>
                    {i.children.map((c) => {
                      const ccls = 'menu-item' + (isActive(c.href) ? ' on' : '');
                      const cst = c.gold ? { color: 'var(--gold,#ffd45e)', fontWeight: 800 } : c.tint ? { color: c.tint, fontWeight: 700 } : undefined;
                      const cinner = (<>
                        {c.icon && <span aria-hidden="true" style={{ marginRight: 8, display: 'inline-flex', verticalAlign: '-3px' }}><OnyxIcon emoji={c.icon} size={16} /></span>}
                        {c.label}
                        {c.dot && <span className={'navdotmini ' + c.dot} style={{ marginLeft: 8 }} />}
                      </>);
                      return c.full
                        ? <a key={c.href} className={ccls} href={c.href} style={cst}>{cinner}</a>
                        : <Link key={c.href} className={ccls} href={c.href} style={cst}>{cinner}</Link>;
                    })}
                  </div>
                );
              }
              const cls = 'menu-item' + (isActive(i.href) ? ' on' : '');
              const inner = (<>
                {i.icon && <span aria-hidden="true" style={{ marginRight: 8, display: 'inline-flex', verticalAlign: '-3px' }}><OnyxIcon emoji={i.icon} size={16} /></span>}
                {i.label}
                {i.dot && <span className={'navdotmini ' + i.dot} style={{ marginLeft: 8 }} />}
              </>);
              const mst = i.gold ? { color: 'var(--gold,#ffd45e)', fontWeight: 800 } : i.tint ? { color: i.tint, fontWeight: 800 } : undefined;
              return i.full
                ? <a key={i.href} className={cls} href={i.href} style={mst}>{inner}</a>
                : <Link key={i.href} className={cls} href={i.href} style={mst}>{inner}</Link>;
            })}
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
