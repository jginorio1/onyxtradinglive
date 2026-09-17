'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useLang } from '@/lib/lang';
import { isNativeApp } from '@/lib/native';

// Logo + botón "ir al panel". Es un solo botón (icono Onyx | casita) que SIEMPRE
// lleva al panel. Sin texto: usa un símbolo (casita) para que sea igual en
// cualquier idioma. El clic se maneja por completo en JS:
//  - Si ya estás en /dashboard (aunque sea una sub-vista), avisa al panel para
//    volver al hub y sube arriba (navegar a la misma URL no haría nada).
//  - Desde cualquier otra sección, navega al panel. En el navegador usa la
//    navegación suave (router). Dentro de la app nativa (Capacitor) la
//    navegación por router a veces no surte efecto, así que hacemos una
//    navegación dura (window.location), que es como carga la app y siempre
//    responde.
export default function PanelLogo() {
  const { lang } = useLang();
  const en = lang === 'en';
  const router = useRouter();
  const pathname = (usePathname() || '').replace(/\/+$/, '') || '/';
  const onDash = pathname === '/dashboard' || pathname === '/en/dashboard';
  const dest = pathname.startsWith('/en') ? '/en/dashboard' : '/dashboard';
  const label = en ? 'Go to panel' : 'Ir al panel';

  const go = (e: React.MouseEvent) => {
    e.preventDefault();
    // Reset instantáneo si el panel ya está montado (sub-vistas del hub).
    try { window.dispatchEvent(new CustomEvent('onyx:panel-home')); } catch {}
    if (onDash) {
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
      return;
    }
    if (isNativeApp()) { try { window.location.assign(dest); return; } catch {} }
    try { router.push(dest); } catch { try { window.location.assign(dest); } catch {} }
  };

  return (
    <a href={dest} onClick={go} className="logo" role="button" aria-label={label} title={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
      {/* Icono Onyx + casita = UN solo botón, con una línea de separación entre ambos. */}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(124,140,255,.14)', border: '1px solid rgba(124,140,255,.4)', borderRadius: 999, padding: '4px 10px 4px 5px' }}>
        <img src="/onyx-symbol.png" alt="Onyx Trading Live" style={{ width: 24, height: 24, objectFit: 'contain', flex: '0 0 auto' }} />
        <span style={{ width: 1, height: 16, background: 'rgba(124,140,255,.45)', flex: '0 0 auto' }} />
        <span aria-hidden="true" style={{ display: 'inline-flex', color: 'var(--soft-brand)' }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M4 11 L12 4 l8 7 M6 10 v9 h12 v-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
      </span>
      <span className="logo-text">Onyx Trading Live</span>
    </a>
  );
}
