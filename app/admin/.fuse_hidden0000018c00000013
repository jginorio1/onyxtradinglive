'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLang } from '@/lib/lang';

// Cambio obligatorio del PIN provisional en el primer acceso del empleado.
// No deja entrar al panel hasta que fija uno propio (distinto del temporal).
export default function ChangePin({ email }: { email: string }) {
  const { lang } = useLang();
  const es = lang === 'es';
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    if (pin.length !== 6) return;
    if (pin !== pin2) { setErr(es ? 'Los PIN no coinciden.' : 'PINs do not match.'); return; }
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/admin/security', {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { router.refresh(); return; }
      setErr(d.error || (es ? 'No se pudo guardar.' : 'Could not save.'));
    } finally { setBusy(false); }
  }

  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 380, textAlign: 'center' }}>
        <div style={{ width: 54, height: 54, borderRadius: 14, margin: '0 auto 14px', background: 'rgba(124,140,255,.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>🔑</div>
        <h1 style={{ fontSize: 20, marginBottom: 4 }}>{es ? 'Crea tu PIN' : 'Create your PIN'}</h1>
        <p className="muted" style={{ fontSize: 13.5, marginBottom: 4 }}>
          {es ? 'Tu acceso usa un PIN temporal. Elige uno nuevo de 6 dígitos que solo tú sepas.' : 'Your access uses a temporary PIN. Choose a new 6-digit one only you know.'}
        </p>
        <p className="muted" style={{ fontSize: 12, marginBottom: 18 }}>{email}</p>

        <input autoFocus inputMode="numeric" maxLength={6} value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder={es ? 'Nuevo PIN' : 'New PIN'}
          style={{ width: 220, textAlign: 'center', letterSpacing: 6, fontSize: 20, padding: '11px 14px', margin: '0 auto 10px', display: 'block', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--tx)' }} />
        <input inputMode="numeric" maxLength={6} value={pin2}
          onChange={(e) => setPin2(e.target.value.replace(/\D/g, '').slice(0, 6))}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          placeholder={es ? 'Repite el PIN' : 'Repeat PIN'}
          style={{ width: 220, textAlign: 'center', letterSpacing: 6, fontSize: 20, padding: '11px 14px', margin: '0 auto', display: 'block', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--tx)' }} />
        {err && <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 10 }}>{err}</div>}

        <button className="btn btn-primary" onClick={save} disabled={busy || pin.length !== 6 || pin2.length !== 6}
          style={{ marginTop: 16, width: 220 }}>{busy ? '…' : (es ? 'Guardar y entrar' : 'Save and enter')}</button>
      </div>
    </div>
  );
}
