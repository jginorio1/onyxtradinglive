'use client';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/lang';

// Reloj del mercado Forex para el dashboard (sirve a todas las plataformas,
// incluida Match-Trader que no tiene panel propio). Horario estándar del Forex:
// abre domingo 21:00 UTC y cierra viernes 21:00 UTC. Cuenta atrás al segundo.
const OPEN_DOW = 0, OPEN_H = 21;    // domingo 21:00 UTC
const CLOSE_DOW = 5, CLOSE_H = 21;  // viernes 21:00 UTC

function marketState(now: Date) {
  const d = now.getUTCDay(), h = now.getUTCHours();
  // Cerrado: viernes ≥21:00, sábado, domingo <21:00.
  const closed = (d === 5 && h >= CLOSE_H) || d === 6 || (d === 0 && h < OPEN_H);
  // Próxima apertura (domingo 21:00 UTC).
  const openAt = new Date(now);
  openAt.setUTCHours(OPEN_H, 0, 0, 0);
  let addDays = (OPEN_DOW - d + 7) % 7;
  if (addDays === 0 && now.getUTCHours() >= OPEN_H) addDays = 7;
  openAt.setUTCDate(now.getUTCDate() + addDays);
  // Próximo cierre (viernes 21:00 UTC).
  const closeAt = new Date(now);
  closeAt.setUTCHours(CLOSE_H, 0, 0, 0);
  let addC = (CLOSE_DOW - d + 7) % 7;
  if (addC === 0 && now.getUTCHours() >= CLOSE_H) addC = 7;
  closeAt.setUTCDate(now.getUTCDate() + addC);
  return { closed, target: closed ? openAt : closeAt };
}

function fmt(ms: number) {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  const hms = `${p(h)}:${p(m)}:${p(sec)}`;
  return d > 0 ? `${d}d ${hms}` : hms;
}

export default function MarketClock() {
  const { lang } = useLang();
  const es = lang !== 'en';
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); const i = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(i); }, []);
  if (!now) return null;
  const { closed, target } = marketState(now);
  const left = target.getTime() - now.getTime();
  const dot = closed ? 'var(--red)' : 'var(--green)';
  return (
    <div className="card" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 16px' }}>
      <span style={{ width: 10, height: 10, borderRadius: '50%', background: dot, flex: 'none', boxShadow: `0 0 8px ${dot}` }} />
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>
          {closed ? (es ? 'Mercado cerrado' : 'Market closed') : (es ? 'Mercado abierto' : 'Market open')}
          <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}> · Forex</span>
        </div>
        <div className="muted" style={{ fontSize: 12.5 }}>
          {closed ? (es ? 'Abre en' : 'Opens in') : (es ? 'Cierra en' : 'Closes in')}{' '}
          <b style={{ color: 'var(--tx)', fontVariantNumeric: 'tabular-nums' }}>{fmt(left)}</b>
        </div>
      </div>
    </div>
  );
}
