'use client';
import { useState } from 'react';

// Selector de fecha + hora colorido e intuitivo (calendario + AM/PM), el mismo
// estilo que las clases en vivo de Onyx Academy. Emite "YYYY-MM-DDTHH:mm" (hora
// local), el formato que usan los <input type="datetime-local"> que reemplaza.
// Reutilizable: Campañas (programar promo) y donde haga falta.
export default function DateTimePicker({ value, onChange, es = true, minNow = false }:
  { value: string; onChange: (v: string) => void; es?: boolean; minNow?: boolean }) {
  const L = (a: string, b: string) => (es ? a : b);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const datePart = (value || '').slice(0, 10);
  const timePart = (value || '').slice(11, 16);
  const [open, setOpen] = useState(!datePart);
  const [view, setView] = useState(() => { const d = datePart ? new Date(datePart + 'T00:00') : new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });

  const h24 = timePart ? parseInt(timePart.slice(0, 2), 10) : null;
  const minute = timePart ? timePart.slice(3, 5) : '00';
  const ampm: 'AM' | 'PM' = h24 == null ? 'PM' : (h24 >= 12 ? 'PM' : 'AM');
  const h12 = h24 == null ? 7 : (h24 % 12 === 0 ? 12 : h24 % 12);

  const emit = (dKey: string, hour12: number, min: string, ap: 'AM' | 'PM') => {
    const hh = ap === 'PM' ? (hour12 % 12) + 12 : (hour12 % 12);
    onChange(`${dKey}T${String(hh).padStart(2, '0')}:${min}`);
  };
  const pickDay = (dKey: string) => emit(dKey, timePart ? h12 : 7, timePart ? minute : '00', timePart ? ampm : 'PM');
  const setTime = (hour12: number, min: string, ap: 'AM' | 'PM') => { if (datePart) emit(datePart, hour12, min, ap); };

  let summary = '';
  if (datePart) {
    const d = new Date(value || (datePart + 'T00:00'));
    const ds = d.toLocaleDateString(es ? 'es-ES' : 'en-US', { weekday: 'short', day: 'numeric', month: 'short' });
    const ts = timePart ? `${h12}:${minute} ${ampm}` : L('elige hora', 'pick time');
    summary = `${ds} · ${ts}`;
  }

  const toKey = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const first = new Date(view.y, view.m, 1);
  const startDow = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const monthName = new Date(view.y, view.m, 1).toLocaleDateString(es ? 'es-ES' : 'en-US', { month: 'long', year: 'numeric' });
  const dows = es ? ['L', 'M', 'X', 'J', 'V', 'S', 'D'] : ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const cells: any[] = [];
  for (let i = 0; i < startDow; i++) cells.push(<div key={'e' + i} />);
  for (let d = 1; d <= daysInMonth; d++) {
    const key = toKey(view.y, view.m, d);
    const dt = new Date(view.y, view.m, d);
    const past = minNow && dt < today;
    const on = key === datePart;
    const isToday = dt.getTime() === today.getTime();
    cells.push(
      <button type="button" key={key} disabled={past} onClick={() => pickDay(key)}
        style={{
          height: 38, borderRadius: 10,
          border: '1px solid ' + (on ? 'var(--brand)' : isToday ? 'color-mix(in srgb,var(--brand) 45%,var(--line))' : 'var(--line)'),
          background: on ? 'linear-gradient(160deg,var(--brand),color-mix(in srgb,var(--brand) 60%,#000))' : 'var(--card)',
          color: on ? '#fff' : past ? 'var(--mut)' : 'var(--tx)', opacity: past ? 0.3 : 1,
          cursor: past ? 'default' : 'pointer', fontSize: 13.5, fontWeight: on ? 800 : 500,
          boxShadow: on ? '0 4px 14px -4px var(--brand)' : 'none', transition: '.12s', position: 'relative',
        }}>{d}{isToday && !on && <span style={{ position: 'absolute', bottom: 3, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: 4, background: 'var(--brand)' }} />}</button>
    );
  }

  const minutes = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];
  const selCss = { padding: '8px 10px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--tx)', fontSize: 15, fontWeight: 700, margin: 0, cursor: 'pointer' } as any;
  const apBtn = (ap: 'AM' | 'PM') => (
    <button type="button" key={ap} onClick={() => setTime(h12, minute, ap)}
      style={{
        flex: 1, padding: '8px 0', borderRadius: 9, fontSize: 13, fontWeight: 800, cursor: 'pointer', transition: '.12s',
        border: '1px solid ' + (ampm === ap ? 'var(--brand)' : 'var(--line)'),
        background: ampm === ap ? 'linear-gradient(160deg,var(--brand),color-mix(in srgb,var(--brand) 60%,#000))' : 'var(--card)',
        color: ampm === ap ? '#fff' : 'var(--mut)',
      }}>{ap}</button>
  );

  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 13px', borderRadius: 12,
          border: '1px solid ' + (datePart ? 'var(--brand)' : 'var(--line)'), cursor: 'pointer', textAlign: 'left',
          background: datePart ? 'color-mix(in srgb,var(--brand) 12%,var(--card))' : 'var(--card)', color: 'var(--tx)',
        }}>
        <span style={{ display: 'grid', placeItems: 'center', width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(160deg,var(--brand),color-mix(in srgb,var(--brand) 55%,#000))', flexShrink: 0, fontSize: 15 }}>📅</span>
        <span style={{ flex: 1, fontSize: 14, fontWeight: datePart ? 700 : 500, color: datePart ? 'var(--tx)' : 'var(--mut)', textTransform: 'capitalize' }}>
          {summary || L('Elige fecha y hora', 'Pick date & time')}
        </span>
        <span style={{ fontSize: 12, color: 'var(--mut)', transform: open ? 'rotate(180deg)' : 'none', transition: '.15s' }}>▾</span>
      </button>

      {open && (
        <div style={{ marginTop: 8, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 14, padding: '12px 13px' }}>
          <div className="row between" style={{ alignItems: 'center', marginBottom: 10 }}>
            <button type="button" className="btn btn-ghost" style={{ padding: '4px 12px', fontSize: 18, lineHeight: 1 }} onClick={() => setView((v) => { const m = v.m - 1; return m < 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m }; })}>‹</button>
            <b style={{ fontSize: 15, textTransform: 'capitalize' }}>{monthName}</b>
            <button type="button" className="btn btn-ghost" style={{ padding: '4px 12px', fontSize: 18, lineHeight: 1 }} onClick={() => setView((v) => { const m = v.m + 1; return m > 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m }; })}>›</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 5, marginBottom: 5 }}>
            {dows.map((w, i) => <span key={i} style={{ textAlign: 'center', fontSize: 10.5, color: 'var(--mut)', textTransform: 'uppercase', fontWeight: 600 }}>{w}</span>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 5 }}>{cells}</div>

          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
            <div className="muted" style={{ fontSize: 11.5, marginBottom: 6, textTransform: 'uppercase', letterSpacing: .4, fontWeight: 700 }}>{L('Hora', 'Time')}</div>
            <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <select value={h12} onChange={(e) => setTime(Number(e.target.value), minute, ampm)} style={{ ...selCss, minWidth: 62 }} disabled={!datePart}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
              <b style={{ fontSize: 18 }}>:</b>
              <select value={minute} onChange={(e) => setTime(h12, e.target.value, ampm)} style={{ ...selCss, minWidth: 66 }} disabled={!datePart}>
                {minutes.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <div className="row" style={{ gap: 6, flex: '1 1 120px', minWidth: 120 }}>{apBtn('AM')}{apBtn('PM')}</div>
            </div>
            {!datePart && <div className="muted" style={{ fontSize: 11, marginTop: 7 }}>{L('Primero elige un día en el calendario.', 'Pick a day on the calendar first.')}</div>}
          </div>

          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
            <button type="button" className="btn btn-primary" style={{ fontSize: 13, padding: '6px 18px' }} onClick={() => setOpen(false)} disabled={!datePart}>{L('Listo', 'Done')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
