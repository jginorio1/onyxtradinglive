'use client';
import Link from 'next/link';
import { useLang } from '@/lib/lang';

// Logo + botón "ir al panel". Es un solo botón (icono Onyx | casita) que lleva al
// panel. Sin texto: usa un símbolo (casita) para que sea igual en cualquier
// idioma.
//
// IMPORTANTE: usa el MISMO <Link> de Next que los tabs del menú (que sí navegan
// dentro de la app nativa). Antes usaba un manejador propio con window.location,
// que en el wrapper no respondía. Aquí no interceptamos la navegación: solo, de
// paso, avisamos al panel para que —si ya está montado en una sub-vista— vuelva
// al hub y suba arriba. Si vienes de otra sección, el propio Link navega al panel.
export default function PanelLogo() {
  const { lang } = useLang();
  const label = lang === 'en' ? 'Go to panel' : 'Ir al panel';

  const onClick = () => {
    try { window.dispatchEvent(new CustomEvent('onyx:panel-home')); } catch {}
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
  };

  return (
    <Link href="/dashboard" onClick={onClick} className="logo" aria-label={label} title={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      {/* Icono Onyx + casita = UN solo botón, con una línea de separación entre ambos. */}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(124,140,255,.14)', border: '1px solid rgba(124,140,255,.4)', borderRadius: 999, padding: '4px 10px 4px 5px' }}>
        <img src="/onyx-symbol.png" alt="Onyx Trading Live" style={{ width: 24, height: 24, objectFit: 'contain', flex: '0 0 auto' }} />
        <span style={{ width: 1, height: 16, background: 'rgba(124,140,255,.45)', flex: '0 0 auto' }} />
        <span aria-hidden="true" style={{ display: 'inline-flex', color: 'var(--soft-brand)' }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M4 11 L12 4 l8 7 M6 10 v9 h12 v-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
      </span>
      <span className="logo-text">Onyx Trading Live</span>
    </Link>
  );
}
