'use client';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

type Lang = 'es' | 'en';

const T: any = {
  es: {
    setupT: 'Activar verificación en dos pasos', setupH: 'Escanea el QR con Google Authenticator o Authy, y escribe el código de 6 dígitos que te muestre.',
    manual: 'O escribe esta clave a mano en tu app:', code: 'Código de 6 dígitos', verify: 'Verificar y activar',
    challT: 'Verificación en dos pasos', challH: 'Escribe el código de 6 dígitos de tu app de autenticación.', confirm: 'Confirmar',
    bad: 'Código incorrecto. Intenta de nuevo.', err: 'Algo salió mal. Recarga e intenta de nuevo.', loading: '…',
  },
  en: {
    setupT: 'Enable two-step verification', setupH: 'Scan the QR with Google Authenticator or Authy, then enter the 6-digit code it shows.',
    manual: 'Or type this key into your app manually:', code: '6-digit code', verify: 'Verify and enable',
    challT: 'Two-step verification', challH: 'Enter the 6-digit code from your authenticator app.', confirm: 'Confirm',
    bad: 'Wrong code. Try again.', err: 'Something went wrong. Reload and try again.', loading: '…',
  },
};

export default function TwoFactor({ mode, lang, onDone }: { mode: 'enroll' | 'challenge'; lang: Lang; onDone: () => void }) {
  const L = T[lang];
  const sb = supabaseBrowser();
  const [qr, setQr] = useState('');
  const [secret, setSecret] = useState('');
  const [factorId, setFactorId] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => { (mode === 'enroll' ? startEnroll() : startChallenge()); }, []);

  async function startEnroll() {
    try {
      // Limpia factores a medio activar de intentos anteriores.
      const { data: f } = await sb.auth.mfa.listFactors();
      for (const x of (f?.all || [])) { if (x.status !== 'verified') { try { await sb.auth.mfa.unenroll({ factorId: x.id }); } catch {} } }
      const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp' });
      if (error || !data) { setMsg(L.err); return; }
      setFactorId(data.id);
      setQr((data as any).totp?.qr_code || '');
      setSecret((data as any).totp?.secret || '');
      setReady(true);
    } catch { setMsg(L.err); }
  }
  async function startChallenge() {
    try {
      const { data } = await sb.auth.mfa.listFactors();
      const totp = (data?.totp || []).find((x: any) => x.status === 'verified') || (data?.totp || [])[0];
      if (!totp) { onDone(); return; }   // no hay factor → nada que verificar
      setFactorId(totp.id); setReady(true);
    } catch { setMsg(L.err); }
  }

  async function submit() {
    if (code.length !== 6) return;
    setBusy(true); setMsg('');
    try {
      const { data: ch, error: ce } = await sb.auth.mfa.challenge({ factorId });
      if (ce || !ch) { setMsg(L.err); return; }
      const { error } = await sb.auth.mfa.verify({ factorId, challengeId: ch.id, code });
      if (error) { setMsg(L.bad); setCode(''); return; }
      onDone();
    } catch { setMsg(L.err); } finally { setBusy(false); }
  }

  const box = { maxWidth: 380, margin: '0 auto' } as any;
  const input = (
    <input value={code} inputMode="numeric" maxLength={6} autoFocus
      onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
      onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
      placeholder="••••••" style={{ letterSpacing: 8, textAlign: 'center', fontSize: 20, margin: '6px 0 0' }} />
  );

  if (mode === 'enroll') {
    return (
      <div style={box}>
        <h3 style={{ marginBottom: 4 }}>🔐 {L.setupT}</h3>
        <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>{L.setupH}</p>
        {!ready && <div className="muted">{L.loading}</div>}
        {ready && (
          <>
            <div style={{ background: '#fff', borderRadius: 12, padding: 12, width: 200, height: 200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {qr.startsWith('<svg') ? <span style={{ width: '100%', height: '100%' }} dangerouslySetInnerHTML={{ __html: qr }} /> : <img src={qr} alt="QR" style={{ width: '100%', height: '100%' }} />}
            </div>
            {secret && <div style={{ marginTop: 12, fontSize: 12 }}><span className="muted">{L.manual}</span><div className="code" style={{ marginTop: 4, wordBreak: 'break-all' }}>{secret}</div></div>}
            <div style={{ marginTop: 14 }}><span className="muted" style={{ fontSize: 12 }}>{L.code}</span>{input}</div>
            {msg && <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 8 }}>{msg}</div>}
            <button className="btn btn-primary" style={{ width: '100%', marginTop: 14 }} disabled={busy || code.length !== 6} onClick={submit}>{busy ? L.loading : L.verify}</button>
          </>
        )}
      </div>
    );
  }

  return (
    <div style={box}>
      <h3 style={{ marginBottom: 4 }}>🔐 {L.challT}</h3>
      <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>{L.challH}</p>
      <span className="muted" style={{ fontSize: 12 }}>{L.code}</span>{input}
      {msg && <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 8 }}>{msg}</div>}
      <button className="btn btn-primary" style={{ width: '100%', marginTop: 14 }} disabled={busy || code.length !== 6} onClick={submit}>{busy ? L.loading : L.confirm}</button>
    </div>
  );
}
