'use client';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/lang';

// ============================================================
// Recursos · uso real de la app medido por ella misma (BD, storage, latencia,
// errores, IA, usuarios) + accesos directos a los paneles de Vercel y Supabase
// donde salen los medidores de infraestructura (CPU/RAM/ancho de banda).
// ============================================================

function fmtBytes(n: number): string {
  if (!n || n < 0) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0, v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${u[i]}`;
}
function fmtNum(n: number): string { return (n || 0).toLocaleString(); }

const T: any = {
  es: {
    title: 'Recursos', sub: 'Uso real de la app en vivo. Los medidores de servidor (CPU/RAM/ancho de banda) viven en Vercel y Supabase.',
    refresh: 'Refrescar', live: 'En vivo', loading: 'Midiendo…',
    latency: 'Latencia', dbPing: 'Ida y vuelta a la BD', serverResp: 'Respuesta del servidor',
    dbCard: 'Base de datos', dbSize: 'Tamaño total', conns: 'Conexiones activas', topTables: 'Tablas más pesadas',
    storageCard: 'Almacenamiento (Storage)', storageTotal: 'Total en buckets', objects: 'archivos', noBuckets: 'Sin archivos aún.',
    errCard: 'Errores', e24: 'Últimas 24 h', e7: 'Últimos 7 días', errGood: 'Sin errores registrados.',
    aiCard: 'Gasto de IA (mes)', aiCalls: 'llamadas', aiTokens: 'tokens',
    usersCard: 'Usuarios', uTotal: 'Total', uNew24: 'Nuevos 24 h', uNew7: 'Nuevos 7 días',
    infraTitle: 'Infraestructura (CPU · RAM · ancho de banda)',
    infraNote: 'Tu app corre en serverless: no hay un servidor fijo con CPU/RAM que monitorear, es uso por invocación. Estos números exactos (y los de ancho de banda y la instancia de base de datos) salen en los paneles de Vercel y Supabase:',
    vUsage: 'Vercel · Uso (ancho de banda, invocaciones, CPU)', vObs: 'Vercel · Observability (latencia, errores)',
    sReports: 'Supabase · Reportes (CPU/RAM/disco de la BD)', sDb: 'Supabase · Tablas y almacenamiento',
    open: 'Abrir ↗', warn: 'Advertencia', good: 'Bien', high: 'Alto',
    setup: 'Nota: si la función SQL onyx_resource_stats no está creada, el tamaño de BD y storage saldrá en 0. Ejecuta supabase/resources_stats.sql una vez.',
  },
  en: {
    title: 'Resources', sub: 'Live app usage. Server gauges (CPU/RAM/bandwidth) live in Vercel and Supabase.',
    refresh: 'Refresh', live: 'Live', loading: 'Measuring…',
    latency: 'Latency', dbPing: 'DB round-trip', serverResp: 'Server response',
    dbCard: 'Database', dbSize: 'Total size', conns: 'Active connections', topTables: 'Heaviest tables',
    storageCard: 'Storage', storageTotal: 'Total in buckets', objects: 'files', noBuckets: 'No files yet.',
    errCard: 'Errors', e24: 'Last 24 h', e7: 'Last 7 days', errGood: 'No errors logged.',
    aiCard: 'AI spend (month)', aiCalls: 'calls', aiTokens: 'tokens',
    usersCard: 'Users', uTotal: 'Total', uNew24: 'New 24 h', uNew7: 'New 7 days',
    infraTitle: 'Infrastructure (CPU · RAM · bandwidth)',
    infraNote: 'Your app runs serverless: there is no fixed server with CPU/RAM to monitor, it is per-invocation usage. These exact figures (plus bandwidth and the database instance) live in the Vercel and Supabase dashboards:',
    vUsage: 'Vercel · Usage (bandwidth, invocations, CPU)', vObs: 'Vercel · Observability (latency, errors)',
    sReports: 'Supabase · Reports (DB CPU/RAM/disk)', sDb: 'Supabase · Tables & storage',
    open: 'Open ↗', warn: 'Warning', good: 'Good', high: 'High',
    setup: 'Note: if the onyx_resource_stats SQL function is not created, DB size and storage show 0. Run supabase/resources_stats.sql once.',
  },
};

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="tile" style={{ minWidth: 0 }}>
      <div className="muted" style={{ fontSize: 11.5 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, marginTop: 3, color: color || 'inherit' }}>{value}</div>
      {sub && <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export default function Resources() {
  const { lang } = useLang();
  const L = T[lang === 'en' ? 'en' : 'es'];
  const [d, setD] = useState<any>(null);

  async function load() {
    try { const r = await fetch('/api/admin/resources'); if (r.ok) setD(await r.json()); } catch {}
  }
  useEffect(() => { load(); const iv = setInterval(load, 20000); return () => clearInterval(iv); }, []);

  if (!d) return <p className="muted">{L.loading}</p>;

  const dbMs = d.latency?.dbMs || 0;
  const srvMs = d.latency?.serverMs || 0;
  const latColor = dbMs > 800 ? 'var(--red)' : dbMs > 300 ? 'var(--amber)' : 'var(--green)';
  const errColor = (d.errors?.last24h || 0) > 0 ? 'var(--amber)' : 'var(--green)';
  const maxTbl = Math.max(1, ...(d.db?.tables || []).map((t: any) => t.bytes));
  const links = d.deepLinks || {};

  return (
    <div>
      <div className="row between" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        <div className="tabhead"><div className="th-row"><span className="th-ic">📟</span><span className="th-t">{L.title}</span></div><div className="th-s">{L.sub}</div></div>
        <div className="row" style={{ gap: 8 }}>
          <span className="pill" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--soft-green)', background: 'rgba(52,226,160,.15)' }}><span className="livedot" />{L.live}</span>
          <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={load}>{L.refresh}</button>
        </div>
      </div>

      {/* Latencia + Usuarios + IA + Errores (mosaico superior) */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginBottom: 18 }}>
        <Stat label={`${L.latency} · ${L.dbPing}`} value={`${dbMs} ms`} color={latColor} sub={`${L.serverResp}: ${srvMs} ms`} />
        <Stat label={L.errCard + ' · ' + L.e24} value={fmtNum(d.errors?.last24h || 0)} color={errColor} sub={`${L.e7}: ${fmtNum(d.errors?.last7d || 0)}`} />
        <Stat label={L.aiCard} value={`$${((d.ai?.monthCents || 0) / 100).toFixed(2)}`} sub={`${fmtNum(d.ai?.calls || 0)} ${L.aiCalls} · ${fmtNum(d.ai?.tokens || 0)} ${L.aiTokens}`} />
        <Stat label={L.usersCard + ' · ' + L.uTotal} value={fmtNum(d.users?.total || 0)} sub={`+${fmtNum(d.users?.new24h || 0)} / 24h · +${fmtNum(d.users?.new7d || 0)} / 7d`} />
      </div>

      {/* Base de datos */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="row between" style={{ marginBottom: 10 }}>
          <b>{L.dbCard}</b>
          <span className="muted" style={{ fontSize: 12 }}>{L.conns}: <b>{fmtNum(d.db?.connections || 0)}</b></span>
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, marginBottom: 12 }}>{fmtBytes(d.db?.bytes || 0)} <span className="muted" style={{ fontSize: 13, fontWeight: 400 }}>· {L.dbSize}</span></div>
        <div className="muted" style={{ fontSize: 11.5, marginBottom: 6 }}>{L.topTables}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {(d.db?.tables || []).map((t: any) => (
            <div key={t.name} className="row" style={{ gap: 8, alignItems: 'center' }}>
              <div style={{ width: 150, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
              <div style={{ flex: 1, background: 'var(--bg2)', borderRadius: 6, height: 14, overflow: 'hidden' }}>
                <div style={{ width: `${Math.max(3, (t.bytes / maxTbl) * 100)}%`, height: '100%', background: 'var(--brand)', borderRadius: 6 }} />
              </div>
              <div style={{ width: 72, textAlign: 'right', fontSize: 11.5 }} className="muted">{fmtBytes(t.bytes)}</div>
            </div>
          ))}
          {(!d.db?.tables || d.db.tables.length === 0) && <p className="muted" style={{ fontSize: 12 }}>{L.setup}</p>}
        </div>
      </div>

      {/* Storage */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="row between" style={{ marginBottom: 10 }}>
          <b>{L.storageCard}</b>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{fmtBytes(d.storage?.totalBytes || 0)} <span className="muted" style={{ fontSize: 12, fontWeight: 400 }}>· {L.storageTotal}</span></span>
        </div>
        {(d.storage?.buckets || []).length ? (
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 8 }}>
            {d.storage.buckets.map((b: any) => (
              <div key={b.name} className="tile" style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</div>
                <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>{fmtBytes(b.bytes)}</div>
                <div className="muted" style={{ fontSize: 11 }}>{fmtNum(b.objects)} {L.objects}</div>
              </div>
            ))}
          </div>
        ) : <p className="muted" style={{ fontSize: 12 }}>{L.noBuckets}</p>}
      </div>

      {/* Infraestructura (deep-links) */}
      <div className="card">
        <b>{L.infraTitle}</b>
        <p className="muted" style={{ fontSize: 12.5, margin: '6px 0 12px' }}>{L.infraNote}</p>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 8 }}>
          {[[L.vUsage, links.vercelUsage], [L.vObs, links.vercelObservability], [L.sReports, links.supabaseReports], [L.sDb, links.supabaseDatabase]].map(([label, url]: any) => (
            <a key={label} href={url} target="_blank" rel="noopener noreferrer" className="tile" style={{ textDecoration: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12.5 }}>{label}</span>
              <span className="pill" style={{ fontSize: 11, flex: 'none' }}>{L.open}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
