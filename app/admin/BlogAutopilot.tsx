'use client';
import { useEffect, useState } from 'react';
import { toast } from '@/lib/toast';

// Piloto automático del blog: llena el calendario con las fechas del mes (día sí,
// día no) y el cron genera cada artículo justo antes de publicarlo.
type Slot = { id: string; title: string; publish_at: string; ready: boolean };
type Cfg = { enabled: boolean; everyNDays: number; hour: number; perMonth: number; useKeywords: boolean; topics: string[]; autoReplenish: boolean };

const ymd = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const MONTHS_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function BlogAutopilot({ es, onChanged }: { es: boolean; onChanged?: () => void }) {
  const [open, setOpen] = useState(false);
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [topicsText, setTopicsText] = useState('');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [busy, setBusy] = useState('');

  async function load() {
    try {
      const r = await fetch('/api/admin/blog/autopilot'); const j = await r.json();
      if (j.settings) { setCfg(j.settings); setTopicsText((j.settings.topics || []).join('\n')); }
      setSlots(j.scheduled || []);
    } catch {}
  }
  useEffect(() => { load(); }, []);

  async function save(patch: Partial<Cfg>) {
    if (!cfg) return;
    const next = { ...cfg, ...patch, topics: topicsText.split('\n').map((s) => s.trim()).filter(Boolean) };
    setCfg(next);
    try { await fetch('/api/admin/blog/autopilot', { method: 'PATCH', body: JSON.stringify(next) }); } catch {}
  }
  async function planMonth() {
    setBusy('plan');
    await save({});   // asegura que la lista de temas quede guardada antes de planificar
    try {
      const r = await fetch('/api/admin/blog/autopilot', { method: 'POST', body: JSON.stringify({ action: 'plan' }) });
      const j = await r.json();
      if (j.ok) { toast(es ? `📅 ${j.created.length} fechas añadidas al calendario.` : `📅 ${j.created.length} dates added to the calendar.`, 'ok'); await load(); onChanged?.(); }
      else if (j.code === 'sin_temas') toast(es ? 'Añade temas (lista) o activa las keywords primero.' : 'Add topics (list) or enable keywords first.');
      else toast(es ? 'No se pudo planificar.' : 'Could not plan.');
    } catch { toast(es ? 'No se pudo planificar.' : 'Could not plan.'); }
    setBusy('');
  }
  async function fillNow() {
    setBusy('fill');
    try {
      const r = await fetch('/api/admin/blog/autopilot', { method: 'POST', body: JSON.stringify({ action: 'fill' }) });
      const j = await r.json();
      if (j.ok && j.filled) { toast(es ? '✨ Próximo artículo generado.' : '✨ Next article generated.', 'ok'); await load(); onChanged?.(); }
      else if (j.ok && !j.tried) toast(es ? 'No hay fechas pendientes por generar ahora.' : 'No pending dates to generate right now.', 'ok');
      else toast((es ? 'La IA no pudo generar.' : 'AI could not generate.') + (j.errors?.[0] ? ` · ${j.errors[0]}` : ''));
    } catch { toast(es ? 'No se pudo generar.' : 'Could not generate.'); }
    setBusy('');
  }

  if (!cfg) return null;
  const marks = new Map<string, boolean>();   // fecha → ready?
  for (const s of slots) marks.set(ymd(s.publish_at), s.ready);
  // Meses a mostrar: los que contienen fechas programadas (o el actual si no hay).
  const monthsSet = new Set<string>();
  for (const s of slots) { const d = new Date(s.publish_at); monthsSet.add(`${d.getFullYear()}-${d.getMonth()}`); }
  if (!monthsSet.size) { const d = new Date(); monthsSet.add(`${d.getFullYear()}-${d.getMonth()}`); }
  const months = [...monthsSet].map((k) => { const [y, m] = k.split('-').map(Number); return { y, m }; })
    .sort((a, b) => a.y - b.y || a.m - b.m).slice(0, 3);

  const pending = slots.filter((s) => !s.ready).length;
  const lbl = (a: string, b: string) => (es ? a : b);

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 12 }}>
      <div className="row between" style={{ padding: '12px 14px', cursor: 'pointer', flexWrap: 'wrap', gap: 8 }} onClick={() => setOpen((o) => !o)}>
        <div className="row" style={{ gap: 10, alignItems: 'center', minWidth: 0 }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, flex: 'none', background: 'linear-gradient(135deg,#7c8cff,#34e2a0)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0b0d17', fontWeight: 800 }}>⚡</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{lbl('Piloto automático del blog', 'Blog autopilot')}</div>
            <div className="muted" style={{ fontSize: 12 }}>{lbl('Llena el mes de artículos, un día sí y otro no, y se generan solos.', 'Fill the month with articles, every other day, generated automatically.')}</div>
          </div>
        </div>
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          <span className="pill" style={{ fontSize: 11, color: cfg.enabled ? 'var(--soft-green)' : 'var(--mut)', background: cfg.enabled ? 'rgba(52,226,160,.15)' : 'var(--card2)' }}>{cfg.enabled ? (lbl('Activo', 'On')) : (lbl('Apagado', 'Off'))}</span>
          <span style={{ color: 'var(--mut)' }}>{open ? '▴' : '▾'}</span>
        </div>
      </div>

      {open && (
        <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--line)' }}>
          {/* Ajustes */}
          <div className="row" style={{ gap: 14, flexWrap: 'wrap', alignItems: 'flex-end', margin: '12px 0' }}>
            <label className="row" style={{ gap: 8, alignItems: 'center', cursor: 'pointer' }}>
              <input type="checkbox" checked={cfg.enabled} onChange={(e) => save({ enabled: e.target.checked })} />
              <span style={{ fontSize: 13 }}>{lbl('Generar y publicar automático', 'Auto-generate and publish')}</span>
            </label>
            <label className="row" style={{ gap: 8, alignItems: 'center', cursor: 'pointer' }}>
              <input type="checkbox" checked={cfg.autoReplenish} onChange={(e) => save({ autoReplenish: e.target.checked })} />
              <span style={{ fontSize: 13 }}>{lbl('Reponer el mes solo al agotarse', 'Auto-refill the month when it runs low')}</span>
            </label>
          </div>
          <div className="row" style={{ gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <div><div className="muted" style={{ fontSize: 12 }}>{lbl('Cadencia', 'Cadence')}</div>
              <select value={cfg.everyNDays} onChange={(e) => save({ everyNDays: Number(e.target.value) })} style={{ margin: '4px 0 0', fontSize: 13 }}>
                <option value={1}>{lbl('Todos los días', 'Every day')}</option>
                <option value={2}>{lbl('Día sí, día no', 'Every other day')}</option>
                <option value={3}>{lbl('Cada 3 días', 'Every 3 days')}</option>
                <option value={7}>{lbl('Una vez por semana', 'Once a week')}</option>
              </select>
            </div>
            <div><div className="muted" style={{ fontSize: 12 }}>{lbl('Hora', 'Hour')}</div>
              <input type="number" min={0} max={23} value={cfg.hour} onChange={(e) => save({ hour: Number(e.target.value) })} style={{ margin: '4px 0 0', width: 80, fontSize: 13 }} />
            </div>
            <div><div className="muted" style={{ fontSize: 12 }}>{lbl('Fechas por lote', 'Dates per batch')}</div>
              <input type="number" min={1} max={40} value={cfg.perMonth} onChange={(e) => save({ perMonth: Number(e.target.value) })} style={{ margin: '4px 0 0', width: 80, fontSize: 13 }} />
            </div>
          </div>

          {/* Fuente de temas */}
          <label className="row" style={{ gap: 8, alignItems: 'center', cursor: 'pointer', marginBottom: 6 }}>
            <input type="checkbox" checked={cfg.useKeywords} onChange={(e) => save({ useKeywords: e.target.checked })} />
            <span style={{ fontSize: 13 }}>{lbl('Usar también mis keywords SEO (rotación)', 'Also use my SEO keywords (rotation)')}</span>
          </label>
          <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{lbl('Lista de temas (uno por línea). Se combinan con las keywords y se eligen al azar:', 'Topic list (one per line). Combined with keywords and picked at random:')}</div>
          <textarea value={topicsText} onChange={(e) => setTopicsText(e.target.value)} onBlur={() => save({})} rows={4}
            placeholder={lbl('Ej.\nCómo pasar un reto de fondeo\nErrores de gestión de riesgo\nQué es el drawdown', 'e.g.\nHow to pass a funded challenge\nRisk management mistakes\nWhat is drawdown')}
            style={{ width: '100%', margin: 0, fontSize: 13 }} />

          {/* Acciones */}
          <div className="row" style={{ gap: 8, margin: '12px 0', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={planMonth} disabled={busy === 'plan'}>{busy === 'plan' ? '…' : `📅 ${lbl('Planificar el mes', 'Plan the month')}`}</button>
            <button className="btn btn-ghost" onClick={fillNow} disabled={busy === 'fill'} title={lbl('Genera ahora el contenido de la próxima fecha pendiente (prueba)', 'Generate the next pending date now (test)')}>{busy === 'fill' ? '…' : `✨ ${lbl('Generar la próxima ahora', 'Generate next now')}`}</button>
          </div>

          {pending > 0 && <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>⏳ {pending} {lbl('fecha(s) esperando a que el cron genere su contenido.', 'date(s) waiting for the cron to generate content.')}</div>}

          {/* Calendario del mes lleno */}
          {months.map(({ y, m }) => (
            <MonthGrid key={`${y}-${m}`} y={y} m={m} marks={marks} es={es} />
          ))}
          <div className="row" style={{ gap: 14, marginTop: 6, flexWrap: 'wrap' }}>
            <span className="row" style={{ gap: 6, fontSize: 11.5, color: 'var(--mut)' }}><i style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--soft-green)', display: 'inline-block' }} /> {lbl('Listo', 'Ready')}</span>
            <span className="row" style={{ gap: 6, fontSize: 11.5, color: 'var(--mut)' }}><i style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--amber)', display: 'inline-block' }} /> {lbl('Programado (se genera solo)', 'Scheduled (auto-generates)')}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function MonthGrid({ y, m, marks, es }: { y: number; m: number; marks: Map<string, boolean>; es: boolean }) {
  const first = new Date(y, m, 1);
  const startDow = (first.getDay() + 6) % 7;   // lunes primero
  const days = new Date(y, m + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  const dow = es ? ['L', 'M', 'X', 'J', 'V', 'S', 'D'] : ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const title = `${(es ? MONTHS_ES : MONTHS_EN)[m]} ${y}`;
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 12, padding: 10, marginTop: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, textTransform: 'capitalize' }}>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
        {dow.map((d, i) => <div key={'h' + i} style={{ textAlign: 'center', fontSize: 10.5, color: 'var(--mut)' }}>{d}</div>)}
        {cells.map((d, i) => {
          if (d == null) return <div key={i} />;
          const key = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const has = marks.has(key);
          const ready = marks.get(key);
          return (
            <div key={i} style={{ aspectRatio: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: 8, fontSize: 12,
              background: has ? (ready ? 'rgba(52,226,160,.16)' : 'rgba(255,192,77,.16)') : 'transparent',
              border: has ? `1px solid ${ready ? 'rgba(52,226,160,.5)' : 'rgba(255,192,77,.5)'}` : '1px solid transparent',
              color: has ? 'var(--tx)' : 'var(--mut)', fontWeight: has ? 700 : 400 }}>
              {d}
              {has && <span style={{ width: 5, height: 5, borderRadius: '50%', marginTop: 2, background: ready ? 'var(--soft-green)' : 'var(--amber)' }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
