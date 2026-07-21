'use client';
import { Fragment, useEffect, useState } from 'react';

type Lang = 'es' | 'en';
const SES = [
  { n: { es: 'Sídney', en: 'Sydney' }, flag: '🇦🇺', o: 22, c: 7, col: '#3ad0ff' },
  { n: { es: 'Tokio', en: 'Tokyo' }, flag: '🇯🇵', o: 0, c: 9, col: '#b98bff' },
  { n: { es: 'Londres', en: 'London' }, flag: '🇬🇧', o: 8, c: 17, col: '#7c8cff' },
  { n: { es: 'Nueva York', en: 'New York' }, flag: '🇺🇸', o: 13, c: 22, col: '#34e2a0' },
];
const T = {
  es: { title: '🕐 Sesiones del mercado', now: 'Ahora', open: '● ABIERTA', closed: 'cerrada', none: 'Mercado tranquilo', localTz: 'tu hora local', legend: 'Línea = tu hora actual · verde/amarillo/rojo = volumen típico', expand: 'Ver detalle', collapse: 'Ocultar', opensIn: 'abre en', closesIn: 'cierra en', next: 'Próximo' },
  en: { title: '🕐 Market sessions', now: 'Now', open: '● OPEN', closed: 'closed', none: 'Quiet market', localTz: 'your local time', legend: 'Line = your current time · green/amber/red = typical volume', expand: 'Details', collapse: 'Hide', opensIn: 'opens in', closesIn: 'closes in', next: 'Next' },
};

export default function MarketHours({ lang }: { lang: Lang }) {
  const t = T[lang];
  const [now, setNow] = useState<Date | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => { setNow(new Date()); const iv = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(iv); }, []);
  if (!now) return null;

  const offset = -now.getTimezoneOffset() / 60;
  const hUTC = now.getUTCHours() + now.getUTCMinutes() / 60;
  const hLoc = (hUTC + offset + 24) % 24;
  const isActive = (s: typeof SES[0]) => (s.o < s.c ? (hUTC >= s.o && hUTC < s.c) : (hUTC >= s.o || hUTC < s.c));
  const locOC = (s: typeof SES[0]) => [(s.o + offset + 24) % 24, (s.c + offset + 24) % 24];
  const seg = (o: number, c: number) => (o < c ? [[o, c]] : [[o, 24], [0, c]]);
  const activeList = SES.filter(isActive);
  const clock = now.toLocaleTimeString(lang === 'es' ? 'es-ES' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const np = hLoc / 24 * 100;

  // contadores en tiempo real: cuánto falta para abrir/cerrar cada sesión
  const nextAt = (hour: number) => { const d = new Date(now); d.setUTCHours(hour, 0, 0, 0); if (d.getTime() <= now.getTime()) d.setUTCDate(d.getUTCDate() + 1); return d.getTime(); };
  const fmtDur = (ms: number) => { const s = Math.max(0, Math.floor(ms / 1000)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60; return (h > 0 ? h + 'h ' : '') + m + 'm ' + ss + 's'; };
  const events = SES.map((s) => { const on = isActive(s); const target = on ? nextAt(s.c) : nextAt(s.o); return { on, rem: target - now.getTime(), evt: on ? t.closesIn : t.opensIn }; });
  const soonest = events.map((e, i) => ({ ...e, s: SES[i] })).sort((x, y) => x.rem - y.rem)[0];

  const nowLabel = activeList.length ? activeList.map((s) => `${s.flag} ${s.n[lang]}`).join('  +  ') : t.none;

  return (
    <div className="card" style={{ padding: 14 }}>
      {/* Tira compacta */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', cursor: 'pointer' }} onClick={() => setOpen(!open)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>{t.title}</span>
          <span className="muted" style={{ fontSize: 13 }}>{t.now}:</span>
          <b style={{ fontSize: 14 }}>{nowLabel}</b>
          {soonest && <span className="muted" style={{ fontSize: 12 }}>· {t.next}: {soonest.s.flag} {soonest.s.n[lang]} {soonest.evt} <b style={{ color: 'var(--tx)' }}>{fmtDur(soonest.rem)}</b></span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 15, fontWeight: 800 }}>{clock} <span className="muted" style={{ fontSize: 11, fontWeight: 400 }}>{t.localTz}</span></span>
          <button className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 12 }}>{open ? t.collapse : t.expand} {open ? '▲' : '▼'}</button>
        </div>
      </div>

      {/* mini timeline siempre visible */}
      {!open && (
        <div style={{ position: 'relative', height: 8, marginTop: 12, background: 'var(--bg2)', borderRadius: 5, overflow: 'hidden' }}>
          {SES.map((s, i) => { const [lo, lc] = locOC(s); const on = isActive(s); return seg(lo, lc).map((g, j) => <div key={i + '-' + j} style={{ position: 'absolute', left: g[0] / 24 * 100 + '%', width: (g[1] - g[0]) / 24 * 100 + '%', top: 0, height: '100%', background: on ? s.col : s.col + '44' }} />); })}
          <div style={{ position: 'absolute', top: -2, bottom: -2, left: np + '%', width: 2, background: '#a06bff' }} />
        </div>
      )}

      {/* Panel expandido */}
      {open && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '128px 1fr', gap: 0 }}>
            <div>
              <div style={{ height: 22 }} />
              {SES.map((s, i) => { const on = isActive(s); const ev = events[i]; return (
                <div key={i} style={{ height: 40, display: 'flex', flexDirection: 'column', justifyContent: 'center', lineHeight: 1.2 }}>
                  <b style={{ fontSize: 13 }}>{s.flag} {s.n[lang]}</b>
                  <span style={{ fontSize: 10, fontWeight: 700, color: on ? s.col : 'var(--mut)' }}>{on ? t.open : t.closed}</span>
                  <span style={{ fontSize: 10, color: 'var(--mut)' }}>{ev.evt} {fmtDur(ev.rem)}</span>
                </div>); })}
            </div>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'relative', height: 22 }}>{[0, 3, 6, 9, 12, 15, 18, 21, 24].map((i) => <div key={i} style={{ position: 'absolute', left: i / 24 * 100 + '%', transform: 'translateX(-50%)', fontSize: 10, color: 'var(--mut)' }}>{i}</div>)}</div>
              <div style={{ position: 'relative' }}>
                {SES.map((s, i) => { const [lo, lc] = locOC(s); const on = isActive(s); return (
                  <div key={i} style={{ position: 'relative', height: 40, borderBottom: '1px solid var(--line)' }}>
                    {seg(lo, lc).map((g, j) => <div key={j} style={{ position: 'absolute', left: g[0] / 24 * 100 + '%', width: (g[1] - g[0]) / 24 * 100 + '%', top: 9, height: 22, borderRadius: 6, background: on ? s.col : s.col + '44', boxShadow: on ? '0 0 12px ' + s.col + '88' : 'none' }} />)}
                  </div>); })}
              </div>
              <div style={{ position: 'relative', height: 50, marginTop: 6 }}>
                <svg width="100%" height="50" viewBox="0 0 100 50" preserveAspectRatio="none"><defs><linearGradient id="ovg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#ff6b7d" /><stop offset="0.35" stopColor="#ffd45e" /><stop offset="0.6" stopColor="#34e2a0" /><stop offset="0.8" stopColor="#ffd45e" /><stop offset="1" stopColor="#ff6b7d" /></linearGradient></defs><path d="M0,42 C10,40 16,36 22,26 C28,18 33,12 40,10 C50,8 56,18 62,23 C70,30 78,27 86,36 C92,42 96,44 100,45" fill="none" stroke="url(#ovg)" strokeWidth="3" /></svg>
              </div>
              <div style={{ position: 'absolute', top: 22, bottom: 0, left: np + '%', width: 2, background: '#a06bff', boxShadow: '0 0 8px #a06bff' }} />
              <div style={{ position: 'absolute', top: 16, left: np + '%', transform: 'translateX(-50%)', width: 12, height: 12, borderRadius: '50%', background: '#a06bff', border: '2px solid var(--card)' }} />
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: 8 }}>{t.legend}</div>
        </div>
      )}
    </div>
  );
}
