'use client';
import { usePathname } from 'next/navigation';
import { useLang } from '@/lib/lang';

// Logo + botón "ir al panel". Es un solo botón (icono Onyx | casita) que SIEMPRE
// lleva al panel. Sin texto: usa un símbolo (casita) para que sea igual en
// cualquier idioma.
//
// Nota importante (app nativa): en el URL-wrapper (Capacitor) la navegación
// "suave" de Next (Link / router.push) a veces no surte efecto y el puente de
// Capacitor puede no estar disponible en las páginas remotas, así que NO
// dependemos de detectarlo. Para ir al panel hacemos SIEMPRE una navegación
// dura (window.location), que es exactamente como la app carga sus páginas y
// por eso siempre responde, igual en el navegador y en la app.
//  - Si ya estás en /dashboard (aunque sea una sub-vista), primero intentamos el
//    reset instantáneo al hub sin recargar; si el enlace se activa igual, la
//    recarga a ?view=hub también deja el hub.
export default function PanelLogo() {
  const { lang } = useLang();
  const en = lang === 'en';
  const pathname = (usePathname() || '').replace(/\/+$/, '') || '/';
  const onDash = pathname === '/dashboard' || pathname === '/en/dashboard';
  const base = pathname.startsWith('/en') ? '/en/dashboard' : '/dashboard';
  const dest = onDash ? base + '?view=hub' : base;   // recarga al hub si hiciera falta
  const label = en ? 'Go to panel' : 'Ir al panel';

  const go = (e: React.MouseEvent) => {
    if (onDash) {
      // En el panel: reset instantáneo al hub sin recargar. Solo evitamos la
      // navegación por defecto si el reset por evento funcionó.
      let ok = false;
      try { window.dispatchEvent(new CustomEvent('onyx:panel-home')); ok = true; } catch {}
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
      if (ok) { e.preventDefault(); return; }
      // Si por lo que sea no se pudo, dejamos que el enlace recargue a ?view=hub.
      return;
    }
    // Fuera del panel: navegación dura garantizada (navegador y app nativa).
    e.preventDefault();
    try { window.location.assign(base); } catch { try { (window.location as any).href = base; } catch {} }
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
