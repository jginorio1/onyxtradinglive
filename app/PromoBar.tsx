'use client';
import { useEffect, useMemo, useRef, useState } from 'react';

// Barra de anuncios/descuentos configurable desde Admin → Barra de descuentos.
// Soporta: emoji, cupón copiable, contador (2 formatos), fondo sólido o degradado,
// posición arriba/abajo, animaciones, cierre por el visitante (se recuerda) y
// métricas de vistas/clics.
const ANIM_SECONDS: Record<string, number> = { slow: 34, normal: 22, fast: 12 };
const PULSE_SECONDS: Record<string, number> = { slow: 3.4, normal: 2.4, fast: 1.4 };

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
  const wrapRef = useRef<HTMLDivElement>(null);
  const stickyTop = position === 'top' && sticky;

  // Cuando la barra es fija arriba, publica su alto en --promo-h para que la
  // barra de navegación (sticky) se coloque justo debajo y no se solapen.
  // Al cerrarse o desmontarse, vuelve a 0.
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

  // Clave única de esta promo: si cambia el texto/fecha, vuelve a mostrarse
  // aunque el visitante hubiera cerrado la anterior.
  const key = useMemo(() => 'onyx_promo_' + btoa(unescape(encodeURIComponent((text || '') + '|' + (endsAt || '')))).slice(0, 24), [text, endsAt]);

  useEffect(() => {
    try { if (dismissible && localStorage.getItem(key) === '1') setClosed(true); } catch {}
    // Métrica de vista (una por carga).
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
      // Últimos 10 min: resalta (parpadeo) para empujar la conversión.
      setUrgent(ms <= 600000);
      if (countdownFmt === 'hms') { setLeft(`${pad(d * 24 + h)}:${pad(m)}:${pad(s)}`); return; }
      // "Urgencia inteligente" (formato 2d 3h 4m):
      //  · faltan >24 h → sin segundos (calmo)   ej. "2d 3h 4m"
      //  · faltan ≤24 h → aparecen los segundos   ej. "3h 04m 05s"
      //  · falta ≤1 h  → reloj MM:SS (urgente)    ej. "04:05"
      if (ms > 86400000) setLeft(`${d}d ${h}h ${m}m`);
      else if (ms > 3600000) setLeft(`${h}h ${pad(m)}m ${pad(s)}s`);
      else setLeft(`${pad(m)}:${pad(s)}`);
    };
    tick(); const iv = setInterval(tick, 1000); return () => clearInterval(iv);
  }, [endsAt, countdown, countdownFmt]);

  if (gone || closed || !text) return null;

  const background = gradient && bg2 ? `linear-gradient(90deg, ${bg || '#7c8cff'}, ${bg2})` : (bg || 'var(--brand)');
  const scrolling = anim === 'slide' || anim === 'marquee';

  const copyCoupon = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    try { navigator.clipboard.writeText(coupon); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  };
  const close = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    setClosed(true); try { localStorage.setItem(key, '1'); } catch {}
  };
  const onClick = () => { try { fetch('/api/promo/track', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, ev: 'click' }), keepalive: true }).catch(() => {}); } catch {} };
  const animSecs = ANIM_SECONDS[speed] || 22;
  const pulseSecs = PULSE_SECONDS[speed] || 2.4;

  // El mensaje (emoji + texto + contador) es lo único que se desplaza.
  const message = (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12, whiteSpace: 'nowrap' }}>
      {emoji && <span>{emoji}</span>}
      <span style={{ fontWeight: 600 }}>{text}</span>
      {left && <span style={{ fontWeight: 800, opacity: .95, fontVariantNumeric: 'tabular-nums', ...(urgent ? { padding: '1px 7px', borderRadius: 5, background: 'rgba(0,0,0,.22)', animation: 'onyxUrg 1s ease-in-out infinite' } : {}) }}>⏳ {left}</span>}
    </span>
  );

  const wrapStyle: any = {
    background, color: fg || '#0a0d14', overflow: 'hidden',
    position: position === 'bottom' ? 'fixed' : (stickyTop ? 'sticky' : 'relative'),
    zIndex: 55,
    ...(position === 'bottom' ? { left: 0, right: 0, bottom: 0 } : {}),
    ...(stickyTop ? { top: 0, left: 0, right: 0 } : {}),
  };
  const linkAttrs = { href: link || '#', onClick, target: newTab ? '_blank' : undefined, rel: newTab ? 'noopener noreferrer' : undefined } as any;

  return (
    <div ref={wrapRef} style={wrapStyle} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <style>{`@keyframes onyxPromo{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}@keyframes onyxPulse{0%,100%{opacity:1}50%{opacity:.72}}@keyframes onyxUrg{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.08);opacity:.85}}`}</style>
      <div style={{ display: 'flex', alignItems: 'center', paddingRight: dismissible ? 30 : 0, animation: anim === 'pulse' ? `onyxPulse ${pulseSecs}s ease-in-out infinite` : undefined }}>
        {/* Mensaje (link; se desplaza si es deslizar/marquesina, se pausa al pasar el ratón) */}
        <a {...linkAttrs} style={{ color: 'inherit', textDecoration: 'none', flex: '1 1 auto', minWidth: 0, overflow: 'hidden', padding: '7px 0', display: 'block' }}>
          {scrolling ? (
            <div style={{ display: 'inline-flex', whiteSpace: 'nowrap', animation: `onyxPromo ${animSecs}s linear infinite`, animationPlayState: paused ? 'paused' : 'running', willChange: 'transform', fontSize: 13.5 }}>
              {[0, 1, 2, 3].map((i) => <span key={i} style={{ paddingRight: 60 }}>{message}</span>)}
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center', fontSize: 13.5, padding: '0 12px' }}>{message}</div>
          )}
        </a>
        {/* Acciones FIJAS: el cupón y el CTA nunca se desplazan → siempre clicables */}
        {(coupon || cta) && (
          <div style={{ flex: 'none', display: 'flex', gap: 10, alignItems: 'center', padding: '0 12px 0 10px', fontSize: 13.5 }}>
            {coupon && (
              <button onClick={copyCoupon} title="Copiar" style={{ font: 'inherit', fontWeight: 700, letterSpacing: 1, cursor: 'pointer', background: 'rgba(0,0,0,.18)', color: 'inherit', border: 'none', borderRadius: 6, padding: '3px 10px', display: 'inline-flex', gap: 6, alignItems: 'center', whiteSpace: 'nowrap' }}>
                {coupon} <span style={{ fontWeight: 400, fontSize: 12 }}>{copied ? '✓' : '⧉'}</span>
              </button>
            )}
            {cta && <a {...linkAttrs} style={{ color: 'inherit', fontWeight: 700, textDecoration: 'underline', whiteSpace: 'nowrap' }}>{cta} →</a>}
          </div>
        )}
      </div>
      {dismissible && (
        <button onClick={close} aria-label="Cerrar" style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'inherit', opacity: .75, cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 4, zIndex: 2 }}>✕</button>
      )}
    </div>
  );
}
