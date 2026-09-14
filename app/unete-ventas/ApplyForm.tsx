'use client';
import { useState } from 'react';

// Formulario de reclutamiento (landing oculta). Bilingüe con un botón ES/EN.
export default function ApplyForm() {
  const [lang, setLang] = useState<'es' | 'en'>('es');
  const L = (es: string, en: string) => (lang === 'es' ? es : en);
  const [f, setF] = useState({ name: '', email: '', phone: '', country: '', desired_role: 'vendedor', experience: '', audience: '', note: '' });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');
  const upd = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr('');
    if (f.name.trim().length < 2 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) { setErr(L('Pon tu nombre y un correo válido.', 'Enter your name and a valid email.')); return; }
    setBusy(true);
    try {
      const r = await fetch('/api/sales/apply', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(f) });
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
        <div style={{ fontSize: 40 }}>✅</div>
        <h1 style={{ fontSize: 22, margin: '10px 0 6px', color: 'var(--tx,#e8ecf5)' }}>{L('¡Solicitud enviada!', 'Application sent!')}</h1>
        <p style={{ color: 'var(--mut,#9aa6bd)', margin: 0 }}>{L('Gracias por tu interés. Revisaremos tu perfil y te contactaremos pronto.', 'Thanks for your interest. We’ll review your profile and contact you soon.')}</p>
      </div>
    </div>
  );

  return (
    <div style={wrap}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button onClick={() => setLang(lang === 'es' ? 'en' : 'es')} style={{ ...inp, width: 'auto', marginTop: 0, padding: '6px 12px', cursor: 'pointer', fontSize: 13 }}>{lang === 'es' ? '🇬🇧 EN' : '🇪🇸 ES'}</button>
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
        {[
          [L('💵 Comisión recurrente', '💵 Recurring commission'), L('Cobras cada mes que tu cliente pague.', 'You earn every month your client pays.')],
          [L('🧑‍🤝‍🧑 Sube de nivel', '🧑‍🤝‍🧑 Grow a team'), L('Supervisores ganan de su equipo.', 'Supervisors earn from their team.')],
          [L('🎁 Das pruebas y descuentos', '🎁 Trials & discounts'), L('Herramientas para cerrar ventas.', 'Tools to close sales.')],
          [L('💬 Atiendes a tus clientes', '💬 Support your clients'), L('Tickets y soporte propios.', 'Your own tickets and support.')],
        ].map(([t, d], i) => (
          <div key={i} style={{ background: 'var(--card,#1b2338)', border: '1px solid var(--line,#2a3350)', borderRadius: 12, padding: 12 }}>
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
