'use client';
import { toast, toastErr, confirmDialog } from '@/lib/toast';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/lang';

// Tarjeta de limpieza de registros basura (cuentas sin confirmar >7 días).
export default function CleanSignups() {
  const { lang } = useLang();
  const es = lang === 'es';
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { load(); }, []);
  async function load() {
    try { const r = await fetch('/api/admin/clean-signups'); const j = await r.json(); setCount(Number(j.count || 0)); } catch { setCount(0); }
  }
  async function clean() {
    if (!(await confirmDialog(es ? '¿Borrar todas las cuentas sin confirmar de más de 7 días? Son bots o registros abandonados.' : 'Delete all unconfirmed accounts older than 7 days? These are bots or abandoned sign-ups.'))) return;
    setBusy(true);
    try {
      const r = await fetch('/api/admin/clean-signups', { method: 'POST' });
      const j = await r.json();
      if (!r.ok) { toastErr(j); return; }
      toast(es ? `Borradas ${j.deleted} cuenta(s) basura.` : `Deleted ${j.deleted} junk account(s).`, 'ok');
      load();
    } finally { setBusy(false); }
  }

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="row between" style={{ flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 14.5, fontWeight: 700 }}>🧹 {es ? 'Limpieza de registros basura' : 'Junk sign-up cleanup'}</div>
          <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
            {es ? 'Cuentas creadas hace +7 días que nunca confirmaron el correo (bots / abandonadas). Se borran solas cada día; aquí puedes forzarlo.'
                : 'Accounts created +7 days ago that never confirmed their email (bots / abandoned). They auto-delete daily; here you can force it.'}
          </div>
        </div>
        <div className="row" style={{ gap: 10, alignItems: 'center' }}>
          <span className="pill" style={{ color: count ? 'var(--amber)' : 'var(--mut)', background: count ? 'rgba(255,192,77,.15)' : 'var(--card2)' }}>
            {count === null ? '…' : `${count} ${es ? 'por limpiar' : 'to clean'}`}
          </span>
          <button className="btn btn-danger" disabled={busy || !count} onClick={clean}>{busy ? '…' : (es ? 'Limpiar ahora' : 'Clean now')}</button>
        </div>
      </div>
    </div>
  );
}
