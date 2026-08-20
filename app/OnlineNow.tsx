'use client';
import { useEffect, useRef, useState } from 'react';

// Burbuja "en línea ahora" (prueba social) abajo a la izquierda.
// El número es SIMULADO pero CREÍBLE: sigue el ritmo real de las sesiones de
// trading. Sube 15 min ANTES de cada apertura (Sídney/Tokio/Londres/NY), culmina
// en la primera hora y baja después, con ruido orgánico para que nunca parezca
// una línea recta ni se quede clavado en el techo. Todo en UTC (global).
// Oculta en móvil (no se monta) y cerrable (se recuerda por sesión).

// Sesiones definidas por su hora LOCAL de apertura + huso horario. La apertura
// en UTC se calcula al vuelo con el desfase real del huso, así el horario de
// verano (DST) de Londres, Nueva York y Sídney se ajusta SOLO, todo el año.
// Londres y Nueva York son las más activas; su solapamiento es el pico del día.
const SESSIONS: Array<{ zone: string; open: number; peak: number; fb: number }> = [
  { zone: 'Australia/Sydney', open: 9 * 60, peak: 0.40, fb: 600 },  // Sídney (fb = desfase respaldo en min)
  { zone: 'Asia/Tokyo', open: 9 * 60, peak: 0.55, fb: 540 },        // Tokio (sin DST)
  { zone: 'Europe/London', open: 8 * 60, peak: 0.92, fb: 0 },       // Londres
  { zone: 'America/New_York', open: 8 * 60, peak: 1.00, fb: -300 }, // Nueva York
];

// Desfase real de un huso respecto a UTC, en minutos (p. ej. Nueva York en
// verano = -240). Usa Intl (soporta DST); si falla, devuelve el respaldo fijo.
function tzOffset(zone: string, date: Date, fb: number): number {
  try {
    const p = new Intl.DateTimeFormat('en-US', { timeZone: zone, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(date);
    const m: any = {}; for (const x of p) m[x.type] = x.value;
    const asUtc = Date.UTC(+m.year, +m.month - 1, +m.day, +m.hour === 24 ? 0 : +m.hour, +m.minute, +m.second);
    return Math.round((asUtc - date.getTime()) / 60000);
  } catch { return fb; }
}

// Forma de la campana de una sesión según los minutos desde su apertura (d):
//  · d ∈ [-15, 0): sube (anticipación) de 0 → 0.7
//  · d ∈ [0, 60]:  culmina de 0.7 → 1.0 (primera hora)
//  · d > 60:       baja suave (decaimiento exponencial)
function shape(d: number): number {
  if (d < -15) return 0;
  if (d < 0) return ((d + 15) / 15) * 0.7;
  if (d <= 60) return 0.7 + 0.3 * (d / 60);
  return Math.exp(-(d - 60) / 120);
}

// Fin de semana: el mercado forex cierra viernes ~21:00 UTC y reabre domingo
// ~21:00 UTC. Fuera de eso, mucha menos gente (pero nunca cero).
function weekendFactor(day: number, m: number): number {
  if (day === 6) return 0.18;                                   // sábado
  if (day === 0) return m < 20 * 60 ? 0.18 : 0.18 + 0.82 * Math.min(1, (m - 20 * 60) / 120); // domingo (reabre)
  if (day === 5 && m > 21 * 60) return Math.max(0.25, 1 - (m - 21 * 60) / 120);              // viernes tarde
  return 1;
}

// Nivel de demanda 0..1 para "ahora". Todo se calcula en UTC (hora absoluta),
// pero la apertura de cada sesión se deriva de su hora local + DST del huso.
function demandLevel(now: Date): number {
  const m = now.getUTCHours() * 60 + now.getUTCMinutes() + now.getUTCSeconds() / 60;
  // Combinación tipo "OR": los solapamientos (Londres+NY) suman sin pasar de 1.
  let inv = 1;
  for (const s of SESSIONS) {
    const off = tzOffset(s.zone, now, s.fb);              // desfase real del huso (con DST)
    const openUtc = (((s.open - off) % 1440) + 1440) % 1440; // apertura local → UTC
    let d = (((m - openUtc) % 1440) + 1440) % 1440;       // 0..1440
    if (d > 720) d -= 1440;                               // → -720..720
    inv *= 1 - s.peak * shape(d);
  }
  const level = 1 - inv;
  return level * weekendFactor(now.getUTCDay(), m);
}

const TICK: Record<string, number> = { slow: 4200, normal: 2300, fast: 1300 };
const EASE: Record<string, number> = { slow: 0.03, normal: 0.05, fast: 0.08 };  // qué tan rápido persigue al objetivo
const NOISE: Record<string, number> = { slow: 0.003, normal: 0.004, fast: 0.006 }; // jitter como fracción del rango

export default function OnlineNow({
  min, max, speed = 'normal', color = '#22c55e', hideMobile = true, label,
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

  const target = () => lo + demandLevel(new Date()) * range;

  // Detecta móvil (y reacciona al cambio de tamaño) para no montar nada allí.
  useEffect(() => {
    if (!hideMobile) return;
    const mq = window.matchMedia('(max-width: 768px)');
    const on = () => setSmall(mq.matches);
    on(); mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [hideMobile]);

  // Estado inicial: recupera el último valor de la sesión o arranca en el nivel
  // que corresponde a la hora actual (para que ya se vea creíble al cargar).
  useEffect(() => {
    try { if (sessionStorage.getItem('onyx_online_closed') === '1') { setClosed(true); return; } } catch {}
    let start = target();
    try { const s = sessionStorage.getItem('onyx_online_val'); if (s) { const v = parseFloat(s); if (!isNaN(v)) start = v; } } catch {}
    // Un pelín de variación para que dos pestañas no muestren lo mismo exacto.
    start += (Math.random() - 0.5) * range * 0.02;
    start = Math.min(hi, Math.max(lo, start));
    valRef.current = start; setN(Math.round(start));
  }, [lo, hi, range]);

  // Cada tick persigue suavemente el objetivo (curva de sesiones) + ruido suave.
  useEffect(() => {
    if (closed || (hideMobile && small)) return;
    const ease = EASE[speed] || 0.05;
    const noiseFrac = NOISE[speed] || 0.004;
    const iv = setInterval(() => {
      const tgt = target();
      // Ruido semi-gaussiano (promedio de dos aleatorios) para que sea más natural.
      const noise = ((Math.random() + Math.random()) / 2 - 0.5) * 2 * noiseFrac * range;
      let v = valRef.current + (tgt - valRef.current) * ease + noise;
      if (v < lo) v = lo; if (v > hi) v = hi;
      valRef.current = v; setN(Math.round(v));
      try { sessionStorage.setItem('onyx_online_val', v.toFixed(1)); } catch {}
    }, TICK[speed] || 2300);
    return () => clearInterval(iv);
  }, [closed, small, hideMobile, speed, lo, hi, range]);

  if (closed) return null;
  if (hideMobile && small) return null;
  if (n == null) return null;

  const close = () => { setClosed(true); try { sessionStorage.setItem('onyx_online_closed', '1'); } catch {} };
  const glow = (a: number) => (color.startsWith('#') ? hexA(color, a) : color);
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
