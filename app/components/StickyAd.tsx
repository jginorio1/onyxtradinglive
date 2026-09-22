'use client';
import { useEffect, useState } from 'react';

// Barra sticky inferior site-wide (formato de mayor CTR). Aparece en páginas
// públicas, se puede cerrar (recordado por sesión) y se oculta en la app nativa
// (.onyx-ad por CSS) y a usuarios de pago (el serve devuelve hide). F4.
type Served =
  | { kind: 'paid'; id: string; creative: string; link: string; alt: string; size: string; disclaimer?: string }
  | { kind: 'partner'; id: string; name: string; logo: string; blurb: string; link: string; size: string }
  | { kind: 'house'; id: string; size: string }
  | { kind: 'programmatic'; id: 'net'; size: string; code: string }
  | null;

export default function StickyAd({ lang }: { lang: 'es' | 'en' }) {
  const [ad, setAd] = useState<Served>(null);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    try { if (sessionStorage.getItem('onyx_sticky_closed') === '1') { setClosed(true); return; } } catch {}
    let alive = true;
    fetch(`/api/ads/serve?slot=sticky_bottom&lang=${lang}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => { if (alive && !j.hide && j.ad && (j.ad.kind === 'paid' || j.ad.kind === 'partner')) setAd(j.ad); })
      .catch(() => {});
    return () => { alive = false; };
  }, [lang]);

  if (closed || !ad || (ad.kind !== 'paid' && ad.kind !== 'partner')) return null;
  const L = (a: string, b: string) => (lang === 'es' ? a : b);
  const onClick = () => { if (ad.kind === 'paid') { try { navigator.sendBeacon('/api/ads/click', new Blob([JSON.stringify({ id: ad.id })], { type: 'application/json' })); } catch {} } };
  const close = () => { setClosed(true); try { sessionStorage.setItem('onyx_sticky_closed', '1'); } catch {} };

  return (
    <div className="onyx-ad" style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 60, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, padding: '6px 10px', background: 'color-mix(in srgb, var(--bg, #0d0e12) 92%, transparent)', borderTop: '1px solid var(--line)', backdropFilter: 'blur(6px)' }}>
      <span style={{ fontSize: 9, letterSpacing: '.05em', color: 'var(--mut)', textTransform: 'uppercase' }}>{L('Publicidad', 'Ad')}</span>
      {ad.kind === 'paid' ? (
        <a href={ad.link} target="_blank" rel="sponsored nofollow noopener" onClick={onClick} style={{ lineHeight: 0, display: 'block', maxWidth: 320 }}>
          <img src={ad.creative} alt={ad.alt || 'Ad'} loading="lazy" decoding="async" style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 4 }} />
        </a>
      ) : (
        <a href={ad.link} target="_blank" rel="sponsored nofollow noopener" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: 'inherit', maxWidth: 460 }}>
          {ad.logo && <img src={ad.logo} alt={ad.name} loading="lazy" decoding="async" style={{ width: 24, height: 24, borderRadius: 5, objectFit: 'contain', flex: 'none', background: '#ffffff10' }} />}
          <span style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>{ad.name}</span>
          {ad.blurb && <span className="muted" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>· {ad.blurb}</span>}
          <span style={{ color: 'var(--brand)', fontSize: 12.5, fontWeight: 700, flex: 'none' }}>{L('Ver →', 'View →')}</span>
        </a>
      )}
      <button onClick={close} aria-label="cerrar" style={{ background: 'transparent', border: 0, color: 'var(--mut)', fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}>×</button>
    </div>
  );
}
