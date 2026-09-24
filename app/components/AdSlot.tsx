'use client';
import { useEffect, useRef, useState } from 'react';

// Un espacio patrocinado. Pide al servidor qué anuncio mostrar (o nada, si el
// visitante paga o los anuncios están apagados). Los enlaces llevan
// rel="sponsored nofollow" (requisito de Google para enlaces pagados) y todo
// va etiquetado como "Publicidad". Mide viewability (IAB 50%/1s) y, en anuncios
// financieros, muestra un aviso de riesgo. En la app NATIVA se oculta por CSS.
type Served =
  | { kind: 'paid'; id: string; creative: string; link: string; alt: string; size: string; disclaimer?: string }
  | { kind: 'partner'; id: string; name: string; logo: string; banner: string; blurb: string; link: string; size: string }
  | { kind: 'house'; id: string; size: string }
  | { kind: 'programmatic'; id: 'net'; size: string; code: string }
  | null;

// ¿La URL parece una imagen de verdad? Los enlaces de "banner" que dan las redes
// de afiliados suelen ser de clic/iframe (…/visit/?bta=…), no un archivo de imagen,
// y romperían el <img>. Aceptamos extensiones de imagen o data URLs; el resto cae a
// la tarjeta del socio (y onError sirve de red por si igual falla).
function looksLikeImage(u: string) {
  if (!u) return false;
  if (u.startsWith('data:image/')) return true;
  return /\.(png|jpe?g|gif|webp|avif|svg)(\?|#|$)/i.test(u.trim());
}

// Contador de huecos por carga de página: cada AdSlot toma una posición (0,1,2…)
// para que el servidor no repita el mismo anuncio ni la misma marca en huecos seguidos.
let SLOT_SEQ = 0;

// Tamaño de cada ubicación (para el modo previsualización, sin llamar al servidor).
const SLOT_SIZE: Record<string, string> = {
  blog_top: '970x90', blog_infeed: '600x300', blog_native: '600x300',
  article_incontent: '728x90', article_sidebar: '300x600', article_halfpage: '300x600',
  landing_top: '970x90', landing_billboard: '970x250', footer_site: '728x90',
  sticky_bottom: '320x50', directory_partner: '600x300',
};

export default function AdSlot({ slot, lang, label = true }: { slot: string; lang: 'es' | 'en'; label?: boolean }) {
  const [ad, setAd] = useState<Served>(null);
  const [done, setDone] = useState(false);
  const [bannerBad, setBannerBad] = useState(false); // el banner del socio no cargó / no es imagen
  const ref = useRef<HTMLDivElement | null>(null);
  const viewed = useRef(false);
  const posRef = useRef<number>(-1);
  if (posRef.current < 0) posRef.current = SLOT_SEQ++;   // posición estable de este hueco

  // Modo previsualización: si la URL trae ?adpreview=<slot>, mostramos un
  // marcador del hueco (aunque no haya anuncio ni el visitante los vea), para
  // que el vendedor/anunciante vea EXACTAMENTE dónde va. adpreview vacío = todos.
  const [preview, setPreview] = useState<{ on: boolean; target: string }>({ on: false, target: '' });
  useEffect(() => {
    try { const p = new URLSearchParams(window.location.search).get('adpreview');
      if (p !== null) setPreview({ on: true, target: p }); } catch {}
  }, []);

  useEffect(() => {
    let alive = true;
    try { if (new URLSearchParams(window.location.search).get('adpreview') !== null) { setDone(true); return; } } catch {}
    fetch(`/api/ads/serve?slot=${encodeURIComponent(slot)}&lang=${lang}&pos=${posRef.current}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => { if (alive) { setBannerBad(false); setAd(j.hide ? null : (j.ad || null)); setDone(true); } })
      .catch(() => { if (alive) setDone(true); });
    return () => { alive = false; };
  }, [slot, lang]);

  // Viewability: cuenta una "vista" cuando ≥50% del anuncio pagado se ve ≥1s (IAB).
  useEffect(() => {
    if (!ad || ad.kind !== 'paid' || !ref.current) return;
    const el = ref.current; let timer: any = null;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting && e.intersectionRatio >= 0.5) {
          if (!timer && !viewed.current) timer = setTimeout(() => {
            viewed.current = true;
            try { navigator.sendBeacon('/api/ads/view', new Blob([JSON.stringify({ id: ad.id })], { type: 'application/json' })); } catch {}
          }, 1000);
        } else if (timer) { clearTimeout(timer); timer = null; }
      }
    }, { threshold: [0, 0.5, 1] });
    io.observe(el);
    return () => { io.disconnect(); if (timer) clearTimeout(timer); };
  }, [ad]);

  // Marcador de previsualización: recuadro a tamaño real en la posición exacta.
  if (preview.on) {
    const sz = SLOT_SIZE[slot] || '728x90';
    const [pw, ph] = sz.split('x').map((n) => parseInt(n, 10) || 1);
    const target = preview.target === slot;
    const L2 = (a: string, b: string) => (lang === 'es' ? a : b);
    return (
      <div ref={ref} data-slot={slot} style={{ margin: '18px auto', maxWidth: pw, width: '100%' }}>
        <div style={{
          aspectRatio: `${pw} / ${ph}`, width: '100%', borderRadius: 8,
          border: `2px ${target ? 'solid' : 'dashed'} #8b93ff`,
          background: target ? 'rgba(139,147,255,.22)' : 'rgba(139,147,255,.08)',
          boxShadow: target ? '0 0 0 4px rgba(139,147,255,.28)' : 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#c9ccff', lineHeight: 1.3 }}>
            {target ? L2('Aquí va TU anuncio', 'YOUR ad goes here') : L2('Espacio publicitario', 'Ad space')}
            <br /><span style={{ fontSize: 11, opacity: .85 }}>{sz}</span>
          </span>
        </div>
      </div>
    );
  }

  if (!done || !ad) return null;

  const [w, h] = (ad.size || '728x90').split('x').map((n) => parseInt(n, 10) || 0);
  const L = (a: string, b: string) => (lang === 'es' ? a : b);
  const wrap: any = { margin: '18px auto', maxWidth: w || 970, width: '100%' };
  const tag = <div style={{ fontSize: 10, letterSpacing: '.05em', color: 'var(--mut)', textTransform: 'uppercase', marginBottom: 4 }}>{L('Publicidad', 'Advertisement')}</div>;

  // Relleno programático (red externa) cuando no hay campaña pagada.
  if (ad.kind === 'programmatic') {
    return (
      <div className="onyx-ad" data-slot={slot} style={wrap} ref={ref}>
        {label && tag}
        <div dangerouslySetInnerHTML={{ __html: ad.code }} />
      </div>
    );
  }

  // Socio del directorio (CPA): broker/prop firm con tu enlace afiliado. Rellena
  // los huecos vacíos y cada clic te paga comisión. Va etiquetado y con rel sponsored.
  if (ad.kind === 'partner') {
    // Solo mostramos el banner como imagen si de verdad es una imagen y no ha
    // fallado. Los "banners" de las redes de afiliados suelen ser enlaces de
    // clic/iframe (…/visit/?bta=…): esos NO son imagen → caemos a la tarjeta.
    if (ad.banner && looksLikeImage(ad.banner) && !bannerBad) {
      return (
        <div className="onyx-ad" data-slot={slot} style={wrap} ref={ref}>
          {label && tag}
          <a href={ad.link} target="_blank" rel="sponsored nofollow noopener" style={{ display: 'block', lineHeight: 0, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--line)' }}>
            <img src={ad.banner} alt={ad.name} loading="lazy" decoding="async" onError={() => setBannerBad(true)}
                 style={{ width: '100%', height: 'auto', display: 'block' }} />
          </a>
        </div>
      );
    }
    return (
      <div className="onyx-ad" data-slot={slot} style={wrap} ref={ref}>
        {label && tag}
        <a href={ad.link} target="_blank" rel="sponsored nofollow noopener" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: 'inherit', border: '1px solid var(--line)', borderRadius: 12, padding: '12px 16px', background: 'color-mix(in srgb, var(--brand) 8%, transparent)' }}>
          {ad.logo
            ? <img src={ad.logo} alt={ad.name} loading="lazy" decoding="async" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'contain', flex: 'none', background: '#ffffff10' }} />
            : <span style={{ width: 40, height: 40, borderRadius: 8, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, background: 'var(--line)' }}>{ad.name?.[0] || '?'}</span>}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{ad.name}</div>
            {ad.blurb && <div className="muted" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{ad.blurb}</div>}
          </div>
          <span style={{ color: 'var(--brand)', fontSize: 13.5, fontWeight: 700, flex: 'none', marginLeft: 'auto' }}>{L('Ver →', 'View →')}</span>
        </a>
      </div>
    );
  }

  // House ad (relleno propio): promueve Pro.
  if (ad.kind === 'house') {
    return (
      <div className="onyx-ad" data-slot={slot} style={wrap} ref={ref}>
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
    <div className="onyx-ad" data-slot={slot} style={wrap} ref={ref}>
      {label && tag}
      <a href={ad.link} target="_blank" rel="sponsored nofollow noopener" onClick={onClick} style={{ display: 'block', lineHeight: 0, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--line)' }}>
        <img src={ad.creative} alt={ad.alt || L('Anuncio', 'Ad')} loading="lazy" decoding="async" style={{ width: '100%', height: 'auto', display: 'block' }} />
      </a>
      {ad.disclaimer && <div style={{ fontSize: 9.5, lineHeight: 1.35, color: 'var(--mut)', marginTop: 4, opacity: 0.8 }}>{ad.disclaimer}</div>}
    </div>
  );
}
