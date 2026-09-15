'use client';
import { useEffect, useMemo, useState } from 'react';
import { useLang } from '@/lib/lang';

// Página pública de CARRERAS. Tarjetas por plaza, filtro por área, y postulación
// con CV. Bilingüe (ES/EN). Se configura desde Admin → Carreras.

const DEPT: Record<string, { es: string; en: string; c: string }> = {
  dev: { es: 'Desarrollo', en: 'Engineering', c: '#8b93ff' },
  management: { es: 'Gerencia', en: 'Management', c: '#e5b567' },
  marketing: { es: 'Marketing', en: 'Marketing', c: '#5ed6a0' },
  design: { es: 'Diseño', en: 'Design', c: '#f0736f' },
  ops: { es: 'Operaciones', en: 'Operations', c: '#54c7ec' },
  sales: { es: 'Ventas', en: 'Sales', c: '#c98bff' },
  other: { es: 'Otros', en: 'Other', c: '#9aa6bd' },
};
const TYPE: Record<string, { es: string; en: string }> = {
  full: { es: 'Tiempo completo', en: 'Full-time' }, part: { es: 'Medio tiempo', en: 'Part-time' },
  contract: { es: 'Por contrato', en: 'Contract' }, intern: { es: 'Prácticas', en: 'Internship' },
};

function Ic({ n, s = 16, c = 'currentColor' }: { n: string; s?: number; c?: string }) {
  const p: Record<string, string> = {
    pin: 'M12 21s-6-5.3-6-10a6 6 0 0112 0c0 4.7-6 10-6 10zM12 11a2 2 0 100-4 2 2 0 000 4z',
    clock: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 8v4l3 2',
    cash: 'M3 6h18v12H3zM12 15a3 3 0 100-6 3 3 0 000 6z',
    arrow: 'M5 12h14M13 6l6 6-6 6',
    globe: 'M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c2.5 2.5 3.5 6 3.5 9S14.5 18.5 12 21',
    check: 'M20 6L9 17l-5-5',
  };
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}><path d={p[n] || ''} /></svg>;
}

export default function CareersClient() {
  const [d, setD] = useState<any>(null);
  // Sigue el idioma global del sitio (mismo selector de la barra). Solo tenemos
  // contenido ES/EN, así que cualquier idioma que no sea español muestra inglés.
  const { lang: siteLang } = useLang();
  const lang: 'es' | 'en' = siteLang === 'es' ? 'es' : 'en';
  const [filter, setFilter] = useState('all');
  const [apply, setApply] = useState<any>(null);
  const L = (es: string, en: string) => (lang === 'es' ? es : en);

  useEffect(() => { (async () => { try { const r = await fetch('/api/careers', { cache: 'no-store' }); setD(await r.json()); } catch { setD({ enabled: false }); } })(); }, []);

  // Toma el campo en el idioma actual; si falta, cae al que exista.
  const T = (o: any, f: string) => (lang === 'en' ? (o[f + '_en'] || o[f]) : (o[f] || o[f + '_en']));
  const TG = (o: any) => (lang === 'en' ? ((o.tags_en && o.tags_en.length) ? o.tags_en : o.tags) : (o.tags && o.tags.length ? o.tags : o.tags_en)) || [];

  const positions: any[] = d?.positions || [];
  const depts = useMemo(() => Array.from(new Set(positions.map((p) => p.department))), [positions]);
  const shown = filter === 'all' ? positions : positions.filter((p) => p.department === filter);

  const wrap: React.CSSProperties = { maxWidth: 980, margin: '0 auto', padding: '40px 18px 80px' };
  const chip = (active: boolean, c: string): React.CSSProperties => ({ padding: '6px 14px', borderRadius: 20, border: `1px solid ${active ? c : 'var(--line,#2a3350)'}`, background: active ? c + '22' : 'transparent', color: active ? c : 'var(--mut,#9aa6bd)', cursor: 'pointer', fontSize: 13, fontWeight: 600 });

  if (!d) return <div style={wrap}><div className="muted">Cargando…</div></div>;
  if (!d.enabled) return <div style={wrap}><div style={{ textAlign: 'center', color: 'var(--mut,#9aa6bd)', padding: 60 }}>{L('No hay plazas publicadas por ahora.', 'No openings published right now.')}</div></div>;

  const s = d.settings || {};
  const title = lang === 'es' ? s.title : (s.title_en || s.title);
  const subtitle = lang === 'es' ? s.subtitle : (s.subtitle_en || s.subtitle);

  return (
    <div style={wrap}>
      {/* El idioma lo controla el selector global del sitio (barra superior). */}

      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: 30 }}>
        <div style={{ fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--gold,#e5b567)', fontWeight: 700 }}>{L('Trabaja con nosotros', 'Work with us')}</div>
        <h1 style={{ fontSize: 38, margin: '8px 0 10px', color: 'var(--tx,#e8ecf5)', lineHeight: 1.1 }}>{title}</h1>
        <p style={{ fontSize: 16, color: 'var(--mut,#9aa6bd)', maxWidth: 620, margin: '0 auto', lineHeight: 1.6 }}>{subtitle}</p>
        <div style={{ marginTop: 14, fontSize: 13.5, color: 'var(--tx,#e8ecf5)' }}>
          <b style={{ color: 'var(--accent,#8b93ff)' }}>{positions.length}</b> {L(positions.length === 1 ? 'plaza disponible' : 'plazas disponibles', positions.length === 1 ? 'open position' : 'open positions')}
        </div>
      </div>

      {/* Filtros por área */}
      {depts.length > 1 && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 24 }}>
        <button style={chip(filter === 'all', 'var(--accent,#8b93ff)')} onClick={() => setFilter('all')}>{L('Todas', 'All')}</button>
        {depts.map((dep) => { const dp = DEPT[dep] || DEPT.other; return <button key={dep} style={chip(filter === dep, dp.c)} onClick={() => setFilter(dep)}>{lang === 'es' ? dp.es : dp.en}</button>; })}
      </div>}

      {/* Tarjetas */}
      {shown.length === 0 ? <div style={{ textAlign: 'center', color: 'var(--mut,#9aa6bd)', padding: 40 }}>{L('No hay plazas en esta área.', 'No positions in this area.')}</div> :
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 16 }}>
          {shown.map((p) => {
            const dp = DEPT[p.department] || DEPT.other;
            return (
              <div key={p.id} style={{ background: 'var(--panel,#161c2e)', border: '1px solid var(--line,#2a3350)', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', borderTop: `3px solid ${dp.c}` }}>
                <span style={{ alignSelf: 'flex-start', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: dp.c, background: dp.c + '1e', padding: '3px 10px', borderRadius: 20 }}>{lang === 'es' ? dp.es : dp.en}</span>
                <h3 style={{ fontSize: 19, margin: '12px 0 6px', color: 'var(--tx,#e8ecf5)' }}>{T(p, 'title')}</h3>
                {T(p, 'summary') && <p style={{ fontSize: 13.5, color: 'var(--mut,#9aa6bd)', margin: '0 0 12px', lineHeight: 1.55, flex: 1 }}>{T(p, 'summary')}</p>}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 12.5, color: 'var(--mut,#9aa6bd)', marginBottom: 12 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Ic n="pin" s={14} /> {p.location || 'Remoto'}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Ic n="clock" s={14} /> {(TYPE[p.type] || TYPE.full)[lang]}</span>
                  {p.salary_range && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Ic n="cash" s={14} /> {p.salary_range}</span>}
                  {p.sales_level && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#c98bff' }}><Ic n="cash" s={14} c="#c98bff" /> {L('Por comisión', 'Commission')}</span>}
                </div>
                {!!TG(p).length && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                  {TG(p).slice(0, 6).map((t: string, i: number) => <span key={i} style={{ fontSize: 11, color: 'var(--mut,#9aa6bd)', border: '1px solid var(--line,#2a3350)', borderRadius: 6, padding: '2px 8px' }}>{t}</span>)}
                </div>}
                <button onClick={() => setApply(p)} style={{ marginTop: 'auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', borderRadius: 10, border: 'none', background: 'var(--accent,#8b93ff)', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>{L('Ver y postularme', 'View & apply')} <Ic n="arrow" s={16} c="#fff" /></button>
              </div>
            );
          })}
        </div>}

      {/* Enlace cruzado al reclutamiento de ventas */}
      <a href="/unete-ventas" style={{ display: 'block', textDecoration: 'none', marginTop: 28 }}>
        <div style={{ background: 'linear-gradient(90deg, rgba(201,139,255,.12), rgba(139,147,255,.12))', border: '1px solid rgba(201,139,255,.35)', borderRadius: 16, padding: '18px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--tx,#e8ecf5)' }}>{L('¿Quieres ser parte del equipo de ventas?', 'Want to join the sales team?')}</div>
            <div style={{ fontSize: 13, color: 'var(--mut,#9aa6bd)', marginTop: 2 }}>{L('Programa por comisión recurrente, no es empleo de nómina.', 'Recurring-commission program, not payroll employment.')}</div>
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10, background: '#c98bff', color: '#1a1030', fontWeight: 700, fontSize: 14 }}>{L('Únete al equipo de ventas', 'Join the sales team')} <Ic n="arrow" s={16} c="#1a1030" /></span>
        </div>
      </a>

      {apply && <ApplyModal job={apply} settings={s} L={L} lang={lang} onClose={() => setApply(null)} />}
    </div>
  );
}

function ApplyModal({ job, settings, L, lang, onClose }: any) {
  const [tab, setTab] = useState<'detail' | 'apply'>('detail');
  const [f, setF] = useState({ name: '', email: '', phone: '', country: '', message: '', audience: '', experience: '' });
  // Plaza del equipo de ventas (por comisión): pide preguntas extra.
  const isSales = !!job.sales_level;
  const levelLabel = job.sales_level === 'director' ? 'Director' : job.sales_level === 'lead' ? 'Lead' : 'Advisor';
  const [cvName, setCvName] = useState(''); const [cvPath, setCvPath] = useState(''); const [cvBusy, setCvBusy] = useState(false);
  const [busy, setBusy] = useState(false); const [done, setDone] = useState(false); const [err, setErr] = useState('');
  const upd = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const inp: React.CSSProperties = { width: '100%', padding: '11px 13px', borderRadius: 10, border: '1px solid var(--line,#2a3350)', background: 'var(--bg,#0e1220)', color: 'var(--tx,#e8ecf5)', fontSize: 14, marginTop: 6 };
  const lbl: React.CSSProperties = { fontSize: 12.5, color: 'var(--mut,#9aa6bd)', fontWeight: 600 };
  const mode = settings.apply_mode || 'form';
  const T = (f: string) => (lang === 'en' ? (job[f + '_en'] || job[f]) : (job[f] || job[f + '_en']));

  async function onCv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return; setErr('');
    if (file.type !== 'application/pdf') { setErr(L('El CV debe ser PDF.', 'Resume must be a PDF.')); return; }
    if (file.size > 5 * 1024 * 1024) { setErr(L('El PDF es muy grande (máx 5 MB).', 'PDF too large (max 5 MB).')); return; }
    setCvName(file.name); setCvBusy(true);
    try {
      const data: string = await new Promise((res, rej) => { const rd = new FileReader(); rd.onload = () => res(String(rd.result)); rd.onerror = rej; rd.readAsDataURL(file); });
      const r = await fetch('/api/careers/upload-cv', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: file.name, data }) });
      const j = await r.json(); if (j.ok && j.path) setCvPath(j.path); else { setErr(j.error || L('No se pudo subir el CV.', 'Could not upload resume.')); setCvName(''); }
    } catch { setErr(L('No se pudo subir el CV.', 'Could not upload resume.')); setCvName(''); }
    setCvBusy(false);
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr('');
    if (f.name.trim().length < 2 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) { setErr(L('Pon tu nombre y un correo válido.', 'Enter your name and a valid email.')); return; }
    setBusy(true);
    try { const r = await fetch('/api/careers', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...f, job_id: job.id, job_title: job.title, resume_path: cvPath }) }); const j = await r.json(); if (j.ok) setDone(true); else setErr(j.error || L('No se pudo enviar.', 'Could not send.')); } catch { setErr(L('Error de red.', 'Network error.')); }
    setBusy(false);
  }

  const applyBtn = () => {
    if (mode === 'email' && settings.apply_email) { window.location.href = `mailto:${settings.apply_email}?subject=${encodeURIComponent('Postulación: ' + job.title)}`; return; }
    if (mode === 'link' && settings.apply_url) { window.open(settings.apply_url, '_blank'); return; }
    setTab('apply');
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 90, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: 20, overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(600px,100%)', background: 'var(--panel,#161c2e)', border: '1px solid var(--line,#2a3350)', borderRadius: 16, padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <h2 style={{ fontSize: 22, margin: 0, color: 'var(--tx,#e8ecf5)' }}>{T('title')}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--mut,#9aa6bd)', fontSize: 22, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12.5, color: 'var(--mut,#9aa6bd)', margin: '8px 0 16px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Ic n="pin" s={14} /> {job.location || 'Remoto'}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Ic n="clock" s={14} /> {(TYPE[job.type] || TYPE.full)[lang]}</span>
          {job.salary_range && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Ic n="cash" s={14} /> {job.salary_range}</span>}
        </div>

        {tab === 'detail' && <>
          {isSales && <div style={{ background: 'rgba(201,139,255,.12)', border: '1px solid rgba(201,139,255,.4)', borderRadius: 10, padding: '10px 12px', marginBottom: 12, fontSize: 12.5, color: 'var(--tx,#e8ecf5)' }}>
            <b style={{ color: '#c98bff' }}>{L(`Equipo de ventas · nivel ${levelLabel}`, `Sales team · ${levelLabel} level`)}</b><br />
            {L('Este puesto es por comisión recurrente, no es un empleo de nómina. Ganas según lo que vendas.', 'This role is recurring-commission based, not payroll employment. You earn from what you sell.')}
          </div>}
          {T('description') ? <div style={{ fontSize: 14, color: 'var(--tx,#e8ecf5)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{T('description')}</div> : <p style={{ color: 'var(--mut,#9aa6bd)' }}>{T('summary')}</p>}
          <button onClick={applyBtn} style={{ marginTop: 20, width: '100%', padding: '13px', borderRadius: 10, border: 'none', background: 'var(--accent,#8b93ff)', color: '#fff', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>{L('Postularme a esta plaza', 'Apply to this position')}</button>
        </>}

        {tab === 'apply' && (done
          ? <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ display: 'inline-flex', width: 54, height: 54, borderRadius: '50%', background: 'rgba(94,214,160,.15)', alignItems: 'center', justifyContent: 'center' }}><Ic n="check" s={30} c="#5ed6a0" /></div>
              <h3 style={{ margin: '12px 0 6px', color: 'var(--tx,#e8ecf5)' }}>{L('¡Postulación enviada!', 'Application sent!')}</h3>
              <p style={{ color: 'var(--mut,#9aa6bd)', margin: 0 }}>{L('Gracias. Revisaremos tu perfil y te contactaremos.', 'Thanks. We’ll review your profile and reach out.')}</p>
            </div>
          : <form onSubmit={submit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label><span style={lbl}>{L('Nombre', 'Name')} *</span><input style={inp} value={f.name} onChange={(e) => upd('name', e.target.value)} /></label>
                <label><span style={lbl}>{L('Correo', 'Email')} *</span><input style={inp} type="email" value={f.email} onChange={(e) => upd('email', e.target.value)} /></label>
                <label><span style={lbl}>{L('Teléfono', 'Phone')}</span><input style={inp} value={f.phone} onChange={(e) => upd('phone', e.target.value)} /></label>
                <label><span style={lbl}>{L('País', 'Country')}</span><input style={inp} value={f.country} onChange={(e) => upd('country', e.target.value)} /></label>
              </div>
              {isSales && <>
                <label style={{ display: 'block', marginTop: 12 }}><span style={lbl}>{L('Tu audiencia / red (dónde vendes)', 'Your audience / network (where you sell)')}</span><textarea style={{ ...inp, minHeight: 56, resize: 'vertical' }} value={f.audience} onChange={(e) => upd('audience', e.target.value)} placeholder={L('Redes, grupos, país, idioma, tamaño…', 'Social, groups, country, language, size…')} /></label>
                <label style={{ display: 'block', marginTop: 12 }}><span style={lbl}>{L('Experiencia vendiendo', 'Sales experience')}</span><textarea style={{ ...inp, minHeight: 56, resize: 'vertical' }} value={f.experience} onChange={(e) => upd('experience', e.target.value)} placeholder={L('¿Qué has vendido y cómo?', 'What have you sold and how?')} /></label>
              </>}
              <label style={{ display: 'block', marginTop: 12 }}><span style={lbl}>{L('¿Por qué tú?', 'Why you?')}</span><textarea style={{ ...inp, minHeight: 80, resize: 'vertical' }} value={f.message} onChange={(e) => upd('message', e.target.value)} placeholder={L('Cuéntanos de tu experiencia', 'Tell us about your experience')} /></label>
              <div style={{ marginTop: 12 }}>
                <span style={lbl}>{L('Currículum (PDF)', 'Resume (PDF)')}</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, padding: '11px 13px', borderRadius: 10, border: '1px dashed var(--line,#2a3350)', background: 'var(--bg,#0e1220)', cursor: 'pointer', color: 'var(--mut,#9aa6bd)', fontSize: 13.5 }}>
                  <Ic n={cvPath ? 'check' : 'arrow'} s={17} c={cvPath ? '#5ed6a0' : '#a9b0ff'} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cvBusy ? L('Subiendo…', 'Uploading…') : cvName || L('Adjuntar CV (máx 5 MB)', 'Attach resume (max 5 MB)')}</span>
                  <input type="file" accept="application/pdf" onChange={onCv} style={{ display: 'none' }} />
                </label>
              </div>
              {err && <div style={{ color: 'var(--red,#f0736f)', fontSize: 13, marginTop: 10 }}>{err}</div>}
              <button type="submit" disabled={busy} style={{ marginTop: 16, width: '100%', padding: '13px', borderRadius: 10, border: 'none', background: 'var(--accent,#8b93ff)', color: '#fff', fontWeight: 600, fontSize: 15, cursor: 'pointer', opacity: busy ? .6 : 1 }}>{busy ? L('Enviando…', 'Sending…') : L('Enviar postulación', 'Send application')}</button>
            </form>)}
      </div>
    </div>
  );
}
