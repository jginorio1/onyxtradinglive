'use client';
import { useState } from 'react';
import { useBeta } from '@/lib/beta';
import { useLang } from '@/lib/lang';

// Aviso fijo arriba cuando el visitante está viendo la versión beta.
// Deja salir de la beta con un clic (borra la cookie onyx_beta).
export default function BetaBanner() {
  const { beta, setBeta } = useBeta();
  const { lang } = useLang();
  const [busy, setBusy] = useState(false);
  if (!beta) return null;
  const es = lang === 'es';

  async function exit() {
    setBusy(true);
    try {
      await fetch('/api/admin/beta', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ off: true }) });
      setBeta(false);
    } finally { setBusy(false); }
  }

  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 60, display: 'flex', alignItems: 'center',
      justifyContent: 'center', gap: 12, padding: '7px 14px', fontSize: 13, fontWeight: 600,
      color: '#0a0d14', background: 'linear-gradient(90deg,#ffd166,#f4a340)',
    }}>
      <span>🧪 {es ? 'Estás viendo la versión BETA' : 'You are viewing the BETA version'}</span>
      <button onClick={exit} disabled={busy} style={{
        border: 'none', borderRadius: 999, padding: '3px 12px', fontSize: 12, fontWeight: 700,
        background: '#0a0d14', color: '#ffd166', cursor: 'pointer',
      }}>{busy ? '…' : (es ? 'Salir de la beta' : 'Exit beta')}</button>
    </div>
  );
}
