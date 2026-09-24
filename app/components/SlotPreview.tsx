'use client';
import React, { useEffect, useRef, useState, useCallback } from 'react';

// Vista EN VIVO de dónde caerá el anuncio. Carga la página real del sitio en un
// mini-navegador y coloca el recuadro dorado justo sobre el hueco real del
// anuncio (lo busca por data-slot y mide su posición exacta). La página se
// renderiza a ancho de ESCRITORIO (1280) y se escala para caber, así se ve el
// layout real (leaderboard, lateral, etc.) y no la versión móvil apretada. Es
// interactiva: se puede hacer scroll dentro. Tiene pantalla completa. Eficiente:
// un solo iframe, reposición con requestAnimationFrame y listeners que se limpian.
const LOGICAL_W = 1280;

export default function SlotPreview({ slotKey, page, size, es = true }: { slotKey: string; page: string; size: string; es?: boolean }) {
  const L = (a: string, b: string) => (es ? a : b);
  const ACC = 'var(--accent,#8b93ff)';
  const line = 'var(--line,#2a3350)';

  const [origin, setOrigin] = useState('https://www.onyxtradinglive.com');
  const [full, setFull] = useState(false);
  const [scale, setScale] = useState(0.4);
  const [box, setBox] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [found, setFound] = useState(false);

  const stageRef = useRef<HTMLDivElement | null>(null);   // área visible (recorta)
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const scaleRef = useRef(0.4);
  const raf = useRef<number | null>(null);
  const timers = useRef<any[]>([]);

  useEffect(() => { try { if (typeof window !== 'undefined' && window.location?.origin) setOrigin(window.location.origin); } catch {} }, []);

  const path = page === 'blog' || page === 'article' ? '/blog' : page === 'directory' ? '/publicidad' : '/';
  const src = `${origin}${path}`;

  const zoneName = ({ blog_top: L('el leaderboard superior', 'the top leaderboard'), landing_top: L('el leaderboard', 'the leaderboard'), landing_billboard: L('el billboard superior', 'the top billboard'), article_incontent: L('dentro del artículo', 'inside the article'), article_sidebar: L('la barra lateral', 'the sidebar'), article_halfpage: L('la barra lateral (media página)', 'the sidebar (half-page)'), blog_infeed: L('entre los posts', 'between posts'), blog_native: L('la tarjeta destacada', 'the featured card'), footer_site: L('el footer', 'the footer'), sticky_bottom: L('la barra fija inferior', 'the sticky bottom bar'), directory_partner: L('el directorio', 'the directory') } as any)[slotKey] || L('esta página', 'this page');

  // Ajusta la escala para que 1280px de ancho lógico quepan en el escenario.
  const fit = useCallback(() => {
    const st = stageRef.current; if (!st) return;
    const w = st.clientWidth || 1;
    const s = Math.max(0.2, Math.min(1, w / LOGICAL_W));
    scaleRef.current = s; setScale(s);
  }, []);

  // Recalcula el recuadro sobre el hueco real (coordenadas × escala).
  const reposition = useCallback((scroll = false) => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      try {
        const ifr = iframeRef.current; if (!ifr) return;
        const el = ifr.contentDocument?.querySelector(`[data-slot="${slotKey}"]`) as HTMLElement | null;
        if (el) {
          if (scroll) { try { el.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch {} }
          const r = el.getBoundingClientRect();
          const s = scaleRef.current;
          setBox({ top: r.top * s, left: r.left * s, width: r.width * s, height: Math.max(r.height * s, 16) });
          setFound(true);
        } else { setFound(false); setBox(null); }
      } catch { setFound(false); setBox(null); }
    });
  }, [slotKey]);

  const onLoad = useCallback(() => {
    fit(); reposition(true);
    [200, 500, 1000, 1600].forEach((ms) => timers.current.push(setTimeout(() => reposition(true), ms)));
    try {
      const win = iframeRef.current?.contentWindow;
      if (win) {
        const onScroll = () => reposition(false);
        win.addEventListener('scroll', onScroll, { passive: true } as any);
        (iframeRef.current as any)._cleanup = () => { try { win.removeEventListener('scroll', onScroll); } catch {} };
      }
    } catch {}
  }, [fit, reposition]);

  // Reajusta al cambiar de espacio, tamaño o pantalla completa.
  useEffect(() => {
    const st = stageRef.current; if (!st) return;
    const ro = new ResizeObserver(() => { fit(); reposition(false); });
    ro.observe(st);
    return () => ro.disconnect();
  }, [fit, reposition]);
  useEffect(() => { const t = setTimeout(() => { fit(); reposition(true); }, 140); timers.current.push(t); return () => clearTimeout(t); }, [slotKey, full, fit, reposition]);
  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current); timers.current.forEach(clearTimeout); timers.current = []; try { (iframeRef.current as any)?._cleanup?.(); } catch {} }, []);

  const stageH = full ? '100%' : 440;
  const iframeH = `${(1 / scale) * 100}%`;   // alto lógico para llenar el escenario tras escalar

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
          style={{ marginLeft: 6, cursor: 'pointer', background: full ? ACC : 'transparent', border: `1px solid ${full ? ACC : line}`, color: full ? '#fff' : 'var(--tx,#e8ecf5)', borderRadius: 7, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>
          {full ? '✕ ' + L('Cerrar', 'Close') : '⛶ ' + L('Pantalla completa', 'Fullscreen')}
        </button>
      </div>

      {/* escenario que recorta; dentro va el iframe a ancho de escritorio escalado */}
      <div ref={stageRef} style={{ position: 'relative', width: '100%', height: stageH, flex: full ? 1 : 'none', overflow: 'hidden', background: '#0b0f1a' }}>
        <iframe
          ref={iframeRef}
          src={src}
          title={page}
          loading="lazy"
          onLoad={onLoad}
          sandbox="allow-same-origin allow-scripts allow-popups"
          style={{ position: 'absolute', top: 0, left: 0, width: LOGICAL_W, height: iframeH, border: 0, transform: `scale(${scale})`, transformOrigin: 'top left' }}
        />
        {/* recuadro exacto sobre el hueco real (no bloquea el scroll) */}
        {found && box && (
          <div style={{ position: 'absolute', top: box.top, left: box.left, width: box.width, height: box.height, borderRadius: 6, border: `2px solid ${ACC}`, background: 'color-mix(in srgb, var(--accent,#8b93ff) 22%, transparent)', boxShadow: `0 0 0 3px color-mix(in srgb, var(--accent,#8b93ff) 22%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,.75)', textAlign: 'center', lineHeight: 1.2 }}>{L('Tu anuncio aquí', 'Your ad here')}<br /><span style={{ fontSize: 10.5, opacity: .95 }}>{size}</span></span>
          </div>
        )}
        {/* si el hueco no está en esta página, aviso limpio (sin recuadro mal puesto) */}
        {!found && (
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '8px 12px', background: 'color-mix(in srgb, var(--accent,#8b93ff) 90%, #000)', color: '#fff', fontSize: 12, fontWeight: 600, textAlign: 'center', pointerEvents: 'none' }}>
            {L(`Este anuncio (${size}) se muestra en ${zoneName}. Haz scroll para verlo.`, `This ad (${size}) shows in ${zoneName}. Scroll to see it.`)}
          </div>
        )}
      </div>

      {!full && <div style={{ padding: '6px 12px 10px', fontSize: 11, color: 'var(--mut,#9aa6bd)' }}>{L('Página real del sitio (puedes hacer scroll). El recuadro marca dónde va el anuncio.', 'Real site page (you can scroll). The box marks where the ad goes.')}</div>}
    </div>
  );

  if (full) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(3,6,14,.9)', padding: 10, display: 'flex' }}>
        <div style={{ margin: 'auto', width: '100%', height: '100%', display: 'flex' }}>{inner}</div>
      </div>
    );
  }
  return inner;
}
