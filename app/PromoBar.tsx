'use client';
import { useEffect, useMemo, useRef, useState } from 'react';

// Barra de anuncios/descuentos configurable desde Admin → Barra de descuentos.
// Moderna y responsiva: degradado con brillo, CTA píldora, cupón copiable, punto
// "en vivo", contador. Se DESPLAZA (marquesina) en todos los tamaños —también en
// móvil— con velocidad constante calculada según el ancho real. Respeta el ajuste
// del sistema "reducir movimiento", el safe-area del iPhone/PWA, y claro/oscuro.
const SPEED_PX: Record<string, number> = { slow: 42, normal: 62, fast: 92 }; // px/seg

export default function PromoBar({
  id = 'default', text, link, cta, bg, bg2, gradient, fg, endsAt,
  emoji = '', coupon = '', newTab = false, position = 'top', sticky = true,
  anim = 'slide', speed = 'normal', countdown = true, countdownFmt = 'dhms', dismissible = true,
}: {
  id?: string; text: string; link: string; cta: string; bg: string; bg2?: string; gradient?: boolean; fg: string; endsAt: string;
  emoji?: string; coupon?: string; newTab?: boolean; position?: 'top' | 'bottom'; sticky?: boolean;
  anim?: 'none' | 'slide' | 'pulse' | 'marquee'; speed?: 'slow' | 'normal' | 'fast'; countdown?: boolean; countdownFmt?: 'dhms' | 'hms'; dismissible?: boolean;
}) {
  const [left, setLeft] = useState<string>('');
  const [gone, setGone] = useState(false);
  const [closed, setClosed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [paused, setPaused] = useState(false);
  const [urgent, setUrgent] = useState(false); // últimos minutos: resalta el contador
  const [narrow, setNarrow] = useState(false);  // móvil: CTA como flecha, cupón compacto
  const [reduce, setReduce] = useState(false);  // "reducir movimiento" del sistema
  const [dur, setDur] = useState(22);           // segundos por vuelta (velocidad constante)
  const [deskCopies, setDeskCopies] = useState(6); // copias en escritorio: llenan el ancho
  const wrapRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const stickyTop = position === 'top' && sticky;
  // En móvil pocas copias (GPU iOS/iPad); en escritorio, las que hagan falta para
  // que el texto llene de lado a lado en cualquier monitor (se calcula midiendo).
  const COPIES = narrow ? 3 : deskCopies;

  // Móvil (< 560px) y preferencia de movimiento del sistema.
  useEffect(() => {
    const mqN = window.matchMedia('(max-width: 560px)');
    const mqR = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => { setNarrow(mqN.matches); setReduce(mqR.matches); };
    on(); mqN.addEventListener('change', on); mqR.addEventListener('change', on);
    return () => { mqN.removeEventListener('change', on); mqR.removeEventListener('change', on); };
  }, []);

  // Publica el alto en --promo-h para que la barra de navegación se coloque debajo.
  useEffect(() => {
    const root = document.documentElement;
    const setH = () => {
      if (stickyTop && !closed && !gone && text && wrapRef.current) root.style.setProperty('--promo-h', wrapRef.current.offsetHeight + 'px');
      else root.style.setProperty('--promo-h', '0px');
    };
    setH();
    window.addEventListener('resize', setH);
    return () => { window.removeEventListener('resize', setH); root.style.setProperty('--promo-h', '0px'); };
  }, [stickyTop, closed, gone, text, left]);

  const scrolling = (anim === 'slide' || anim === 'marquee') && !reduce;

  // Duración = distancia de una vuelta / velocidad → velocidad CONSTANTE en cualquier
  // pantalla. Solo cambia un número (seguro); las copias son fijas para no crear una
  // capa gigante que iOS/iPad no puedan componer (eso dejaba la barra en blanco).
  useEffect(() => {
    if (!scrolling) return;
    const measure = () => {
      const cW = wrapRef.current?.offsetWidth || 360;
      const tW = trackRef.current?.scrollWidth || 800;
      const rendered = narrow ? 3 : deskCopies;
      const copyW = Math.max(120, tW / (rendered * 2));   // ancho de una copia (con guarda)
      // En escritorio, tantas copias como hagan falta para que media pista ≥ el ancho
      // del contenedor (así no queda hueco y el texto va de lado a lado). Tope 24.
      if (!narrow) {
        const need = Math.min(24, Math.max(4, Math.ceil(cW / copyW) + 2));
        if (need !== deskCopies) setDeskCopies(need);
      }
      const half = tW / 2;
      const px = SPEED_PX[speed] || 62;
      setDur(Math.min(45, Math.max(8, half / px)));
    };
    const t = setTimeout(measure, 60);      // tras el layout de fuentes
    window.addEventListener('resize', measure);
    return () => { clearTimeout(t); window.removeEventListener('resize', measure); };
  }, [scrolling, text, coupon, narrow, speed, deskCopies]);

  const key = useMemo(() => 'onyx_promo_' + btoa(unescape(encodeURIComponent((text || '') + '|' + (endsAt || '')))).slice(0, 24), [text, endsAt]);

  useEffect(() => {
    try { if (dismissible && localStorage.getItem(key) === '1') setClosed(true); } catch {}
    try { fetch('/api/promo/track', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, ev: 'view' }), keepalive: true }).catch(() => {}); } catch {}
  }, [key, dismissible, id]);

  useEffect(() => {
    if (!countdown || !endsAt) return;
    const end = new Date(endsAt).getTime();
    if (isNaN(end)) return;
    const pad = (n: number) => String(n).padStart(2, '0');
    const tick = () => {
      const ms = end - Date.now();
      if (ms <= 0) { setGone(true); return; }
      const d = Math.floor(ms / 86400000);
      const h = Math.floor((ms % 86400000) / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setUrgent(ms <= 600000);
      if (countdownFmt === 'hms') { setLeft(`${pad(d * 24 + h)}:${pad(m)}:${pad(s)}`); return; }
      if (ms > 86400000) setLeft(`${d}d ${h}h ${m}m`);
      else if (ms > 3600000) setLeft(`${h}h ${pad(m)}m ${pad(s)}s`);
      else setLeft(`${pad(m)}:${pad(s)}`);
    };
    tick(); const iv = setInterval(tick, 1000); return () => clearInterval(iv);
  }, [endsAt, countdown, countdownFmt]);

  if (gone || closed || !text) return null;

  const background = gradient && bg2 ? `linear-gradient(90deg, ${bg || '#8b7bff'}, ${bg2})` : (bg || 'var(--brand)');

  const copyCoupon = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); try { navigator.clipboard.writeText(coupon); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {} };
  const close = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); setClosed(true); try { localStorage.setItem(key, '1'); } catch {} };
  const onClick = () => { try { fetch('/api/promo/track', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, ev: 'click' }), keepalive: true }).catch(() => {}); } catch {} };

  const countdownEl = left ? (
    <span style={{ flex: 'none', fontWeight: 700, fontVariantNumeric: 'tabular-nums', background: 'rgba(0,0,0,.16)', borderRadius: 6, padding: '2px 8px', ...(urgent ? { animation: 'onyxUrg 1s ease-in-out infinite' } : {}) }}>⏳ {left}</span>
  ) : null;

  // Una copia del mensaje (emoji/punto + texto + contador).
  const message = (i: number) => (
    <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 11, whiteSpace: 'nowrap', paddingRight: 56, fontWeight: 600 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'currentColor', opacity: .65, flex: 'none', animation: reduce ? undefined : 'onyxDot 1.6s ease-in-out infinite' }} />
      {emoji && <span>{emoji}</span>}
      <span>{text}</span>
      {countdownEl}
    </span>
  );

  const wrapStyle: any = {
    background, color: fg || '#0a0d14', overflow: 'hidden', position: position === 'bottom' ? 'fixed' : (stickyTop ? 'sticky' : 'relative'),
    zIndex: 55,
    ...(position === 'bottom' ? { left: 0, right: 0, bottom: 0, paddingBottom: 'env(safe-area-inset-bottom, 0px)' } : {}),
    ...(stickyTop ? { top: 0, left: 0, right: 0, paddingTop: 'env(safe-area-inset-top, 0px)' } : {}),
  };
  const linkAttrs = { href: link || '#', onClick, target: newTab ? '_blank' : undefined, rel: newTab ? 'noopener noreferrer' : undefined } as any;
  const px = { paddingLeft: 'max(12px, env(safe-area-inset-left, 0px))', paddingRight: 'max(8px, env(safe-area-inset-right, 0px))' } as any;

  return (
    <div ref={wrapRef} style={wrapStyle} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <style>{`@keyframes onyxMarq{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}@keyframes onyxSheen{0%{transform:translateX(-140%)}60%,100%{transform:translateX(240%)}}@keyframes onyxDot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(.7)}}@keyframes onyxPulse{0%,100%{opacity:1}50%{opacity:.72}}@keyframes onyxUrg{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.08);opacity:.85}}`}</style>
      {/* Brillo que barre (solo si hay movimiento) */}
      {!reduce && <div aria-hidden style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '38%', background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.30),transparent)', animation: 'onyxSheen 6s ease-in-out infinite', pointerEvents: 'none' }} />}

      <div style={{ display: 'flex', alignItems: 'center', gap: narrow ? 6 : 10, ...px, animation: anim === 'pulse' && !reduce ? 'onyxPulse 2.4s ease-in-out infinite' : undefined }}>
        {/* Mensaje (link). Se desplaza; si el sistema pide menos movimiento, queda estático. */}
        <a {...linkAttrs} style={{ color: 'inherit', textDecoration: 'none', flex: '1 1 auto', minWidth: 0, overflow: 'hidden', display: 'block', padding: '8px 0', fontSize: 'clamp(12px, 3.3vw, 13.5px)' }}>
          {scrolling ? (
            <div ref={trackRef} style={{ display: 'inline-flex', whiteSpace: 'nowrap', animation: `onyxMarq ${dur}s linear infinite`, animationPlayState: paused ? 'paused' : 'running' }}>
              {Array.from({ length: COPIES * 2 }).map((_, i) => message(i))}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: narrow ? 'flex-start' : 'center', gap: 10, minWidth: 0 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                {emoji && <span style={{ flex: 'none' }}>{emoji}</span>}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{text}</span>
                {countdownEl}
              </span>
            </div>
          )}
        </a>

        {/* Cupón + CTA: SIEMPRE fijos y tocables. En móvil el CTA es solo la flecha. */}
        {(coupon || cta) && (
          <div style={{ flex: 'none', display: 'flex', gap: narrow ? 6 : 10, alignItems: 'center' }}>
            {coupon && (
              <button onClick={copyCoupon} title="Copiar cupón" style={{ font: 'inherit', fontWeight: 700, letterSpacing: narrow ? 0.3 : 0.6, cursor: 'pointer', background: 'rgba(0,0,0,.14)', color: 'inherit', border: '1px dashed rgba(0,0,0,.35)', borderRadius: 8, padding: narrow ? '3px 8px' : '4px 10px', display: 'inline-flex', gap: 6, alignItems: 'center', whiteSpace: 'nowrap', fontSize: narrow ? 12 : 13.5 }}>
                {coupon} <span style={{ fontWeight: 400, fontSize: 12 }}>{copied ? '✓' : '⧉'}</span>
              </button>
            )}
            {cta && (
              <a {...linkAttrs} aria-label={cta} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#0a0d14', color: '#fff', borderRadius: 999, padding: narrow ? '6px 10px' : '6px 14px', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap', fontSize: narrow ? 15 : 13.5 }}>
                {narrow ? '→' : <>{cta} →</>}
              </a>
            )}
          </div>
        )}

        {dismissible && (
          <button onClick={close} aria-label="Cerrar" style={{ flex: 'none', background: 'transparent', border: 'none', color: 'inherit', opacity: .7, cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: 4 }}>✕</button>
        )}
      </div>
    </div>
  );
}
