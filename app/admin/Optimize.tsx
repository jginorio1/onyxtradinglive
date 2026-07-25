'use client';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/lang';
import { useT } from '@/lib/adminText';

const T: any = {
  es: {
    intro: 'No solo mide: optimiza sola. Cada trabajo corre en su horario y aquí ves el resultado.',
    dbTitle: 'Limpieza y afinado de BD', dbDesc: 'Purga logs viejos (>90 días) y afina la base · semanal',
    prunedErr: 'Errores purgados', prunedTg: 'Telegram purgados', analyzed: 'Afinado', last: 'Última', never: 'Nunca',
    yes: 'Sí', no: 'Pendiente', run: 'Ejecutar ahora', running: 'Optimizando…',
    imgTitle: 'Compresión de imágenes', imgDesc: 'Comprime cada foto de diario al subirla',
    imgCount: 'Fotos optimizadas', imgSaved: 'Espacio ahorrado',
    fixTitle: 'Auto-arreglos (PRs)', fixDesc: 'Dependabot abre PRs de actualizaciones y seguridad; los menores se auto-fusionan. Tú apruebas el resto.',
    budgetTitle: 'Presupuestos de rendimiento', budgetDesc: 'La auditoría avisa (y puede bloquear) si una nota baja del umbral.',
    cacheTitle: 'Caché y cabeceras', cacheDesc: 'Cache-Control óptimo en imágenes e íconos → repetir visita casi instantánea.', active: 'Activo',
    on: 'Automática', off: 'En pausa', needSql: 'El “afinado” necesita el SQL optimize_v1 (córrelo en Supabase). La purga funciona igual.',
  },
  en: {
    intro: 'It doesn’t just measure: it optimizes itself. Each job runs on schedule and you see the result here.',
    dbTitle: 'Database cleanup and tuning', dbDesc: 'Prunes old logs (>90 days) and tunes the database · weekly',
    prunedErr: 'Errors pruned', prunedTg: 'Telegram pruned', analyzed: 'Tuned', last: 'Last', never: 'Never',
    yes: 'Yes', no: 'Pending', run: 'Run now', running: 'Optimizing…',
    imgTitle: 'Image compression', imgDesc: 'Compresses every journal photo on upload',
    imgCount: 'Photos optimized', imgSaved: 'Space saved',
    fixTitle: 'Auto-fixes (PRs)', fixDesc: 'Dependabot opens update and security PRs; minor ones auto-merge. You approve the rest.',
    budgetTitle: 'Performance budgets', budgetDesc: 'The audit warns (and can block) if a score drops below the threshold.',
    cacheTitle: 'Cache and headers', cacheDesc: 'Optimal Cache-Control on images and icons → repeat visits nearly instant.', active: 'Active',
    on: 'Automatic', off: 'Paused', needSql: 'Tuning needs the optimize_v1 SQL (run it in Supabase). Pruning works regardless.',
  },
};

const fmtB = (n: number) => (!n ? '—' : n < 1024 * 1024 ? Math.round(n / 1024) + ' KB' : (n / 1024 / 1024).toFixed(1) + ' MB');

function Ic({ e }: { e: string }) {
  return <span style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(124,140,255,.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flex: 'none' }}>{e}</span>;
}

export default function Optimize() {
  const { lang } = useLang();
  const t = T[lang];
  const gt = useT();
  const [d, setD] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  async function load() { try { const r = await fetch('/api/admin/optimize'); setD(await r.json()); } catch { setD({}); } }
  useEffect(() => { load(); }, []);

  const o = d?.optimize || { enabled: true, last_at: null, pruned_errors: 0, pruned_tg: 0, analyzed: false, images: { count: 0, saved_bytes: 0 } };
  const recent = o.last_at && (Date.now() - new Date(o.last_at).getTime()) < 8 * 86400000;

  async function runNow() { setBusy(true); await fetch('/api/admin/optimize', { method: 'POST' }); await load(); setBusy(false); }
  async function toggle() { await fetch('/api/admin/optimize', { method: 'PATCH', body: JSON.stringify({ enabled: !o.enabled }) }); await load(); }

  const Tog = ({ on, onClick }: { on: boolean; onClick: () => void }) => (
    <span className="toggle" onClick={onClick} style={{ background: on ? '#34e2a0' : '#556080', cursor: 'pointer' }}><span className="knob" style={{ left: on ? 21 : 3 }} /></span>
  );
  const tile = (label: string, value: any, color?: string) => (
    <div className="tile"><div className="muted" style={{ fontSize: 11.5 }}>{label}</div><div style={{ fontSize: 18, fontWeight: 700, marginTop: 3, color: color || 'var(--tx)' }}>{value}</div></div>
  );

  return (
    <>
      <div className="row between" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div className="tabhead"><div className="th-row"><span className="th-ic">🚀</span><span className="th-t">{gt.h_optim_t}</span></div><div className="th-s">{t.intro}</div></div>
        <span className="pill" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: o.enabled ? '#7fe9c0' : 'var(--mut)', background: o.enabled ? 'rgba(52,226,160,.15)' : 'var(--card2)' }}>{o.enabled && recent && <span className="livedot" />}{o.enabled ? t.on : t.off}</span>
      </div>

      {/* Limpieza de BD */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="row between" style={{ marginBottom: 10 }}>
          <div className="row"><Ic e="🧹" /><div><b style={{ fontSize: 13.5 }}>{t.dbTitle}</b><div className="muted" style={{ fontSize: 11.5 }}>{t.dbDesc}</div></div></div>
          <Tog on={o.enabled} onClick={toggle} />
        </div>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10 }}>
          {tile(t.prunedErr, (o.pruned_errors ?? 0).toLocaleString())}
          {tile(t.prunedTg, (o.pruned_tg ?? 0).toLocaleString())}
          {tile(t.analyzed, o.analyzed ? '✓ ' + t.yes : t.no, o.analyzed ? 'var(--green)' : 'var(--amber)')}
          {tile(t.last, o.last_at ? new Date(o.last_at).toLocaleDateString() : t.never)}
        </div>
        <div className="row" style={{ gap: 8, marginTop: 10 }}>
          <button className="btn btn-primary" onClick={runNow} disabled={busy}>{busy ? t.running : '▶ ' + t.run}</button>
        </div>
        {!o.analyzed && <div className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>{t.needSql}</div>}
      </div>

      {/* Compresión de imágenes */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="row" style={{ marginBottom: 10 }}><Ic e="🖼️" /><div><b style={{ fontSize: 13.5 }}>{t.imgTitle}</b><div className="muted" style={{ fontSize: 11.5 }}>{t.imgDesc}</div></div><span className="pill" style={{ marginLeft: 'auto', color: '#7fe9c0', background: 'rgba(52,226,160,.15)' }}>{t.active}</span></div>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10 }}>
          {tile(t.imgCount, (o.images?.count ?? 0).toLocaleString())}
          {tile(t.imgSaved, fmtB(o.images?.saved_bytes ?? 0), 'var(--green)')}
        </div>
      </div>

      {/* Auto-arreglos + Presupuestos + Caché */}
      <div className="grid g2" style={{ gap: 12 }}>
        <div className="card" style={{ margin: 0 }}>
          <div className="row"><Ic e="🤖" /><b style={{ fontSize: 13.5 }}>{t.fixTitle}</b></div>
          <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>{t.fixDesc}</div>
        </div>
        <div className="card" style={{ margin: 0 }}>
          <div className="row"><Ic e="🎯" /><b style={{ fontSize: 13.5 }}>{t.budgetTitle}</b></div>
          <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>{t.budgetDesc}</div>
        </div>
      </div>
      <div className="card" style={{ marginTop: 12 }}>
        <div className="row"><Ic e="⚡" /><b style={{ fontSize: 13.5 }}>{t.cacheTitle}</b><span className="pill" style={{ marginLeft: 'auto', color: '#7fe9c0', background: 'rgba(52,226,160,.15)' }}><span className="livedot" />{t.active}</span></div>
        <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>{t.cacheDesc}</div>
      </div>
    </>
  );
}
