'use client';
import { useEffect, useRef, useState } from 'react';
import { getWeather, type Weather, type WxCond } from '@/lib/weatherClient';

// Clima en UNA tarjetita: pastilla con tinte según el clima + animación
// (gotas / copos / nubes) CONTENIDA dentro de la propia pastilla (no baja por
// la pantalla). Tocarla enciende/apaga la animación (el interruptor), y el
// estado se recuerda en localStorage 'onyx_weatherbg' ('on'/'off').
// Colores VIVOS por clima.
const RGB: Record<WxCond, string> = {
  clear: '255,176,28',   // sol dorado
  clouds: '96,132,178',  // azul-gris nube
  rain: '34,120,255',    // azul lluvia intenso
  storm: '124,86,245',   // violeta tormenta
  snow: '96,196,255',    // cian hielo
  fog: '150,163,184',    // gris niebla
};
const NIGHT_CLEAR = '78,104,230'; // azul noche
function rgbFor(w: Weather) { return w.cond === 'clear' && !w.isDay ? NIGHT_CLEAR : RGB[w.cond]; }

const EMOJI: Record<WxCond, string> = { clear: '☀️', clouds: '☁️', rain: '🌧️', storm: '⛈️', snow: '❄️', fog: '🌫️' };
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

export function WeatherCard({ country, lang = 'es', sep = false }: { country?: string; lang?: string; sep?: boolean }) {
  const [wx, setWx] = useState<Weather | null>(null);
  const [on, setOn] = useState(true);
  const cvRef = useRef<HTMLCanvasElement | null>(null);
  const boxRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    try { if (localStorage.getItem('onyx_weatherbg') === 'off') setOn(false); } catch {}
    let alive = true; getWeather(country).then((w) => { if (alive) setWx(w); });
    return () => { alive = false; };
  }, [country]);

  useEffect(() => {
    const cv = cvRef.current, box = boxRef.current;
    if (!cv || !box || !wx || !on) { const c = cv?.getContext('2d'); if (c && cv) c.clearRect(0, 0, cv.width, cv.height); return; }
    const kind = wx.cond === 'snow' ? 'snow'
      : (wx.cond === 'rain' || wx.cond === 'storm') ? 'rain'
      : (wx.cond === 'clouds' || wx.cond === 'fog') ? 'clouds' : 'none';
    if (kind === 'none') return;
    if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = cv.getContext('2d'); if (!ctx) return;

    let raf = 0, W = 0, H = 0;
    const dpr = Math.min(2, (typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1));
    const resize = () => { const r = box.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height); cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px'; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    resize();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    ro?.observe(box);

    if (kind === 'clouds') {
      const P = Array.from({ length: 3 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: 10 + Math.random() * 16, spd: 0.08 + Math.random() * 0.16, a: 0.16 + Math.random() * 0.12 }));
      const tick = () => { ctx.clearRect(0, 0, W, H);
        for (const p of P) { p.x += p.spd; if (p.x - p.r > W) { p.x = -p.r; p.y = Math.random() * H; }
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r); g.addColorStop(0, `rgba(200,210,230,${p.a})`); g.addColorStop(1, 'rgba(200,210,230,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); }
        raf = requestAnimationFrame(tick); };
      raf = requestAnimationFrame(tick);
      return () => { cancelAnimationFrame(raf); ro?.disconnect(); };
    }

    const snow = kind === 'snow';
    const N = snow ? 12 : 16;
    const P = Array.from({ length: N }, () => ({ x: Math.random() * W, y: Math.random() * H, len: snow ? 0 : 4 + Math.random() * 5, r: snow ? 0.8 + Math.random() * 1.3 : 0, spd: snow ? 0.35 + Math.random() * 0.6 : 3 + Math.random() * 2.5, drift: Math.random() * Math.PI * 2 }));
    const tick = () => { ctx.clearRect(0, 0, W, H);
      if (snow) { ctx.fillStyle = 'rgba(255,255,255,.85)';
        for (const p of P) { p.y += p.spd; p.drift += 0.03; p.x += Math.sin(p.drift) * 0.25; if (p.y > H + 1) { p.y = -1; p.x = Math.random() * W; } ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); }
      } else { ctx.strokeStyle = 'rgba(180,205,255,.7)'; ctx.lineWidth = 1;
        for (const p of P) { p.y += p.spd; p.x += 0.5; if (p.y > H + 2) { p.y = -4; p.x = Math.random() * W; } ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - 1, p.y - p.len); ctx.stroke(); } }
      raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); ro?.disconnect(); };
  }, [wx, on]);

  if (!wx) return null;
  const L = LABEL[lang === 'en' ? 'en' : 'es'];
  const rgb = rgbFor(wx);
  const toggle = () => { setOn((v) => { const nv = !v; try { localStorage.setItem('onyx_weatherbg', nv ? 'on' : 'off'); } catch {} return nv; }); };
  const tip = (wx.city ? wx.city + ' · ' : '') + L[wx.cond] + ' · ' + (lang === 'en' ? (on ? 'tap to pause' : 'tap to animate') : (on ? 'toca para pausar' : 'toca para animar'));
  return (
    <>
      {sep && <span style={{ width: 1, height: 22, background: 'var(--line)', flex: 'none' }} className="hero-sep" />}
      <span ref={boxRef} onClick={toggle} role="button" tabIndex={0} title={tip}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }}
        style={{ position: 'relative', overflow: 'hidden', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--tx)', whiteSpace: 'nowrap', cursor: 'pointer', padding: '4px 10px', borderRadius: 999, border: `1px solid rgba(${rgb},.75)`, background: `linear-gradient(90deg, rgba(${rgb},.22), rgba(${rgb},.42))`, boxShadow: `0 0 0 1px rgba(${rgb},.15)` }}>
        {on && <canvas ref={cvRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />}
        <span style={{ position: 'relative', fontSize: 13 }}>{emojiFor(wx)}</span>
        <span style={{ position: 'relative', fontWeight: 700 }}>{wx.temp}°{wx.unit}</span>
        <span style={{ position: 'relative', fontWeight: 600 }}>{L[wx.cond]}</span>
      </span>
    </>
  );
}
