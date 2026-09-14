'use client';
import { useState } from 'react';

// Formulario de reclutamiento (landing oculta). Bilingüe con un botón ES/EN.
// Íconos de línea inline (SVG) y subida de currículum (PDF) al bucket privado.

// Set reducido de íconos de línea, estilo moderno, sin dependencias.
function Ic({ n, s = 20, c = 'currentColor' }: { n: string; s?: number; c?: string }) {
  const p: Record<string, string> = {
    cash: 'M3 6h18v12H3zM12 15a3 3 0 100-6 3 3 0 000 6zM6 9v0M18 15v0',
    team: 'M9 11a3 3 0 100-6 3 3 0 000 6zM2 20v-1a4 4 0 014-4h4a4 4 0 014 4v1M17 11a3 3 0 000-6M22 20v-1a4 4 0 00-3-3.8',
    gift: 'M20 12v8a1 1 0 01-1 1H5a1 1 0 01-1-1v-8M2 7h20v5H2zM12 7v14M12 7S10.5 3 8 3a2 2 0 000 4M12 7s1.5-4 4-4a2 2 0 010 4',
    chat: 'M21 15a2 2 0 01-2 2H8l-4 4V5a2 2 0 012-2h13a2 2 0 012 2z',
    check: 'M20 6L9 17l-5-5',
    file: 'M14 3v5h5M8 3h6l5 5v11a1 1 0 01-1 1H8a1 1 0 01-1-1V4a1 1 0 011-1z',
    upload: 'M12 15V3M7 8l5-5 5 5M4 17v2a1 1 0 001 1h14a1 1 0 001-1v-2',
    globe: 'M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c2.5 2.5 3.5 6 3.5 9S14.5 18.5 12 21M12 3C9.5 5.5 8.5 9 8.5 12s1 6.5 3.5 9',
  };
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}><path d={p[n] || ''} /></svg>;
}

export default function ApplyForm() {
  const [lang, setLang] = useState<'es' | 'en'>('es');
  const L = (es: string, en: string) => (lang === 'es' ? es : en);
  const [f, setF] = useState({ name: '', email: '', phone: '', country: '', desired_role: 'vendedor', experience: '', audience: '', note: '' });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');
  const [cvName, setCvName] = useState('');
  const [cvPath, setCvPath] = useState('');
  const [cvBusy, setCvBusy] = useState(false);
  const upd = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));

  async function onCv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setErr(''); setCvPath('');
    if (file.type !== 'application/pdf') { setErr(L('El CV debe ser un PDF.', 'The resume must be a PDF.')); return; }
    if (file.size > 5 * 1024 * 1024) { setErr(L('El PDF es muy grande (máx 5 MB).', 'PDF too large (max 5 MB).')); return; }
    setCvName(file.name); setCvBusy(true);
    try {
      const data: string = await new Promise((res, rej) => { const rd = new FileReader(); rd.onload = () => res(String(rd.result)); rd.onerror = rej; rd.readAsDataURL(file); });
      const r = await fetch('/api/sales/upload-cv', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: file.name, data }) });
      const j = await r.json();
      if (j.ok && j.path) setCvPath(j.path); else { setErr(j.error || L('No se pudo subir el CV.', 'Could not upload the resume.')); setCvName(''); }
    } catch { setErr(L('No se pudo subir el CV.', 'Could not upload the resume.')); setCvName(''); }
    setCvBusy(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr('');
    if (f.name.trim().length < 2 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) { setErr(L('Pon tu nombre y un correo válido.', 'Enter your name and a valid email.')); return; }
    if (cvBusy) { setErr(L('Espera a que termine de subir el CV.', 'Wait for the resume upload to finish.')); return; }
    setBusy(true);
    try {
      const r = await fetch('/api/sales/apply', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...f, resume_path: cvPath }) });
      const j = await r.json();
      if (j.ok) setDone(true); else setErr(j.error || L('No se pudo enviar. Intenta de nuevo.', 'Could not send. Try again.'));
    } catch { setErr(L('Error de red.', 'Network error.')); }
    setBusy(false);
  }

  const inp: React.CSSProperties = { width: '100%', padding: '11px 13px', borderRadius: 10, border: '1px solid var(--line,#2a3350)', background: 'var(--bg,#0e1220)', color: 'var(--tx,#e8ecf5)', fontSize: 14, marginTop: 6 };
  const lbl: React.CSSProperties = { fontSize: 13, color: 'var(--mut,#9aa6bd)', fontWeight: 600 };
  const wrap: React.CSSProperties = { maxWidth: 640, margin: '0 auto', padding: '28px 20px 60px' };

  if (done) return (
    <div style={wrap}>
      <div style={{ background: 'var(--panel,#161c2e)', border: '1px solid var(--line,#2a3350)', borderRadius: 16, padding: 28, textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', width: 56, height: 56, borderRadius: '50%', background: 'rgba(94,214,160,.15)', alignItems: 'center', justifyContent: 'center' }}><Ic n="check" s={30} c="#5ed6a0" /></div>
        <h1 style={{ fontSize: 22, margin: '12px 0 6px', color: 'var(--tx,#e8ecf5)' }}>{L('¡Solicitud enviada!', 'Application sent!')}</h1>
        <p style={{ color: 'var(--mut,#9aa6bd)', margin: 0 }}>{L('Gracias por tu interés. Revisaremos tu perfil y te contactaremos pronto.', 'Thanks for your interest. We’ll review your profile and contact you soon.')}</p>
      </div>
    </div>
  );

  const feats: [string, string, string][] = [
    ['cash', L('Comisión recurrente', 'Recurring commission'), L('Cobras cada mes que tu cliente pague.', 'You earn every month your client pays.')],
    ['team', L('Sube de nivel', 'Grow a team'), L('Los supervisores ganan de su equipo.', 'Supervisors earn from their team.')],
    ['gift', L('Pruebas y descuentos', 'Trials & discounts'), L('Herramientas para cerrar ventas.', 'Tools to close sales.')],
    ['chat', L('Atiendes a tus clientes', 'Support your clients'), L('Tickets y soporte propios.', 'Your own tickets and support.')],
  ];

  return (
    <div style={wrap}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button onClick={() => setLang(lang === 'es' ? 'en' : 'es')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 10, border: '1px solid var(--line,#2a3350)', background: 'var(--bg,#0e1220)', color: 'var(--tx,#e8ecf5)', cursor: 'pointer', fontSize: 13 }}><Ic n="globe" s={15} />{lang === 'es' ? 'EN' : 'ES'}</button>
      </div>

      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--gold,#e5b567)', fontWeight: 700 }}>{L('Programa privado', 'Private program')}</div>
        <h1 style={{ fontSize: 27, margin: '6px 0 8px', color: 'var(--tx,#e8ecf5)' }}>{L('Únete al equipo de ventas de Onyx', 'Join the Onyx sales team')}</h1>
        <p style={{ color: 'var(--mut,#9aa6bd)', margin: 0, fontSize: 15, lineHeight: 1.6 }}>
          {L('No es un simple programa de referidos: eres parte de la compañía. Traes clientes, los atiendes, y cobras una comisión recurrente TODOS los meses mientras tu cliente siga activo.',
             'Not a simple referral program: you’re part of the company. You bring clients, support them, and earn a recurring commission EVERY month while your client stays active.')}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginBottom: 22 }}>
        {feats.map(([icon, t, d], i) => (
          <div key={i} style={{ background: 'var(--card,#1b2338)', border: '1px solid var(--line,#2a3350)', borderRadius: 12, padding: 14 }}>
            <div style={{ display: 'inline-flex', width: 36, height: 36, borderRadius: 9, background: 'rgba(139,147,255,.14)', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}><Ic n={icon} s={19} c="#a9b0ff" /></div>
            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--tx,#e8ecf5)' }}>{t}</div>
            <div style={{ fontSize: 12.5, color: 'var(--mut,#9aa6bd)', marginTop: 2 }}>{d}</div>
          </div>
        ))}
      </div>

      <form onSubmit={submit} style={{ background: 'var(--panel,#161c2e)', border: '1px solid var(--line,#2a3350)', borderRadius: 16, padding: 22 }}>
        <h2 style={{ fontSize: 18, margin: '0 0 12px', color: 'var(--tx,#e8ecf5)' }}>{L('Cuéntanos de ti', 'Tell us about you')}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label><span style={lbl}>{L('Nombre completo', 'Full name')} *</span><input style={inp} value={f.name} onChange={(e) => upd('name', e.target.value)} /></label>
          <label><span style={lbl}>{L('Correo', 'Email')} *</span><input style={inp} type="email" value={f.email} onChange={(e) => upd('email', e.target.value)} /></label>
          <label><span style={lbl}>{L('Teléfono / WhatsApp', 'Phone / WhatsApp')}</span><input style={inp} value={f.phone} onChange={(e) => upd('phone', e.target.value)} /></label>
          <label><span style={lbl}>{L('País', 'Country')}</span><input style={inp} value={f.country} onChange={(e) => upd('country', e.target.value)} /></label>
        </div>
        <label style={{ display: 'block', marginTop: 12 }}><span style={lbl}>{L('¿Qué rol te interesa?', 'Which role interests you?')}</span>
          <select style={inp} value={f.desired_role} onChange={(e) => upd('desired_role', e.target.value)}>
            <option value="vendedor">{L('Vendedor (traer y atender clientes)', 'Seller (bring & support clients)')}</option>
            <option value="supervisor">{L('Supervisor (liderar un equipo de vendedores)', 'Supervisor (lead a team of sellers)')}</option>
          </select>
        </label>
        <label style={{ display: 'block', marginTop: 12 }}><span style={lbl}>{L('Tu experiencia comercial', 'Your sales experience')}</span>
          <textarea style={{ ...inp, minHeight: 70, resize: 'vertical' }} value={f.experience} onChange={(e) => upd('experience', e.target.value)} placeholder={L('Ventas, trading, comunidad, etc.', 'Sales, trading, community, etc.')} /></label>
        <label style={{ display: 'block', marginTop: 12 }}><span style={lbl}>{L('¿A qué audiencia llegas?', 'What audience do you reach?')}</span>
          <textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }} value={f.audience} onChange={(e) => upd('audience', e.target.value)} placeholder={L('Redes, grupos, país, idioma…', 'Social, groups, country, language…')} /></label>

        {/* Currículum (PDF) → bucket privado */}
        <div style={{ marginTop: 12 }}>
          <span style={lbl}>{L('Currículum / CV (PDF, opcional)', 'Resume / CV (PDF, optional)')}</span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, padding: '11px 13px', borderRadius: 10, border: '1px dashed var(--line,#2a3350)', background: 'var(--bg,#0e1220)', cursor: 'pointer', color: 'var(--mut,#9aa6bd)', fontSize: 13.5 }}>
            <Ic n={cvPath ? 'file' : 'upload'} s={18} c={cvPath ? '#5ed6a0' : '#a9b0ff'} />
            <span style={{ flex: 1, color: cvPath ? 'var(--tx,#e8ecf5)' : undefined, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {cvBusy ? L('Subiendo…', 'Uploading…') : cvName ? cvName : L('Selecciona tu CV en PDF (máx 5 MB)', 'Choose your PDF resume (max 5 MB)')}
            </span>
            {cvPath && <Ic n="check" s={17} c="#5ed6a0" />}
            <input type="file" accept="application/pdf" onChange={onCv} style={{ display: 'none' }} />
          </label>
        </div>

        <label style={{ display: 'block', marginTop: 12 }}><span style={lbl}>{L('Mensaje (opcional)', 'Message (optional)')}</span>
          <textarea style={{ ...inp, minHeight: 50, resize: 'vertical' }} value={f.note} onChange={(e) => upd('note', e.target.value)} /></label>

        {err && <div style={{ color: 'var(--red,#f0736f)', fontSize: 13, marginTop: 10 }}>{err}</div>}
        <button type="submit" disabled={busy} style={{ marginTop: 16, width: '100%', padding: '13px', borderRadius: 10, border: 'none', background: 'var(--accent,#8b93ff)', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', opacity: busy ? .6 : 1 }}>
          {busy ? L('Enviando…', 'Sending…') : L('Enviar solicitud', 'Send application')}
        </button>
        <p style={{ fontSize: 11.5, color: 'var(--mut,#9aa6bd)', textAlign: 'center', marginTop: 10 }}>
          {L('Al enviar aceptas que revisemos tu perfil. Este programa es por invitación.', 'By sending you agree we review your profile. This program is invite-only.')}
        </p>
      </form>
    </div>
  );
}
