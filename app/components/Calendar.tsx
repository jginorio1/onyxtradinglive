'use client';
// Calendario moderno y grande (reemplaza al <input type="date"> nativo, que se ve
// pequeño y feo). Navegación por mes, "hoy" resaltado, día elegido marcado, botón
// "Hoy". Devuelve la fecha como 'YYYY-MM-DD'. Bilingüe por prop `en`.
import { useState } from 'react';
import Icon from '@/app/components/Icons';

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

export default function Calendar({ value, onChange, en = false, max }: { value?: string; onChange: (d: string) => void; en?: boolean; max?: string }) {
  const today = new Date();
  const sel = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
  const init = sel ? new Date(sel + 'T00:00:00') : today;
  const [ym, setYm] = useState({ y: init.getFullYear(), m: init.getMonth() });
  const maxD = max && /^\d{4}-\d{2}-\d{2}$/.test(max) ? max : '';

  const months = en
    ? ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    : ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const dows = en ? ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] : ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];

  const first = new Date(ym.y, ym.m, 1);
  const blanks = (first.getDay() + 6) % 7; // lunes primero
  const days = new Date(ym.y, ym.m + 1, 0).getDate();
  const todayIso = iso(today.getFullYear(), today.getMonth(), today.getDate());

  function shift(d: number) { const dt = new Date(ym.y, ym.m + d, 1); setYm({ y: dt.getFullYear(), m: dt.getMonth() }); }

  const cells: (number | null)[] = [];
  for (let i = 0; i < blanks; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 14, width: 290, boxShadow: '0 12px 34px rgba(0,0,0,.28)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <button onClick={() => shift(-1)} aria-label="prev" style={{ width: 30, height: 30, borderRadius: 9, border: '1px solid var(--line)', background: 'var(--bg2)', cursor: 'pointer', color: 'var(--tx)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="back" size={16} /></button>
        <div style={{ fontSize: 14.5, fontWeight: 700, textTransform: 'capitalize' }}>{months[ym.m]} {ym.y}</div>
        <button onClick={() => shift(1)} aria-label="next" style={{ width: 30, height: 30, borderRadius: 9, border: '1px solid var(--line)', background: 'var(--bg2)', cursor: 'pointer', color: 'var(--tx)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="chevronRight" size={16} /></button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3, textAlign: 'center', fontSize: 11, color: 'var(--mut)', marginBottom: 4 }}>
        {dows.map((d) => <span key={d}>{d}</span>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3, textAlign: 'center' }}>
        {cells.map((d, i) => {
          if (d === null) return <span key={i} />;
          const di = iso(ym.y, ym.m, d);
          const isSel = di === sel;
          const isToday = di === todayIso;
          const disabled = maxD ? di > maxD : false;
          return (
            <button key={i} disabled={disabled} onClick={() => onChange(di)} style={{
              height: 36, borderRadius: 9, cursor: disabled ? 'default' : 'pointer', fontSize: 13.5,
              border: isToday && !isSel ? '1px solid var(--soft-brand,#7c8cff)' : '1px solid transparent',
              background: isSel ? 'var(--tx)' : 'transparent', color: disabled ? 'var(--mut)' : isSel ? 'var(--card)' : 'var(--tx)',
              fontWeight: isSel || isToday ? 700 : 400, opacity: disabled ? .4 : 1,
            }}>{d}</button>
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
        <button onClick={() => { const t = new Date(); setYm({ y: t.getFullYear(), m: t.getMonth() }); onChange(todayIso); }} style={{ fontSize: 12, fontWeight: 600, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', color: 'var(--tx)' }}>{en ? 'Today' : 'Hoy'}</button>
        {sel && <button onClick={() => onChange('')} style={{ fontSize: 12, fontWeight: 600, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--mut)' }}>{en ? 'Clear' : 'Quitar'}</button>}
      </div>
    </div>
  );
}
