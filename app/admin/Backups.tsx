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
