'use client';
import React, { useEffect, useRef, useState, useCallback } from 'react';

// Vista EN VIVO de dónde caerá el anuncio. Carga la página real del sitio en un
// mini-navegador (iframe, mismo dominio) y coloca el recuadro dorado JUSTO sobre
// el hueco real del anuncio: busca el elemento por su atributo data-slot, lo
// centra en la vista y dibuja el recuadro exactamente encima (con su tamaño).
// Se recalcula al cargar, al hacer scroll y al cambiar de tamaño → siempre
// alineado. Botón de pantalla completa. Eficiente: un solo iframe, listeners
// limpiados, reposicionado con requestAnimationFrame.
export default function SlotPreview({ slotKey, page, size, es = true }: { slotKey: string; page: string; size: string; es?: boolean }) {
  const L = (a: string, b: string) => (es ? a : b);
  const ACC = 'var(--accent,#8b93ff)';
  const line = 'var(--line,#2a3350)';

  const [origin, setOrigin] = useState('https://www.onyxtradinglive.com');
  const [full, setFull] = useState(false);
  const [box, setBox] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [found, setFound] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const raf = useRef<number | null>(null);
  const timers = useRef<any[]>([]);

  useEffect(() => { try { if (typeof window !== 'undefined' && window.location?.origin) setOrigin(window.location.origin); } catch {} }, []);

  const path = page === 'blog' || page === 'article' ? '/blog' : page === 'directory' ? '/publicidad' : '/';
  const src = `${origin}${path}`;

  // Zona aproximada (respaldo si no se encuentra el hueco real).
  const zonePct = (): React.CSSProperties => {
    switch (slotKey) {
      case 'landing_billboard': return { top: '14%', left: '3%', width: '94%', height: '16%' };
      case 'blog_top': case 'landing_top': return { top: '14%', left: '3%', width: '94%', height: '8%' };
      case 'article_incontent': return { top: '40%', left: '3%', width: '64%', height: '7%' };
      case 'article_sidebar': return { top: '26%', right: '3%', width: '30%', height: '16%' };
      case 'article_halfpage': return { top: '22%', right: '3%', width: '30%', height: '34%' };
      case 'blog_infeed': return { top: '52%', left: '3%', width: '94%', height: '8%' };
      case 'blog_native': return { top: '30%', left: '52%', width: '45%', height: '16%' };
      case 'footer_site': return { bottom: '5%', left: '3%', width: '94%', height: '7%' };
      case 'sticky_bottom': return { bottom: '3%', left: '3%', width: '94%', height: '5%' };
      case 'directory_partner': return { top: '26%', left: '3%', width: '94%', height: '9%' };
      default: return { top: '14%', left: '3%', width: '94%', height: '8%' };
    }
  };

  // Recalcula la posición del recuadro sobre el hueco real.
  const reposition = useCallback((scroll = false) => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      try {
        const ifr = iframeRef.current; const wrap = wrapRef.current;
        if (!ifr || !wrap) return;
        const doc = ifr.contentDocument;
        const el = doc?.querySelector(`[data-slot="${slotKey}"]`) as HTMLElement | null;
        if (el) {
          if (scroll) { try { el.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch {} }
          const r = el.getBoundingClientRect();
          const wr = ifr.getBoundingClientRect();
          setBox({ top: r.top, left: r.left, width: r.width, height: Math.max(r.height, 18) });
          setFound(true);
        } else {
          setFound(false); setBox(null);
        }
      } catch { setFound(false); setBox(null); }
    });
  }, [slotKey]);

  // Al cargar el iframe: reposiciona varias veces (deja asentar el layout y los
  // anuncios), y engancha listeners de scroll/resize dentro del iframe.
  const onLoad = useCallback(() => {
    reposition(true);
    [200, 500, 900, 1500].forEach((ms) => timers.current.push(setTimeout(() => reposition(true), ms)));
    try {
      const win = iframeRef.current?.contentWindow;
      if (win) {
        const onScroll = () => reposition(false);
        win.addEventListener('scroll', onScroll, { passive: true } as any);
        win.addEventListener('resize', onScroll);
        (iframeRef.current as any)._cleanup = () => { try { win.removeEventListener('scroll', onScroll); win.removeEventListener('resize', onScroll); } catch {} };
      }
    } catch {}
  }, [reposition]);

  // Al cambiar de espacio o entrar/salir de pantalla completa, recentra.
  useEffect(() => { const t = setTimeout(() => reposition(true), 120); timers.current.push(t); return () => clearTimeout(t); }, [slotKey, full, reposition]);

  // Limpieza.
  useEffect(() => () => {
    if (raf.current) cancelAnimationFrame(raf.current);
    timers.current.forEach(clearTimeout); timers.current = [];
    try { (iframeRef.current as any)?._cleanup?.(); } catch {}
  }, []);

  const H = full ? '100%' : 420;

  const inner = (
    <div style={{ border: `1px solid ${line}`, borderRadius: full ? 0 : 12, overflow: 'hidden', background: 'var(--panel,#161c2e)', display: 'flex', flexDirection: 'column', height: full ? '100%' : 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', background: 'color-mix(in srgb, var(--mut,#9aa6bd) 12%, transparent)', borderBottom: `1px solid ${line}`, flex: 'none' }}>
        <span style={{ width: 8, height: 8, borderRadius: 8, background: '#f0736f' }} />
        <span style={{ width: 8, height: 8, borderRadius: 8, background: '#f0b74e' }} />
        <span style={{ width: 8, height: 8, borderRadius: 8, background: '#5ed6a0' }} />
        <span style={{ marginLeft: 8, fontSize: 10.5, color: 'var(--mut,#9aa6bd)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{src.replace(/^https?:\/\//, '')}</span>
        <span style={{ marginLeft: 'auto', fontSize: 9.5, color: '#5ed6a0', border: '1px solid #5ed6a0', borderRadius: 20, padding: '1px 7px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: 6, background: '#5ed6a0', boxShadow: '0 0 6px #5ed6a0' }} />{L('EN VIVO', 'LIVE')}
        </span>
        <button onClick={() => setFull((v) => !v)} title={full ? L('Salir', 'Exit') : L('Pantalla completa', 'Fullscreen')}
          style={{ marginLeft: 6, cursor: 'pointer', background: 'transparent', border: `1px solid ${line}`, color: 'var(--tx,#e8ecf5)', borderRadius: 7, padding: '2px 8px', fontSize: 11 }}>
          {full ? '✕ ' + L('Cerrar', 'Close') : '⛶ ' + L('Ampliar', 'Expand')}
        </button>
      </div>

      <div ref={wrapRef} style={{ position: 'relative', width: '100%', height: H, flex: full ? 1 : 'none', background: '#0b0f1a' }}>
        <iframe
          ref={iframeRef}
          src={src}
          title={page}
          loading="lazy"
          onLoad={onLoad}
          sandbox="allow-same-origin allow-scripts"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, pointerEvents: 'none' }}
        />
        <div style={{ position: 'absolute', inset: 0 }} />
        {/* recuadro exacto sobre el hueco real */}
        {found && box && (
          <div style={{ position: 'absolute', top: box.top, left: box.left, width: box.width, height: box.height, borderRadius: 6, border: `2px solid ${ACC}`, background: 'color-mix(in srgb, var(--accent,#8b93ff) 24%, transparent)', boxShadow: `0 0 0 3px color-mix(in srgb, var(--accent,#8b93ff) 22%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,.7)', textAlign: 'center', lineHeight: 1.2 }}>{L('Tu anuncio aquí', 'Your ad here')}<br /><span style={{ fontSize: 10, opacity: .95 }}>{size}</span></span>
          </div>
        )}
        {/* respaldo aproximado si aún no se localiza el hueco */}
        {!found && (
          <div style={{ position: 'absolute', ...zonePct(), borderRadius: 6, border: `2px dashed ${ACC}`, background: 'color-mix(in srgb, var(--accent,#8b93ff) 16%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,.7)', textAlign: 'center', lineHeight: 1.2 }}>{L('Tu anuncio aquí', 'Your ad here')}<br /><span style={{ fontSize: 10, opacity: .9 }}>{size} · {L('ubicación aprox.', 'approx. spot')}</span></span>
          </div>
        )}
      </div>

      {!full && <div style={{ padding: '6px 12px 10px', fontSize: 11, color: 'var(--mut,#9aa6bd)' }}>{L('Página real del sitio. El recuadro marca dónde se mostrará el anuncio.', 'Real site page. The box marks where the ad will appear.')}</div>}
    </div>
  );

  if (full) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(3,6,14,.85)', padding: 18, display: 'flex' }}>
        <div style={{ margin: 'auto', width: '100%', maxWidth: 1200, height: '90vh', display: 'flex' }}>{inner}</div>
      </div>
    );
  }
  return inner;
}
