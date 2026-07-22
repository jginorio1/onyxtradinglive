'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import LangToggle from './LangToggle';

// Avatar con menú. Se cierra al pulsar fuera o con Escape, como cualquier
// menú al que el usuario esté acostumbrado.
export default function TopBarMenu({ email, initial, isAdmin, t }:
  { email: string; initial: string; isAdmin: boolean; t: Record<string, string> }) {
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

  return (
    <div ref={box} style={{ position: 'relative' }}>
      <button className="avatar" onClick={() => setOpen(!open)} aria-label={t.myAccount} aria-expanded={open}>
        {initial}
      </button>

      {open && (
        <div className="menu">
          <div className="menu-head">{email}</div>
          <Link className="menu-item" href="/account" onClick={() => setOpen(false)}>{t.myAccount}</Link>
          <Link className="menu-item" href="/pricing" onClick={() => setOpen(false)}>{t.myPlan}</Link>
          <Link className="menu-item" href="/account?tab=referidos" onClick={() => setOpen(false)}>{t.referrals}</Link>
          {isAdmin && <Link className="menu-item" href="/admin" onClick={() => setOpen(false)}>{t.adminPanel}</Link>}

          {/* Con sesión el idioma es un ajuste, y los ajustes viven en el menú */}
          <div style={{ borderTop: '1px solid var(--line)', margin: '6px 0', paddingTop: 4 }}>
            <LangToggle label={t.language} />
          </div>

          <form action="/auth/signout" method="post">
            <button className="menu-item danger" type="submit">{t.signout}</button>
          </form>
        </div>
      )}
    </div>
  );
}
