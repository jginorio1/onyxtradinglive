'use client';
import { useState } from 'react';
import OnyxIcon from '@/app/components/OnyxIcon';

// El alumno canjea un código de beca. Al hacerlo, entra a la academia con acceso.
export default function RedeemBeca({ L, onDone }: { L: (es: string, en: string) => string; onDone: (mentorId: string) => void }) {
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  // Solicitar beca
  const [showApply, setShowApply] = useState(false);
  const [acadCode, setAcadCode] = useState('');
  const [message, setMessage] = useState('');
  const [reason, setReason] = useState('low_income');
  const [aMsg, setAMsg] = useState('');

  async function redeem() {
    if (!code.trim()) return;
    setBusy(true); setMsg('');
    try {
      const r = await fetch('/api/academy/scholarships/redeem', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: code.trim() }) });
      const j = await r.json();
      if (!r.ok) { setMsg(j.error || L('No se pudo canjear.', 'Could not redeem.')); return; }
      setMsg(L('¡Beca activada! 🎓', 'Scholarship activated! 🎓')); setCode('');
      if (j.mentorId) onDone(j.mentorId);
    } finally { setBusy(false); }
  }
  async function apply() {
    if (!acadCode.trim() || !message.trim()) { setAMsg(L('Pon el código de la academia y cuéntanos por qué la necesitas.', 'Enter the academy code and tell us why you need it.')); return; }
    setBusy(true); setAMsg('');
    try {
      const r = await fetch('/api/academy/scholarships/apply', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: acadCode.trim(), message, reason }) });
      const j = await r.json();
      if (!r.ok) { setAMsg(j.error || L('No se pudo enviar.', 'Could not send.')); return; }
      setAMsg(L('¡Solicitud enviada! El mentor la revisará.', 'Request sent! The mentor will review it.')); setMessage(''); setAcadCode('');
    } finally { setBusy(false); }
  }

  return (
    <div className="sk-card">
      <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <OnyxIcon emoji="🎓" size={16} />
        <span style={{ fontSize: 13.5, fontWeight: 600 }}>{L('¿Tienes una beca?', 'Have a scholarship?')}</span>
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder={L('Ingresa tu código de beca', 'Enter your scholarship code')} style={{ margin: 0, flex: 1, minWidth: 160 }} onKeyDown={(e) => e.key === 'Enter' && redeem()} />
        <button className="btn btn-primary" onClick={redeem} disabled={busy}>{busy ? '…' : L('Canjear', 'Redeem')}</button>
      </div>
      {msg && <div className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>{msg}</div>}

      <button className="btn btn-ghost" style={{ fontSize: 12, marginTop: 8 }} onClick={() => setShowApply((v) => !v)}>
        {showApply ? '▾ ' : '▸ '}{L('¿No tienes código? Solicita una beca', 'No code? Apply for a scholarship')}
      </button>
      {showApply && (
        <div style={{ marginTop: 8, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <input value={acadCode} onChange={(e) => setAcadCode(e.target.value)} placeholder={L('Código de la academia', 'Academy code')} style={{ margin: 0, flex: '1 1 160px' }} />
            <select value={reason} onChange={(e) => setReason(e.target.value)} style={{ margin: 0 }}>
              <option value="low_income">{L('Pocos recursos', 'Low income')}</option>
              <option value="merit">{L('Mérito', 'Merit')}</option>
              <option value="other">{L('Otro', 'Other')}</option>
            </select>
          </div>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder={L('Cuéntale al mentor por qué necesitas la beca…', 'Tell the mentor why you need the scholarship…')} style={{ width: '100%', margin: 0 }} />
          <div className="row" style={{ gap: 10, alignItems: 'center', marginTop: 8 }}>
            <button className="btn btn-primary" onClick={apply} disabled={busy}>{busy ? '…' : L('Enviar solicitud', 'Send request')}</button>
            {aMsg && <span className="muted" style={{ fontSize: 12.5 }}>{aMsg}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
