'use client';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/lang';
import { useT } from '@/lib/adminText';

const T: any = {
  es: {
    exportNow: 'Exportar ahora', exportDesc: 'Descarga una copia manual de todos los datos.',
    exportAll: 'Exportar todo (JSON)', exportCsv: 'Operaciones (CSV)',
    auto: 'Backup automático', autoOn: 'Activo · diario', autoOff: 'Sin ejecutar aún',
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
    restoreWarn: 'Restaurar sobre producción reemplaza los datos actuales. Por eso por defecto va a la base de pruebas y pide confirmación escrita.',
    download: 'Descargar', retaining: 'Reteniendo 12 · limpia las viejas', colDate: 'Fecha y hora',
    emptyHint: 'Para que aparezca una fila ahora mismo, ve a GitHub → Actions → Backup → Run workflow. Al terminar, la copia se registra aquí.',
    rcTitle: 'Restaurar una copia',
    rc1t: '1 · Elige la copia', rc1s: 'del historial, por fecha/hora',
    rc2t: '2 · Restaura en pruebas', rc2s: 'base de test, sin tocar producción',
    rc3t: '3 · Verifica y aplica', rc3s: 'a producción solo si confirmas',
    dlHelp: 'El botón Descargar trae el archivo .sql.gz desde Backblaze. Si te pide configurar llaves, añade B2_KEY_ID, B2_APP_KEY y B2_BUCKET en Vercel (las mismas de GitHub).',
    healthOk: 'Al día', healthWarn: 'Atención', healthBad: 'Sin copia reciente', healthNone: 'Sin copias',
    agoH: 'hace {n} h', agoD: 'hace {n} días', agoNow: 'hace un momento',
    spaceUsed: 'Espacio usado', from: 'Desde', to: 'Hasta', q7: '7 días', q30: '30 días', qAll: 'Todo',
    showMore: 'Ver {n} copias más', showLess: 'Ver menos', noMatch: 'No hay copias en ese rango de fechas.',
  },
  en: {
    exportNow: 'Export now', exportDesc: 'Download a manual copy of all data.',
    exportAll: 'Export all (JSON)', exportCsv: 'Trades (CSV)',
    auto: 'Automatic backup', autoOn: 'Active · daily', autoOff: 'Not run yet',
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
    restoreWarn: 'Restoring over production replaces current data. That is why it defaults to the test database and asks for written confirmation.',
    download: 'Download', retaining: 'Keeping 12 · cleans old ones', colDate: 'Date & time',
    emptyHint: 'To make a row appear right now, go to GitHub → Actions → Backup → Run workflow. When it finishes, the copy is recorded here.',
    rcTitle: 'Restore a copy',
    rc1t: '1 · Pick the copy', rc1s: 'from history, by date/time',
    rc2t: '2 · Restore to test', rc2s: 'test database, production untouched',
    rc3t: '3 · Verify and apply', rc3s: 'to production only if you confirm',
    dlHelp: 'The Download button pulls the .sql.gz file from Backblaze. If it asks you to configure keys, add B2_KEY_ID, B2_APP_KEY and B2_BUCKET in Vercel (the same ones from GitHub).',
    healthOk: 'Up to date', healthWarn: 'Heads up', healthBad: 'No recent copy', healthNone: 'No copies',
    agoH: '{n} h ago', agoD: '{n} days ago', agoNow: 'just now',
    spaceUsed: 'Space used', from: 'From', to: 'To', q7: '7 days', q30: '30 days', qAll: 'All',
    showMore: 'Show {n} more copies', showLess: 'Show less', noMatch: 'No copies in that date range.',
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
  const [showAll, setShowAll] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => { fetch('/api/admin/backup').then((r) => r.json()).then(setD).catch(() => setD({})); }, []);

  // Atajos de rango: N días atrás → hoy (o Todo).
  function quickRange(days: number | null) {
    if (days === null) { setFrom(''); setTo(''); return; }
    const end = new Date();
    const start = new Date(Date.now() - days * 86400000);
    setFrom(start.toISOString().slice(0, 10));
    setTo(end.toISOString().slice(0, 10));
  }

  function download(exp: string) {
    setBusy(exp);
    window.location.href = '/api/admin/backup?export=' + exp;
    setTimeout(() => setBusy(''), 2500);
  }

  const backup = d?.backup || { last_at: null, size: 0, dest: '', history: [] };
  const recent = backup.last_at && (Date.now() - new Date(backup.last_at).getTime()) < 8 * 86400000;
  const counts = d?.counts || {};

  // Salud del respaldo: verde si la última copia es de hace <36 h, ámbar <3 días, rojo si más.
  const ageMs = backup.last_at ? Date.now() - new Date(backup.last_at).getTime() : Infinity;
  const agoTxt = (ms: number) => {
    if (!isFinite(ms)) return '';
    const h = Math.floor(ms / 3600000);
    if (h < 1) return t.agoNow;
    if (h < 48) return t.agoH.replace('{n}', String(h));
    return t.agoD.replace('{n}', String(Math.floor(h / 24)));
  };
  const health = !backup.last_at ? { txt: t.healthNone, c: '#c9a9ff', bg: 'rgba(160,107,255,.18)' }
    : ageMs < 36 * 3600000 ? { txt: t.healthOk, c: '#7fe9c0', bg: 'rgba(52,226,160,.15)' }
    : ageMs < 3 * 86400000 ? { txt: t.healthWarn, c: '#ffcf7a', bg: 'rgba(255,192,77,.16)' }
    : { txt: t.healthBad, c: '#ff9aa6', bg: 'rgba(255,107,125,.16)' };

  // Historial filtrado por fecha + "ver últimas 5".
  const allHist: any[] = backup.history || [];
  const fromMs = from ? new Date(from + 'T00:00:00').getTime() : -Infinity;
  const toMs = to ? new Date(to + 'T23:59:59').getTime() : Infinity;
  const filtered = allHist.filter((c) => { const m = new Date(c.at).getTime(); return m >= fromMs && m <= toMs; });
  const shown = showAll ? filtered : filtered.slice(0, 5);
  const hidden = filtered.length - shown.length;
  const spaceBytes = allHist.reduce((s, c) => s + (Number(c.size) || 0), 0);
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
          <span className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {/* Indicador de salud: verde/ámbar/rojo según cuándo fue la última copia */}
            <span className="pill" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: health.c, background: health.bg }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: health.c }} className={ageMs < 36 * 3600000 ? 'livedot' : undefined} />
              {health.txt}{backup.last_at ? ` · ${agoTxt(ageMs)}` : ''}
            </span>
            {recent
              ? <span className="pill" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#7fe9c0', background: 'rgba(52,226,160,.15)' }}><span className="livedot" />{t.autoOn}</span>
              : <span className="pill amber">{t.autoOff}</span>}
          </span>
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
        <div className="row between" style={{ marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
          <b style={{ fontSize: 14 }}>{t.history}</b>
          <span className="row" style={{ gap: 8 }}>
            <span className="pill" style={{ color: 'var(--mut)' }}>{t.spaceUsed}: {fmtSize(spaceBytes)}</span>
            <span className="pill" style={{ color: 'var(--mut)' }}>{t.retaining}</span>
          </span>
        </div>

        {/* Filtro por fechas */}
        <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 12 }}>
          <div><label className="muted" style={{ fontSize: 11.5, display: 'block' }}>{t.from}</label>
            <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setShowAll(true); }} style={{ width: 150, marginTop: 3 }} /></div>
          <div><label className="muted" style={{ fontSize: 11.5, display: 'block' }}>{t.to}</label>
            <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setShowAll(true); }} style={{ width: 150, marginTop: 3 }} /></div>
          <div className="row" style={{ gap: 6, marginLeft: 'auto' }}>
            <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => { quickRange(7); setShowAll(true); }}>{t.q7}</button>
            <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => { quickRange(30); setShowAll(true); }}>{t.q30}</button>
            <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => { quickRange(null); setShowAll(false); }}>{t.qAll}</button>
          </div>
        </div>

        {/* Cabecera de columnas */}
        <div className="row between" style={{ fontSize: 11, color: 'var(--mut)', padding: '0 0 6px' }}>
          <span style={{ flex: 1 }}>{t.colDate}</span>
          <span style={{ width: 70 }}>{t.size}</span>
          <span style={{ width: 220 }}>{t.dest}</span>
        </div>

        {!allHist.length && (
          <div style={{ padding: '10px 0', borderTop: '1px solid var(--line)' }}>
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>{t.noHistory}</p>
            <p className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>{t.emptyHint}</p>
          </div>
        )}
        {allHist.length > 0 && !filtered.length && (
          <div style={{ padding: '10px 0', borderTop: '1px solid var(--line)' }}>
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>{t.noMatch}</p>
          </div>
        )}

        {shown.map((c: any, i: number) => (
          <div key={i} style={{ borderTop: '1px solid var(--line)', padding: '10px 0' }}>
            <div className="row between" style={{ gap: 8, flexWrap: 'wrap', fontSize: 13 }}>
              <span className="row" style={{ gap: 8, flex: 1, minWidth: 150 }}>{i === 0 && recent ? <span className="livedot" /> : <span style={{ width: 7 }} />}{new Date(c.at).toLocaleString()}</span>
              <span className="muted" style={{ width: 70 }}>{fmtSize(c.size)}</span>
              <span className="row" style={{ gap: 8 }}>
                <span className="muted" style={{ width: 74 }}>{c.dest}</span>
                <a className="btn btn-ghost" href={c.file ? `/api/admin/backup/download?file=${encodeURIComponent(c.file)}` : undefined}
                   style={{ padding: '4px 10px', fontSize: 12, opacity: c.file ? 1 : .5, pointerEvents: c.file ? 'auto' : 'none' }}>⤓ {t.download}</a>
                <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setRestoreFile(restoreFile === (c.file || String(i)) ? '' : (c.file || String(i)))}>↺ {t.restore}</button>
              </span>
            </div>
            {restoreFile === (c.file || String(i)) && (
              <div style={{ marginTop: 10, background: 'var(--bg2)', border: '1px solid var(--brand)', borderRadius: 10, padding: 12 }}>
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
        {(hidden > 0 || (showAll && filtered.length > 5)) && (
          <button className="btn btn-ghost" style={{ width: '100%', marginTop: 10, fontSize: 12.5, color: 'var(--mut)' }}
            onClick={() => setShowAll(!showAll)}>
            {showAll ? `▲ ${t.showLess}` : `▼ ${t.showMore.replace('{n}', String(hidden))}`}
          </button>
        )}
        <div className="muted" style={{ fontSize: 11.5, marginTop: 10 }}>{t.dlHelp}</div>
      </div>

      {/* Restaurar una copia (guía fija en 3 pasos) */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="row" style={{ gap: 9, marginBottom: 10 }}>
          <span style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(124,140,255,.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flex: 'none' }}>↩</span>
          <b style={{ fontSize: 14 }}>{t.rcTitle}</b>
        </div>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
          {[[t.rc1t, t.rc1s], [t.rc2t, t.rc2s], [t.rc3t, t.rc3s]].map((s, i) => (
            <div key={i} style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--brand)' }}>{s[0]}</div>
              <div className="muted" style={{ fontSize: 11.5, marginTop: 3 }}>{s[1]}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--amber)', marginTop: 10 }}>⚠ {t.restoreWarn}</div>
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
