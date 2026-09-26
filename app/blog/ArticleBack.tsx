'use client';
import { useRouter } from 'next/navigation';

// Botón "Volver" del artículo del blog. Pensado sobre todo para MÓVIL y para la
// app nativa, donde antes era difícil salir del artículo (no había atrás claro).
// Si hay historial dentro del sitio, retrocede; si el artículo se abrió directo
// (deep-link, sin historial), lleva de vuelta al listado del blog.
export default function ArticleBack({ es }: { es: boolean }) {
  const router = useRouter();
  const label = es ? 'Volver' : 'Back';

  const back = () => {
    try {
      const cameFromSite = typeof document !== 'undefined'
        && document.referrer
        && new URL(document.referrer).origin === window.location.origin;
      if (cameFromSite && window.history.length > 1) { router.back(); return; }
    } catch {}
    // Sin historial propio → al índice del blog (nunca deja al usuario atrapado).
    try { router.push(es ? '/blog' : '/en/blog'); } catch { window.location.assign('/blog'); }
  };

  return (
    <button type="button" onClick={back} className="article-back" aria-label={label} title={label}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 10,
        background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 999,
        padding: '7px 14px 7px 11px', color: 'var(--tx)', font: 'inherit', fontSize: 13.5,
        fontWeight: 600, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' as any,
      }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label}
    </button>
  );
}
