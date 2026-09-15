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
                  {p.sales_level && <span style={{ fontSize: 10.5, fontWeight: 700, color: '#c98bff', background: 'rgba(201,139,255,.15)', padding: '2px 7px', borderRadius: 20, marginLeft: 6 }}>Ventas · {p.sales_level === 'director' ? 'Director' : p.sales_level === 'lead' ? 'Lead' : 'Advisor'} · comisión</span>}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {typeof a.match_score === 'number' && <span title="Encaje con la vacante (IA)" style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 20, color: '#fff', background: a.match_score >= 75 ? '#5ed6a0' : a.match_score >= 50 ? '#e5a53a' : '#f0736f' }}>{a.match_score}%</span>}
                  <div><b>{a.name}</b> <span className="muted" style={{ fontSize: 12 }}>· {a.email} · {a.country || '—'} · {a.job_title || 'general'}</span></div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {a.resume_signed ? <a href={a.resume_signed} target="_blank" rel="noopener" style={{ ...btn, textDecoration: 'none' }}>Ver CV</a> : <span className="muted" style={{ fontSize: 11 }}>sin CV</span>}
                  {canManage && a.resume_signed && <MatchButton appId={a.id} has={typeof a.match_score === 'number'} act={act} btn={btn} />}
                  {canManage && <select value={a.status} onChange={(e) => act({ action: 'set_app_status', app_id: a.id, status: e.target.value })} style={{ ...inp, borderColor: (APPST[a.status] || APPST.new).c }}>
                    {Object.entries(APPST).map(([k, v]) => <option key={k} value={k}>{v.l}</option>)}
                  </select>}
                </div>
              </div>
              {a.match_summary && <div style={{ fontSize: 12.5, marginTop: 8, padding: '8px 10px', borderRadius: 8, background: 'var(--bg,#0e1220)', border: '1px solid var(--line,#2a3350)', whiteSpace: 'pre-wrap', color: 'var(--tx,#e8ecf5)' }}><b style={{ fontSize: 11, color: 'var(--accent,#8b93ff)' }}>Onyx AI · análisis del CV</b>{'\n'}{a.match_summary}</div>}
              {a.message && <div className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>{a.message}</div>}
            </div>
          ))}
      </div>}

      {/* ===== AJUSTES ===== */}
      {sub === 'ajustes' && <>
        <SettingsBox s={s} act={act} inp={inp} btnP={btnP} card={card} canManage={canManage} />
        <CompanyBox company={d.company || ''} act={act} inp={inp} btnP={btnP} card={card} canManage={canManage} />
      </>}

      {edit && <PositionModal p={edit} act={act} onClose={() => setEdit(null)} inp={inp} btn={btn} btnP={btnP} />}
    </div>
  );
}

// Botón para analizar el CV de una postulación contra su vacante (IA).
function MatchButton({ appId, has, act, btn }: any) {
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try {
      const r = await act({ action: 'match_cv', app_id: appId });
      if (r && r.ok === false) alert(r.error || 'No se pudo analizar el CV.');
    } catch (e: any) {
      alert('El análisis falló o tardó demasiado. Intenta de nuevo. ' + (e?.message || ''));
    } finally { setBusy(false); }
  }
  return (
    <button disabled={busy} onClick={run}
      style={{ ...btn, borderColor: 'var(--accent,#8b93ff)', color: 'var(--accent,#8b93ff)' }}>
      {busy ? 'Analizando…' : has ? '↻ Re-analizar' : '🎯 Analizar CV'}
    </button>
  );
}

function PositionModal({ p, act, onClose, inp, btn, btnP }: any) {
  const [f, setF] = useState<any>({ ...p, tags: (p.tags || []).join(', '), tags_en: (p.tags_en || []).join(', ') });
  const [lang, setLang] = useState<'es' | 'en'>('es');
  const [busyT, setBusyT] = useState(false);
  const [audit, setAudit] = useState<any>(null);
  const [busyA, setBusyA] = useState(false);
  const [busyG, setBusyG] = useState(false);
  const [busyS, setBusyS] = useState(false);
  const [busyAp, setBusyAp] = useState(false);
  const [prevScore, setPrevScore] = useState<number | null>(null);
  const u = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const lbl: React.CSSProperties = { fontSize: 12, color: 'var(--mut,#9aa6bd)', display: 'block', marginBottom: 4 };
  // Sufijo de campo según idioma que se edita.
  const F = (base: string) => (lang === 'en' ? base + '_en' : base);
  const other = lang === 'es' ? 'en' : 'es';

  async function translate() {
    setBusyT(true);
    try {
      const r = await act({ action: 'translate', to: other, src: {
        title: f[F('title')] || '', summary: f[F('summary')] || '', description: f[F('description')] || '',
        tags: String((lang === 'en' ? f.tags_en : f.tags) || '').split(',').map((t: string) => t.trim()).filter(Boolean),
      } });
      if (r?.translated) {
        const t = r.translated;
        setF((x: any) => ({ ...x,
          [other === 'en' ? 'title_en' : 'title']: t.title,
          [other === 'en' ? 'summary_en' : 'summary']: t.summary,
          [other === 'en' ? 'description_en' : 'description']: t.description,
          [other === 'en' ? 'tags_en' : 'tags']: (t.tags || []).join(', '),
        }));
        setLang(other);
      } else if (r && r.ok === false) alert(r.error || 'La IA no respondió.');
    } catch { alert(lang === 'es' ? 'La IA tardó demasiado o falló. Intenta de nuevo.' : 'AI timed out or failed. Try again.'); }
    finally { setBusyT(false); }
  }
  async function generate() {
    if (!String(f[F('title')] || '').trim()) { alert(lang === 'es' ? 'Escribe primero el título de la plaza.' : 'Write the job title first.'); return; }
    setBusyG(true);
    try {
      const r = await act({ action: 'draft', lang, ctx: {
        title: f[F('title')], department: f.department, type: f.type, location: f.location, salary_range: f.salary_range,
        summary: f[F('summary')], description: f[F('description')], sales_level: f.sales_level || '',
        tags: String((lang === 'en' ? f.tags_en : f.tags) || '').split(',').map((t: string) => t.trim()).filter(Boolean),
      } });
      if (r?.draft) {
        const g = r.draft;
        setF((x: any) => ({ ...x,
          [F('title')]: g.title || x[F('title')],
          [F('summary')]: g.summary,
          [F('description')]: g.description,
          [lang === 'en' ? 'tags_en' : 'tags']: (g.tags || []).join(', '),
        }));
      } else if (r && r.ok === false) alert(r.error || 'La IA no respondió.');
    } catch { alert(lang === 'es' ? 'La IA tardó demasiado o falló. Intenta de nuevo.' : 'AI timed out or failed. Try again.'); }
    finally { setBusyG(false); }
  }
  async function suggest() {
    if (!String(f[F('title')] || '').trim()) { alert(lang === 'es' ? 'Escribe primero el título de la plaza.' : 'Write the job title first.'); return; }
    setBusyS(true);
    try {
      const r = await act({ action: 'suggest_skills', lang, ctx: { title: f[F('title')], department: f.department, description: f[F('description')], sales_level: f.sales_level || '' } });
      if (r?.tags?.length) {
        const key = lang === 'en' ? 'tags_en' : 'tags';
        const have = String(f[key] || '').split(',').map((t: string) => t.trim()).filter(Boolean);
        const merged = Array.from(new Set([...have, ...r.tags])).slice(0, 12);
        setF((x: any) => ({ ...x, [key]: merged.join(', ') }));
      } else if (r && r.ok === false) alert(r.error || 'La IA no respondió.');
    } catch { alert(lang === 'es' ? 'La IA tardó demasiado o falló. Intenta de nuevo.' : 'AI timed out or failed. Try again.'); }
    finally { setBusyS(false); }
  }
  // Arma el objeto de la plaza en el idioma activo (para auditar/aplicar).
  const jobNow = (src: any = f) => ({
    title: src[F('title')], department: src.department, type: src.type, location: src.location, salary_range: src.salary_range,
    summary: src[F('summary')], description: src[F('description')], sales_level: src.sales_level || '',
    tags: String((lang === 'en' ? src.tags_en : src.tags) || '').split(',').map((t: string) => t.trim()).filter(Boolean),
  });
  async function runAudit(jobOverride?: any) {
    setBusyA(true);
    if (!jobOverride) setPrevScore(null); // auditoría manual: sin comparación
    try {
      const r = await act({ action: 'audit', lang, job: jobOverride || jobNow() });
      setAudit(r?.audit || null);
      return r?.audit || null;
    } catch { alert(lang === 'es' ? 'La IA tardó demasiado o falló. Intenta de nuevo.' : 'AI timed out or failed. Try again.'); return null; }
    finally { setBusyA(false); }
  }
  // Aplica las sugerencias con IA, rellena los campos y vuelve a auditar.
  async function applyAndReaudit() {
    if (!audit || !(audit.items || []).length) return;
    setBusyAp(true);
    const before = audit.score;
    try {
      const r = await act({ action: 'apply_audit', lang, items: audit.items, job: jobNow() });
      if (r?.applied) {
        const a = r.applied;
        const next = { ...f,
          [F('title')]: a.title || f[F('title')],
          [F('summary')]: a.summary,
          [F('description')]: a.description,
          [lang === 'en' ? 'tags_en' : 'tags']: (a.tags || []).join(', '),
        };
        setF(next);
        setPrevScore(before);
        await runAudit(jobNow(next));
      } else if (r && r.ok === false) alert(r.error || 'La IA no respondió.');
    } catch { alert(lang === 'es' ? 'La IA tardó demasiado o falló. Intenta de nuevo.' : 'AI timed out or failed. Try again.'); }
    finally { setBusyAp(false); }
  }
  async function save() {
    const r = await act({ action: 'save_position', position: { ...f,
      tags: String(f.tags || '').split(',').map((t: string) => t.trim()).filter(Boolean),
      tags_en: String(f.tags_en || '').split(',').map((t: string) => t.trim()).filter(Boolean),
    } });
    if (r?.ok) onClose();
  }
  const AC: Record<string, string> = { good: '#5ed6a0', warn: '#f0b74e', info: '#8b93ff' };
  const AI: Record<string, string> = { good: '✓', warn: '⚠', info: 'ℹ' };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 90, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: 24, overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(580px,100%)', background: 'var(--bg,#0e1220)', border: '1px solid var(--line,#2a3350)', borderRadius: 14, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}><h3 style={{ margin: 0, fontSize: 18 }}>{f.id ? 'Editar plaza' : 'Nueva plaza'}</h3><button onClick={onClose} style={btn}>✕</button></div>

        {/* Idioma + traducir con IA */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: 'var(--card,#1b2338)', borderRadius: 8, padding: '6px 8px', marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => setLang('es')} style={{ ...btn, padding: '5px 12px', ...(lang === 'es' ? { background: 'var(--accent,#8b93ff)', color: '#fff', border: 'none' } : {}) }}>Español</button>
            <button onClick={() => setLang('en')} style={{ ...btn, padding: '5px 12px', ...(lang === 'en' ? { background: 'var(--accent,#8b93ff)', color: '#fff', border: 'none' } : {}) }}>English</button>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button onClick={generate} disabled={busyG} title={lang === 'es' ? 'Rellena resumen, descripción y etiquetas desde el título' : 'Fills summary, description and tags from the title'} style={{ ...btnP, padding: '5px 12px' }}>{busyG ? (lang === 'es' ? 'Generando…' : 'Generating…') : (lang === 'es' ? '✨ Generar con IA' : '✨ Generate with AI')}</button>
            <button onClick={translate} disabled={busyT} style={{ ...btn, borderColor: 'var(--accent,#8b93ff)', color: 'var(--accent,#8b93ff)', padding: '5px 12px' }}>{busyT ? 'Traduciendo…' : `Traducir al ${other === 'en' ? 'inglés' : 'español'} con IA`}</button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {/* Tipo de contratación: empleo normal o ventas por comisión. */}
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', background: 'var(--card,#1b2338)', borderRadius: 8, padding: '8px 10px' }}>
            <span style={{ fontSize: 12, color: 'var(--mut,#9aa6bd)' }}>Tipo:</span>
            <button type="button" onClick={() => u('sales_level', '')} style={{ ...btn, padding: '5px 12px', ...(!f.sales_level ? { background: 'var(--accent,#8b93ff)', color: '#fff', border: 'none' } : {}) }}>Empleo</button>
            <button type="button" onClick={() => setF((x: any) => ({ ...x, sales_level: x.sales_level || 'advisor', department: 'sales' }))} style={{ ...btn, padding: '5px 12px', ...(f.sales_level ? { background: '#c98bff', color: '#1a1030', border: 'none' } : {}) }}>Ventas · por comisión</button>
            {!!f.sales_level && <select value={f.sales_level} onChange={(e) => u('sales_level', e.target.value)} style={{ ...inp, marginLeft: 'auto' }}>
              <option value="director">Director</option>
              <option value="lead">Lead</option>
              <option value="advisor">Advisor</option>
            </select>}
          </div>
          {!!f.sales_level && <div style={{ gridColumn: '1 / -1', fontSize: 11.5, color: '#c98bff' }}>La postulación aparecerá en Carreras y en el reclutamiento de ventas. No pongas salario fijo (es comisión).</div>}
          <label style={{ gridColumn: '1 / -1' }}><span style={lbl}>Título {lang === 'es' ? '*' : '(EN)'}</span><input style={{ ...inp, width: '100%' }} value={f[F('title')] || ''} onChange={(e) => u(F('title'), e.target.value)} placeholder={lang === 'es' ? 'Desarrollador Backend Sr.' : 'Sr. Backend Developer'} /></label>
          <label><span style={lbl}>Área</span><select style={{ ...inp, width: '100%' }} value={f.department} onChange={(e) => u('department', e.target.value)}>{DEPTS.map((k) => <option key={k} value={k}>{DL[k]}</option>)}</select></label>
          <label><span style={lbl}>Tipo</span><select style={{ ...inp, width: '100%' }} value={f.type} onChange={(e) => u('type', e.target.value)}><option value="full">Tiempo completo</option><option value="part">Medio tiempo</option><option value="contract">Por contrato</option><option value="intern">Prácticas</option></select></label>
          <label><span style={lbl}>Ubicación</span><input style={{ ...inp, width: '100%' }} value={f.location || ''} onChange={(e) => u('location', e.target.value)} placeholder="Remoto / México…" /></label>
          <label><span style={lbl}>Rango salarial (opcional)</span><input style={{ ...inp, width: '100%' }} value={f.salary_range || ''} onChange={(e) => u('salary_range', e.target.value)} placeholder="$1500 - $2500" /></label>
          <label style={{ gridColumn: '1 / -1' }}><span style={lbl}>Resumen {lang === 'en' ? '(EN)' : ''} (sale en la tarjeta)</span><textarea style={{ ...inp, width: '100%', minHeight: 50, resize: 'vertical' }} value={f[F('summary')] || ''} onChange={(e) => u(F('summary'), e.target.value)} /></label>
          <label style={{ gridColumn: '1 / -1' }}><span style={lbl}>Descripción completa {lang === 'en' ? '(EN)' : ''}</span><textarea style={{ ...inp, width: '100%', minHeight: 120, resize: 'vertical' }} value={f[F('description')] || ''} onChange={(e) => u(F('description'), e.target.value)} placeholder="Responsabilidades, requisitos, beneficios…" /></label>
          <label style={{ gridColumn: '1 / -1' }}>
            <span style={{ ...lbl, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Etiquetas {lang === 'en' ? '(EN)' : ''} (separadas por coma)</span>
              <button type="button" onClick={suggest} disabled={busyS} style={{ ...btn, padding: '3px 9px', fontSize: 11, borderColor: 'var(--accent,#8b93ff)', color: 'var(--accent,#8b93ff)' }}>{busyS ? (lang === 'es' ? 'Sugiriendo…' : 'Suggesting…') : (lang === 'es' ? '✨ Sugerir skills' : '✨ Suggest skills')}</button>
            </span>
            <input style={{ ...inp, width: '100%' }} value={(lang === 'en' ? f.tags_en : f.tags) || ''} onChange={(e) => u(lang === 'en' ? 'tags_en' : 'tags', e.target.value)} placeholder="React, Node, Remoto" />
          </label>
          <label><span style={lbl}>Estado</span><select style={{ ...inp, width: '100%' }} value={f.status} onChange={(e) => u('status', e.target.value)}><option value="open">Publicada</option><option value="draft">Borrador</option><option value="closed">Cerrada</option></select></label>
          <label><span style={lbl}>Orden (menor = arriba)</span><input type="number" style={{ ...inp, width: '100%' }} value={f.sort ?? 0} onChange={(e) => u('sort', Number(e.target.value))} /></label>
        </div>

        {/* Auditoría IA */}
        <div style={{ background: 'var(--card,#1b2338)', border: '1px solid var(--line,#2a3350)', borderRadius: 10, padding: 12, marginTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <b style={{ fontSize: 13.5 }}>Onyx AI · auditoría de la plaza</b>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {audit && <span style={{ fontSize: 20, fontWeight: 700, color: audit.score >= 75 ? '#5ed6a0' : audit.score >= 50 ? '#f0b74e' : '#f0736f' }}>{audit.score}<span style={{ fontSize: 11, color: 'var(--mut,#9aa6bd)', fontWeight: 400 }}>/100</span></span>}
              <button onClick={() => runAudit()} disabled={busyA} style={{ ...btn, padding: '5px 12px', borderColor: 'var(--accent,#8b93ff)', color: 'var(--accent,#8b93ff)' }}>{busyA ? 'Analizando…' : audit ? 'Re-auditar' : 'Auditar'}</button>
            </div>
          </div>
          {audit && <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
            {prevScore != null && <div style={{ fontSize: 12, fontWeight: 600, color: audit.score > prevScore ? '#5ed6a0' : audit.score < prevScore ? '#f0736f' : 'var(--mut,#9aa6bd)' }}>
              {audit.score > prevScore ? `▲ Subió de ${prevScore} a ${audit.score} (+${audit.score - prevScore})` : audit.score < prevScore ? `▼ Bajó de ${prevScore} a ${audit.score}` : `Sin cambio (${audit.score})`}
            </div>}
            {(audit.items || []).map((it: any, i: number) => (
              <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12.5, alignItems: 'flex-start' }}><span style={{ color: AC[it.level] || AC.info }}>{AI[it.level] || AI.info}</span><span>{it.text}</span></div>
            ))}
            {/* Aplicar las sugerencias con IA y re-auditar en un clic. */}
            {(audit.items || []).some((it: any) => it.level !== 'good') && <button onClick={applyAndReaudit} disabled={busyAp || busyA} style={{ ...btnP, marginTop: 6, alignSelf: 'flex-start', padding: '7px 14px' }}>{busyAp ? 'Aplicando y re-auditando…' : '✨ Aplicar sugerencias y re-auditar'}</button>}
            <div style={{ fontSize: 10.5, color: 'var(--mut,#9aa6bd)', marginTop: 2 }}>{audit.ai ? 'Sugerencias de IA según el rol.' : 'Sugerencias por reglas (IA no disponible).'} Los datos que la IA no sabe (salario, métricas) los deja como [marcador] para que los completes.</div>
          </div>}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}><button style={btn} onClick={onClose}>Cancelar</button><button style={btnP} onClick={save}>Guardar</button></div>
      </div>
    </div>
  );
}

// Contexto Onyx: perfil de empresa que la IA usa para generar/sugerir/auditar
// vacantes (y lo comparte Ventas). Editable; si se vacía, vuelve al default.
function CompanyBox({ company, act, inp, btnP, card, canManage }: any) {
  const [txt, setTxt] = useState<string>(company || '');
  useEffect(() => { setTxt(company || ''); }, [company]);
  const lbl: React.CSSProperties = { fontSize: 12.5, color: 'var(--mut,#9aa6bd)', display: 'block', marginBottom: 4 };
  return (
    <div style={{ ...card, marginTop: 12 }}>
      <b style={{ fontSize: 14 }}>🏢 Contexto Onyx <span style={{ fontSize: 11, color: 'var(--mut,#9aa6bd)', fontWeight: 400 }}>· lo que usamos y hacia dónde vamos</span></b>
      <p style={{ fontSize: 12.5, color: 'var(--mut,#9aa6bd)', margin: '6px 0 10px', lineHeight: 1.5 }}>
        La IA lee esto al <b>Generar</b>, <b>Sugerir skills</b> y <b>Auditar</b> una plaza, para nombrar tus herramientas reales (Next.js, Supabase, Stripe, MT4/MT5, cTrader…) y alinear la vacante con tu dirección. También lo comparte el reclutamiento de ventas.
      </p>
      <label><span style={lbl}>Perfil de la empresa (stack, qué hacemos, hacia dónde vamos)</span>
        <textarea style={{ ...inp, width: '100%', minHeight: 130, resize: 'vertical', lineHeight: 1.5 }} value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="Somos… Usamos… Vamos hacia…" />
      </label>
      {canManage && <div style={{ marginTop: 10 }}><button style={btnP} onClick={() => act({ action: 'save_company', company: txt })}>Guardar contexto</button></div>}
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
