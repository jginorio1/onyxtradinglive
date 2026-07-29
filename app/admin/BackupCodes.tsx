'use client';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/lang';

// Códigos de respaldo del 2FA: por si pierdes el teléfono. Se generan una vez y
// se muestran solo en ese momento (se guardan cifrados). Cada uno se usa una vez.
export default function BackupCodes() {
  const { lang } = useLang();
  const es = lang !== 'en';
  const [left, setLeft] = useState<number | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = () => fetch('/api/admin/2fa-backup').then((r) => r.json()).then((d) => setLeft(d.left ?? 0)).catch(() => {});
  useEffect(() => { load(); }, []);

  async function generate() {
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/admin/2fa-backup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'generate' }) });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || (es ? 'No se pudo generar.' : 'Could not generate.')); return; }
      setCodes(d.codes || []); load();
    } finally { setBusy(false); }
  }

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <div className="row between" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
        <b style={{ fontSize: 14 }}>🗝️ {es ? 'Códigos de respaldo (2FA)' : 'Backup codes (2FA)'}</b>
        {left !== null && <span className="pill" style={left > 0 ? { color: 'var(--soft-green)', background: 'rgba(52,226,160,.15)' } : { color: 'var(--amber)', background: 'rgba(255,192,77,.16)' }}>{left} {es ? 'disponibles' : 'left'}</span>}
      </div>
      <p className="muted" style={{ fontSize: 12.5, marginBottom: 10 }}>
        {es ? 'Guárdalos en un lugar seguro. Si pierdes el teléfono, entras con uno de estos códigos. Al generar de nuevo, los anteriores dejan de servir.'
            : 'Store them somewhere safe. If you lose your phone, sign in with one of these codes. Generating new ones invalidates the old ones.'}
      </p>

      {codes && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 12, padding: 12, marginBottom: 10 }}>
          {codes.map((c) => <div key={c} className="code" style={{ textAlign: 'center', letterSpacing: 2, fontSize: 14 }}>{c}</div>)}
        </div>
      )}
      {codes && <button className="btn btn-ghost" style={{ fontSize: 12.5, marginBottom: 10 }} onClick={() => { try { navigator.clipboard.writeText(codes.join('\n')); } catch {} }}>📋 {es ? 'Copiar todos' : 'Copy all'}</button>}

      {err && <div style={{ color: 'var(--amber)', fontSize: 12.5, marginBottom: 8 }}>{err}</div>}
      <button className="btn btn-primary" onClick={generate} disabled={busy} style={{ padding: '8px 12px' }}>
        {busy ? '…' : (left ? (es ? 'Regenerar códigos' : 'Regenerate codes') : (es ? 'Generar códigos' : 'Generate codes'))}
      </button>
    </div>
  );
}
