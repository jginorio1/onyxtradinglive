'use client';
import { useEffect, useState } from 'react';
import OnyxIcon from '@/app/components/OnyxIcon';

// Editor del REPORTE de rendimiento por Telegram. Se entrega a cada trader a SU
// hora local (sábado 5pm por defecto). Todo el mensaje es editable aquí.
type Cfg = {
  enabled: boolean; day: number; hour: number; monthly: boolean;
  attachImage: boolean; attachPdf: boolean; attachCsv: boolean; defaultTzMin: number;
  title_es: string; title_en: string; body_es: string; body_en: string;
};

const DAYS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TZ = [[-720, 'UTC-12'], [-360, 'UTC-6 (MX centro)'], [-300, 'UTC-5 (COL/PE)'], [-240, 'UTC-4 (VE/CL)'], [-180, 'UTC-3 (ARG/UY/BR)'], [0, 'UTC (Londres)'], [60, 'UTC+1 (Madrid)'], [540, 'UTC+9 (Japón)']] as [number, string][];

export default function ReportsEditor({ es = true }: { es?: boolean }) {
  const L = (a: string, b: string) => (es ? a : b);
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => { fetch('/api/admin/reports').then((r) => r.json()).then((j) => setCfg(j.config)).catch(() => {}); }, []);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2600); };
  const set = (k: keyof Cfg, v: any) => setCfg((c) => (c ? { ...c, [k]: v } : c));

  async function save(action: 'save' | 'test') {
    if (!cfg) return;
    setSaving(true);
    try {
      const r = await fetch('/api/admin/reports', { method: 'POST', body: JSON.stringify({ action, config: cfg }) });
      const j = await r.json();
      if (j.ok) flash(action === 'test' ? L('Prueba enviada a tu Telegram', 'Test sent to your Telegram') : L('Guardado', 'Saved'));
      else flash(j.error || L('No se pudo', 'Failed'));
    } catch { flash(L('Error de red', 'Network error')); }
    setSaving(false);
  }

  if (!cfg) return null;
  const inp: any = { width: '100%', margin: 0, padding: '7px 9px', fontSize: 13, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--tx)' };
  const cell: any = { background: 'var(--bg2)', borderRadius: 10, padding: 12, minWidth: 0 };
  const Toggle = ({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) => (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', ...cell }}>
      <span style={{ fontSize: 13 }}>{label}</span>
      <span style={{ width: 34, height: 20, borderRadius: 10, background: on ? 'var(--green)' : 'var(--line)', position: 'relative', flex: 'none', transition: 'background .15s' }}>
        <span style={{ position: 'absolute', top: 2, [on ? 'right' : 'left']: 2, width: 16, height: 16, borderRadius: '50%', background: '#fff' } as any} />
      </span>
    </div>
  );

  return (
    <div className="card" style={{ gridColumn: '1 / -1' }}>
      <div className="row between" style={{ marginBottom: 4 }}>
        <div className="row" style={{ gap: 8 }}><OnyxIcon emoji="📊" size={16} /><h3>{L('Reporte de rendimiento (Telegram)', 'Performance report (Telegram)')}</h3></div>
        <Toggle on={cfg.enabled} onClick={() => set('enabled', !cfg.enabled)} label={cfg.enabled ? L('Activo', 'Active') : L('Apagado', 'Off')} />
      </div>
      <p className="muted" style={{ fontSize: 12.5, marginBottom: 14 }}>{L('Se envía a cada trader a SU hora local, con imagen + PDF + CSV. Edita el día, la hora y el texto.', 'Delivered to each trader at THEIR local time, with image + PDF + CSV. Edit the day, hour and text.')}</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,200px),1fr))', gap: 12, marginBottom: 12 }}>
        <div style={cell}>
          <div style={{ fontSize: 12, color: 'var(--mut)', marginBottom: 5 }}>{L('Cada', 'Every')}</div>
          <select value={cfg.day} onChange={(e) => set('day', Number(e.target.value))} style={inp}>
            {(es ? DAYS_ES : DAYS_EN).map((d, i) => <option key={i} value={i}>{d}</option>)}
          </select>
        </div>
        <div style={cell}>
          <div style={{ fontSize: 12, color: 'var(--mut)', marginBottom: 5 }}>{L('Hora local del trader', "Trader's local time")}</div>
          <select value={cfg.hour} onChange={(e) => set('hour', Number(e.target.value))} style={inp}>
            {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
          </select>
        </div>
        <div style={cell}>
          <div style={{ fontSize: 12, color: 'var(--mut)', marginBottom: 5 }}>{L('Zona por defecto', 'Default timezone')}</div>
          <select value={cfg.defaultTzMin} onChange={(e) => set('defaultTzMin', Number(e.target.value))} style={inp}>
            {TZ.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <div className="muted" style={{ fontSize: 11, marginTop: 5 }}>{L('Solo si no conocemos la del trader.', "Only if we don't know the trader's.")}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,180px),1fr))', gap: 12, marginBottom: 12 }}>
        <Toggle on={cfg.monthly} onClick={() => set('monthly', !cfg.monthly)} label={L('También el día 1 (mensual)', 'Also on the 1st (monthly)')} />
        <Toggle on={cfg.attachImage} onClick={() => set('attachImage', !cfg.attachImage)} label={L('Imagen resumen', 'Summary image')} />
        <Toggle on={cfg.attachPdf} onClick={() => set('attachPdf', !cfg.attachPdf)} label="PDF" />
        <Toggle on={cfg.attachCsv} onClick={() => set('attachCsv', !cfg.attachCsv)} label="CSV" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div style={cell}>
          <div style={{ fontSize: 12, color: 'var(--mut)', marginBottom: 5 }}>{L('Título (ES)', 'Title (ES)')}</div>
          <input value={cfg.title_es} onChange={(e) => set('title_es', e.target.value)} style={inp} />
          <div style={{ fontSize: 12, color: 'var(--mut)', margin: '10px 0 5px' }}>{L('Título (EN)', 'Title (EN)')}</div>
          <input value={cfg.title_en} onChange={(e) => set('title_en', e.target.value)} style={inp} />
        </div>
        <div style={cell}>
          <div style={{ fontSize: 12, color: 'var(--mut)', marginBottom: 5 }}>{L('Cuerpo (ES)', 'Body (ES)')}</div>
          <textarea value={cfg.body_es} onChange={(e) => set('body_es', e.target.value)} rows={4} style={{ ...inp, resize: 'vertical' }} />
          <div style={{ fontSize: 12, color: 'var(--mut)', margin: '10px 0 5px' }}>{L('Cuerpo (EN)', 'Body (EN)')}</div>
          <textarea value={cfg.body_en} onChange={(e) => set('body_en', e.target.value)} rows={4} style={{ ...inp, resize: 'vertical' }} />
        </div>
      </div>
      <div className="muted" style={{ fontSize: 11.5, marginBottom: 14 }}>{L('Variables:', 'Variables:')} <code>{'{neto} {ops} {winrate} {pf} {mejor_par} {peor_par} {nombre} {cadencia}'}</code></div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={() => save('save')} disabled={saving}>{saving ? '…' : L('Guardar', 'Save')}</button>
        <button className="btn btn-ghost" onClick={() => save('test')} disabled={saving}>{L('Enviarme una prueba ahora', 'Send me a test now')}</button>
        {toast && <span style={{ fontSize: 13, color: 'var(--green)' }}>{toast}</span>}
      </div>
    </div>
  );
}
