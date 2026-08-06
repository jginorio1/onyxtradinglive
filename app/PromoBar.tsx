'use client';
import { useEffect, useMemo, useState } from 'react';

// Barra de anuncios/descuentos configurable desde Admin → Barra de descuentos.
// Soporta: emoji, cupón copiable, contador (2 formatos), fondo sólido o degradado,
// posición arriba/abajo, animaciones, cierre por el visitante (se recuerda) y
// métricas de vistas/clics.
const ANIM_SECONDS: Record<string, number> = { slow: 34, normal: 22, fast: 12 };
const PULSE_SECONDS: Record<string, number> = { slow: 3.4, normal: 2.4, fast: 1.4 };

export default function PromoBar({
  id = 'default', text, link, cta, bg, bg2, gradient, fg, endsAt,
  emoji = '', coupon = '', newTab = false, position = 'top',
  anim = 'slide', speed = 'normal', countdown = true, countdownFmt = 'dhms', dismissible = true,
}: {
  id?: string; text: string; link: string; cta: string; bg: string; bg2?: string; gradient?: boolean; fg: string; endsAt: string;
  emoji?: string; coupon?: string; newTab?: boolean; position?: 'top' | 'bottom';
  anim?: 'none' | 'slide' | 'pulse' | 'marquee'; speed?: 'slow' | 'normal' | 'fast'; countdown?: boolean; countdownFmt?: 'dhms' | 'hms'; dismissible?: boolean;
}) {
  const [left, setLeft] = useState<string>('');
  const [gone, setGone] = useState(false);
  const [closed, setClosed] = useState(false);
  const [copied, setCopied] = useState(false);

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
      if (countdownFmt === 'hms') setLeft(`${pad(d * 24 + h)}:${pad(m)}:${pad(s)}`);
      else setLeft(d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${s}s`);
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

  const inner = (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12, whiteSpace: 'nowrap' }}>
      {emoji && <span>{emoji}</span>}
      <span style={{ fontWeight: 600 }}>{text}</span>
      {left && <span style={{ fontWeight: 700, opacity: .95, fontVariantNumeric: 'tabular-nums' }}>⏳ {left}</span>}
      {coupon && (
        <button onClick={copyCoupon} title="Copiar" style={{ font: 'inherit', fontWeight: 700, letterSpacing: 1, cursor: 'pointer', background: 'rgba(0,0,0,.18)', color: 'inherit', border: 'none', borderRadius: 6, padding: '2px 9px', display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          {coupon} <span style={{ fontWeight: 400, fontSize: 12 }}>{copied ? '✓' : '⧉'}</span>
        </button>
      )}
      {cta && <span style={{ textDecoration: 'underline', fontWeight: 700 }}>{cta} →</span>}
    </span>
  );

  const wrapStyle: any = {
    background, color: fg || '#0a0d14', overflow: 'hidden', position: position === 'bottom' ? 'fixed' : 'relative',
    zIndex: 55, ...(position === 'bottom' ? { left: 0, right: 0, bottom: 0 } : {}),
  };

  return (
    <div style={wrapStyle}>
      <style>{`@keyframes onyxPromo{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}@keyframes onyxPulse{0%,100%{opacity:1}50%{opacity:.72}}`}</style>
      <a href={link || '#'} onClick={onClick} target={newTab ? '_blank' : undefined} rel={newTab ? 'noopener noreferrer' : undefined}
        style={{ color: 'inherit', textDecoration: 'none', display: 'block', padding: '7px 0', animation: anim === 'pulse' ? `onyxPulse ${pulseSecs}s ease-in-out infinite` : undefined }}>
        {scrolling ? (
          <div style={{ display: 'inline-flex', whiteSpace: 'nowrap', animation: `onyxPromo ${animSecs}s linear infinite`, willChange: 'transform', fontSize: 13.5 }}>
            {[0, 1, 2, 3].map((i) => <span key={i} style={{ paddingRight: 60 }}>{inner}</span>)}
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center', fontSize: 13.5, padding: '0 44px' }}>{inner}</div>
        )}
      </a>
      {dismissible && (
        <button onClick={close} aria-label="Cerrar" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'inherit', opacity: .75, cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 4 }}>✕</button>
      )}
    </div>
  );
}
