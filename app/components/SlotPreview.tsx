'use client';
import React, { useEffect, useRef, useState, useCallback } from 'react';

// Vista de dónde caerá el anuncio. Dos modos:
//  · MAQUETA (por defecto): simulación de escritorio del sitio, siempre bien
//    proporcionada; el recuadro cae en la zona exacta con la proporción real.
//  · EN VIVO: la página real del sitio a ancho de escritorio, con ZOOM manual
//    (− / % / +) y SCROLL, sin auto-encoger. No recarga sola (URL estable, el
//    iframe se monta una vez y se mantiene).
// El recuadro de la vista se puede ESTIRAR arrastrando su esquina inferior
// derecha. Y hay pantalla completa.
const LOGICAL_W = 1280;
const LOGICAL_H = 2200;

export default function SlotPreview({ slotKey, page, size, es = true }: { slotKey: string; page: string; size: string; es?: boolean }) {
  const L = (a: string, b: string) => (es ? a : b);
  const ACC = 'var(--accent,#8b93ff)';
  const line = 'var(--line,#2a3350)';
  const bg = '#0e1524';

  // Origen fijo desde el primer render (evita recargas por cambio de host).
  const [origin] = useState(() => { try { if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin; } catch {} return 'https://www.onyxtradinglive.com'; });
  // Los espacios de ARTÍCULO (lateral, media página, dentro del texto) sólo
  // existen en una página de artículo, no en el listado. Resolvemos un artículo
  // real (por el sitemap) para poder mostrarlos.
  const [articlePath, setArticlePath] = useState<string>('/blog');
  useEffect(() => {
    if (page !== 'article') return; let alive = true;
    (async () => {
      try {
        const xml = await fetch(`${origin}/sitemap.xml`, { cache: 'no-store' }).then((r) => r.text());
        let m = xml.match(/https?:\/\/[^<\s]+\/blog\/[a-z0-9\-]+/i);
        if (m) { if (alive) setArticlePath(new URL(m[0]).pathname); return; }
      } catch {}
      try {
        const html = await fetch(`${origin}/blog`, { cache: 'no-store' }).then((r) => r.text());
        const m = html.match(/\/blog\/[a-z0-9\-]{3,}/i);
        if (alive && m) setArticlePath(m[0]);
      } catch {}
    })();
    return () => { alive = false; };
  }, [page, origin]);
  const path = page === 'blog' ? '/blog' : page === 'article' ? articlePath : page === 'directory' ? '/publicidad' : '/';
  // La URL lleva ?adpreview=<slot>: la página marca TODOS los huecos y resalta el
  // elegido, aunque no haya anuncio ni el visitante los vea. Cambia con el slot.
  const src = `${origin}${path}?adpreview=${encodeURIComponent(slotKey)}`;

  // Por defecto la MAQUETA (sin iframe): fluida, instantánea y sin recargas. El
  // iframe "en vivo" solo se monta cuando el usuario lo pide (evita que el SW /
  // chequeo de versión del sitio provoque refrescos dentro del recuadro).
  const [mode, setMode] = useState<'mock' | 'live'>('mock');
  const [everLive, setEverLive] = useState(false);
  const [full, setFull] = useState(false);
  const [zoom, setZoom] = useState(0.85);
  const [box, setBox] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [found, setFound] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const zoomRef = useRef(0.85);
  const raf = useRef<number | null>(null);
  const timers = useRef<any[]>([]);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  const [aw, ah] = (size || '728x90').split('x').map((n) => parseInt(n, 10) || 1);
  const aspect = aw / ah;

  // ---------- recuadro exacto sobre el hueco real (en vivo) ----------
  const reposition = useCallback((scroll = false) => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      try {
        const el = iframeRef.current?.contentDocument?.querySelector(`[data-slot="${slotKey}"]`) as HTMLElement | null;
        if (el) {
          if (scroll) { try { el.scrollIntoView({ block: 'center' }); } catch {} }
          const r = el.getBoundingClientRect(); const z = zoomRef.current;
          setBox({ top: r.top * z, left: r.left * z, width: r.width * z, height: Math.max(r.height * z, 16) }); setFound(true);
        } else { setFound(false); setBox(null); }
      } catch { setFound(false); setBox(null); }
    });
  }, [slotKey]);
  const onLoad = useCallback(() => {
    reposition(true);
    [300, 800, 1500].forEach((ms) => timers.current.push(setTimeout(() => reposition(true), ms)));
    try { const w = iframeRef.current?.contentWindow; if (w) { const f = () => reposition(false); w.addEventListener('scroll', f, { passive: true } as any); (iframeRef.current as any)._c = () => { try { w.removeEventListener('scroll', f); } catch {} }; } } catch {}
  }, [reposition]);
  useEffect(() => { if (mode === 'live') { const t = setTimeout(() => reposition(true), 150); timers.current.push(t); } }, [mode, slotKey, zoom, full, reposition]);
  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current); timers.current.forEach(clearTimeout); timers.current = []; try { (iframeRef.current as any)?._c?.(); } catch {} }, []);

  const goLive = () => { setEverLive(true); setMode('live'); };
  const setZ = (z: number) => setZoom(Math.max(0.4, Math.min(1.5, Math.round(z * 100) / 100)));

  // ---------- maqueta ----------
  const gray = (h: number | string, w: any = '100%', extra: React.CSSProperties = {}) => ({ height: h, width: w, background: 'rgba(255,255,255,.06)', borderRadius: 6, ...extra } as React.CSSProperties);
  const AdBox = ({ maxW = 640 }: { maxW?: number }) => (
    <div style={{ width: '100%', maxWidth: maxW, aspectRatio: `${aw} / ${ah}`, margin: '0 auto', borderRadius: 8, border: `2px solid ${ACC}`, background: 'color-mix(in srgb, var(--accent,#8b93ff) 20%, transparent)', boxShadow: `0 0 0 4px color-mix(in srgb, var(--accent,#8b93ff) 16%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,.6)', lineHeight: 1.25 }}>{L('Tu anuncio aquí', 'Your ad here')}<br /><span style={{ fontSize: 11, opacity: .9 }}>{size}</span></span>
    </div>
  );
  const isAd = (k: string) => k === slotKey;
  let mock: React.ReactNode = null;
  if (page === 'blog') mock = (<div style={{ display: 'grid', gap: 12 }}>{isAd('blog_top') ? <AdBox maxW={640} /> : <div style={gray(46)} />}<div style={gray(20, '45%')} />{(isAd('blog_infeed') || isAd('blog_native')) ? <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}><div style={gray(120)} /><div style={{ display: 'flex' }}><AdBox maxW={300} /></div></div> : <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}><div style={gray(120)} /><div style={gray(120)} /></div>}<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}><div style={gray(120)} /><div style={gray(120)} /></div></div>);
  else if (page === 'article') mock = (<div style={{ display: 'grid', gridTemplateColumns: '1.9fr 1fr', gap: 16 }}><div style={{ display: 'grid', gap: 10 }}><div style={gray(22, '75%')} /><div style={gray(12)} /><div style={gray(12)} />{isAd('article_incontent') ? <AdBox maxW={560} /> : <div style={gray(12)} />}<div style={gray(12)} /><div style={gray(12)} /><div style={gray(12)} /></div><div>{(isAd('article_sidebar') || isAd('article_halfpage')) ? <AdBox maxW={300} /> : <div style={gray(220)} />}</div></div>);
  else if (page === 'landing') mock = (<div style={{ display: 'grid', gap: 14 }}>{(isAd('landing_billboard') || isAd('landing_top')) ? <AdBox maxW={728} /> : <div style={gray(60)} />}<div style={gray(40, '55%', { margin: '4px auto 0' })} /><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}><div style={gray(90)} /><div style={gray(90)} /><div style={gray(90)} /></div></div>);
  else if (page === 'directory') mock = (<div style={{ display: 'grid', gap: 10 }}><div style={gray(18, '45%')} />{isAd('directory_partner') ? <AdBox maxW={620} /> : <div style={gray(60)} />}<div style={gray(50)} /><div style={gray(50)} /></div>);
  else mock = (<div style={{ display: 'grid', gap: 12 }}><div style={gray(16, '50%')} /><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}><div style={gray(90)} /><div style={gray(90)} /></div>{(isAd('footer_site') || isAd('sticky_bottom')) ? <AdBox maxW={728} /> : <div style={gray(30)} />}</div>);

  const chip = (on: boolean): React.CSSProperties => ({ cursor: 'pointer', background: on ? ACC : 'transparent', border: `1px solid ${on ? ACC : line}`, color: on ? '#fff' : 'var(--tx,#e8ecf5)', borderRadius: 7, padding: '3px 9px', fontSize: 11, fontWeight: 600 });
  const zbtn: React.CSSProperties = { cursor: 'pointer', background: 'transparent', border: `1px solid ${line}`, color: 'var(--tx,#e8ecf5)', borderRadius: 6, width: 24, height: 24, fontSize: 14, lineHeight: '20px', padding: 0 };

  const stageStyle: React.CSSProperties = full
    ? { position: 'relative', flex: 1, overflow: 'auto', background: bg }
    : { position: 'relative', width: '100%', height: 460, minHeight: 260, overflow: 'auto', resize: 'vertical', background: bg };

  const inner = (
    <div style={{ border: `1px solid ${line}`, borderRadius: full ? 0 : 12, overflow: 'hidden', background: 'var(--panel,#161c2e)', display: 'flex', flexDirection: 'column', height: full ? '100%' : 'auto' }}>
      {/* barra de herramientas */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', background: 'color-mix(in srgb, var(--mut,#9aa6bd) 12%, transparent)', borderBottom: `1px solid ${line}`, flex: 'none', flexWrap: 'wrap' }}>
        <span style={{ width: 8, height: 8, borderRadius: 8, background: '#f0736f' }} />
        <span style={{ width: 8, height: 8, borderRadius: 8, background: '#f0b74e' }} />
        <span style={{ width: 8, height: 8, borderRadius: 8, background: '#5ed6a0' }} />
        <span style={{ marginLeft: 6, fontSize: 10.5, color: 'var(--mut,#9aa6bd)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }}>{src.replace(/^https?:\/\//, '')}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={() => setMode('mock')} style={chip(mode === 'mock')}>{L('Maqueta', 'Mock')}</button>
          <button onClick={goLive} style={chip(mode === 'live')}>{mode === 'live' ? '● ' + L('En vivo', 'Live') : L('Ver en vivo', 'View live')}</button>
          {mode === 'live' && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 2 }}>
              <button onClick={() => setZ(zoom - 0.1)} style={zbtn} title={L('Alejar', 'Zoom out')}>−</button>
              <span style={{ fontSize: 11, color: 'var(--tx,#e8ecf5)', minWidth: 34, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZ(zoom + 0.1)} style={zbtn} title={L('Acercar', 'Zoom in')}>+</button>
            </span>
          )}
          <button onClick={() => setFull((v) => !v)} style={chip(full)}>{full ? '✕ ' + L('Cerrar', 'Close') : '⛶ ' + L('Pantalla completa', 'Fullscreen')}</button>
        </div>
      </div>

      {/* escenario: se puede estirar arrastrando la esquina inferior derecha */}
      <div style={stageStyle}>
        {/* EN VIVO: iframe a tamaño real con zoom + scroll (montado una sola vez) */}
        {everLive && (
          <div style={{ display: mode === 'live' ? 'block' : 'none', position: 'relative', width: LOGICAL_W * zoom, height: LOGICAL_H * zoom }}>
            <iframe ref={iframeRef} src={src} title={page} onLoad={onLoad} sandbox="allow-same-origin allow-scripts allow-popups"
              style={{ position: 'absolute', top: 0, left: 0, width: LOGICAL_W, height: LOGICAL_H, border: 0, transform: `scale(${zoom})`, transformOrigin: 'top left' }} />
            {found && box && (
              <div style={{ position: 'absolute', top: box.top, left: box.left, width: box.width, height: box.height, borderRadius: 6, border: `2px solid ${ACC}`, background: 'color-mix(in srgb, var(--accent,#8b93ff) 22%, transparent)', boxShadow: `0 0 0 3px color-mix(in srgb, var(--accent,#8b93ff) 22%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,.75)', textAlign: 'center', lineHeight: 1.2 }}>{L('Tu anuncio aquí', 'Your ad here')}<br /><span style={{ fontSize: 10.5, opacity: .95 }}>{size}</span></span>
              </div>
            )}
          </div>
        )}
        {mode === 'live' && everLive && !found && (
          <div style={{ position: 'sticky', bottom: 0, left: 0, right: 0, padding: '7px 12px', background: 'color-mix(in srgb, var(--accent,#8b93ff) 88%, #000)', color: '#fff', fontSize: 12, fontWeight: 600, textAlign: 'center' }}>{L(`El hueco ${size} aparece al hacer scroll en esta página.`, `The ${size} slot appears as you scroll this page.`)}</div>
        )}

        {/* MAQUETA */}
        {mode === 'mock' && (
          <div style={{ position: 'absolute', inset: 0, overflow: 'auto', background: bg }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 22px', borderBottom: `1px solid ${line}`, position: 'sticky', top: 0, background: bg }}>
              <div style={{ width: 26, height: 26, borderRadius: 7, background: ACC }} />
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx,#e8ecf5)' }}>Onyx Trading Live</div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 16 }}>{[70, 60, 80, 55].map((w, i) => <div key={i} style={{ width: w, height: 10, borderRadius: 6, background: 'rgba(255,255,255,.08)' }} />)}</div>
            </div>
            <div style={{ padding: '20px 22px 30px', maxWidth: 1040, margin: '0 auto' }}>{mock}</div>
          </div>
        )}
      </div>

      {!full && <div style={{ padding: '6px 12px 10px', fontSize: 11, color: 'var(--mut,#9aa6bd)' }}>{L('Estira el recuadro desde su esquina inferior derecha. “Ver en vivo” abre la página real con zoom y scroll.', 'Drag the bottom-right corner to resize. “View live” opens the real page with zoom and scroll.')}</div>}
    </div>
  );

  if (full) return <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(3,6,14,.9)', padding: 10, display: 'flex' }}><div style={{ margin: 'auto', width: '100%', height: '100%', display: 'flex' }}>{inner}</div></div>;
  return inner;
}
