'use client';
import { useLang } from '@/lib/lang';

// ============================================================
// Logo = botón "ir al Panel" (/dashboard).
//
// POR QUÉ ESTA VERSIÓN ES LA DEFINITIVA:
// En la app nativa (Android WebView) TODO lo que es <button> con onClick de JS
// funciona perfecto (campana, idioma, tema, avatar, menú). Lo que NO respondía
// era el logo cuando era un <a>/<Link> de Next: la navegación por router del
// <Link> es poco fiable en el wrapper, y estando ya en /dashboard el Link al
// mismo destino simplemente no hace nada ("no reacciona").
//
// Así que aquí el logo YA NO es un enlace: es un <button> idéntico en mecánica a
// los controles que sí funcionan. Al pulsarlo:
//   • Si ya estás en el panel → solo vuelve al hub (evento) y sube arriba, sin
//     recargar.
//   • Si estás en cualquier otra sección → navegación DURA a /dashboard
//     (window.location), que es la forma más fiable de moverse dentro de un
//     WebView (una navegación real del navegador, no interceptada por el router).
// ============================================================
export default function PanelLogo() {
  const { lang } = useLang();
  const label = lang === 'en' ? 'Go to panel' : 'Ir al panel';

  const go = () => {
    let p = '/';
    try { p = (window.location.pathname || '/').replace(/\/+$/, '') || '/'; } catch {}
    if (p === '/dashboard' || p === '/en/dashboard') {
      // Ya en el panel: solo resetear a la vista principal y subir arriba.
      try { window.dispatchEvent(new CustomEvent('onyx:panel-home')); } catch {}
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
      return;
    }
    // Desde cualquier otra sección: navegación real y garantizada al panel.
    try {
      const origin = window.location.origin || '';
      window.location.assign(origin + '/dashboard');
    } catch {
      try { window.location.href = '/dashboard'; } catch {}
    }
  };

  return (
    <button type="button" onClick={go} className="logo" aria-label={label} title={label}
      onPointerDown={(e) => { try { (e.currentTarget as HTMLElement).classList.add('is-pressing'); } catch {} }}
      onPointerUp={(e) => { try { (e.currentTarget as HTMLElement).classList.remove('is-pressing'); } catch {} }}
      onPointerLeave={(e) => { try { (e.currentTarget as HTMLElement).classList.remove('is-pressing'); } catch {} }}
      onPointerCancel={(e) => { try { (e.currentTarget as HTMLElement).classList.remove('is-pressing'); } catch {} }}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', padding: 0, margin: 0, cursor: 'pointer', font: 'inherit', color: 'inherit', lineHeight: 'normal', textAlign: 'left', appearance: 'none' as any, WebkitAppearance: 'none' as any, WebkitTapHighlightColor: 'transparent' as any }}>
      {/* Solo la casita (ir al panel). Sin símbolo Onyx para no confundir — el
          botón entero navega al dashboard. */}
      <span className="logo-home-pill" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(124,140,255,.14)', border: '1px solid rgba(124,140,255,.4)', borderRadius: 999, padding: '6px 10px' }}>
        <span aria-hidden="true" style={{ display: 'inline-flex', color: 'var(--soft-brand)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 11 L12 4 l8 7 M6 10 v9 h12 v-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
      </span>
      <span className="logo-text">Onyx Trading Live</span>
    </button>
  );
}
