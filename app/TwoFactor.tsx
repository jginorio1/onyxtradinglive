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
    bkT: 'Guarda tus códigos de respaldo', bkH: 'Si pierdes el teléfono, entra con uno de estos códigos (cada uno se usa una sola vez). Guárdalos en un lugar seguro; no volverán a mostrarse.',
    bkContinue: 'Ya los guardé, continuar', bkUse: '¿Perdiste el teléfono? Usa un código de respaldo', bkBack: '← Volver al código de la app',
    bkCode: 'Código de respaldo', bkVerify: 'Entrar con código', bkCopy: 'Copiar todos',
    enlarge: 'Toca para ampliar', copyKey: 'Copiar clave', copied: '¡Copiado!',
  },
  en: {
    setupT: 'Enable two-step verification', setupH: 'Scan the QR with Google Authenticator or Authy, then enter the 6-digit code it shows.',
    manual: 'Or type this key into your app manually:', code: '6-digit code', verify: 'Verify and enable',
    challT: 'Two-step verification', challH: 'Enter the 6-digit code from your authenticator app.', confirm: 'Confirm',
    bad: 'Wrong code. Try again.', err: 'Something went wrong. Reload and try again.', loading: '…',
    bkT: 'Save your backup codes', bkH: 'If you lose your phone, sign in with one of these codes (each works once). Store them somewhere safe; they will not be shown again.',
    bkContinue: 'I saved them, continue', bkUse: 'Lost your phone? Use a backup code', bkBack: '← Back to app code',
    bkCode: 'Backup code', bkVerify: 'Sign in with code', bkCopy: 'Copy all',
    enlarge: 'Tap to enlarge', copyKey: 'Copy key', copied: 'Copied!',
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
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);  // mostrados 1 vez tras activar
  const [useBackup, setUseBackup] = useState(false);                       // en el challenge: usar código de respaldo
  const [bcode, setBcode] = useState('');
  const [zoom, setZoom] = useState(false);       // ampliar el QR (para escanear desde otro móvil)
  const [copiedSec, setCopiedSec] = useState(false);

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
      // Al ACTIVAR el 2FA, generamos y mostramos los códigos de respaldo una vez.
      if (mode === 'enroll') {
        try { const r = await fetch('/api/admin/2fa-backup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'generate' }) }); const j = await r.json(); if (j.codes?.length) { setBackupCodes(j.codes); return; } } catch {}
      }
      onDone();
    } catch { setMsg(L.err); } finally { setBusy(false); }
  }

  // Entrar con un código de respaldo (cuando no tienes el teléfono a mano).
  async function submitBackup() {
    if (!bcode.trim()) return;
    setBusy(true); setMsg('');
    try {
      const r = await fetch('/api/admin/2fa-backup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'verify', code: bcode }) });
      if (!r.ok) { setMsg(L.bad); setBcode(''); return; }
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

  // Pantalla de códigos de respaldo (tras activar el 2FA). Se muestran una vez.
  if (backupCodes) {
    return (
      <div style={box}>
        <h3 style={{ marginBottom: 4 }}>🗝️ {L.bkT}</h3>
        <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>{L.bkH}</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 12, padding: 12 }}>
          {backupCodes.map((c) => <div key={c} className="code" style={{ textAlign: 'center', letterSpacing: 2, fontSize: 14 }}>{c}</div>)}
        </div>
        <button className="btn btn-ghost" style={{ width: '100%', marginTop: 10, fontSize: 13 }} onClick={() => { try { navigator.clipboard.writeText(backupCodes.join('\n')); } catch {} }}>📋 {L.bkCopy}</button>
        <button className="btn btn-primary" style={{ width: '100%', marginTop: 10 }} onClick={onDone}>{L.bkContinue}</button>
      </div>
    );
  }

  if (mode === 'enroll') {
    return (
      <div style={box}>
        <h3 style={{ marginBottom: 4 }}>🔐 {L.setupT}</h3>
        <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>{L.setupH}</p>
        {!ready && <div className="muted">{L.loading}</div>}
        {ready && (
          <>
            <div title={L.enlarge} onClick={() => setZoom(true)} style={{ background: '#fff', borderRadius: 12, padding: 12, width: 200, height: 200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-in' }}>
              {qr.startsWith('<svg') ? <span style={{ width: '100%', height: '100%' }} dangerouslySetInnerHTML={{ __html: qr }} /> : <img src={qr} alt="QR" style={{ width: '100%', height: '100%' }} />}
            </div>
            <div className="muted" style={{ fontSize: 11.5, textAlign: 'center', marginTop: 6 }}>🔍 {L.enlarge}</div>
            {secret && (
              <div style={{ marginTop: 12, fontSize: 12 }}>
                <span className="muted">{L.manual}</span>
                <div className="row" style={{ gap: 8, marginTop: 4, alignItems: 'center' }}>
                  <div className="code" style={{ flex: 1, wordBreak: 'break-all' }}>{secret}</div>
                  <button className="btn btn-ghost" style={{ fontSize: 12, padding: '5px 10px', flex: 'none' }} onClick={() => { try { navigator.clipboard.writeText(secret); setCopiedSec(true); setTimeout(() => setCopiedSec(false), 1500); } catch {} }}>{copiedSec ? '✓' : '📋'} {copiedSec ? L.copied : L.copyKey}</button>
                </div>
              </div>
            )}
            {zoom && (
              <div onClick={() => setZoom(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                <div style={{ background: '#fff', borderRadius: 16, padding: 20, width: 320, height: 320, maxWidth: '90vw', maxHeight: '90vw', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {qr.startsWith('<svg') ? <span style={{ width: '100%', height: '100%' }} dangerouslySetInnerHTML={{ __html: qr }} /> : <img src={qr} alt="QR" style={{ width: '100%', height: '100%' }} />}
                </div>
              </div>
            )}
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
      {!useBackup ? (
        <>
          <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>{L.challH}</p>
          <span className="muted" style={{ fontSize: 12 }}>{L.code}</span>{input}
          {msg && <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 8 }}>{msg}</div>}
          <button className="btn btn-primary" style={{ width: '100%', marginTop: 14 }} disabled={busy || code.length !== 6} onClick={submit}>{busy ? L.loading : L.confirm}</button>
          <button className="btn btn-ghost" style={{ width: '100%', marginTop: 8, fontSize: 12.5 }} onClick={() => { setUseBackup(true); setMsg(''); }}>{L.bkUse}</button>
        </>
      ) : (
        <>
          <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>{L.bkH}</p>
          <span className="muted" style={{ fontSize: 12 }}>{L.bkCode}</span>
          <input value={bcode} autoFocus autoComplete="off" maxLength={12}
            onChange={(e) => setBcode(e.target.value.replace(/[^a-fA-F0-9]/g, '').toLowerCase().slice(0, 12))}
            onKeyDown={(e) => { if (e.key === 'Enter') submitBackup(); }}
            placeholder="a1b2c3d4e5" style={{ letterSpacing: 3, textAlign: 'center', fontSize: 18, margin: '6px 0 0' }} />
          {msg && <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 8 }}>{msg}</div>}
          <button className="btn btn-primary" style={{ width: '100%', marginTop: 14 }} disabled={busy || !bcode.trim()} onClick={submitBackup}>{busy ? L.loading : L.bkVerify}</button>
          <button className="btn btn-ghost" style={{ width: '100%', marginTop: 8, fontSize: 12.5 }} onClick={() => { setUseBackup(false); setMsg(''); }}>{L.bkBack}</button>
        </>
      )}
    </div>
  );
}
