'use client';
import { useEffect, useState } from 'react';
import { useT } from '@/lib/adminText';

// Plantillas de prop firm. Se editan aquí para poder corregirlas cuando una
// firma cambie sus reglas, sin tener que volver a subir la web.
export default function Firms() {
  const t = useT();
  const [list, setList] = useState<any[]>([]);
  const [isDefault, setIsDefault] = useState(true);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => { load(); }, []);
  async function load() {
    try {
      const r = await fetch('/api/admin/firms');
      const j = await r.json();
      setList(j.list || []); setIsDefault(!!j.isDefault);
    } catch { setList([]); }
  }

  const set = (i: number, k: string, v: any) =>
    setList(list.map((f, ix) => (ix === i ? { ...f, [k]: v } : f)));

  const add = () => setList([...list, {
    id: '', name: '', daily_loss: 5, total_loss: 10,
    base: 'day_start_balance', reset_hour: 0, note_es: '', note_en: '',
  }]);
  const remove = (i: number) => setList(list.filter((_, ix) => ix !== i));

  async function save() {
    setBusy('save'); setMsg('');
    const r = await fetch('/api/admin/firms', { method: 'POST', body: JSON.stringify({ list }) });
    const j = await r.json(); setBusy('');
    if (!r.ok) { alert(j.error || 'error'); return; }
    setList(j.list || []); setIsDefault(false);
    setMsg(t.fi_saved); setTimeout(() => setMsg(''), 2500);
  }
  async function reset() {
    if (!confirm(t.fi_confirmReset)) return;
    setBusy('reset');
    const r = await fetch('/api/admin/firms', { method: 'POST', body: JSON.stringify({ action: 'reset' }) });
    const j = await r.json(); setBusy('');
    setList(j.list || []); setIsDefault(true);
  }

  const lbl = { fontSize: 11, color: 'var(--mut)', display: 'block', marginBottom: 3 } as any;
  const inp = { margin: 0, padding: '6px 9px', fontSize: 13 } as any;

  // Sin id o sin nombre no se puede guardar
  const bad = list.filter((f) => !String(f.id || '').trim() || !String(f.name || '').trim()).length;

  const dotOf = (i: number) => ['#34e2a0', '#7c8cff', '#ffc04d', '#b98bff', '#3ad0ff', '#ff9aa6'][i % 6];

  return (
    <>
      <div className="tabhead"><div className="th-row"><span className="th-ic">🏛️</span><span className="th-t">Prop firms</span></div><div className="th-s">Plantillas que ve el trader al configurar límites. Corrige aquí y todos las ven.</div></div>
      <div className="card" style={{ marginBottom: 16 }}>
        <p className="muted" style={{ fontSize: 13 }}>{t.fi_intro}</p>
        {isDefault && (
          <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>{t.fi_default}</div>
        )}
      </div>

      {list.map((f, i) => (
        <div key={i} className="card" style={{ marginBottom: 12 }}>
          <div className="row between" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div className="row" style={{ gap: 9 }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: dotOf(i), flex: 'none' }} />
              <b style={{ fontSize: 14 }}>{f.name || f.id || t.fi_new}</b>
            </div>
            <span className="pill gray">{f.daily_loss || 0}% {t.fi_daily_s} · {f.total_loss || 0}% {t.fi_total_s}</span>
          </div>
          <div className="row" style={{ gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
            <div style={{ width: 130 }}>
              <span style={lbl}>{t.fi_id}</span>
              <input value={f.id} onChange={(e) => set(i, 'id', e.target.value)} placeholder="ftmo" style={{ ...inp, width: '100%' }} />
            </div>
            <div style={{ width: 160 }}>
              <span style={lbl}>{t.fi_name}</span>
              <input value={f.name} onChange={(e) => set(i, 'name', e.target.value)} placeholder="FTMO" style={{ ...inp, width: '100%' }} />
            </div>
            <div style={{ width: 110 }}>
              <span style={lbl}>{t.fi_daily}</span>
              <input type="number" value={f.daily_loss} onChange={(e) => set(i, 'daily_loss', Number(e.target.value))} style={{ ...inp, width: '100%' }} />
            </div>
            <div style={{ width: 110 }}>
              <span style={lbl}>{t.fi_total}</span>
              <input type="number" value={f.total_loss} onChange={(e) => set(i, 'total_loss', Number(e.target.value))} style={{ ...inp, width: '100%' }} />
            </div>
          </div>

          <div style={{ background: 'rgba(255,192,77,.08)', border: '1px solid var(--amber)', borderRadius: 10, padding: '9px 11px', marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--amber)', marginBottom: 7 }}>{t.fi_confused}</div>
            <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
              <div style={{ width: 210 }}>
                <span style={lbl}>{t.fi_base}</span>
                <select value={f.base} onChange={(e) => set(i, 'base', e.target.value)} style={{ ...inp, width: '100%' }}>
                  <option value="day_start_balance">{t.fi_base1}</option>
                  <option value="day_start_equity">{t.fi_base2}</option>
                  <option value="initial_balance">{t.fi_base3}</option>
                </select>
              </div>
              <div style={{ width: 130 }}>
                <span style={lbl}>{t.fi_reset}</span>
                <select value={f.reset_hour} onChange={(e) => set(i, 'reset_hour', Number(e.target.value))} style={{ ...inp, width: '100%' }}>
                  {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <span style={lbl}>{t.fi_noteEs}</span>
              <input value={f.note_es || ''} onChange={(e) => set(i, 'note_es', e.target.value)} style={{ ...inp, width: '100%' }} />
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <span style={lbl}>{t.fi_noteEn}</span>
              <input value={f.note_en || ''} onChange={(e) => set(i, 'note_en', e.target.value)} style={{ ...inp, width: '100%' }} />
            </div>
          </div>

          <button className="btn btn-ghost" style={{ marginTop: 10, padding: '4px 10px', fontSize: 12 }} onClick={() => remove(i)}>{t.fi_remove}</button>
        </div>
      ))}

      <div className="row" style={{ gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
        <button className="btn btn-ghost" onClick={add}>{t.fi_add}</button>
        <button className="btn btn-primary" onClick={save} disabled={busy === 'save' || bad > 0 || !list.length}
          style={{ opacity: bad > 0 || !list.length ? .5 : 1 }}>
          {busy === 'save' ? '...' : t.fi_save}
        </button>
        <button className="btn btn-ghost" onClick={reset} disabled={busy === 'reset'}>{t.fi_resetBtn}</button>
        {msg && <span style={{ color: 'var(--green)', fontSize: 14 }}>{msg}</span>}
      </div>
      {bad > 0 && (
        <div style={{ marginTop: 10, padding: '9px 12px', background: 'rgba(245,158,11,.08)', border: '1px solid var(--amber)', borderRadius: 10, fontSize: 13 }}>
          {t.fi_badPre} {bad} {t.fi_bad}
        </div>
      )}
    </>
  );
}
