'use client';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/lang';
import { useT } from '@/lib/adminText';

const T: any = {
  es: {
    exportNow: 'Exportar ahora', exportDesc: 'Descarga una copia manual de todos los datos.',
    exportAll: 'Exportar todo (JSON)', exportCsv: 'Operaciones (CSV)',
    auto: 'Backup automático', autoOn: 'Activo · semanal', autoOff: 'Sin ejecutar aún',
    last: 'Última copia', size: 'Tamaño', dest: 'Destino', never: 'Nunca', destNone: '—',
    autoNote: 'Corre en GitHub Actions cada domingo y sube el volcado a tu almacén externo. Aquí solo ves el estado; la configuración es un archivo con dos secretos.',
    setup: 'Cómo se configura', setupHide: 'Ocultar',
    setupSteps: [
      'En tu repositorio de GitHub → Settings → Secrets and variables → Actions, añade: DATABASE_URL (la cadena de conexión de Supabase), B2_KEY_ID y B2_APP_KEY (tu almacén Backblaze), B2_BUCKET, APP_URL y CRON_SECRET.',
      'El archivo .github/workflows/backup.yml (incluido) hace el pg_dump comprimido, lo sube al bucket y avisa a esta página.',
      'Puedes lanzarlo a mano desde la pestaña Actions → Backup → Run workflow para probarlo.',
    ],
    checklist: 'Lista de seguridad',
    ck1: 'Supabase en plan Pro (backups diarios 7 días)',
    ck2: 'Copia externa semanal activa',
    ck3: 'Variables de entorno guardadas aparte',
    ck4: 'Restauración probada una vez',
    counts: 'Datos ahora', users: 'Usuarios', accounts: 'Cuentas', trades: 'Operaciones', tickets: 'Tickets',
    history: 'Historial de copias', noHistory: 'Aún no hay copias registradas. Corre el backup una vez.',
    retention: 'Se guardan las últimas 12. En Backblaze puedes poner una regla de ciclo de vida para borrar solas las más viejas.',
    restore: 'Restaurar', restoreTitle: 'Cómo restaurar esta copia', close: 'Cerrar',
    restoreSteps: [
      'Descarga el archivo desde Backblaze → Browse Files → tu bucket → carpeta backups/.',
      'Restáuralo PRIMERO en un proyecto Supabase de prueba, nunca directo en producción.',
      'Descomprime y cárgalo con este comando (cambia la conexión por la de tu base de prueba):',
    ],
    restoreWarn: 'Restaurar sobre producción reemplaza los datos actuales. Hazlo solo con una copia verificada y sabiendo lo que haces.',
  },
  en: {
    exportNow: 'Export now', exportDesc: 'Download a manual copy of all data.',
    exportAll: 'Export all (JSON)', exportCsv: 'Trades (CSV)',
    auto: 'Automatic backup', autoOn: 'Active · weekly', autoOff: 'Not run yet',
    last: 'Last backup', size: 'Size', dest: 'Destination', never: 'Never', destNone: '—',
    autoNote: 'Runs in GitHub Actions every Sunday and uploads the dump to your external storage. Here you only see the status; setup is one file with two secrets.',
    setup: 'How to set it up', setupHide: 'Hide',
    setupSteps: [
      'In your GitHub repo → Settings → Secrets and variables → Actions, add: DATABASE_URL (the Supabase connection string), B2_KEY_ID and B2_APP_KEY (your Backblaze storage), B2_BUCKET, APP_URL and CRON_SECRET.',
      'The file .github/workflows/backup.yml (included) makes the compressed pg_dump, uploads it to the bucket and pings this page.',
      'You can run it manually from the Actions tab → Backup → Run workflow to test it.',
    ],
    checklist: 'Safety checklist',
    ck1: 'Supabase on Pro (daily backups, 7 days)',
    ck2: 'Weekly external copy active',
    ck3: 'Environment variables saved elsewhere',
    ck4: 'Restore tested once',
    counts: 'Data now', users: 'Users', accounts: 'Accounts', trades: 'Trades', tickets: 'Tickets',
    history: 'Backup history', noHistory: 'No backups recorded yet. Run the backup once.',
    retention: 'The last 12 are kept. In Backblaze you can set a lifecycle rule to auto-delete older ones.',
    restore: 'Restore', restoreTitle: 'How to restore this backup', close: 'Close',
    restoreSteps: [
      'Download the file from Backblaze → Browse Files → your bucket → backups/ folder.',
      'Restore it FIRST into a test Supabase project, never straight to production.',
      'Unzip and load it with this command (swap the connection for your test database):',
    ],
    restoreWarn: 'Restoring over production replaces current data. Only do it with a verified backup and knowing what you are doing.',
  },
};

const fmtSize = (n: number) => (!n ? '—' : n < 1024 * 1024 ? Math.round(n / 1024) + ' KB' : (n / 1024 / 1024).toFixed(1) + ' MB');

export default function Backups() {
  const { lang } = useLang();
  const t = T[lang];
  const gt = useT();
  const [d, setD] = useState<any>(null);
  const [busy, setBusy] = useState('');
  const [showSetup, setShowSetup] = useState(false);
  const [restoreFile, setRestoreFile] = useState('');

  useEffect(() => { fetch('/api/admin/backup').then((r) => r.json()).then(setD).catch(() => setD({})); }, []);

  function download(exp: string) {
    setBusy(exp);
    window.location.href = '/api/admin/backup?export=' + exp;
    setTimeout(() => setBusy(''), 2500);
  }

  const backup = d?.backup || { last_at: null, size: 0, dest: '' };
  const recent = backup.last_at && (Date.now() - new Date(backup.last_at).getTime()) < 8 * 86400000;
  const counts = d?.counts || {};
  const tile = (label: string, value: any, color?: string, live?: boolean) => (
    <div className="tile"><div className="muted" style={{ fontSize: 11.5 }}>{label}</div>
      <div className="row" style={{ gap: 7, marginTop: 3 }}><span style={{ fontSize: 16, fontWeight: 700, color: color || 'var(--tx)' }}>{value}</span>{live && <span className="livedot" />}</div></div>
  );

  return (
    <>
      <div className="tabhead"><div className="th-row"><span className="th-ic">🗄️</span><span className="th-t">{gt.h_backups_t}</span></div><div className="th-s">{gt.h_backups_s}</div></div>

      {/* Exportar ahora */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="row between" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div><b style={{ fontSize: 14 }}>{t.exportNow}</b><div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>{t.exportDesc}</div></div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => download('json')} disabled={busy === 'json'}>⬇ {t.exportAll}</button>
            <button className="btn btn-ghost" onClick={() => download('csv')} disabled={busy === 'csv'}>📄 {t.exportCsv}</button>
          </div>
        </div>
      </div>

      {/* Backup automático */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="row between" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <b style={{ fontSize: 14 }}>{t.auto}</b>
          {recent
            ? <span className="pill" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#7fe9c0', background: 'rgba(52,226,160,.15)' }}><span className="livedot" />{t.autoOn}</span>
            : <span className="pill amber">{t.autoOff}</span>}
        </div>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10 }}>
          {tile(t.last, backup.last_at ? new Date(backup.last_at).toLocaleString() : t.never, undefined, recent)}
          {tile(t.size, fmtSize(backup.size))}
          {tile(t.dest, backup.dest || t.destNone)}
        </div>
        <div className="muted" style={{ fontSize: 11.5, marginTop: 10 }}>{t.autoNote}</div>
        <button className="btn btn-ghost" style={{ marginTop: 10, fontSize: 12.5 }} onClick={() => setShowSetup(!showSetup)}>{showSetup ? t.setupHide : t.setup}</button>
        {showSetup && (
          <ol style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: 12.5, color: 'var(--mut)', lineHeight: 1.7 }}>
            {t.setupSteps.map((s: string, i: number) => <li key={i} style={{ marginBottom: 6 }}>{s}</li>)}
          </ol>
        )}
      </div>

      {/* Historial de copias */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="row between" style={{ marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
          <b style={{ fontSize: 14 }}>{t.history}</b>
          <span className="pill" style={{ color: 'var(--mut)' }}>{(backup.history || []).length}/12</span>
        </div>
        {!(backup.history || []).length && <p className="muted" style={{ fontSize: 13 }}>{t.noHistory}</p>}
        {(backup.history || []).map((c: any, i: number) => (
          <div key={i} className="row between" style={{ padding: '9px 0', borderTop: '1px solid var(--line)', gap: 8, flexWrap: 'wrap', fontSize: 12.5 }}>
            <span className="row" style={{ gap: 8 }}>{i === 0 && recent && <span className="livedot" />}{new Date(c.at).toLocaleString()}</span>
            <span className="row" style={{ gap: 12 }}>
              <span className="muted">{fmtSize(c.size)}</span>
              <span className="muted">{c.dest}</span>
              <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setRestoreFile(restoreFile === (c.file || String(i)) ? '' : (c.file || String(i)))}>↩ {t.restore}</button>
            </span>
            {restoreFile === (c.file || String(i)) && (
              <div style={{ width: '100%', marginTop: 8, background: 'var(--bg2)', border: '1px solid var(--brand)', borderRadius: 10, padding: 12 }}>
                <b style={{ fontSize: 13 }}>{t.restoreTitle}</b>
                <ol style={{ margin: '8px 0', paddingLeft: 18, fontSize: 12.5, color: 'var(--mut)', lineHeight: 1.6 }}>
                  {t.restoreSteps.map((s: string, k: number) => <li key={k} style={{ marginBottom: 4 }}>{s}</li>)}
                </ol>
                <pre style={{ background: '#0a0d14', border: '1px solid var(--line)', borderRadius: 8, padding: '9px 11px', fontSize: 11.5, overflowX: 'auto', margin: '0 0 8px', color: '#bcd6ff' }}>{`gunzip -c "${c.file || 'onyx-backup-XXXX.sql.gz'}" | psql "TU_CONEXION_DE_PRUEBA"`}</pre>
                <div style={{ fontSize: 11.5, color: 'var(--amber)' }}>⚠ {t.restoreWarn}</div>
              </div>
            )}
          </div>
        ))}
        <div className="muted" style={{ fontSize: 11.5, marginTop: 10 }}>{t.retention}</div>
      </div>

      {/* Datos ahora */}
      <div className="card" style={{ marginBottom: 12 }}>
        <b style={{ fontSize: 14 }}>{t.counts}</b>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 10, marginTop: 10 }}>
          {tile(t.users, (counts.profiles ?? 0).toLocaleString())}
          {tile(t.accounts, (counts.trading_accounts ?? 0).toLocaleString())}
          {tile(t.trades, (counts.trades ?? 0).toLocaleString(), 'var(--brand)')}
          {tile(t.tickets, (counts.support_tickets ?? 0).toLocaleString())}
        </div>
      </div>

      {/* Lista de seguridad */}
      <div className="card">
        <b style={{ fontSize: 14 }}>{t.checklist}</b>
        {[t.ck1, t.ck2, t.ck3, t.ck4].map((c: string, i: number) => (
          <div key={i} className="row" style={{ gap: 9, padding: '8px 0', borderTop: i ? '1px solid var(--line)' : 'none', fontSize: 13 }}>
            <span style={{ color: 'var(--mut)' }}>○</span>{c}
          </div>
        ))}
      </div>
    </>
  );
}
