'use client';
import { useEffect, useState } from 'react';

// Botón flotante "subir al inicio". Aparece SOLO al bajar (~350px) y con un toque
// lleva al principio de la página con desplazamiento suave. Va abajo-izquierda
// para no chocar con el chat de soporte (que va abajo-derecha). Global: sirve en
// cualquier sección larga (Guardian, Copy, Academia, etc.).
export default function BackToTop() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
      setShow(y > 350);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const up = () => {
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch { window.scrollTo(0, 0); }
    const el: any = document.scrollingElement || document.documentElement;
    if (el) el.scrollTop = 0;
  };

  if (!show) return null;
  return (
    <button
      onClick={up}
      aria-label="Subir al inicio"
      title="Subir al inicio"
      style={{
        position: 'fixed',
        left: 16,
        bottom: `calc(18px + env(safe-area-inset-bottom))`,
        zIndex: 900,
        width: 46,
        height: 46,
        borderRadius: '50%',
        border: 'none',
        cursor: 'pointer',
        background: 'linear-gradient(135deg,#4b3ff0,#7c8cff)',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 8px 22px rgba(0,0,0,.35)',
        fontSize: 22,
        lineHeight: 1,
      }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 19 V6 M6 11 l6 -6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
