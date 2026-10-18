'use client';
import { useEffect, useMemo, useState } from 'react';
import { toast } from '@/lib/toast';
import OnyxIcon from '@/app/components/OnyxIcon';
import Calendar from '@/app/components/Calendar';

// Admin → Horarios. Sobre la nómina existente: cada empleado tiene su plantilla
// semanal de turnos + excepciones por día, y vemos quién está fichado ahora y las
// horas trabajadas del mes. No duplica la ficha del empleado (vive en `staff`).

const WD_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const WD_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function dur(min: number) { const h = Math.floor(min / 60), m = min % 60; return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`; }
function since(iso: string, es: boolean) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return es ? `desde hace ${dur(mins)}` : `for ${dur(mins)}`;
}

export default function Schedule({ canManage = true, lang = 'es' }: { canManage?: boolean; lang?: 'es' | 'en' }) {
  const es = lang === 'es';
  const WD = es ? WD_ES : WD_EN;
  const [data, setData] = useState<any>(null);
  const [open, setOpen] = useState<string>('');   // empleado expandido
  const [busy, setBusy] = useState(false);

  async function load() {
    try { const r = await fetch('/api/admin/schedule'); const j = await r.json(); setData(j); } catch {}
  }
  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, []);

  async function act(body: any) {
    setBusy(true);
    try {
      const r = await fetch('/api/admin/schedule', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.ok === false) { toast(j.error || 'Error'); return false; }
      await load(); return true;
    } catch { toast('Error'); return false; } finally { setBusy(false); }
  }

  const staff: any[] = data?.staff || [];
  const nowClocked = staff.filter((s) => s.clockedInAt);

  if (!data) return <div className="muted" style={{ fontSize: 13 }}>…</div>;

  return (
    <div style={{ maxWidth: 'none' }}>
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ fontSize: 18, margin: 0 }}><OnyxIcon emoji="🗓️" size={15} /> {es ? 'Horarios y fichaje' : 'Schedules & clock-in'}</h2>
        <p className="muted" style={{ fontSize: 12.5, margin: '2px 0 0' }}>{es ? 'Asigna el turno semanal de cada empleado, pon días libres o cambios puntuales, y revisa quién está trabajando ahora.' : 'Set each employee’s weekly shift, add days off or one-off changes, and see who’s working now.'}</p>
      </div>

      {/* Fichados ahora */}
      <div className="card" style={{ padding: 14, marginBottom: 16, border: '1px solid color-mix(in srgb, var(--green) 35%, var(--line))' }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: nowClocked.length ? 10 : 0 }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 99, background: nowClocked.length ? 'var(--green)' : 'var(--mut)', marginRight: 7, boxShadow: nowClocked.length ? '0 0 8px var(--green)' : 'none' }} />
          {es ? 'Trabajando ahora' : 'Working now'} · {nowClocked.length}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {nowClocked.map((s) => (
            <div key={s.id} className="row" style={{ gap: 8, background: 'var(--bg2)', borderRadius: 10, padding: '7px 11px' }}>
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>{s.name}</span>
              <span className="muted" style={{ fontSize: 11.5 }}>{since(s.clockedInAt, es)}</span>
              {canManage && <button className="btn btn-ghost" style={{ fontSize: 10.5, padding: '2px 7px' }} disabled={busy} onClick={() => act({ action: 'force_clock_out', staff_id: s.id })}>{es ? 'Cerrar' : 'Clock out'}</button>}
            </div>
          ))}
          {!nowClocked.length && <span className="muted" style={{ fontSize: 12 }}>{es ? 'Nadie fichado en este momento.' : 'No one clocked in right now.'}</span>}
        </div>
      </div>

      {/* Empleados */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {staff.map((s) => (
          <EmpCard key={s.id} s={s} es={es} WD={WD} canManage={canManage} busy={busy} act={act}
            expanded={open === s.id} onToggle={() => setOpen(open === s.id ? '' : s.id)} />
        ))}
        {!staff.length && <div className="muted" style={{ fontSize: 13 }}>{es ? 'No hay empleados en nómina todavía. Añádelos en Nómina.' : 'No payroll employees yet. Add them in Payroll.'}</div>}
      </div>
    </div>
  );
}

function EmpCard({ s, es, WD, canManage, busy, act, expanded, onToggle }: any) {
  const totalShifts = (s.shifts || []).length;
  const offCount = (s.exceptions || []).filter((e: any) => e.kind === 'off').length;

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div className="row between" style={{ padding: '12px 14px', cursor: 'pointer', gap: 10 }} onClick={onToggle}>
        <div className="row" style={{ gap: 10, minWidth: 0 }}>
          <span style={{ width: 8, height: 8, borderRadius: 99, flex: 'none', background: s.clockedInAt ? 'var(--green)' : (s.status === 'active' ? 'var(--mut)' : 'var(--red,#e5484d)'), boxShadow: s.clockedInAt ? '0 0 8px var(--green)' : 'none' }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
            <div className="muted" style={{ fontSize: 11.5 }}>{s.position || s.department}{totalShifts ? ` · ${totalShifts} ${es ? 'turnos/sem' : 'shifts/wk'}` : ` · ${es ? 'sin horario' : 'no schedule'}`}{offCount ? ` · ${offCount} ${es ? 'días libres' : 'days off'}` : ''}</div>
          </div>
        </div>
        <div className="row" style={{ gap: 12, flex: 'none' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{dur(s.workedMin || 0)}</div>
            <div className="muted" style={{ fontSize: 10.5 }}>{es ? 'este mes' : 'this month'}</div>
          </div>
          <OnyxIcon name={expanded ? 'chevron-up' : 'chevron-down'} size={16} glow={false} />
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: '1px solid var(--line)', padding: 14 }}>
          <WeekEditor s={s} es={es} WD={WD} canManage={canManage} busy={busy} act={act} />
          <ExcEditor s={s} es={es} canManage={canManage} busy={busy} act={act} />
        </div>
      )}
    </div>
  );
}

// Plantilla semanal: 7 filas, cada una con sus turnos (añadir/editar/quitar).
function WeekEditor({ s, es, WD, canManage, busy, act }: any) {
  const byDay: Record<number, any[]> = {};
  for (let d = 0; d < 7; d++) byDay[d] = [];
  (s.shifts || []).forEach((sh: any) => { byDay[sh.weekday]?.push(sh); });
  const inp = { padding: '4px 6px', borderRadius: 7, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--tx)', fontSize: 12.5, fontFamily: 'inherit' } as any;

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>{es ? 'Turno semanal' : 'Weekly shift'}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[1, 2, 3, 4, 5, 6, 0].map((d) => (
          <div key={d} className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ width: 34, fontSize: 12, fontWeight: 700, color: 'var(--mut)', flex: 'none' }}>{WD[d]}</span>
            {byDay[d].length === 0 && <span className="muted" style={{ fontSize: 11.5 }}>{es ? 'libre' : 'off'}</span>}
            {byDay[d].map((sh: any) => (
              <span key={sh.id} className="row" style={{ gap: 4, background: 'var(--bg2)', borderRadius: 8, padding: '3px 6px' }}>
                {canManage ? (
                  <>
                    <input type="time" defaultValue={sh.start_time} style={{ ...inp, width: 92 }} onBlur={(e) => e.target.value !== sh.start_time && act({ action: 'update_shift', id: sh.id, start_time: e.target.value })} />
                    <span className="muted" style={{ fontSize: 11 }}>–</span>
                    <input type="time" defaultValue={sh.end_time} style={{ ...inp, width: 92 }} onBlur={(e) => e.target.value !== sh.end_time && act({ action: 'update_shift', id: sh.id, end_time: e.target.value })} />
                    <button className="btn btn-ghost" style={{ fontSize: 11, padding: '1px 6px' }} disabled={busy} onClick={() => act({ action: 'delete_shift', id: sh.id })}>✕</button>
                  </>
                ) : <span style={{ fontSize: 12 }}>{sh.start_time}–{sh.end_time}</span>}
              </span>
            ))}
            {canManage && <button className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 8px' }} disabled={busy} onClick={() => act({ action: 'add_shift', staff_id: s.id, weekday: d, start_time: '09:00', end_time: '17:00' })}>+ {es ? 'turno' : 'shift'}</button>}
          </div>
        ))}
      </div>
    </div>
  );
}

// Excepciones por fecha: elige un día y márcalo libre o con horario distinto.
function ExcEditor({ s, es, canManage, busy, act }: any) {
  const [day, setDay] = useState('');
  const [kind, setKind] = useState<'off' | 'custom'>('off');
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('17:00');
  const inp = { padding: '5px 7px', borderRadius: 7, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--tx)', fontSize: 12.5, fontFamily: 'inherit' } as any;
  const excs = (s.exceptions || []).slice().sort((a: any, b: any) => a.day.localeCompare(b.day));

  async function save() {
    if (!day) { toast(es ? 'Elige una fecha.' : 'Pick a date.'); return; }
    const okr = await act({ action: 'set_exception', staff_id: s.id, day, kind, start_time: start, end_time: end });
    if (okr) { setDay(''); toast(es ? 'Guardado' : 'Saved', 'ok'); }
  }

  return (
    <div>
      <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>{es ? 'Excepciones por día (libre o cambio puntual)' : 'Per-day exceptions (off or one-off change)'}</div>
      {canManage && (
        <div className="row" style={{ gap: 10, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 10 }}>
          <div style={{ width: 230 }}><Calendar value={day} onChange={setDay} en={!es} /></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="row" style={{ gap: 6 }}>
              <button className="btn" style={{ fontSize: 11.5, padding: '4px 10px', background: kind === 'off' ? 'var(--brand)' : 'var(--bg2)', color: kind === 'off' ? '#0b1020' : 'var(--tx)' }} onClick={() => setKind('off')}>{es ? 'Día libre' : 'Day off'}</button>
              <button className="btn" style={{ fontSize: 11.5, padding: '4px 10px', background: kind === 'custom' ? 'var(--brand)' : 'var(--bg2)', color: kind === 'custom' ? '#0b1020' : 'var(--tx)' }} onClick={() => setKind('custom')}>{es ? 'Otro horario' : 'Custom hours'}</button>
            </div>
            {kind === 'custom' && (
              <div className="row" style={{ gap: 5, alignItems: 'center' }}>
                <input type="time" value={start} onChange={(e) => setStart(e.target.value)} style={{ ...inp, width: 100 }} />
                <span className="muted">–</span>
                <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} style={{ ...inp, width: 100 }} />
              </div>
            )}
            <button className="btn btn-primary" style={{ fontSize: 12 }} disabled={busy || !day} onClick={save}>{es ? 'Guardar excepción' : 'Save exception'}</button>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {excs.map((e: any) => (
          <span key={e.id} className="row" style={{ gap: 6, background: 'var(--bg2)', borderRadius: 8, padding: '4px 9px', fontSize: 11.5 }}>
            <b>{e.day.slice(5)}</b>
            <span style={{ color: e.kind === 'off' ? 'var(--red,#e5484d)' : 'var(--green)' }}>{e.kind === 'off' ? (es ? 'libre' : 'off') : `${e.start_time}–${e.end_time}`}</span>
            {canManage && <button className="btn btn-ghost" style={{ fontSize: 10.5, padding: '0 5px' }} disabled={busy} onClick={() => act({ action: 'delete_exception', staff_id: s.id, day: e.day })}>✕</button>}
          </span>
        ))}
        {!excs.length && <span className="muted" style={{ fontSize: 11.5 }}>{es ? 'Sin excepciones este mes.' : 'No exceptions this month.'}</span>}
      </div>
    </div>
  );
}
