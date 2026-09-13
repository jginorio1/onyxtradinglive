'use client';
import { useEffect, useRef, useState } from 'react';
import { getWeather, type Weather, type WxCond } from '@/lib/weatherClient';

// Tinte de fondo según el clima (muy leve, esquina superior) + partículas
// animadas (gotas de lluvia / copos de nieve cayendo). Interruptor en
// localStorage 'onyx_weatherbg' = 'off' para apagarlo.
const TINT: Record<WxCond, string> = {
  clear: 'rgba(245,158,11,.14)',
  clouds: 'rgba(148,163,184,.16)',
  rain: 'rgba(56,130,246,.18)',
  storm: 'rgba(99,102,241,.20)',
  snow: 'rgba(224,242,254,.16)',
  fog: 'rgba(148,163,184,.14)',
};
// De noche el cielo despejado no es dorado: tinte azul-noche.
const TINT_NIGHT_CLEAR = 'rgba(56,70,140,.18)';
function tintFor(w: Weather) { return w.cond === 'clear' && !w.isDay ? TINT_NIGHT_CLEAR : TINT[w.cond]; }

export default function WeatherBg({ country }: { country?: string }) {
  const [wx, setWx] = useState<Weather | null>(null);
  const cvRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('onyx_weatherbg') === 'off') return;
    let alive = true;
    getWeather(country).then((w) => { if (alive) setWx(w); });
    return () => { alive = false; };
  }, [country]);

  // Animación de partículas (solo lluvia/tormenta/nieve).
  useEffect(() => {
    const cv = cvRef.current;
    if (!cv || !wx) return;
    const anim = wx.cond === 'rain' || wx.cond === 'storm' || wx.cond === 'snow';
    if (!anim) return;
    const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    const ctx = cv.getContext('2d');
    if (!ctx) return;
    let raf = 0, W = 0, H = 0;
    const dpr = Math.min(2, (typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1));
    const resize = () => { W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px'; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    resize();
    addEventListener('resize', resize);

    const snow = wx.cond === 'snow';
    const N = snow ? 70 : 90;
    const P = Array.from({ length: N }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      len: snow ? 0 : 8 + Math.random() * 14,
      r: snow ? 1.2 + Math.random() * 2.4 : 0,
      spd: snow ? 0.5 + Math.random() * 1.1 : 6 + Math.random() * 7,
      drift: Math.random() * Math.PI * 2,
    }));

    const tick = () => {
      ctx.clearRect(0, 0, W, H);
      if (snow) {
        ctx.fillStyle = 'rgba(255,255,255,.55)';
        for (const p of P) {
          p.y += p.spd; p.drift += 0.01; p.x += Math.sin(p.drift) * 0.4;
          if (p.y > H + 4) { p.y = -4; p.x = Math.random() * W; }
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        }
      } else {
        ctx.strokeStyle = 'rgba(140,180,255,.35)'; ctx.lineWidth = 1.1;
        for (const p of P) {
          p.y += p.spd; p.x += 1.1;
          if (p.y > H + 10) { p.y = -10; p.x = Math.random() * W; }
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - 1.6, p.y - p.len); ctx.stroke();
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', resize); };
  }, [wx]);

  if (!wx) return null;
  return (
    <div aria-hidden style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(120% 80% at 85% -10%, ${tintFor(wx)}, transparent 55%)` }} />
      <canvas ref={cvRef} style={{ position: 'absolute', inset: 0, opacity: .8 }} />
    </div>
  );
}

const EMOJI: Record<WxCond, string> = { clear: '☀️', clouds: '☁️', rain: '🌧️', storm: '⛈️', snow: '❄️', fog: '🌫️' };
// De noche: la luna en vez del sol; nubes con luna.
function emojiFor(w: Weather) {
  if (w.isDay) return EMOJI[w.cond];
  if (w.cond === 'clear') return '🌙';
  if (w.cond === 'clouds') return '☁️';
  return EMOJI[w.cond];
}
const LABEL: Record<string, Record<WxCond, string>> = {
  es: { clear: 'Despejado', clouds: 'Nublado', rain: 'Lluvia', storm: 'Tormenta', snow: 'Nieve', fog: 'Niebla' },
  en: { clear: 'Clear', clouds: 'Cloudy', rain: 'Rain', storm: 'Storm', snow: 'Snow', fog: 'Fog' },
};

// Chip con icono + temperatura (para poner junto al saludo).
export function WeatherChip({ country, lang = 'es', sep = false }: { country?: string; lang?: string; sep?: boolean }) {
  const [wx, setWx] = useState<Weather | null>(null);
  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('onyx_weatherbg') === 'off') return;
    let alive = true; getWeather(country).then((w) => { if (alive) setWx(w); });
    return () => { alive = false; };
  }, [country]);
  if (!wx) return null;
  const L = LABEL[lang === 'en' ? 'en' : 'es'];
  return (
    <>
      {sep && <span style={{ width: 1, height: 22, background: 'var(--line)', flex: 'none' }} className="hero-sep" />}
      <span title={(wx.city ? wx.city + ' · ' : '') + L[wx.cond]}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--mut)', whiteSpace: 'nowrap' }}>
        <span style={{ fontSize: 13 }}>{emojiFor(wx)}</span> {wx.temp}°{wx.unit} <span style={{ opacity: .7 }}>{L[wx.cond]}</span>
      </span>
    </>
  );
}
