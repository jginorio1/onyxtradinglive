'use client';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/lang';

// Control de la burbuja "en línea ahora" (prueba social simulada, abajo-izq).
type Cfg = {
  enabled: boolean; min: number; max: number; speed: 'slow' | 'normal' | 'fast';
  color: string; hideMobile: boolean; label_es: string; label_en: string;
};

export default function OnlineNowControl() {
  const { lang } = useLang();
  const L = (es: string, en: string) => (lang === 'en' ? en : es);
  const [c, setC] = useState<Cfg | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => { fetch('/api/admin/online').then((r) => r.json()).then((d) => { if (!d.error) setC(d); }).catch(() => {}); }, []);
  const upd = (k: keyof Cfg, v: any) => setC((p) => (p ? { ...p, [k]: v } : p));

  async function save() {
    if (!c) return;
    setBusy(true); setMsg('');
    try {
      const r = await fetch('/api/admin/online', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(c) });
      const d = await r.json();
      if (!r.ok) setMsg(d.error || 'Error'); else { setC(d); setMsg(L('Guardado ✓', 'Saved ✓')); }
    } finally { setBusy(false); }
  }

  if (!c) return null;
  const speeds: Array<[Cfg['speed'], string]> = [['slow', L('Lenta', 'Slow')], ['normal', L('Normal', 'Normal')], ['fast', L('Rápida', 'Fast')]];

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <h3 style={{ marginBottom: 4 }}>🟢 {L('Usuarios en línea (burbuja)', 'Users online (bubble)')}</h3>
      <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
        {L('Burbuja de "prueba social" abajo a la izquierda. El número es simulado: se mantiene entre la base y el máximo y sube/baja solo. Oculta en móvil.',
           'Bottom-left "social proof" bubble. The number is simulated: it stays between base and max and drifts on its own. Hidden on mobile.')}
      </p>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line, rgba(255,255,255,.08))' }}>
        <span style={{ fontSize: 13.5 }}>{L('Mostrar la burbuja', 'Show the bubble')}</span>
        <span className="toggle" onClick={() => upd('enabled', !c.enabled)} style={{ background: c.enabled ? 'var(--green)' : '#556080' }}><span className="knob" style={{ left: c.enabled ? 21 : 3 }} /></span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
        <label style={{ fontSize: 12.5 }}>{L('Base mínima', 'Minimum base')}
          <input type="number" min={0} value={c.min} onChange={(e) => upd('min', Number(e.target.value))} className="input" style={{ width: '100%', marginTop: 4 }} />
        </label>
        <label style={{ fontSize: 12.5 }}>{L('Máximo', 'Maximum')}
          <input type="number" min={1} value={c.max} onChange={(e) => upd('max', Number(e.target.value))} className="input" style={{ width: '100%', marginTop: 4 }} />
        </label>
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 12.5, marginBottom: 6 }}>{L('Velocidad de cambio', 'Change speed')}</div>
        <div style={{ display: 'inline-flex', gap: 6 }}>
          {speeds.map(([v, lbl]) => (
            <button key={v} onClick={() => upd('speed', v)} className="btn" style={{ padding: '5px 14px', fontSize: 12.5, background: c.speed === v ? 'var(--brand, #7c8cff)' : 'var(--chip, rgba(255,255,255,.06))', color: c.speed === v ? '#0a0d14' : 'inherit', border: 'none', borderRadius: 20 }}>{lbl}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
        <label style={{ fontSize: 12.5 }}>{L('Texto (ES)', 'Text (ES)')}
          <input value={c.label_es} onChange={(e) => upd('label_es', e.target.value)} className="input" style={{ width: '100%', marginTop: 4 }} placeholder="en línea ahora" />
        </label>
        <label style={{ fontSize: 12.5 }}>{L('Texto (EN)', 'Text (EN)')}
          <input value={c.label_en} onChange={(e) => upd('label_en', e.target.value)} className="input" style={{ width: '100%', marginTop: 4 }} placeholder="online now" />
        </label>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 12.5, display: 'inline-flex', alignItems: 'center', gap: 8 }}>{L('Color de la luz', 'Light color')}
          <input type="color" value={c.color} onChange={(e) => upd('color', e.target.value)} style={{ width: 40, height: 28, border: 'none', background: 'none', cursor: 'pointer' }} />
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="toggle" onClick={() => upd('hideMobile', !c.hideMobile)} style={{ background: c.hideMobile ? 'var(--green)' : '#556080' }}><span className="knob" style={{ left: c.hideMobile ? 21 : 3 }} /></span>
          <span style={{ fontSize: 13 }}>{L('Ocultar en móvil', 'Hide on mobile')}</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
        <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? '…' : L('Guardar', 'Save')}</button>
        {msg && <span className="muted" style={{ fontSize: 12.5 }}>{msg}</span>}
      </div>
    </div>
  );
}
