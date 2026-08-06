'use client';
import { useEffect, useRef, useState } from 'react';

// Burbuja "en línea ahora" (prueba social) abajo a la izquierda.
// El número es SIMULADO: parte de un valor entre `min` y `max` y hace una
// caminata aleatoria suave con leve tendencia a subir, sin pasar del piso/techo.
// Oculta en móvil (no se monta) y cerrable (se recuerda por sesión).
const TICK: Record<string, number> = { slow: 4200, normal: 2300, fast: 1300 };
const STEP: Record<string, number> = { slow: 1, normal: 1.4, fast: 2 };

export default function OnlineNow({
  min, max, speed = 'normal', color = '#22c55e', hideMobile = true,
  label,
}: {
  min: number; max: number; speed?: 'slow' | 'normal' | 'fast'; color: string; hideMobile?: boolean; label: string;
}) {
  const lo = Math.max(0, Math.round(min));
  const hi = Math.max(lo + 1, Math.round(max));
  const range = hi - lo;

  const [n, setN] = useState<number | null>(null);
  const [closed, setClosed] = useState(false);
  const [small, setSmall] = useState(false);
  const valRef = useRef(lo);

  // Detecta móvil (y reacciona al cambio de tamaño) para no montar nada allí.
  useEffect(() => {
    if (!hideMobile) return;
    const mq = window.matchMedia('(max-width: 768px)');
    const on = () => setSmall(mq.matches);
    on(); mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [hideMobile]);

  // Estado inicial: recupera el último valor de la sesión o arranca en un punto
  // natural del primer tercio del rango (para que no salga siempre igual).
  useEffect(() => {
    try { if (sessionStorage.getItem('onyx_online_closed') === '1') { setClosed(true); return; } } catch {}
    let start = lo + Math.floor(Math.random() * Math.max(1, range * 0.35));
    try { const s = sessionStorage.getItem('onyx_online_val'); if (s) { const v = parseInt(s, 10); if (!isNaN(v)) start = v; } } catch {}
    start = Math.min(hi, Math.max(lo, start));
    valRef.current = start; setN(start);
  }, [lo, hi, range]);

  // Caminata aleatoria: leve sesgo al alza, rebota contra piso/techo.
  useEffect(() => {
    if (closed || (hideMobile && small)) return;
    const base = STEP[speed] || 1.4;
    const iv = setInterval(() => {
      const mag = Math.max(1, Math.round((range * 0.006 + 2) * base));
      let delta = Math.round((Math.random() - 0.42) * 2 * mag); // sesgo suave al alza
      let v = valRef.current + delta;
      if (v < lo) v = lo + Math.floor(Math.random() * Math.max(1, mag));
      if (v > hi) v = hi - Math.floor(Math.random() * Math.max(1, mag));
      valRef.current = v; setN(v);
      try { sessionStorage.setItem('onyx_online_val', String(v)); } catch {}
    }, TICK[speed] || 2300);
    return () => clearInterval(iv);
  }, [closed, small, hideMobile, speed, lo, hi, range]);

  if (closed) return null;
  if (hideMobile && small) return null;
  if (n == null) return null;

  const close = () => { setClosed(true); try { sessionStorage.setItem('onyx_online_closed', '1'); } catch {} };
  const glow = (a: number) => color.startsWith('#') ? hexA(color, a) : color;
  const shown = n.toLocaleString('en-US');

  return (
    <div aria-hidden="true" style={{
      position: 'fixed', left: 16, bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))', zIndex: 60,
      display: 'flex', alignItems: 'center', gap: 11,
      background: 'var(--card, #121829)', color: 'var(--text, #e8ecff)',
      borderRadius: 13, padding: '11px 34px 11px 14px', overflow: 'hidden',
      animation: 'onyxOnGlow 2.6s ease-in-out infinite',
    }}>
      <style>{`
        @keyframes onyxOnGlow{0%,100%{box-shadow:0 8px 24px rgba(0,0,0,.30),0 0 0 1px ${glow(0.35)},0 0 18px ${glow(0.26)}}50%{box-shadow:0 8px 28px rgba(0,0,0,.34),0 0 0 1px ${glow(0.60)},0 0 34px ${glow(0.52)}}}
        @keyframes onyxOnDot{0%,100%{box-shadow:0 0 0 0 ${glow(0.55)}}70%{box-shadow:0 0 0 7px ${glow(0)}}}
        @keyframes onyxOnSweep{0%{transform:translateX(-130%)}100%{transform:translateX(340%)}}
      `}</style>
      <span style={{ position: 'absolute', top: 0, bottom: 0, width: '38%', background: `linear-gradient(90deg,transparent,${glow(0.10)},transparent)`, animation: 'onyxOnSweep 3.6s ease-in-out infinite', pointerEvents: 'none' }} />
      <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, flex: 'none', animation: 'onyxOnDot 1.9s ease-out infinite' }} />
      <div style={{ lineHeight: 1.2 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{shown}</span>{' '}
          <span style={{ fontWeight: 400, opacity: .72 }}>{label}</span>
        </div>
      </div>
      <button onClick={close} aria-label="Cerrar" style={{ position: 'absolute', right: 8, top: 7, background: 'transparent', border: 'none', color: 'inherit', opacity: .55, cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: 4 }}>✕</button>
    </div>
  );
}

// #rrggbb + alpha → rgba(). Si no es hex válido, devuelve el color tal cual.
function hexA(hex: string, a: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const int = parseInt(m[1], 16);
  return `rgba(${(int >> 16) & 255},${(int >> 8) & 255},${int & 255},${a})`;
}
