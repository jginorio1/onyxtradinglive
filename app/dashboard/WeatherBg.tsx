'use client';
import { useEffect, useRef, useState } from 'react';
import { getWeather, type Weather, type WxCond } from '@/lib/weatherClient';

// Tinte de fondo según el clima (muy leve, esquina superior) + partículas
// animadas (gotas de lluvia / copos de nieve cayendo). Interruptor en
// localStorage 'onyx_weatherbg' = 'off' para apagarlo.
// Color base del clima (rgb sin alfa: el alfa lo ponemos en cada capa).
const RGB: Record<WxCond, string> = {
  clear: '245,158,11',    // ámbar sol
  clouds: '148,163,184',  // gris nube
  rain: '56,130,246',     // azul lluvia
  storm: '99,102,241',    // índigo tormenta
  snow: '186,220,255',    // celeste nieve
  fog: '148,163,184',     // gris niebla
};
const NIGHT_CLEAR = '70,90,170'; // azul-noche para cielo despejado de noche
function rgbFor(w: Weather) { return w.cond === 'clear' && !w.isDay ? NIGHT_CLEAR : RGB[w.cond]; }

export default function WeatherBg({ country }: { country?: string }) {
  const [wx, setWx] = useState<Weather | null>(null);
  const cvRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('onyx_weatherbg') === 'off') return;
    let alive = true;
    getWeather(country).then((w) => { if (alive) setWx(w); });
    return () => { alive = false; };
  }, [country]);

  // Animación en canvas: gotas (lluvia/tormenta), copos (nieve) o nubes que se
  // desplazan (nublado/niebla). El cielo despejado no anima (solo el tinte).
  useEffect(() => {
    const cv = cvRef.current;
    if (!cv || !wx) return;
    const kind = wx.cond === 'snow' ? 'snow'
      : (wx.cond === 'rain' || wx.cond === 'storm') ? 'rain'
      : (wx.cond === 'clouds' || wx.cond === 'fog') ? 'clouds' : 'none';
    if (kind === 'none') return;
    const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    const ctx = cv.getContext('2d');
    if (!ctx) return;
    let raf = 0, W = 0, H = 0;
    const dpr = Math.min(2, (typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1));
    const resize = () => { W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px'; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    resize();
    addEventListener('resize', resize);

    // Opción A: las partículas viven en la FRANJA superior y se desvanecen hacia
    // abajo (band ≈ 46% del alto). Así el clima se nota arriba sin ensuciar el
    // resto de la página. fade(y) = 1 arriba → 0 al final de la franja.
    const band = Math.max(220, Math.min(520, H * 0.46));
    const fade = (y: number) => Math.max(0, 1 - y / band);

    if (kind === 'clouds') {
      // Blobs suaves que cruzan despacio, arriba.
      const N = 6;
      const yTop = () => 8 + Math.random() * (band * 0.7);
      const P = Array.from({ length: N }, () => ({
        x: Math.random() * W, y: yTop(),
        r: 70 + Math.random() * 130, spd: 0.15 + Math.random() * 0.35, a: 0.06 + Math.random() * 0.06,
      }));
      const tick = () => {
        ctx.clearRect(0, 0, W, H);
        for (const p of P) {
          p.x += p.spd; if (p.x - p.r > W) { p.x = -p.r; p.y = yTop(); }
          const al = p.a * fade(p.y);
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
          g.addColorStop(0, `rgba(170,180,200,${al})`); g.addColorStop(1, 'rgba(170,180,200,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => { cancelAnimationFrame(raf); removeEventListener('resize', resize); };
    }

    const snow = kind === 'snow';
    const N = snow ? 70 : 90;
    const spawnY = () => Math.random() * band;   // nacen dentro de la franja
    const P = Array.from({ length: N }, () => ({
      x: Math.random() * W, y: spawnY(),
      len: snow ? 0 : 9 + Math.random() * 16,
      r: snow ? 1.3 + Math.random() * 2.6 : 0,
      spd: snow ? 0.6 + Math.random() * 1.2 : 7 + Math.random() * 8,
      drift: Math.random() * Math.PI * 2,
    }));
    const tick = () => {
      ctx.clearRect(0, 0, W, H);
      if (snow) {
        for (const p of P) {
          p.y += p.spd; p.drift += 0.01; p.x += Math.sin(p.drift) * 0.5;
          if (p.y > band + 6) { p.y = -4; p.x = Math.random() * W; }
          ctx.fillStyle = `rgba(255,255,255,${0.75 * fade(p.y)})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        }
      } else {
        ctx.lineWidth = 1.3;
        for (const p of P) {
          p.y += p.spd; p.x += 1.3;
          if (p.y > band + 12) { p.y = -12; p.x = Math.random() * W; }
          ctx.strokeStyle = `rgba(150,190,255,${0.6 * fade(p.y)})`;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - 1.9, p.y - p.len); ctx.stroke();
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', resize); };
  }, [wx]);

  if (!wx) return null;
  const rgb = rgbFor(wx);
  // Opción A · "Franja de cielo": el color se concentra en una banda ARRIBA
  // (detrás del saludo) y se desvanece hacia abajo. Un poco más intenso al tope
  // + un halo suave en la esquina superior derecha. Se ve igual en claro/oscuro.
  const sky = `linear-gradient(180deg, rgba(${rgb},.42) 0%, rgba(${rgb},.16) 34%, rgba(${rgb},.04) 55%, transparent 68%),`
    + `radial-gradient(70% 90% at 88% -20%, rgba(${rgb},.28), transparent 55%)`;
  return (
    <div aria-hidden style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', inset: 0, background: sky }} />
      <canvas ref={cvRef} style={{ position: 'absolute', inset: 0, opacity: .95 }} />
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
