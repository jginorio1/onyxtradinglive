'use client';
import React, { useEffect, useRef, useState, useCallback } from 'react';

// Vista de dónde caerá el anuncio. Por defecto muestra una MAQUETA de escritorio
// fiel del sitio (siempre se ve bien y el banner cae en su zona exacta, con su
// proporción real). Un botón "● En vivo" cambia a la página real (iframe a ancho
// de escritorio escalado, con scroll). Ambos con pantalla completa.
const LOGICAL_W = 1280;

export default function SlotPreview({ slotKey, page, size, es = true }: { slotKey: string; page: string; size: string; es?: boolean }) {
  const L = (a: string, b: string) => (es ? a : b);
  const ACC = 'var(--accent,#8b93ff)';
  const line = 'var(--line,#2a3350)';

  const [origin, setOrigin] = useState('https://www.onyxtradinglive.com');
  const [full, setFull] = useState(false);
  const [live, setLive] = useState(false);
  const [scale, setScale] = useState(0.4);
  const [box, setBox] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [found, setFound] = useState(false);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const scaleRef = useRef(0.4);
  const raf = useRef<number | null>(null);
  const timers = useRef<any[]>([]);

  useEffect(() => { try { if (typeof window !== 'undefined' && window.location?.origin) setOrigin(window.location.origin); } catch {} }, []);

  const path = page === 'blog' || page === 'article' ? '/blog' : page === 'directory' ? '/publicidad' : '/';
  const src = `${origin}${path}`;
  const [aw, ah] = (size || '728x90').split('x').map((n) => parseInt(n, 10) || 1);
  const aspect = aw / ah;

  // ---------- iframe en vivo (escalado a escritorio) ----------
  const fit = useCallback(() => {
    const st = stageRef.current; if (!st) return;
    const s = Math.max(0.2, Math.min(1, (st.clientWidth || 1) / LOGICAL_W));
    scaleRef.current = s; setScale(s);
  }, []);
  const reposition = useCallback((scroll = false) => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      try {
        const ifr = iframeRef.current; if (!ifr) return;
        const el = ifr.contentDocument?.querySelector(`[data-slot="${slotKey}"]`) as HTMLElement | null;
        if (el) {
          if (scroll) { try { el.scrollIntoView({ block: 'center' }); } catch {} }
          const r = el.getBoundingClientRect(); const s = scaleRef.current;
          setBox({ top: r.top * s, left: r.left * s, width: r.width * s, height: Math.max(r.height * s, 16) }); setFound(true);
        } else { setFound(false); setBox(null); }
      } catch { setFound(false); setBox(null); }
    });
  }, [slotKey]);
  const onLoad = useCallback(() => {
    fit(); reposition(true);
    [200, 600, 1200].forEach((ms) => timers.current.push(setTimeout(() => reposition(true), ms)));
    try { const win = iframeRef.current?.contentWindow; if (win) { const f = () => reposition(false); win.addEventListener('scroll', f, { passive: true } as any); (iframeRef.current as any)._c = () => { try { win.removeEventListener('scroll', f); } catch {} }; } } catch {}
  }, [fit, reposition]);
  useEffect(() => {
    if (!live) return; const st = stageRef.current; if (!st) return;
    const ro = new ResizeObserver(() => { fit(); reposition(false); }); ro.observe(st);
    const t = setTimeout(() => { fit(); reposition(true); }, 140); timers.current.push(t);
    return () => { ro.disconnect(); };
  }, [live, full, slotKey, fit, reposition]);
  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current); timers.current.forEach(clearTimeout); timers.current = []; try { (iframeRef.current as any)?._c?.(); } catch {} }, []);

  // ---------- maqueta (bloques) ----------
  const bg = '#0e1524';
  const gray = (h: number | string, w: any = '100%', extra: React.CSSProperties = {}) => ({ height: h, width: w, background: 'rgba(255,255,255,.06)', borderRadius: 6, ...extra } as React.CSSProperties);
  const AdBox = ({ maxW = 640 }: { maxW?: number }) => {
    const w = Math.min(maxW, 640); const h = Math.max(28, Math.round(w / aspect));
    return (
      <div style={{ width: '100%', maxWidth: w, minHeight: Math.min(h, 260), aspectRatio: `${aw} / ${ah}`, margin: '0 auto', borderRadius: 8, border: `2px solid ${ACC}`, background: 'color-mix(in srgb, var(--accent,#8b93ff) 20%, transparent)', boxShadow: `0 0 0 4px color-mix(in srgb, var(--accent,#8b93ff) 16%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,.6)', lineHeight: 1.25 }}>{L('Tu anuncio aquí', 'Your ad here')}<br /><span style={{ fontSize: 11, opacity: .9 }}>{size}</span></span>
      </div>
    );
  };
  const isAd = (k: string) => k === slotKey;

  let mock: React.ReactNode = null;
  if (page === 'blog') {
    mock = (<div style={{ display: 'grid', gap: 12 }}>
      {isAd('blog_top') ? <AdBox maxW={640} /> : <div style={gray(46)} />}
      <div style={gray(20, '45%')} />
      {isAd('blog_infeed') || isAd('blog_native')
        ? <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}><div style={gray(120)} /><div style={{ display: 'flex' }}><AdBox maxW={300} /></div></div>
        : <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}><div style={gray(120)} /><div style={gray(120)} /></div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}><div style={gray(120)} /><div style={gray(120)} /></div>
    </div>);
  } else if (page === 'article') {
    mock = (<div style={{ display: 'grid', gridTemplateColumns: '1.9fr 1fr', gap: 16 }}>
      <div style={{ display: 'grid', gap: 10 }}>
        <div style={gray(22, '75%')} /><div style={gray(12)} /><div style={gray(12)} />
        {isAd('article_incontent') ? <AdBox maxW={560} /> : <div style={gray(12)} />}
        <div style={gray(12)} /><div style={gray(12)} /><div style={gray(12)} />
      </div>
      <div>{isAd('article_sidebar') || isAd('article_halfpage') ? <AdBox maxW={300} /> : <div style={gray(220)} />}</div>
    </div>);
  } else if (page === 'landing') {
    mock = (<div style={{ display: 'grid', gap: 14 }}>
      {isAd('landing_billboard') || isAd('landing_top') ? <AdBox maxW={728} /> : <div style={gray(60)} />}
      <div style={gray(40, '55%', { margin: '4px auto 0' })} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}><div style={gray(90)} /><div style={gray(90)} /><div style={gray(90)} /></div>
    </div>);
  } else if (page === 'directory') {
    mock = (<div style={{ display: 'grid', gap: 10 }}>
      <div style={gray(18, '45%')} />
      {isAd('directory_partner') ? <AdBox maxW={620} /> : <div style={gray(60)} />}
      <div style={gray(50)} /><div style={gray(50)} />
    </div>);
  } else {
    mock = (<div style={{ display: 'grid', gap: 12 }}>
      <div style={gray(16, '50%')} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}><div style={gray(90)} /><div style={gray(90)} /></div>
      {isAd('footer_site') || isAd('sticky_bottom') ? <AdBox maxW={728} /> : <div style={gray(30)} />}
    </div>);
  }

  const stageH = full ? '100%' : 460;

  const mockView = (
    <div style={{ width: '100%', height: '100%', overflow: 'auto', background: bg }}>
      {/* nav simulada */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 22px', borderBottom: `1px solid ${line}`, position: 'sticky', top: 0, background: bg }}>
        <div style={{ width: 26, height: 26, borderRadius: 7, background: ACC }} />
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx,#e8ecf5)' }}>Onyx Trading Live</div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 16 }}>{[70, 60, 80, 55].map((w, i) => <div key={i} style={{ width: w, height: 10, borderRadius: 6, background: 'rgba(255,255,255,.08)' }} />)}</div>
      </div>
      <div style={{ padding: '20px 22px 30px', maxWidth: 1040, margin: '0 auto' }}>{mock}</div>
    </div>
  );

  const iframeH = `${(1 / scale) * 100}%`;
  const liveView = (
    <>
      <iframe ref={iframeRef} src={src} title={page} loading="lazy" onLoad={onLoad} sandbox="allow-same-origin allow-scripts allow-popups"
        style={{ position: 'absolute', top: 0, left: 0, width: LOGICAL_W, height: iframeH, border: 0, transform: `scale(${scale})`, transformOrigin: 'top left' }} />
      {found && box && (
        <div style={{ position: 'absolute', top: box.top, left: box.left, width: box.width, height: box.height, borderRadius: 6, border: `2px solid ${ACC}`, background: 'color-mix(in srgb, var(--accent,#8b93ff) 22%, transparent)', boxShadow: `0 0 0 3px color-mix(in srgb, var(--accent,#8b93ff) 22%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,.75)', textAlign: 'center', lineHeight: 1.2 }}>{L('Tu anuncio aquí', 'Your ad here')}<br /><span style={{ fontSize: 10.5, opacity: .95 }}>{size}</span></span>
        </div>
      )}
      {!found && <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '8px 12px', background: 'color-mix(in srgb, var(--accent,#8b93ff) 88%, #000)', color: '#fff', fontSize: 12, fontWeight: 600, textAlign: 'center', pointerEvents: 'none' }}>{L(`El hueco ${size} aparece al hacer scroll en esta página.`, `The ${size} slot appears as you scroll this page.`)}</div>}
    </>
  );

  const chip = (on: boolean): React.CSSProperties => ({ cursor: 'pointer', background: on ? ACC : 'transparent', border: `1px solid ${on ? ACC : line}`, color: on ? '#fff' : 'var(--tx,#e8ecf5)', borderRadius: 7, padding: '3px 10px', fontSize: 11, fontWeight: 600 });

  const inner = (
    <div style={{ border: `1px solid ${line}`, borderRadius: full ? 0 : 12, overflow: 'hidden', background: 'var(--panel,#161c2e)', display: 'flex', flexDirection: 'column', height: full ? '100%' : 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', background: 'color-mix(in srgb, var(--mut,#9aa6bd) 12%, transparent)', borderBottom: `1px solid ${line}`, flex: 'none' }}>
        <span style={{ width: 8, height: 8, borderRadius: 8, background: '#f0736f' }} />
        <span style={{ width: 8, height: 8, borderRadius: 8, background: '#f0b74e' }} />
        <span style={{ width: 8, height: 8, borderRadius: 8, background: '#5ed6a0' }} />
        <span style={{ marginLeft: 8, fontSize: 10.5, color: 'var(--mut,#9aa6bd)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{src.replace(/^https?:\/\//, '')}</span>
        <button onClick={() => setLive((v) => !v)} title={L('Ver la página real', 'View the real page')} style={{ ...chip(live), marginLeft: 'auto' }}>{live ? '● ' + L('En vivo', 'Live') : L('Ver en vivo', 'View live')}</button>
        <button onClick={() => setFull((v) => !v)} style={chip(full)}>{full ? '✕ ' + L('Cerrar', 'Close') : '⛶ ' + L('Pantalla completa', 'Fullscreen')}</button>
      </div>
      <div ref={stageRef} style={{ position: 'relative', width: '100%', height: stageH, flex: full ? 1 : 'none', overflow: 'hidden', background: bg }}>
        {live ? liveView : mockView}
      </div>
      {!full && <div style={{ padding: '6px 12px 10px', fontSize: 11, color: 'var(--mut,#9aa6bd)' }}>{live ? L('Página real del sitio (puedes hacer scroll).', 'Real site page (you can scroll).') : L('Maqueta a escala real del sitio. El recuadro marca dónde va el anuncio. Pulsa “Ver en vivo” para la página real.', 'True-scale mock of the site. The box marks where the ad goes. Tap “View live” for the real page.')}</div>}
    </div>
  );

  if (full) return <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(3,6,14,.9)', padding: 10, display: 'flex' }}><div style={{ margin: 'auto', width: '100%', height: '100%', display: 'flex' }}>{inner}</div></div>;
  return inner;
}
