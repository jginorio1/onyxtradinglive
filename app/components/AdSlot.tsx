'use client';
import { useEffect, useState } from 'react';

// Un espacio patrocinado. Pide al servidor qué anuncio mostrar (o nada, si el
// visitante paga o los anuncios están apagados). Los enlaces llevan
// rel="sponsored nofollow" (requisito de Google para enlaces pagados) y todo
// va etiquetado como "Publicidad". En la app NATIVA se oculta por CSS (.native-app).
type Served =
  | { kind: 'paid'; id: string; creative: string; link: string; alt: string; size: string }
  | { kind: 'house'; id: string; size: string }
  | null;

export default function AdSlot({ slot, lang, label = true }: { slot: string; lang: 'es' | 'en'; label?: boolean }) {
  const [ad, setAd] = useState<Served>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/ads/serve?slot=${encodeURIComponent(slot)}&lang=${lang}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => { if (alive) { setAd(j.hide ? null : (j.ad || null)); setDone(true); } })
      .catch(() => { if (alive) setDone(true); });
    return () => { alive = false; };
  }, [slot, lang]);

  if (!done || !ad) return null;

  const [w, h] = (ad.size || '728x90').split('x').map((n) => parseInt(n, 10) || 0);
  const L = (a: string, b: string) => (lang === 'es' ? a : b);
  const wrap: any = { margin: '18px auto', maxWidth: w || 970, width: '100%' };
  const tag = <div style={{ fontSize: 10, letterSpacing: '.05em', color: 'var(--mut)', textTransform: 'uppercase', marginBottom: 4 }}>{L('Publicidad', 'Advertisement')}</div>;

  // House ad (relleno propio) cuando no hay campaña pagada: promueve Pro.
  if (ad.kind === 'house') {
    return (
      <div className="onyx-ad" style={wrap}>
        {label && tag}
        <a href={lang === 'es' ? '/#precios' : '/en/#precios'} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, textDecoration: 'none', color: 'inherit', border: '1px solid var(--line)', borderRadius: 12, padding: '12px 16px', background: 'color-mix(in srgb, var(--brand) 8%, transparent)' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{L('Navega sin anuncios con Pro', 'Go ad-free with Pro')}</div>
            <div className="muted" style={{ fontSize: 12 }}>{L('Mejora tu plan y desbloquea todo Onyx.', 'Upgrade and unlock all of Onyx.')}</div>
          </div>
          <span style={{ color: 'var(--brand)', fontSize: 13.5, fontWeight: 700, flex: 'none' }}>{L('Ver planes →', 'See plans →')}</span>
        </a>
      </div>
    );
  }

  // Anuncio pagado.
  const onClick = () => { try { navigator.sendBeacon('/api/ads/click', new Blob([JSON.stringify({ id: ad.id })], { type: 'application/json' })); } catch {} };
  return (
    <div className="onyx-ad" style={wrap}>
      {label && tag}
      <a href={ad.link} target="_blank" rel="sponsored nofollow noopener" onClick={onClick} style={{ display: 'block', lineHeight: 0, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--line)' }}>
        <img src={ad.creative} alt={ad.alt || L('Anuncio', 'Ad')} loading="lazy" decoding="async" width={w || undefined} height={h || undefined} style={{ width: '100%', height: 'auto', display: 'block' }} />
      </a>
    </div>
  );
}
