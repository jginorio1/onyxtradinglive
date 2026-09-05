'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLang } from '@/lib/lang';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

// Pantalla de bloqueo del panel admin. La renderiza el servidor cuando la
// sesión está bloqueada por inactividad; sin PIN correcto no se ven los datos.
export default function LockScreen({ email }: { email: string }) {
  const { lang } = useLang();
  const es = lang === 'es';
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function unlock() {
    if (pin.length !== 6) return;
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/admin/security', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'unlock', pin }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { router.refresh(); return; }
      if (d.forceLogout) { await logout(); return; }
      setErr(es ? 'PIN incorrecto.' : 'Wrong PIN.'); setPin('');
    } finally { setBusy(false); }
  }

  async function logout() {
    try { await supabaseBrowser().auth.signOut(); } catch {}
    window.location.href = '/login';
  }

  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 360, textAlign: 'center' }}>
        <div style={{ width: 54, height: 54, borderRadius: 14, margin: '0 auto 14px', background: 'rgba(124,140,255,.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>🔒</div>
        <h1 style={{ fontSize: 20, marginBottom: 4 }}>{es ? 'Panel bloqueado' : 'Panel locked'}</h1>
        <p className="muted" style={{ fontSize: 13.5, marginBottom: 4 }}>
          {es ? 'Se bloqueó por inactividad. Ingresa tu PIN de 6 dígitos para continuar.' : 'Locked due to inactivity. Enter your 6-digit PIN to continue.'}
        </p>
        <p className="muted" style={{ fontSize: 12, marginBottom: 18 }}>{email}</p>

        <input
          autoFocus type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          onKeyDown={(e) => e.key === 'Enter' && unlock()}
          placeholder="••••••"
          style={{ width: 200, textAlign: 'center', letterSpacing: 8, fontSize: 22, padding: '12px 14px', margin: '0 auto', display: 'block', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--tx)' }}
        />
        {err && <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 10 }}>{err}</div>}

        <button className="btn btn-primary" onClick={unlock} disabled={busy || pin.length !== 6}
          style={{ marginTop: 16, width: 200 }}>{busy ? '…' : (es ? 'Desbloquear' : 'Unlock')}</button>

        <div style={{ marginTop: 14 }}>
          <button className="btn btn-ghost" onClick={logout} style={{ fontSize: 12.5 }}>
            {es ? 'Salir e iniciar sesión con contraseña' : 'Sign out and log in with password'}
          </button>
        </div>
      </div>
    </div>
  );
}
