'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/lang';

// Footer único para TODAS las páginas. En móvil: solo el logo (el texto se oculta
// con .logo-text, igual que el header) y los enlaces se apilan centrados.
// Muestra la versión pública (production) que se gestiona desde Admin.
export default function SiteFooter() {
  const { lang } = useLang();
  const es = lang === 'es';
  const [ver, setVer] = useState('');
  const [fx, setFx] = useState<any>(null);

  useEffect(() => {
    fetch('/api/version', { cache: 'no-store' }).then((r) => r.json()).then((j) => setVer(j.version || '')).catch(() => {});
    // Footer editable del Landing Builder (enlaces + lema). Vacío = enlaces del código.
    fetch('/api/landing-content', { cache: 'no-store' }).then((r) => r.json()).then((c) => setFx(c?.footer || null)).catch(() => {});
  }, []);

  const L = (a: string, b: string) => (es ? a : b);
  const defLinks: [string, string][] = [
    ['/', L('Inicio', 'Home')],
    ['/pricing', L('Planes', 'Plans')],
    ['/guia', L('Guía', 'Guide')],
    ['/embajadores', L('Embajadores', 'Ambassadors')],
    ['/invita', L('Invita y gana', 'Invite & earn')],
    ['/contacto', L('Contacto', 'Contact')],
    ['/terms', L('Términos', 'Terms')],
    ['/privacy', L('Privacidad', 'Privacy')],
  ];
  const links: [string, string][] = (fx?.links?.length)
    ? fx.links.map((l: any) => [l.href, es ? l.es : l.en])
    : defLinks;
  const tagline = es ? (fx?.tagline_es || '') : (fx?.tagline_en || '');

  return (
    <footer style={{ borderTop: '1px solid var(--line)', marginTop: 20, padding: '26px 0 30px' }}>
      <div className="wrap" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
        <Link href="/" className="logo" aria-label="Onyx Trading Live" style={{ fontSize: 16 }}>
          <img src="/onyx-symbol.png" alt="Onyx Trading Live" style={{ width: 26, height: 26, objectFit: 'contain' }} />
          <span className="logo-text">Onyx Trading Live</span>
        </Link>
        {tagline && <div className="muted" style={{ fontSize: 13, maxWidth: 520 }}>{tagline}</div>}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '10px 20px', color: 'var(--mut)', fontSize: 13.5 }}>
          {links.map(([href, label], i) => <Link key={href + i} href={href} style={{ color: 'var(--mut)' }}>{label}</Link>)}
        </div>
        <div className="muted" style={{ fontSize: 12 }}>
          © 2026 Onyx Trading Live{ver ? <> · <span style={{ color: 'var(--tx)' }}>v{ver}</span></> : null}
        </div>
      </div>
    </footer>
  );
}
