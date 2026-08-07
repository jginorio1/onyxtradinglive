'use client';
import { useState } from 'react';
import OnyxIcon from '@/app/components/OnyxIcon';

// El alumno canjea un código de beca. Al hacerlo, entra a la academia con acceso.
export default function RedeemBeca({ L, onDone }: { L: (es: string, en: string) => string; onDone: (mentorId: string) => void }) {
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

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

  return (
    <div className="sk-card">
      <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <OnyxIcon emoji="🎓" size={16} />
        <span style={{ fontSize: 13.5, fontWeight: 600 }}>{L('¿Tienes una beca?', 'Have a scholarship?')}</span>
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder={L('Ingresa tu código de beca', 'Enter your scholarship code')} style={{ margin: 0, flex: 1, minWidth: 160 }} onKeyDown={(e) => e.key === 'Enter' && redeem()} />
        <button className="btn btn-primary" onClick={redeem} disabled={busy}>{busy ? '…' : L('Canjear', 'Redeem')}</button>
      </div>
      {msg && <div className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>{msg}</div>}
    </div>
  );
}
