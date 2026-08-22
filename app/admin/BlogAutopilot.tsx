'use client';
import { useEffect, useState, type CSSProperties } from 'react';
import { toast } from '@/lib/toast';

// Interruptor moderno (pastilla iluminada).
function Switch({ on, accent = '#34e2a0' }: { on: boolean; accent?: string }) {
  return (
    <span style={{ width: 42, height: 24, borderRadius: 999, flex: 'none', position: 'relative', transition: 'all .18s',
      background: on ? accent : 'var(--line)', boxShadow: on ? `0 0 14px -2px ${accent}` : 'none' }}>
      <span style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .18s', boxShadow: '0 2px 5px rgba(0,0,0,.35)' }} />
    </span>
  );
}
// Tarjeta-interruptor iluminada: icono + título + descripción + switch.
function ToggleCard({ on, onToggle, accent, icon, title, desc }: { on: boolean; onToggle: () => void; accent: string; icon: string; title: string; desc: string }) {
  return (
    <div onClick={onToggle} style={{ cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'flex-start', padding: 14, borderRadius: 14,
      background: on ? `linear-gradient(160deg, ${accent}1f, var(--bg2) 70%)` : 'var(--bg2)',
      border: `1px solid ${on ? accent + '66' : 'var(--line)'}`,
      boxShadow: on ? `0 0 0 1px ${accent}22, 0 12px 28px -16px ${accent}` : 'none', transition: 'all .18s' }}>
      <span style={{ width: 34, height: 34, borderRadius: 10, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, background: `${accent}22`, border: `1px solid ${accent}55` }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 3 }}>{title}</div>
        <div className="muted" style={{ fontSize: 12, lineHeight: 1.45 }}>{desc}</div>
      </div>
      <Switch on={on} accent={accent} />
    </div>
  );
}
// Fila-interruptor compacta (dentro de otra tarjeta).
function ToggleRow({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <div onClick={onToggle} style={{ cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 13 }}>{label}</span>
      <Switch on={on} accent="#c584ff" />
    </div>
  );
}

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
  const [gen, setGen] = useState({ running: false, done: 0, total: 0 });

  async function load() {
    try {
      const r = await fetch('/api/admin/blog/autopilot'); const j = await r.json();
      if (j.settings) { setCfg(j.settings); setTopicsText((j.settings.topics || []).join('\n')); }
      setSlots(j.scheduled || []);
    } catch {}
  }
  // Refresco ligero: SOLO actualiza las fechas (no pisa lo que estás escribiendo).
  async function refreshSlots() {
    try { const r = await fetch('/api/admin/blog/autopilot'); const j = await r.json(); if (Array.isArray(j.scheduled)) setSlots(j.scheduled); } catch {}
  }
  useEffect(() => { load(); }, []);
  // Mientras el panel esté abierto, refresca el progreso cada 10s (para ver avanzar
  // al cron aunque no estés generando, y que sobreviva a un refresh de página).
  useEffect(() => { if (!open) return; const iv = setInterval(refreshSlots, 10000); return () => clearInterval(iv); }, [open]);

  async function save(patch: Partial<Cfg>) {
    if (!cfg) return;
    const next = { ...cfg, ...patch, topics: topicsText.split('\n').map((s) => s.trim()).filter(Boolean) };
    setCfg(next);
    // tzOffset: para que la "hora" se interprete en TU zona horaria, no en UTC.
    try { await fetch('/api/admin/blog/autopilot', { method: 'PATCH', body: JSON.stringify({ ...next, tzOffset: new Date().getTimezoneOffset() }) }); } catch {}
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
  async function expandTopics() {
    setBusy('topics');
    await save({});   // guarda la lista actual antes de ampliar (para no duplicar)
    try {
      const r = await fetch('/api/admin/blog/autopilot', { method: 'POST', body: JSON.stringify({ action: 'topics', count: 60 }) });
      const j = await r.json();
      if (j.ok) { setTopicsText((j.topics || []).join('\n')); if (cfg) setCfg({ ...cfg, topics: j.topics || [] }); toast(es ? `🧠 ${j.added} temas nuevos añadidos.` : `🧠 ${j.added} new topics added.`, 'ok'); }
      else toast((es ? 'La IA no pudo sugerir temas.' : 'AI could not suggest topics.') + (j.detail ? ` · ${j.detail}` : ''));
    } catch { toast(es ? 'No se pudo.' : 'Could not.'); }
    setBusy('');
  }
  // Reordena TODAS las fechas en secuencia limpia día-sí/día-no desde mañana.
  async function normalize() {
    setBusy('norm');
    try {
      const r = await fetch('/api/admin/blog/autopilot', { method: 'POST', body: JSON.stringify({ action: 'normalize' }) });
      const j = await r.json();
      if (j.ok) { toast(es ? `📅 ${j.count} fechas reordenadas (día sí, día no).` : `📅 ${j.count} dates reordered (every other day).`, 'ok'); await load(); onChanged?.(); }
      else toast(es ? 'No se pudo reprogramar.' : 'Could not reschedule.');
    } catch { toast(es ? 'No se pudo reprogramar.' : 'Could not reschedule.'); }
    setBusy('');
  }
  const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));
  // Genera TODAS las fechas vacías, una por una (bucle en el navegador con barra de
  // progreso). Tolerante a límites de la API: pausa entre cada una y hace backoff
  // (espera creciente) si falla, en vez de rendirse a las pocas.
  async function fillAll() {
    const total = slots.filter((s) => !s.ready).length;
    if (!total) { toast(es ? 'No hay fechas vacías. Planifica el mes primero.' : 'No empty dates. Plan the month first.'); return; }
    setGen({ running: true, done: 0, total });
    let done = 0, fails = 0, lastErr = '';
    for (let i = 0; i < total * 4 + 40; i++) {
      let ok = false, remaining = -1; let rateLimited = false;
      try {
        const r = await fetch('/api/admin/blog/autopilot', { method: 'POST', body: JSON.stringify({ action: 'fill', all: true }) });
        const j = await r.json();
        if (j.ok && j.filled) { done++; fails = 0; ok = true; remaining = j.remaining ?? -1; setGen({ running: true, done, total }); refreshSlots(); }
        else { fails++; lastErr = j.errors?.[0] || j.error || ''; rateLimited = /429|rate|limit|overload|529/i.test(lastErr); }
      } catch { fails++; lastErr = 'red'; }
      if (ok && remaining === 0) break;                          // ya no queda nada vacío
      // Solo se rinde tras MUCHOS fallos seguidos (los límites de la nube se resuelven
      // esperando ~1 min). Antes de eso, sigue reintentando con esperas crecientes.
      if (fails >= 20) { toast((es ? 'La IA se detuvo (posible límite de la API). Espera unos minutos y pulsa Reanudar; retoma donde quedó.' : 'AI stopped (possible API limit). Wait a few minutes and press Resume; it picks up where it left off.') + (lastErr ? ` · ${lastErr}` : '')); break; }
      // Ritmo: pausa base entre éxitos para no saturar el límite por minuto; backoff
      // largo si hay límite de tasa (hasta 60s) para dejar que la ventana se reponga.
      const wait = fails === 0 ? 2500 : (rateLimited ? Math.min(60000, 15000 * fails) : Math.min(20000, 3000 * fails));
      await sleep(wait);
    }
    setGen({ running: false, done: 0, total: 0 });
    if (done) toast(es ? `✅ ${done} artículo(s) generado(s).` : `✅ ${done} article(s) generated.`, 'ok');
    await load(); onChanged?.();
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

      {open && (() => {
        const nTopics = topicsText.split('\n').map((s) => s.trim()).filter(Boolean).length;
        const runwayMonths = Math.round((nTopics * (cfg.everyNDays || 2)) / 30 * 10) / 10;
        const glow = (c: string) => ({ background: 'var(--bg2)', border: `1px solid ${c}40`, borderRadius: 14, padding: 14, boxShadow: `0 0 0 1px ${c}14, 0 10px 26px -14px ${c}, inset 0 1px 0 rgba(255,255,255,.03)` } as const);
        const fieldL: CSSProperties = { fontSize: 11.5, color: 'var(--mut)', display: 'block', marginBottom: 5, fontWeight: 600, letterSpacing: .2 };
        return (
        <div style={{ padding: 14, borderTop: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Interruptores como tarjetas iluminadas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 10 }}>
            <ToggleCard on={cfg.enabled} onToggle={() => save({ enabled: !cfg.enabled })} accent="#34e2a0" icon="⚡"
              title={lbl('Generar y publicar automático', 'Auto-generate and publish')}
              desc={lbl('El cron escribe y publica un artículo cada 2 días, solo.', 'The cron writes and publishes an article every 2 days, automatically.')} />
            <ToggleCard on={cfg.autoReplenish} onToggle={() => save({ autoReplenish: !cfg.autoReplenish })} accent="#7c8cff" icon="♾️"
              title={lbl('Reponer el mes solo', 'Auto-refill the month')}
              desc={lbl('Cuando quedan pocas fechas, planifica el siguiente lote. Nunca se detiene.', 'When few dates remain, it plans the next batch. It never stops.')} />
          </div>

          {/* Ajustes de cadencia */}
          <div style={glow('#5ecfff')}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}><span>🗓️</span>{lbl('Ritmo de publicación', 'Publishing rhythm')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>
              <div><label style={fieldL}>{lbl('Cadencia', 'Cadence')}</label>
                <select value={cfg.everyNDays} onChange={(e) => save({ everyNDays: Number(e.target.value) })} style={{ margin: 0, fontSize: 13, width: '100%' }}>
                  <option value={1}>{lbl('Todos los días', 'Every day')}</option>
                  <option value={2}>{lbl('Día sí, día no', 'Every other day')}</option>
                  <option value={3}>{lbl('Cada 3 días', 'Every 3 days')}</option>
                  <option value={7}>{lbl('Una vez por semana', 'Once a week')}</option>
                </select>
              </div>
              <div><label style={fieldL}>{lbl('Hora del día', 'Hour of day')}</label>
                <input type="number" min={0} max={23} value={cfg.hour} onChange={(e) => save({ hour: Number(e.target.value) })} style={{ margin: 0, width: '100%', fontSize: 13 }} />
              </div>
              <div><label style={fieldL}>{lbl('Fechas por lote', 'Dates per batch')}</label>
                <input type="number" min={1} max={40} value={cfg.perMonth} onChange={(e) => save({ perMonth: Number(e.target.value) })} style={{ margin: 0, width: '100%', fontSize: 13 }} />
              </div>
            </div>
          </div>

          {/* Temas / fuente de contenido */}
          <div style={glow('#c584ff')}>
            <div className="row between" style={{ marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}><span>🧠</span>{lbl('Temas de los artículos', 'Article topics')}</div>
              <span style={{ fontSize: 11.5, color: runwayMonths >= 12 ? 'var(--soft-green)' : 'var(--amber)', background: runwayMonths >= 12 ? 'rgba(52,226,160,.14)' : 'rgba(255,192,77,.14)', border: '1px solid ' + (runwayMonths >= 12 ? 'rgba(52,226,160,.4)' : 'rgba(255,192,77,.4)'), padding: '3px 10px', borderRadius: 999, fontWeight: 600 }}>
                {nTopics} {lbl('temas · ~', 'topics · ~')}{runwayMonths} {lbl('meses', 'months')}
              </span>
            </div>
            <ToggleRow on={cfg.useKeywords} onToggle={() => save({ useKeywords: !cfg.useKeywords })}
              label={lbl('Usar también mis keywords SEO (rotación automática)', 'Also use my SEO keywords (auto rotation)')} />
            <div className="muted" style={{ fontSize: 12, margin: '10px 0 5px' }}>{lbl('Lista de temas (uno por línea). Se combinan con las keywords y se eligen al azar:', 'Topic list (one per line). Combined with keywords and picked at random:')}</div>
            <textarea value={topicsText} onChange={(e) => setTopicsText(e.target.value)} onBlur={() => save({})} rows={4}
              placeholder={lbl('Ej.\nCómo pasar un reto de fondeo\nErrores de gestión de riesgo\nQué es el drawdown', 'e.g.\nHow to pass a funded challenge\nRisk management mistakes\nWhat is drawdown')}
              style={{ width: '100%', margin: 0, fontSize: 13 }} />
            <button className="btn btn-ghost" style={{ color: 'var(--brand)', fontSize: 12.5, marginTop: 8 }} onClick={expandTopics} disabled={busy === 'topics'}
              title={lbl('Onyx AI propone 60 temas nuevos de tu nicho y los añade (sin repetir)', 'Onyx AI proposes 60 fresh topics for your niche and adds them (no repeats)')}>
              {busy === 'topics' ? '…' : `🧠 ${lbl('Ampliar temas con IA (+60)', 'Expand topics with AI (+60)')}`}
            </button>
          </div>

          {/* Acciones principales */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={planMonth} disabled={busy === 'plan' || gen.running} style={{ boxShadow: '0 8px 20px -8px var(--brand)' }}>{busy === 'plan' ? '…' : `📅 ${lbl('Planificar el mes', 'Plan the month')}`}</button>
            <button className="btn btn-primary" onClick={fillAll} disabled={gen.running || pending === 0} title={lbl('Genera YA el contenido de todas las fechas vacías (una por una)', 'Generate ALL empty dates now (one by one)')} style={{ background: 'linear-gradient(135deg,#7c8cff,#34e2a0)', color: '#0b0d17', boxShadow: '0 8px 20px -8px #34e2a0' }}>
              {gen.running ? `⏳ ${gen.done}/${gen.total}` : (pending > 0 && slots.some((s) => s.ready) ? `⚡ ${lbl('Reanudar', 'Resume')} (${pending})` : `⚡ ${lbl('Generar todas ahora', 'Generate all now')}`)}
            </button>
            <button className="btn btn-ghost" onClick={fillNow} disabled={busy === 'fill' || gen.running} title={lbl('Genera solo la próxima fecha pendiente (prueba)', 'Generate just the next pending date (test)')}>{busy === 'fill' ? '…' : `✨ ${lbl('Solo la próxima', 'Just the next')}`}</button>
            {slots.length > 0 && <button className="btn btn-ghost" onClick={normalize} disabled={busy === 'norm' || gen.running} title={lbl('Reordena TODAS las fechas en secuencia día sí/día no desde mañana (arregla huecos y horas)', 'Reorder ALL dates into a clean every-other-day sequence from tomorrow (fixes gaps and times)')}>{busy === 'norm' ? '…' : `🔁 ${lbl('Reprogramar día sí/día no', 'Reschedule every other day')}`}</button>}
          </div>

          {/* Barra de progreso PERSISTENTE: se calcula desde la base (listos/total),
              así sobrevive a un refresh y muestra al cron avanzar aunque no generes. */}
          {slots.length > 0 && (() => {
            const ready = slots.filter((s) => s.ready).length;
            const pct = Math.round((ready / slots.length) * 100);
            return (
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 12, padding: 12 }}>
                <div className="row between" style={{ marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600 }}>{gen.running ? `⏳ ${lbl('Generando…', 'Generating…')}` : (pct === 100 ? `✅ ${lbl('Todo generado', 'All generated')}` : lbl('Progreso de generación', 'Generation progress'))}</span>
                  <span className="muted" style={{ fontSize: 12 }}>{ready}/{slots.length} · {pct}%</span>
                </div>
                <div style={{ height: 8, borderRadius: 999, background: 'var(--line)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#7c8cff,#34e2a0)', boxShadow: pct > 0 ? '0 0 12px -2px #34e2a0' : 'none', transition: 'width .3s' }} />
                </div>
                {pending > 0 && !gen.running && <div className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>{lbl('Puedes cerrar esta pestaña: el cron sigue generando 1 cada pocas horas. O pulsa "Reanudar" para terminarlas todas ahora.', 'You can close this tab: the cron keeps generating 1 every few hours. Or press "Resume" to finish them all now.')}</div>}
              </div>
            );
          })()}

          {/* Calendario del mes lleno */}
          <div style={glow('#34e2a0')}>
            <div className="row between" style={{ marginBottom: 4, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}><span>📅</span>{lbl('Calendario del mes', 'Month calendar')}</div>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 11.5, color: 'var(--mut)' }}><i style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--soft-green)' }} /> {lbl('Listo', 'Ready')}</span>
                <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 11.5, color: 'var(--mut)' }}><i style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--amber)' }} /> {lbl('Programado (se genera solo)', 'Scheduled (auto-generates)')}</span>
              </div>
            </div>
            {months.map(({ y, m }) => (<MonthGrid key={`${y}-${m}`} y={y} m={m} marks={marks} es={es} />))}
          </div>
        </div>
        );
      })()}
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
