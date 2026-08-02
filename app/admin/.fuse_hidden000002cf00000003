'use client';
import { useState } from 'react';
import { toast } from '@/lib/toast';
import { useLang } from '@/lib/lang';

// Cambio de entorno (Producción ⇄ Beta). El aislamiento real vive en la
// infraestructura (otra URL + otra base de datos); esto es solo el atajo con
// PIN + alerta para no entrar a pruebas por accidente.
const CUR = (process.env.NEXT_PUBLIC_APP_ENV || 'production').toLowerCase();
const BETA_URL = process.env.NEXT_PUBLIC_BETA_URL || '';
const PROD_URL = process.env.NEXT_PUBLIC_PROD_URL || '';

export default function EnvSwitch() {
  const { lang } = useLang();
  const L = (es: string, en: string) => (lang === 'en' ? en : es);
  const isBeta = CUR === 'beta' || CUR === 'staging';
  const [ask, setAsk] = useState(false);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);

  function goProd() {
    if (!PROD_URL) { toast(L('Falta NEXT_PUBLIC_PROD_URL en Vercel.', 'NEXT_PUBLIC_PROD_URL is missing in Vercel.')); return; }
    window.location.href = PROD_URL;
  }
  async function confirmBeta() {
    if (!BETA_URL) { toast(L('Falta NEXT_PUBLIC_BETA_URL en Vercel.', 'NEXT_PUBLIC_BETA_URL is missing in Vercel.')); return; }
    setBusy(true);
    try {
      const r = await fetch('/api/admin/env-switch', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pin }) });
      const j = await r.json();
      if (!r.ok || !j.ok) { toast(j.error || L('PIN incorrecto', 'Wrong PIN')); return; }
      window.location.href = BETA_URL;
    } finally { setBusy(false); }
  }

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="row between" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
        <h3 style={{ margin: 0 }}>🧭 {L('Entorno', 'Environment')}</h3>
        <span className="pill" style={isBeta ? { color: '#fff', background: '#7a3cff' } : { color: 'var(--soft-green)', background: 'rgba(52,226,160,.15)' }}>
          {isBeta ? L('ESTÁS EN BETA', 'YOU ARE IN BETA') : L('Producción', 'Production')}
        </span>
      </div>
      <p className="muted" style={{ fontSize: 13.5, marginBottom: 10 }}>
        {L('Beta y Producción son sitios y bases de datos separados. Aquí solo saltas de uno a otro.', 'Beta and Production are separate sites and databases. Here you just jump between them.')}
      </p>

      {isBeta ? (
        <button className="btn btn-primary" onClick={goProd}>← {L('Volver a Producción', 'Back to Production')}</button>
      ) : (
        <button className="btn btn-ghost" style={{ borderColor: '#7a3cff', color: '#a06bff' }} onClick={() => { setPin(''); setAsk(true); }}>
          🧪 {L('Ir a Beta (pruebas)', 'Go to Beta (testing)')}
        </button>
      )}

      {ask && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setAsk(false)}>
          <div className="card" style={{ maxWidth: 420, width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>⚠️ {L('Vas a entrar al entorno de PRUEBAS', 'You are entering the TESTING environment')}</h3>
            <p className="muted" style={{ fontSize: 13.5, marginBottom: 12 }}>
              {L('En Beta los datos y los pagos NO son reales. Los cambios que hagas ahí no afectan a tus clientes. Confirma con tu PIN.', 'In Beta, data and payments are NOT real. Changes there do not affect your customers. Confirm with your PIN.')}
            </p>
            <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="••••••" inputMode="numeric"
              style={{ width: 150, letterSpacing: 4, textAlign: 'center', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--tx)' }} />
            <div className="row" style={{ gap: 10, marginTop: 14 }}>
              <button className="btn btn-primary" onClick={confirmBeta} disabled={busy}>{busy ? '…' : L('Entrar a Beta', 'Enter Beta')}</button>
              <button className="btn btn-ghost" onClick={() => setAsk(false)}>{L('Cancelar', 'Cancel')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
