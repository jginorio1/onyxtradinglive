'use client';
import { useEffect, useState } from 'react';

// Admin de CARRERAS: crea/edita plazas, ajustes de la página pública, y ve las
// postulaciones (con CV). Vive en el área Equipo.

const DEPTS = ['dev', 'management', 'marketing', 'design', 'ops', 'sales', 'other'];
const DL: Record<string, string> = { dev: 'Desarrollo', management: 'Gerencia', marketing: 'Marketing', design: 'Diseño', ops: 'Operaciones', sales: 'Ventas', other: 'Otros' };
const APPST: Record<string, { l: string; c: string }> = { new: { l: 'Nueva', c: '#8b93ff' }, review: { l: 'En revisión', c: '#e5b567' }, interview: { l: 'Entrevista', c: '#54c7ec' }, hired: { l: 'Contratado', c: '#5ed6a0' }, rejected: { l: 'Descartado', c: '#f0736f' } };

export default function CareersAdmin({ canManage = true }: { canManage?: boolean }) {
  const [d, setD] = useState<any>(null);
  const [sub, setSub] = useState<'plazas' | 'postulaciones' | 'ajustes'>('plazas');
  const [msg, setMsg] = useState('');
  const [edit, setEdit] = useState<any>(null);

  useEffect(() => { load(); }, []);
  async function load() { try { const r = await fetch('/api/admin/careers', { cache: 'no-store' }); setD(await r.json()); } catch {} }
  async function act(body: any) { setMsg(''); const r = await fetch('/api/admin/careers', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); const j = await r.json(); if (j.error) setMsg('⚠ ' + j.error); else setMsg('Hecho ✓'); await load(); return j; }

  const inp: React.CSSProperties = { padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line,#2a3350)', background: 'var(--bg,#0e1220)', color: 'var(--tx,#e8ecf5)', fontSize: 13 };
  const btn: React.CSSProperties = { padding: '7px 12px', borderRadius: 8, border: '1px solid var(--line,#2a3350)', background: 'var(--panel,#161c2e)', color: 'var(--tx,#e8ecf5)', cursor: 'pointer', fontSize: 12.5 };
  const btnP: React.CSSProperties = { ...btn, background: 'var(--accent,#8b93ff)', color: '#fff', border: 'none', fontWeight: 600 };
  const card: React.CSSProperties = { background: 'var(--card,#1b2338)', border: '1px solid var(--line,#2a3350)', borderRadius: 12, padding: 14 };

  if (!d) return <div className="muted">Cargando…</div>;
  const s = d.settings || {};
  const positions: any[] = d.positions || [];
  const apps: any[] = d.applications || [];
  const subBtn = (id: any, label: string, n?: number) => <button onClick={() => setSub(id)} style={{ ...btn, background: sub === id ? 'var(--accent,#8b93ff)' : btn.background, color: sub === id ? '#fff' : btn.color, border: sub === id ? 'none' : btn.border }}>{label}{n ? ` · ${n}` : ''}</button>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>Carreras</h2>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <a href={d.link} target="_blank" rel="noopener" style={{ ...btn, textDecoration: 'none' }}>Ver página pública ↗</a>
          <button style={btn} onClick={() => { navigator.clipboard.writeText(d.link); setMsg('Enlace copiado ✓'); }}>Copiar enlace</button>
        </div>
      </div>

      {msg && <div style={{ border: '1px solid var(--accent,#8b93ff)', color: 'var(--accent,#8b93ff)', borderRadius: 10, padding: '8px 12px', marginBottom: 12, fontSize: 13 }}>{msg}</div>}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {subBtn('plazas', 'Plazas', positions.length)}
        {subBtn('postulaciones', 'Postulaciones', apps.filter((a) => a.status === 'new').length)}
        {subBtn('ajustes', 'Ajustes')}
      </div>

      {/* ===== PLAZAS ===== */}
      {sub === 'plazas' && <div>
        {canManage && <button style={{ ...btnP, marginBottom: 12 }} onClick={() => setEdit({ department: 'dev', type: 'full', location: 'Remoto', status: 'open', tags: [] })}>+ Nueva plaza</button>}
        {positions.length === 0 ? <div className="muted">Aún no hay plazas. Crea la primera.</div> :
          <div style={{ display: 'grid', gap: 8 }}>
            {positions.map((p) => (
              <div key={p.id} style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <b style={{ color: 'var(--tx,#e8ecf5)' }}>{p.title}</b>
                  <span className="muted" style={{ fontSize: 12 }}> · {DL[p.department] || p.department} · {p.location}</span>
                  <div style={{ fontSize: 11, color: p.status === 'open' ? '#5ed6a0' : p.status === 'draft' ? '#e5b567' : '#9aa6bd' }}>{p.status === 'open' ? 'publicada' : p.status === 'draft' ? 'borrador' : 'cerrada'}</div>
                </div>
                {canManage && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button style={btn} onClick={() => setEdit({ ...p })}>Editar</button>
                  <button style={btn} onClick={() => act({ action: 'set_status', id: p.id, status: p.status === 'open' ? 'closed' : 'open' })}>{p.status === 'open' ? 'Cerrar' : 'Publicar'}</button>
                  <button style={btn} onClick={() => confirm('¿Borrar esta plaza?') && act({ action: 'delete_position', id: p.id })}>✕</button>
                </div>}
              </div>
            ))}
          </div>}
      </div>}

      {/* ===== POSTULACIONES ===== */}
      {sub === 'postulaciones' && <div>
        {apps.length === 0 ? <div className="muted">Aún no hay postulaciones.</div> :
          apps.map((a) => (
            <div key={a.id} style={{ ...card, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <div><b>{a.name}</b> <span className="muted" style={{ fontSize: 12 }}>· {a.email} · {a.country || '—'} · {a.job_title || 'general'}</span></div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {a.resume_signed ? <a href={a.resume_signed} target="_blank" rel="noopener" style={{ ...btn, textDecoration: 'none' }}>Ver CV</a> : <span className="muted" style={{ fontSize: 11 }}>sin CV</span>}
                  {canManage && <select value={a.status} onChange={(e) => act({ action: 'set_app_status', app_id: a.id, status: e.target.value })} style={{ ...inp, borderColor: (APPST[a.status] || APPST.new).c }}>
                    {Object.entries(APPST).map(([k, v]) => <option key={k} value={k}>{v.l}</option>)}
                  </select>}
                </div>
              </div>
              {a.message && <div className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>{a.message}</div>}
            </div>
          ))}
      </div>}

      {/* ===== AJUSTES ===== */}
      {sub === 'ajustes' && <SettingsBox s={s} act={act} inp={inp} btnP={btnP} card={card} canManage={canManage} />}

      {edit && <PositionModal p={edit} act={act} onClose={() => setEdit(null)} inp={inp} btn={btn} btnP={btnP} />}
    </div>
  );
}

function PositionModal({ p, act, onClose, inp, btn, btnP }: any) {
  const [f, setF] = useState<any>({ ...p, tags: (p.tags || []).join(', ') });
  const u = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const lbl: React.CSSProperties = { fontSize: 12, color: 'var(--mut,#9aa6bd)', display: 'block', marginBottom: 4 };
  async function save() { const r = await act({ action: 'save_position', position: { ...f, tags: String(f.tags || '').split(',').map((t: string) => t.trim()).filter(Boolean) } }); if (r?.ok) onClose(); }
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 90, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: 24, overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(560px,100%)', background: 'var(--bg,#0e1220)', border: '1px solid var(--line,#2a3350)', borderRadius: 14, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}><h3 style={{ margin: 0, fontSize: 18 }}>{f.id ? 'Editar plaza' : 'Nueva plaza'}</h3><button onClick={onClose} style={btn}>✕</button></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={{ gridColumn: '1 / -1' }}><span style={lbl}>Título *</span><input style={{ ...inp, width: '100%' }} value={f.title || ''} onChange={(e) => u('title', e.target.value)} placeholder="Desarrollador Backend Sr." /></label>
          <label><span style={lbl}>Área</span><select style={{ ...inp, width: '100%' }} value={f.department} onChange={(e) => u('department', e.target.value)}>{DEPTS.map((k) => <option key={k} value={k}>{DL[k]}</option>)}</select></label>
          <label><span style={lbl}>Tipo</span><select style={{ ...inp, width: '100%' }} value={f.type} onChange={(e) => u('type', e.target.value)}><option value="full">Tiempo completo</option><option value="part">Medio tiempo</option><option value="contract">Por contrato</option><option value="intern">Prácticas</option></select></label>
          <label><span style={lbl}>Ubicación</span><input style={{ ...inp, width: '100%' }} value={f.location || ''} onChange={(e) => u('location', e.target.value)} placeholder="Remoto / México…" /></label>
          <label><span style={lbl}>Rango salarial (opcional)</span><input style={{ ...inp, width: '100%' }} value={f.salary_range || ''} onChange={(e) => u('salary_range', e.target.value)} placeholder="$1500 - $2500" /></label>
          <label style={{ gridColumn: '1 / -1' }}><span style={lbl}>Resumen (1-2 líneas, sale en la tarjeta)</span><textarea style={{ ...inp, width: '100%', minHeight: 50, resize: 'vertical' }} value={f.summary || ''} onChange={(e) => u('summary', e.target.value)} /></label>
          <label style={{ gridColumn: '1 / -1' }}><span style={lbl}>Descripción completa</span><textarea style={{ ...inp, width: '100%', minHeight: 120, resize: 'vertical' }} value={f.description || ''} onChange={(e) => u('description', e.target.value)} placeholder="Responsabilidades, requisitos, beneficios…" /></label>
          <label style={{ gridColumn: '1 / -1' }}><span style={lbl}>Etiquetas (separadas por coma)</span><input style={{ ...inp, width: '100%' }} value={f.tags || ''} onChange={(e) => u('tags', e.target.value)} placeholder="React, Node, Remoto" /></label>
          <label><span style={lbl}>Estado</span><select style={{ ...inp, width: '100%' }} value={f.status} onChange={(e) => u('status', e.target.value)}><option value="open">Publicada</option><option value="draft">Borrador</option><option value="closed">Cerrada</option></select></label>
          <label><span style={lbl}>Orden (menor = arriba)</span><input type="number" style={{ ...inp, width: '100%' }} value={f.sort ?? 0} onChange={(e) => u('sort', Number(e.target.value))} /></label>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}><button style={btn} onClick={onClose}>Cancelar</button><button style={btnP} onClick={save}>Guardar</button></div>
      </div>
    </div>
  );
}

function SettingsBox({ s, act, inp, btnP, card, canManage }: any) {
  const [f, setF] = useState<any>({ ...s });
  useEffect(() => { setF({ ...s }); }, [s]);
  const u = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const lbl: React.CSSProperties = { fontSize: 12.5, color: 'var(--mut,#9aa6bd)', display: 'block', marginBottom: 4 };
  return (
    <div>
      <div style={card}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, cursor: 'pointer', color: 'var(--tx,#e8ecf5)' }}>
          <input type="checkbox" checked={!!f.enabled} onChange={(e) => u('enabled', e.target.checked)} style={{ width: 16, height: 16, flex: 'none', margin: 0 }} />
          <span>Página de carreras activa (pública en /carreras)</span>
        </label>
        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          <label><span style={lbl}>Título (ES)</span><input style={{ ...inp, width: '100%' }} value={f.title || ''} onChange={(e) => u('title', e.target.value)} /></label>
          <label><span style={lbl}>Subtítulo (ES)</span><textarea style={{ ...inp, width: '100%', minHeight: 46, resize: 'vertical' }} value={f.subtitle || ''} onChange={(e) => u('subtitle', e.target.value)} /></label>
          <label><span style={lbl}>Título (EN)</span><input style={{ ...inp, width: '100%' }} value={f.title_en || ''} onChange={(e) => u('title_en', e.target.value)} /></label>
          <label><span style={lbl}>Subtítulo (EN)</span><textarea style={{ ...inp, width: '100%', minHeight: 46, resize: 'vertical' }} value={f.subtitle_en || ''} onChange={(e) => u('subtitle_en', e.target.value)} /></label>
        </div>
      </div>
      <div style={card}>
        <b>¿Cómo se postulan?</b>
        <div style={{ display: 'grid', gap: 10, marginTop: 10, maxWidth: 520 }}>
          <label><span style={lbl}>Método</span><select style={{ ...inp, width: '100%' }} value={f.apply_mode || 'form'} onChange={(e) => u('apply_mode', e.target.value)}><option value="form">Formulario en la app (con CV) — recomendado</option><option value="email">Enviar correo</option><option value="link">Enlace externo</option></select></label>
          {f.apply_mode === 'email' && <label><span style={lbl}>Correo</span><input style={{ ...inp, width: '100%' }} value={f.apply_email || ''} onChange={(e) => u('apply_email', e.target.value)} placeholder="jobs@onyxtradinglive.com" /></label>}
          {f.apply_mode === 'link' && <label><span style={lbl}>URL externa</span><input style={{ ...inp, width: '100%' }} value={f.apply_url || ''} onChange={(e) => u('apply_url', e.target.value)} placeholder="https://…" /></label>}
        </div>
      </div>
      {canManage && <button style={btnP} onClick={() => act({ action: 'save_settings', settings: f })}>Guardar ajustes</button>}
    </div>
  );
}
