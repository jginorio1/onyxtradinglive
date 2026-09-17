'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLang } from '@/lib/lang';

// Logo + botón "Panel": un solo botón (icono | Panel) que SIEMPRE lleva al panel.
// Si ya estás en /dashboard (aunque en una sub-vista: rendimiento, plan, etc.),
// navegar a la misma URL no haría nada; por eso avisamos al panel para que vuelva
// al hub y subimos arriba. Desde otra sección, el Link navega normal.
export default function PanelLogo() {
  const { lang } = useLang();
  const en = lang === 'en';
  const pathname = usePathname() || '';
  const onDash = pathname === '/dashboard' || pathname === '/en/dashboard';

  const go = (e: React.MouseEvent) => {
    if (onDash) {
      e.preventDefault();
      try { window.dispatchEvent(new CustomEvent('onyx:panel-home')); } catch {}
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
    }
  };

  return (
    <Link className="logo" href="/dashboard" onClick={go} aria-label={en ? 'Go to panel' : 'Ir al panel'} title={en ? 'Go to panel' : 'Ir al panel'} style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      {/* Icono + "Panel" son UN solo botón, con una línea de separación entre ambos. */}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(124,140,255,.14)', border: '1px solid rgba(124,140,255,.4)', borderRadius: 999, padding: '3px 11px 3px 5px' }}>
        <img src="/onyx-symbol.png" alt="Onyx Trading Live" style={{ width: 24, height: 24, objectFit: 'contain', flex: '0 0 auto' }} />
        <span style={{ width: 1, height: 16, background: 'rgba(124,140,255,.45)', flex: '0 0 auto' }} />
        <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--soft-brand)', whiteSpace: 'nowrap' }}>Panel</span>
      </span>
      <span className="logo-text">Onyx Trading Live</span>
    </Link>
  );
}
