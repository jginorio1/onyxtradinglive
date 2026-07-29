'use client';
import { useState } from 'react';
import { useLang } from '@/lib/lang';

// Coach AI: repaso honesto del rendimiento del trader, bajo demanda.
export default function CoachCard() {
  const { lang } = useLang();
  const L = (es: string, en: string) => (lang === 'en' ? en : es);
  const [txt, setTxt] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [open, setOpen] = useState(true);

  async function gen() {
    setBusy(true); setMsg(''); setTxt('');
    try {
      const r = await fetch('/api/coach?lang=' + lang);
      const j = await r.json();
      if (j.locked) { setMsg(L('No disponible en tu plan.', 'Not available on your plan.')); return; }
      if (j.empty) { setMsg(L('Necesitas unas cuantas operaciones cerradas para tu repaso.', 'You need a few closed trades for your review.')); return; }
      if (!j.ok) { setMsg(L('No se pudo generar ahora. Inténtalo de nuevo.', "Couldn't generate now. Try again.")); return; }
      setTxt(j.review || ''); setOpen(true);
    } finally { setBusy(false); }
  }

  return (
    <div className="card" style={{ marginBottom: 14, border: '1px solid rgba(124,140,255,.3)' }}>
      <div className="row between" style={{ flexWrap: 'wrap', gap: 8, marginBottom: txt && open ? 10 : 0 }}>
        <div className="row" style={{ gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 22 }}>🧠</span>
          <div><b style={{ fontSize: 15 }}>{L('Coach AI', 'Onyx Coach')}</b>
            <div className="muted" style={{ fontSize: 12.5 }}>{L('Un repaso honesto de tu trading, en palabras claras.', 'An honest review of your trading, in plain words.')}</div></div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {txt && <button className="btn btn-ghost" onClick={() => setOpen((o) => !o)}>{open ? '▲ ' + L('Ocultar', 'Hide') : '▼ ' + L('Ver repaso', 'Show review')}</button>}
          <button className="btn btn-primary" onClick={gen} disabled={busy}>{busy ? '…' : (txt ? '↻ ' + L('Otra vez', 'Again') : '✨ ' + L('Generar repaso', 'Generate review'))}</button>
        </div>
      </div>
      {msg && <div className="muted" style={{ fontSize: 13 }}>{msg}</div>}
      {txt && open && <div style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: '12px 14px', fontSize: 14, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{txt}</div>}
    </div>
  );
}
