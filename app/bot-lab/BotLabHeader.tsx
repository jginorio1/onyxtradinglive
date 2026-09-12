'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useLang } from '@/lib/lang';
import LangToggle from '@/app/LangToggle';
import ThemeToggle from '@/app/ThemeToggle';

// ============================================================
// Barra DEDICADA de Onyx Bot Lab. El layout la usa en lugar de la barra global
// cuando estás en /bot-lab o /dashboard/bot-lab, para que se sienta un producto
// aparte (mismo login, misma base de datos). Logo propio "Onyx Bot Lab".
// ============================================================
export default function BotLabHeader({ loggedIn = false }: { loggedIn?: boolean }) {
  const { lang } = useLang();
  const es = lang === 'es';
  const path = usePathname() || '';
  const inDash = path.includes('/dashboard/bot-lab');
  const [open, setOpen] = useState(false);
  const [acct, setAcct] = useState(false); // menú de cuenta (incluye Salir)
  const mi: any = { display: 'block', padding: '9px 12px', borderRadius: 8, color: 'var(--tx)', fontSize: 13.5, fontWeight: 600, textDecoration: 'none' };

  // En el PANEL, la barra lateral ya cubre Marketplace/Mis robots/Vender/Ganancias,
  // así que arriba solo dejamos info pública (Servicios/Precios/FAQ) que abre en otra
  // pestaña, sin duplicar ni sacarte del panel sin avisar. En el LANDING, la nav completa.
  const items: { href: string; label: string; on: boolean; blank?: boolean }[] = inDash
    ? [
        { href: '/bot-lab#servicio', label: es ? 'Servicios' : 'Services', on: false, blank: true },
        { href: '/bot-lab#precios', label: es ? 'Precios' : 'Pricing', on: false, blank: true },
        { href: '/bot-lab/faq', label: 'FAQ', on: false, blank: true },
      ]
    : [
        { href: '/bot-lab', label: 'Marketplace', on: path === '/bot-lab' || path.endsWith('/bot-lab') },
        { href: '/bot-lab#vende', label: es ? 'Vender' : 'Sell', on: false },
        { href: '/bot-lab#servicio', label: es ? 'Servicios' : 'Services', on: false },
        { href: '/bot-lab#precios', label: es ? 'Precios' : 'Pricing', on: false },
        { href: '/bot-lab/faq', label: 'FAQ', on: path.includes('/bot-lab/faq') },
      ];

  const link: any = { fontSize: 14, color: 'var(--mut)', fontWeight: 600, padding: '4px 0', borderBottom: '2px solid transparent' };
  const linkOn: any = { ...link, color: 'var(--tx)', borderColor: 'var(--gold, #ffd45e)' };

  return (
    <div>
      {/* Cabecera como bloque sticky ÚNICO (cinta + barra) para que respete el notch/estado
          del móvil una sola vez y no quede nada bajo la batería ni detrás del menú. */}
      <div className="botlab-headwrap">
      {/* Cinta discreta: recuerda que es parte de Onyx */}
      <div style={{ background: 'rgba(255,255,255,.03)', borderBottom: '1px solid rgba(255,255,255,.06)', fontSize: 12 }}>
        <div className="wrap-wide" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 32, color: 'var(--mut)' }}>
          <span className="botlab-ribbon-txt">{es ? 'Un producto de Onyx Trading Live' : 'A product of Onyx Trading Live'}</span>
          <a href={inDash ? '/dashboard' : '/'} onClick={(e) => { e.preventDefault(); window.location.href = inDash ? '/dashboard' : '/'; }} style={{ color: 'var(--brand)', fontWeight: 700, marginLeft: 'auto' }}>← Onyx</a>
        </div>
      </div>

      {/* Barra propia */}
      <div className="topbar botlab-topbar">
        <div className="wrap-wide" style={{ display: 'flex', alignItems: 'center', gap: 18, position: 'relative' }}>
          <Link href="/bot-lab" className="logo" aria-label="Onyx Bot Lab" style={{ gap: 11 }}>
            <span style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(120deg,var(--gold,#ffd45e),#ffb020)', color: '#3a2a06', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 800, boxShadow: '0 6px 18px rgba(255,212,94,.4)' }}>◆</span>
            <span className="botlab-logo-text" style={{ lineHeight: 1.05, whiteSpace: 'nowrap' }}>
              <span style={{ fontWeight: 800, fontSize: 17, whiteSpace: 'nowrap' }}>Onyx Bot Lab</span>
              <small style={{ display: 'block', fontSize: 9.5, fontWeight: 700, letterSpacing: '.14em', color: 'var(--mut)', textTransform: 'uppercase', marginTop: -2 }}>{es ? 'Marketplace de robots' : 'Robot marketplace'}</small>
            </span>
          </Link>

          <div style={{ flex: 1 }} />
          {/* Nav de escritorio, centrado en la barra (en flujo normal, sin position:absolute) */}
          <nav className="botlab-nav" style={{ display: 'flex', gap: 22 }}>
            {items.map((i) => (
              <Link key={i.href} href={i.href} target={i.blank ? '_blank' : undefined} rel={i.blank ? 'noopener' : undefined} style={i.on ? linkOn : link} onMouseEnter={(e) => { if (!i.on) (e.currentTarget as HTMLElement).style.color = 'var(--tx)'; }} onMouseLeave={(e) => { if (!i.on) (e.currentTarget as HTMLElement).style.color = 'var(--mut)'; }}>{i.label}{i.blank ? ' ↗' : ''}</Link>
            ))}
          </nav>

          <div style={{ flex: 1 }} />
          <ThemeToggle />
          <LangToggle compact />
          {loggedIn
            ? <div style={{ position: 'relative' }}>
                <button onClick={() => setAcct((o) => !o)} className="btn btn-primary" style={{ background: 'linear-gradient(120deg,var(--gold,#ffd45e),#ffb020)', color: '#3a2a06', border: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>{es ? 'Mi panel' : 'My panel'} <span style={{ fontSize: 10 }}>▾</span></button>
                {acct && (
                  <>
                    <div onClick={() => setAcct(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                    <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', minWidth: 190, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, boxShadow: '0 12px 34px rgba(0,0,0,.4)', padding: 6, zIndex: 41 }}>
                      <a href="/dashboard/bot-lab" onClick={() => (window.location.href = '/dashboard/bot-lab')} style={mi}>{es ? 'Panel de Bot Lab' : 'Bot Lab panel'}</a>
                      <a href="/dashboard" onClick={() => (window.location.href = '/dashboard')} style={mi}>{es ? 'Onyx Trading Live' : 'Onyx Trading Live'}</a>
                      <a href="/account" onClick={() => (window.location.href = '/account')} style={mi}>{es ? 'Mi cuenta' : 'My account'}</a>
                      <div style={{ borderTop: '1px solid var(--line)', margin: '4px 0' }} />
                      <form action="/auth/signout" method="post"><button type="submit" style={{ ...mi, width: '100%', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--red,#ff6b7d)', fontWeight: 700 }}>{es ? 'Salir' : 'Sign out'}</button></form>
                    </div>
                  </>
                )}
              </div>
            : <>
                <a className="btn btn-ghost btn-login botlab-signin" href="/login">{es ? 'Entrar' : 'Sign in'}</a>
                <a className="btn btn-primary" href="/login?mode=signup" style={{ background: 'linear-gradient(120deg,var(--gold,#ffd45e),#ffb020)', color: '#3a2a06', border: 'none' }}>{es ? 'Empezar' : 'Get started'}</a>
              </>}
          {/* Botón móvil: despliega los enlaces */}
          <button className="botlab-burger" onClick={() => setOpen((o) => !o)} aria-label="Menu" style={{ display: 'none', background: 'transparent', border: '1px solid var(--line)', color: 'var(--tx)', width: 36, height: 36, borderRadius: 9, cursor: 'pointer', fontSize: 16 }}>☰</button>
        </div>
        {open && (
          <div style={{ borderTop: '1px solid var(--line)', background: 'var(--card,#1a2133)', boxShadow: '0 18px 44px rgba(0,0,0,.5)' }}>
            {/* Panel propio: SIN la clase wrap-wide (dentro de .topbar esa clase fuerza height:64px
                + justify-content:space-between y desparramaba los enlaces sobre el hero). */}
            <div style={{ maxWidth: 1680, margin: '0 auto', padding: '8px 16px 14px', display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
              {items.map((i) => (
                <Link key={i.href} href={i.href} target={i.blank ? '_blank' : undefined} rel={i.blank ? 'noopener' : undefined} onClick={() => setOpen(false)} style={{ display: 'block', width: '100%', padding: '13px 12px', borderRadius: 10, color: 'var(--tx)', fontWeight: 600, fontSize: 15, textAlign: 'left', textDecoration: 'none', background: i.on ? 'color-mix(in srgb,var(--gold,#ffd45e) 15%,transparent)' : 'transparent' }}>{i.label}{i.blank ? ' ↗' : ''}</Link>
              ))}
              {!loggedIn && (
                <a href="/login" onClick={() => setOpen(false)} style={{ display: 'block', width: '100%', padding: '13px 12px', marginTop: 4, borderTop: '1px solid var(--line)', color: 'var(--tx)', fontWeight: 700, fontSize: 15, textAlign: 'left', textDecoration: 'none' }}>{es ? 'Entrar' : 'Sign in'}</a>
              )}
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
