'use client';
import { toast, confirmDialog } from '@/lib/toast';
import { useEffect, useState } from 'react';

// Panel de becas del mentor (Fase 1): conceder directa o por código, ver activas
// con su cuenta atrás, y revocar. Cobertura completa; la parcial llega después.
type L = (es: string, en: string) => string;

const inp: any = { width: '100%', margin: 0, fontSize: 13, padding: '7px 9px' };
const lbl: any = { fontSize: 12, color: 'var(--mut)', display: 'block', marginBottom: 3 };
const money = (c: number) => '$' + (Math.round(c) / 100).toLocaleString('en-US', { minimumFractionDigits: 0 });

function daysLeft(ends?: string | null): string {
  if (!ends) return '∞';
  const ms = new Date(ends).getTime() - Date.now();
  if (ms <= 0) return '—';
  const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000);
  return d > 0 ? `${d}d` : `${h}h`;
}

export default function ScholarshipPanel({ L }: { L: L }) {
  const [d, setD] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  // formulario
  const [kind, setKind] = useState<'direct' | 'code'>('direct');
  const [email, setEmail] = useState('');
  const [seats, setSeats] = useState(10);
  const [code, setCode] = useState('');
  const [scope, setScope] = useState<'all' | 'modules'>('all');
  const [mods, setMods] = useState<string[]>([]);
  const [productId, setProductId] = useState('');
  const [days, setDays] = useState(90);
  const [lifetime, setLifetime] = useState(false);
  const [reason, setReason] = useState('low_income');
  const [appDays, setAppDays] = useState(90);   // días al aprobar una solicitud
  const [capInput, setCapInput] = useState<number | null>(null);   // cupo (null = usa el del servidor)

  async function load() { try { const r = await fetch('/api/academy/scholarships'); const j = await r.json(); if (!j.error) setD(j); } catch {} }
  useEffect(() => { load(); }, []);

  async function create() {
    setBusy(true); setMsg('');
    try {
      const body: any = { action: 'create', kind, coverage: 'full', scope, modules: mods, product_id: productId || null, reason, lifetime, days: lifetime ? 0 : days };
      if (kind === 'direct') body.email = email; else { body.seats = seats; if (code) body.code = code; }
      const r = await fetch('/api/academy/scholarships', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) setMsg(j.error || 'Error'); else { setMsg(L('Beca creada ✓', 'Scholarship created ✓')); setEmail(''); setCode(''); await load(); }
    } finally { setBusy(false); }
  }
  async function revoke(id: string) {
    if (!(await confirmDialog(L('¿Revocar esta beca? El alumno perderá el acceso.', 'Revoke this scholarship? The student loses access.')))) return;
    await fetch('/api/academy/scholarships', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'revoke', id }) });
    await load();
  }
  const copy = (t: string) => { try { navigator.clipboard.writeText(t); setMsg(L('Código copiado ✓', 'Code copied ✓')); } catch {} };
  async function saveCap() {
    const cap = capInput ?? d.cap ?? 0;
    await fetch('/api/academy/scholarships', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'setcap', cap }) });
    setMsg(L('Cupo guardado ✓', 'Cap saved ✓')); await load();
  }
  async function doRaffle() {
    const n = Number(prompt(L('¿Cuántas becas sortear entre las solicitudes pendientes?', 'How many scholarships to raffle among pending requests?'), '1')) || 0;
    if (n < 1) return;
    if (!(await confirmDialog(L(`Se sortearán ${n} beca(s) al azar entre los solicitantes y se les concederá (${appDays} días). ¿Continuar?`, `${n} scholarship(s) will be raffled among applicants and granted (${appDays} days). Continue?`)))) return;
    await fetch('/api/academy/scholarships', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'raffle', count: n, days: appDays }) });
    await load();
  }
  async function decide(id: string, action: 'approve' | 'deny') {
    const body: any = { action, id, days: appDays };
    if (action === 'deny') { const note = prompt(L('Motivo (opcional) para el alumno:', 'Reason (optional) for the student:')) || ''; body.note = note; }
    await fetch('/api/academy/scholarships', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    await load();
  }

  if (!d) return null;
  const list: any[] = d.scholarships || [];
  const active = list.filter((s) => s.status === 'active' && (!s.ends_at || new Date(s.ends_at).getTime() > Date.now()));
  const modName = (id: string) => (d.modules || []).find((m: any) => m.id === id)?.title || id;
  const scopeLabel = (s: any) => s.scope === 'all' ? L('Toda la academia', 'Whole academy') : (s.modules || []).map(modName).join(', ') || L('Módulos', 'Modules');

  return (
    <div>
      <h3 style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 }}>🎓 {L('Becas', 'Scholarships')}</h3>
      <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>{L('Concede acceso gratis a alumnos con pocos recursos o por sorteo. Al vencer, pierden el acceso y se les invita a suscribirse.', 'Grant free access to students with few resources or via raffle. When it ends, they lose access and are invited to subscribe.')}</p>

      {/* Resumen */}
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <span className="pill green">{d.report?.activeCount ?? 0} {L('becas activas', 'active')}</span>
        <span className="pill">{d.report?.codeCount ?? 0} {L('códigos', 'codes')}</span>
        <span className="pill">{d.report?.expiredCount ?? 0} {L('vencidas', 'expired')}</span>
        {(d.report?.givenCents ?? 0) > 0 && <span className="pill" style={{ color: 'var(--soft-brand)' }}>{L('valor regalado', 'value given')}: {money(d.report.givenCents)}</span>}
        {(d.conversion?.expired ?? 0) > 0 && <span className="pill" style={{ color: 'var(--green)' }}>{L('conversión', 'conversion')}: {d.conversion.converted}/{d.conversion.expired} ({d.conversion.rate}%)</span>}
      </div>

      {/* Cupo / presupuesto */}
      <div className="card" style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13 }}>{L('Tope de becas completas activas', 'Cap of active full scholarships')}</span>
        <input type="number" min={0} value={capInput ?? d.cap ?? 0} onChange={(e) => setCapInput(Number(e.target.value))} style={{ ...inp, width: 90 }} />
        <span className="muted" style={{ fontSize: 12 }}>{L('(0 = sin tope)', '(0 = no cap)')}</span>
        <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={saveCap}>{L('Guardar cupo', 'Save cap')}</button>
      </div>

      {/* Solicitudes pendientes */}
      {(d.apps || []).length > 0 && (
        <div className="card" style={{ marginBottom: 14, border: '1px solid var(--amber)' }}>
          <div className="row between" style={{ alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700 }}>📝 {L('Solicitudes de beca', 'Scholarship requests')} · {(d.apps || []).length}</div>
            <div className="row" style={{ gap: 8, alignItems: 'center' }}>
              <label style={{ fontSize: 12, color: 'var(--mut)', display: 'inline-flex', gap: 6, alignItems: 'center' }}>{L('Al aprobar, dar', 'On approve, grant')}
                <input type="number" min={1} value={appDays} onChange={(e) => setAppDays(Number(e.target.value))} style={{ ...inp, width: 70, padding: '5px 7px' }} /> {L('días', 'days')}
              </label>
              <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={doRaffle}>🎲 {L('Sortear', 'Raffle')}</button>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(d.apps || []).map((a: any) => (
              <div key={a.id} style={{ border: '1px solid var(--line)', borderRadius: 9, padding: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{a.email || L('Alumno', 'Student')}</div>
                {a.message && <div className="muted" style={{ fontSize: 12, margin: '3px 0 8px', lineHeight: 1.4 }}>“{a.message}”</div>}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn" style={{ fontSize: 12, background: 'color-mix(in srgb,var(--green) 18%,transparent)', color: 'var(--green)', border: 'none' }} onClick={() => decide(a.id, 'approve')}>{L('Aprobar', 'Approve')}</button>
                  <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => decide(a.id, 'deny')}>{L('Rechazar', 'Deny')}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Crear */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 10 }}>{L('Nueva beca', 'New scholarship')}</div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 11 }}>
          {([['direct', L('👤 Asignar a alumno', '👤 Assign to student')], ['code', L('🔗 Código/enlace', '🔗 Code/link')]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setKind(k)} className="btn" style={{ padding: '5px 12px', fontSize: 12.5, border: '1px solid ' + (kind === k ? 'var(--brand)' : 'var(--line)'), background: kind === k ? 'color-mix(in srgb,var(--brand) 18%,transparent)' : 'transparent' }}>{l}</button>
          ))}
        </div>

        {kind === 'direct' ? (
          <div style={{ marginBottom: 11 }}><span style={lbl}>{L('Correo del alumno', 'Student email')}</span><input value={email} onChange={(e) => setEmail(e.target.value)} style={inp} placeholder="alumno@correo.com" /></div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 10, marginBottom: 11 }}>
            <div><span style={lbl}>{L('Código (opcional)', 'Code (optional)')}</span><input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} style={inp} placeholder={L('se genera solo', 'auto-generated')} /></div>
            <div><span style={lbl}>{L('Plazas', 'Seats')}</span><input type="number" min={1} value={seats} onChange={(e) => setSeats(Number(e.target.value))} style={inp} /></div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 11 }}>
          <div><span style={lbl}>{L('Alcance', 'Scope')}</span>
            <select value={scope} onChange={(e) => setScope(e.target.value as any)} style={inp}>
              <option value="all">{L('Toda la academia', 'Whole academy')}</option>
              <option value="modules">{L('Módulos concretos', 'Specific modules')}</option>
            </select>
          </div>
          <div><span style={lbl}>{L('Nivel de referencia (opcional)', 'Reference tier (optional)')}</span>
            <select value={productId} onChange={(e) => setProductId(e.target.value)} style={inp}>
              <option value="">—</option>
              {(d.products || []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>

        {scope === 'modules' && (
          <div style={{ marginBottom: 11 }}>
            <span style={lbl}>{L('Elige los módulos', 'Pick modules')}</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {(d.modules || []).map((m: any) => {
                const on = mods.includes(m.id);
                return <button key={m.id} onClick={() => setMods((s) => on ? s.filter((x) => x !== m.id) : [...s, m.id])} className="btn" style={{ padding: '4px 10px', fontSize: 12, border: '1px solid ' + (on ? 'var(--brand)' : 'var(--line)'), background: on ? 'color-mix(in srgb,var(--brand) 18%,transparent)' : 'transparent' }}>{m.title}</button>;
              })}
              {!(d.modules || []).length && <span className="muted" style={{ fontSize: 12 }}>{L('Aún no tienes módulos.', 'No modules yet.')}</span>}
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 11 }}>
          <div><span style={lbl}>{L('Duración (días)', 'Duration (days)')}</span>
            <input type="number" min={1} value={days} onChange={(e) => setDays(Number(e.target.value))} disabled={lifetime} style={{ ...inp, opacity: lifetime ? .5 : 1 }} />
            <label style={{ fontSize: 12, color: 'var(--mut)', display: 'inline-flex', gap: 6, marginTop: 6, alignItems: 'center' }}><input type="checkbox" checked={lifetime} onChange={(e) => setLifetime(e.target.checked)} /> {L('De por vida', 'Lifetime')}</label>
          </div>
          <div><span style={lbl}>{L('Motivo', 'Reason')}</span>
            <select value={reason} onChange={(e) => setReason(e.target.value)} style={inp}>
              <option value="low_income">{L('Pocos recursos', 'Low income')}</option>
              <option value="raffle">{L('Sorteo', 'Raffle')}</option>
              <option value="merit">{L('Mérito', 'Merit')}</option>
              <option value="other">{L('Otro', 'Other')}</option>
            </select>
          </div>
        </div>

        <div className="muted" style={{ fontSize: 11.5, marginBottom: 10 }}>{L('Cobertura: completa (gratis). Los descuentos parciales llegarán en la próxima fase.', 'Coverage: full (free). Partial discounts are coming in the next phase.')}</div>
        <div className="row" style={{ gap: 10, alignItems: 'center' }}>
          <button className="btn btn-primary" onClick={create} disabled={busy}>{busy ? '…' : L('Crear beca', 'Create scholarship')}</button>
          {msg && <span className="muted" style={{ fontSize: 12.5 }}>{msg}</span>}
        </div>
      </div>

      {/* Activas */}
      <div style={{ fontSize: 12.5, fontWeight: 700, margin: '0 2px 8px' }}>{L('Becas activas', 'Active scholarships')}</div>
      {!active.length && <div className="card muted" style={{ margin: 0 }}>{L('Aún no has concedido becas.', 'No scholarships yet.')}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {active.map((s) => (
          <div key={s.id} className="card" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 16 }}>{s.kind === 'code' ? '🔗' : '🎓'}</span>
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{s.kind === 'code' ? s.code : (s.email || L('Alumno', 'Student'))} · <span style={{ color: 'var(--green)' }}>{L('Completa', 'Full')}</span></div>
              <div className="muted" style={{ fontSize: 11.5 }}>{scopeLabel(s)}{s.kind === 'code' ? ` · ${s.used}/${s.seats} ${L('usadas', 'used')}` : ''}</div>
            </div>
            <span className="pill" style={{ color: 'var(--amber)' }}>⏳ {daysLeft(s.ends_at)}</span>
            {s.kind === 'code' && <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => copy(s.code)}>{L('Copiar', 'Copy')}</button>}
            <button className="btn btn-ghost" style={{ fontSize: 12, color: 'var(--red)' }} onClick={() => revoke(s.id)}>{L('Revocar', 'Revoke')}</button>
          </div>
        ))}
      </div>
    </div>
  );
}
