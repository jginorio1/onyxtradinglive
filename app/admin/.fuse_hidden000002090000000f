'use client';
import { useEffect, useMemo, useState } from 'react';
import { useLang } from '@/lib/lang';
import { fmtDate } from '@/lib/fmtDate';

type Lang = 'es' | 'en';
const T: any = {
  es: { title: 'Historial de auditorías', avg: 'Promedio', of: 'de', runs: 'auditorías', trend: 'Tendencia', cal: 'Calendario',
    empty: 'Aún no hay historial. Se irá llenando con cada auditoría del despliegue.', pick: 'Toca un día con punto para ver esa auditoría.',
    perf: 'Rendimiento', a11y: 'Accesibilidad', seo: 'SEO', best: 'Buenas prácticas', sec: 'Seguridad',
    secOk: 'protegido', secWarn: 'avisos', secFail: 'fallos', noData: 'Faltan datos para el gráfico.',
    months: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
    dows: ['L', 'M', 'X', 'J', 'V', 'S', 'D'] },
  en: { title: 'Audit history', avg: 'Average', of: 'of', runs: 'audits', trend: 'Trend', cal: 'Calendar',
    empty: 'No history yet. It fills up with each deploy audit.', pick: 'Tap a day with a dot to see that audit.',
    perf: 'Performance', a11y: 'Accessibility', seo: 'SEO', best: 'Best practices', sec: 'Security',
    secOk: 'protected', secWarn: 'warnings', secFail: 'failures', noData: 'Not enough data for the chart.',
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    dows: ['M', 'T', 'W', 'T', 'F', 'S', 'S'] },
};

const SERIES = [
  { key: 'performance', color: '#3b8bff', label: 'perf' },
  { key: 'accessibility', color: 'var(--brand2)', label: 'a11y' },
  { key: 'seo', color: 'var(--green)', label: 'seo' },
  { key: 'best_practices', color: 'var(--amber)', label: 'best' },
];
const dayKey = (d: any) => new Date(d).toISOString().slice(0, 10);
const scoreCol = (v: number) => (v >= 90 ? 'var(--green)' : v >= 50 ? 'var(--amber)' : 'var(--red)');

export default function AuditHistory() {
  const { lang } = useLang() as { lang: Lang };
  const t = T[lang];
  const [data, setData] = useState<any>(null);
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [selKey, setSelKey] = useState<string | null>(null);

  useEffect(() => { fetch('/api/admin/audit/history?days=180').then((r) => r.json()).then(setData).catch(() => setData({ runs: [], averages: {} })); }, []);

  const runs: any[] = data?.runs || [];
  const byDay = useMemo(() => { const m: Record<string, any[]> = {}; runs.forEach((r) => { const k = dayKey(r.at); (m[k] ||= []).push(r); }); return m; }, [runs]);
  const av = data?.averages || {};

  if (!data) return <div className="card muted">…</div>;

  // ── Gráfico de tendencia (SVG multi-línea) ──
  const W = 640, H = 170, padL = 26, padR = 10, padT = 12, padB = 18;
  const pts = runs.filter((r) => typeof r.performance === 'number');
  const x = (i: number) => padL + (pts.length <= 1 ? 0 : (i * (W - padL - padR)) / (pts.length - 1));
  const y = (v: number) => padT + (1 - Math.max(0, Math.min(100, v)) / 100) * (H - padT - padB);

  // ── Calendario ──
  const first = new Date(cursor.y, cursor.m, 1);
  const startDow = (first.getDay() + 6) % 7; // lunes=0
  const daysIn = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(startDow).fill(null), ...Array.from({ length: daysIn }, (_, i) => i + 1)];
  const sel = selKey && byDay[selKey] ? byDay[selKey][byDay[selKey].length - 1] : null;

  const tile = (label: string, v: any) => (
    <div className="tile"><div className="muted" style={{ fontSize: 11.5 }}>{label}</div><div style={{ fontSize: 20, fontWeight: 700, marginTop: 2, color: v == null ? 'var(--mut)' : scoreCol(v) }}>{v == null ? '—' : v}</div></div>
  );

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="row between" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        <b style={{ fontSize: 14 }}>📅 {t.title}</b>
        <span className="muted" style={{ fontSize: 12 }}>{av.count || 0} {t.runs}</span>
      </div>

      {!runs.length && <p className="muted" style={{ fontSize: 13 }}>{t.empty}</p>}

      {!!runs.length && (
        <>
          {/* Promedios */}
          <div className="muted" style={{ fontSize: 11, marginBottom: 6 }}>{t.avg}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
            {tile(t.perf, av.performance)}{tile(t.a11y, av.accessibility)}{tile(t.seo, av.seo)}{tile(t.best, av.best_practices)}
          </div>

          {/* Gráfico de tendencia */}
          <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>{t.trend}</div>
          {pts.length < 2
            ? <p className="muted" style={{ fontSize: 12.5, margin: '4px 0 14px' }}>{t.noData}</p>
            : (
              <>
                <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', marginBottom: 6 }}>
                  {[0, 50, 100].map((g) => (
                    <g key={g}>
                      <line x1={padL} y1={y(g)} x2={W - padR} y2={y(g)} stroke="var(--line)" strokeWidth="1" />
                      <text x={0} y={y(g) + 3} fontSize="9" fill="var(--mut)">{g}</text>
                    </g>
                  ))}
                  {SERIES.map((s) => (
                    <polyline key={s.key} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
                      points={pts.map((r, i) => `${x(i)},${y(r[s.key] ?? 0)}`).join(' ')} />
                  ))}
                </svg>
                <div className="row" style={{ gap: 14, flexWrap: 'wrap', fontSize: 11.5, marginBottom: 14 }}>
                  {SERIES.map((s) => <span key={s.key} className="row" style={{ gap: 5, alignItems: 'center' }}><span style={{ width: 10, height: 3, background: s.color, borderRadius: 2 }} />{(t as any)[s.label]}</span>)}
                </div>
              </>
            )}

          {/* Calendario */}
          <div className="row between" style={{ marginBottom: 8, alignItems: 'center' }}>
            <span className="muted" style={{ fontSize: 11 }}>{t.cal}</span>
            <div className="row" style={{ gap: 6, alignItems: 'center' }}>
              <button className="btn btn-ghost" style={{ padding: '2px 10px' }} onClick={() => setCursor((c) => ({ y: c.m === 0 ? c.y - 1 : c.y, m: (c.m + 11) % 12 }))}>‹</button>
              <b style={{ fontSize: 13, minWidth: 74, textAlign: 'center' }}>{t.months[cursor.m]} {cursor.y}</b>
              <button className="btn btn-ghost" style={{ padding: '2px 10px' }} onClick={() => setCursor((c) => ({ y: c.m === 11 ? c.y + 1 : c.y, m: (c.m + 1) % 12 }))}>›</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
            {t.dows.map((d: string, i: number) => <div key={i} className="muted" style={{ fontSize: 10, textAlign: 'center', padding: '2px 0' }}>{d}</div>)}
            {cells.map((day, i) => {
              if (day == null) return <div key={i} />;
              const k = `${cursor.y}-${String(cursor.m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const rr = byDay[k];
              const perf = rr ? rr[rr.length - 1].performance : null;
              const on = selKey === k;
              return (
                <div key={i} onClick={() => rr && setSelKey(k)} title={rr ? k : ''}
                  style={{ aspectRatio: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: 8, fontSize: 11.5, cursor: rr ? 'pointer' : 'default', background: on ? 'var(--card2)' : 'transparent', border: on ? '1px solid var(--brand)' : '1px solid transparent', color: rr ? 'var(--tx)' : 'var(--mut)' }}>
                  {day}
                  {rr && <span style={{ width: 6, height: 6, borderRadius: '50%', marginTop: 2, background: typeof perf === 'number' ? scoreCol(perf) : 'var(--brand)' }} />}
                </div>
              );
            })}
          </div>

          {/* Detalle del día elegido */}
          {sel && (
            <div style={{ borderTop: '1px solid var(--line)', marginTop: 12, paddingTop: 12 }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>{fmtDate(sel.at, lang)}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10 }}>
                {tile(t.perf, sel.performance)}{tile(t.a11y, sel.accessibility)}{tile(t.seo, sel.seo)}{tile(t.best, sel.best_practices)}
                <div className="tile"><div className="muted" style={{ fontSize: 11.5 }}>{t.sec}</div><div style={{ fontSize: 15, fontWeight: 700, marginTop: 4, color: sel.sec_overall === 'ok' ? 'var(--green)' : sel.sec_overall === 'warn' ? 'var(--amber)' : 'var(--red)' }}>{sel.sec_overall === 'ok' ? t.secOk : sel.sec_overall === 'warn' ? `${sel.sec_warns} ${t.secWarn}` : `${sel.sec_fails} ${t.secFail}`}</div></div>
              </div>
            </div>
          )}
          {!sel && <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>{t.pick}</p>}
        </>
      )}
    </div>
  );
}
