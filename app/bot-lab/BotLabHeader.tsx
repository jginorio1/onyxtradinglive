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

  const items: { href: string; label: string; on: boolean }[] = [
    { href: '/bot-lab', label: 'Marketplace', on: path === '/bot-lab' || path.endsWith('/bot-lab') || inDash },
    { href: '/bot-lab#vende', label: es ? 'Vender' : 'Sell', on: false },
    { href: '/bot-lab#servicio', label: es ? 'Servicios' : 'Services', on: false },
    { href: '/bot-lab#precios', label: es ? 'Precios' : 'Pricing', on: false },
    { href: '/bot-lab/faq', label: 'FAQ', on: path.includes('/bot-lab/faq') },
  ];

  const link: any = { fontSize: 14, color: 'var(--mut)', fontWeight: 600, padding: '4px 0', borderBottom: '2px solid transparent' };
  const linkOn: any = { ...link, color: 'var(--tx)', borderColor: 'var(--gold, #ffd45e)' };

  return (
    <div>
      {/* Cinta discreta: recuerda que es parte de Onyx */}
      <div style={{ background: 'rgba(255,255,255,.03)', borderBottom: '1px solid rgba(255,255,255,.06)', fontSize: 12 }}>
        <div className="wrap-wide" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 32, color: 'var(--mut)' }}>
          <span>{es ? 'Un producto de Onyx Trading Live' : 'A product of Onyx Trading Live'}</span>
          <Link href={inDash ? '/dashboard' : '/'} style={{ color: 'var(--brand)', fontWeight: 700 }}>← {es ? 'Volver a Onyx' : 'Back to Onyx'}</Link>
        </div>
      </div>

      {/* Barra propia */}
      <div className="topbar">
        <div className="wrap-wide" style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <Link href="/bot-lab" className="logo" aria-label="Onyx Bot Lab" style={{ gap: 11 }}>
            <span style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(120deg,var(--gold,#ffd45e),#ffb020)', color: '#3a2a06', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 800, boxShadow: '0 6px 18px rgba(255,212,94,.4)' }}>◆</span>
            <span style={{ lineHeight: 1.05 }}>
              <span style={{ fontWeight: 800, fontSize: 17 }}>Onyx Bot Lab</span>
              <small style={{ display: 'block', fontSize: 9.5, fontWeight: 700, letterSpacing: '.14em', color: 'var(--mut)', textTransform: 'uppercase', marginTop: -2 }}>{es ? 'Marketplace de robots' : 'Robot marketplace'}</small>
            </span>
          </Link>

          {/* Nav de escritorio */}
          <nav className="botlab-nav" style={{ display: 'flex', gap: 22, marginLeft: 8 }}>
            {items.map((i) => (
              <Link key={i.href} href={i.href} style={i.on ? linkOn : link} onMouseEnter={(e) => { if (!i.on) (e.currentTarget as HTMLElement).style.color = 'var(--tx)'; }} onMouseLeave={(e) => { if (!i.on) (e.currentTarget as HTMLElement).style.color = 'var(--mut)'; }}>{i.label}</Link>
            ))}
          </nav>

          <div style={{ flex: 1 }} />
          <ThemeToggle />
          <LangToggle compact />
          {loggedIn
            ? <Link className="btn btn-primary" href="/dashboard/bot-lab" style={{ background: 'linear-gradient(120deg,var(--gold,#ffd45e),#ffb020)', color: '#3a2a06', border: 'none' }}>{es ? 'Mi panel' : 'My panel'}</Link>
            : <>
                <Link className="btn btn-ghost btn-login" href="/login">{es ? 'Entrar' : 'Sign in'}</Link>
                <Link className="btn btn-primary" href="/login?mode=signup" style={{ background: 'linear-gradient(120deg,var(--gold,#ffd45e),#ffb020)', color: '#3a2a06', border: 'none' }}>{es ? 'Empezar' : 'Get started'}</Link>
              </>}
          {/* Botón móvil: despliega los enlaces */}
          <button className="botlab-burger" onClick={() => setOpen((o) => !o)} aria-label="Menu" style={{ display: 'none', background: 'transparent', border: '1px solid var(--line)', color: 'var(--tx)', width: 36, height: 36, borderRadius: 9, cursor: 'pointer', fontSize: 16 }}>☰</button>
        </div>
        {open && (
          <div className="wrap-wide" style={{ paddingBottom: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {items.map((i) => <Link key={i.href} href={i.href} onClick={() => setOpen(false)} style={{ padding: '8px 0', color: 'var(--tx)', fontWeight: 600 }}>{i.label}</Link>)}
          </div>
        )}
      </div>

      <style>{`@media(max-width:820px){.botlab-nav{display:none!important}.botlab-burger{display:inline-flex!important;align-items:center;justify-content:center}}`}</style>
    </div>
  );
}
