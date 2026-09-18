'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLang } from '@/lib/lang';

// ============================================================
// Logo = botón "ir al Panel". Lleva a /dashboard (el inicio de la app).
//
// POR QUÉ ESTA VERSIÓN (definitiva): antes NO navegaba dentro de la app nativa
// (Android WebView), aunque en Chrome sí. La causa real: (1) el <img raster>
// del logo se "tragaba" el toque en el webview, y (2) un onClick diferido con
// setTimeout + pointerEvents interfería con la navegación del <Link>.
//
// Los tabs del menú (Panel, Copy, Robots, Ganancia neta…) SÍ navegan en la app
// porque son un <Link> LIMPIO de Next con un icono SVG dentro y NADA más. Aquí
// copiamos EXACTAMENTE ese patrón:
//   • <Link> de Next sin onClick que bloquee ni preventDefault.
//   • El símbolo Onyx se pinta como FONDO CSS (background-image), no como <img>,
//     así no existe ningún elemento hijo que pueda interceptar el toque: el tap
//     cae siempre en el <a>.
//   • Icono "panel" en SVG en línea (como los tabs), sin texto → igual en todos
//     los idiomas.
// El único onClick es SÍNCRONO y solo avisa al panel para volver al hub cuando
// YA estás en /dashboard (donde el <Link> al mismo destino no navega). Nunca
// llama a preventDefault, así que jamás bloquea la navegación real.
// ============================================================
export default function PanelLogo() {
  const { lang } = useLang();
  const pathname = usePathname() || '';
  const label = lang === 'en' ? 'Go to panel' : 'Ir al panel';

  // Aviso "volver al hub": útil solo si YA estás en /dashboard (ahí el Link no
  // navega porque es el mismo destino). Es síncrono y va envuelto en try/catch;
  // no interfiere con la navegación normal desde otras secciones.
  const onClick = () => {
    const p = pathname.replace(/\/+$/, '');
    if (p === '/dashboard' || p === '/en/dashboard') {
      try { window.dispatchEvent(new CustomEvent('onyx:panel-home')); } catch {}
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
    }
  };

  return (
    <Link href="/dashboard" onClick={onClick} className="logo" aria-label={label} title={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(124,140,255,.14)', border: '1px solid rgba(124,140,255,.4)', borderRadius: 999, padding: '4px 11px 4px 9px' }}>
        {/* Símbolo Onyx como FONDO (no <img>), para no crear un hijo que trague el toque. */}
        <span aria-hidden="true" style={{ width: 22, height: 22, flex: '0 0 auto', backgroundImage: 'url(/onyx-symbol.png)', backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center' }} />
        <span aria-hidden="true" style={{ width: 1, height: 15, background: 'rgba(124,140,255,.45)', flex: '0 0 auto' }} />
        {/* Icono "panel" (casita) en SVG en línea, como los tabs que sí funcionan. */}
        <span aria-hidden="true" style={{ display: 'inline-flex', color: 'var(--soft-brand)' }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M4 11 L12 4 l8 7 M6 10 v9 h12 v-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
      </span>
      <span className="logo-text">Onyx Trading Live</span>
    </Link>
  );
}
