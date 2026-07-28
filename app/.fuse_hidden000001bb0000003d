'use client';
import { useEffect, useState } from 'react';

// Barra de anuncios/descuentos en el top del landing. El texto se desliza y,
// si hay fecha de fin, muestra un contador regresivo para dar urgencia.
export default function PromoBar({
  text, link, cta, bg, fg, endsAt,
}: { text: string; link: string; cta: string; bg: string; fg: string; endsAt: string }) {
  const [left, setLeft] = useState<string>('');
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (!endsAt) return;
    const end = new Date(endsAt).getTime();
    if (isNaN(end)) return;
    const tick = () => {
      const ms = end - Date.now();
      if (ms <= 0) { setGone(true); return; }
      const d = Math.floor(ms / 86400000);
      const h = Math.floor((ms % 86400000) / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setLeft(d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${s}s`);
    };
    tick(); const iv = setInterval(tick, 1000); return () => clearInterval(iv);
  }, [endsAt]);

  if (gone || !text) return null;

  const inner = (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12, whiteSpace: 'nowrap' }}>
      <span style={{ fontWeight: 600 }}>{text}</span>
      {left && <span style={{ fontWeight: 700, opacity: .95, fontVariantNumeric: 'tabular-nums' }}>⏳ {left}</span>}
      {cta && <span style={{ textDecoration: 'underline', fontWeight: 700 }}>{cta} →</span>}
    </span>
  );

  return (
    <div style={{ background: bg || '#7c8cff', color: fg || '#0a0d14', overflow: 'hidden', position: 'relative', zIndex: 55 }}>
      <style>{`@keyframes onyxPromo{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}`}</style>
      <a href={link || '#'} style={{ color: 'inherit', textDecoration: 'none', display: 'block', padding: '7px 0' }}>
        <div style={{ display: 'inline-flex', whiteSpace: 'nowrap', animation: 'onyxPromo 22s linear infinite', willChange: 'transform', fontSize: 13.5 }}>
          <span style={{ paddingRight: 60 }}>{inner}</span>
          <span style={{ paddingRight: 60 }}>{inner}</span>
          <span style={{ paddingRight: 60 }}>{inner}</span>
          <span style={{ paddingRight: 60 }}>{inner}</span>
        </div>
      </a>
    </div>
  );
}
