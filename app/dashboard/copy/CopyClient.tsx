'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/lib/lang';

const T: any = {
  es: {
    title: 'Copy trading', sub: 'Replica de una cuenta master a tus esclavas. Tú eres dueño de todas.',
    lock: 'El copy trading está en el plan Elite.', lockCta: 'Ver planes →',
    warn: 'Copiar entre cuentas puede violar las reglas de tu prop firm. Eres responsable de cumplirlas.',
    links: 'Tus enlaces', newLink: 'Nuevo enlace', master: 'Master', slave: 'Esclava', mode: 'Modo',
    m_balance: 'Balance %', m_risk: 'Riesgo % (RR)', m_pips: 'Pips', m_fixed: 'Lote fijo ×',
    mult: 'Multiplicador', risk: 'Riesgo %', pip: 'Pips SL', maxLot: 'Lote máx', reverse: 'Invertir',
    add: 'Crear enlace', save: 'Guardar', del: 'Quitar', on: 'Activo', off: 'Pausado', pick: 'Elige…',
    noAcc: 'Necesitas al menos 2 cuentas MT conectadas para copiar.', log: 'Replicación en vivo', noLog: 'Sin actividad todavía.',
    kcopied: 'copiado', kskipped: 'saltado (símbolo)', kerror: 'error',
  },
  en: {
    title: 'Copy trading', sub: 'Replicate from one master to your slave accounts. You own them all.',
    lock: 'Copy trading is on the Elite plan.', lockCta: 'See plans →',
    warn: 'Copying between accounts may violate your prop firm rules. You are responsible for compliance.',
    links: 'Your links', newLink: 'New link', master: 'Master', slave: 'Slave', mode: 'Mode',
    m_balance: 'Balance %', m_risk: 'Risk % (RR)', m_pips: 'Pips', m_fixed: 'Fixed lot ×',
    mult: 'Multiplier', risk: 'Risk %', pip: 'SL pips', maxLot: 'Max lot', reverse: 'Reverse',
    add: 'Create link', save: 'Save', del: 'Remove', on: 'On', off: 'Paused', pick: 'Choose…',
    noAcc: 'You need at least 2 connected MT accounts to copy.', log: 'Live replication', noLog: 'No activity yet.',
    kcopied: 'copied', kskipped: 'skipped (symbol)', kerror: 'error',
  },
};

export default function CopyClient() {
  const { lang } = useLang();
  const t = T[lang];
  const [d, setD] = useState<any>(null);
  const [log, setLog] = useState<any[]>([]);
  const [nl, setNl] = useState<any>({ master_account_id: '', slave_account_id: '', mode: 'balance', multiplier: 1, risk_pct: 1, pip_risk: 20, max_lot: 50, reverse: false });
  const [busy, setBusy] = useState(false);

  const load = () => fetch('/api/copy/links').then((r) => r.json()).then(setD).catch(() => setD({ inPlan: false }));
  useEffect(() => { load(); }, []);
  useEffect(() => {
    const f = () => fetch('/api/copy/log').then((r) => r.ok ? r.json() : null).then((j) => j && setLog(j.log || [])).catch(() => {});
    f(); const iv = setInterval(f, 6000); return () => clearInterval(iv);
  }, []);

  const accs: any[] = d?.accounts || [];
  const label = (id: string) => { const a = accs.find((x) => x.id === id); return a ? (a.nickname || a.login) : id.slice(0, 6); };
  const modeLabel = (m: string) => ({ balance: t.m_balance, risk: t.m_risk, pips: t.m_pips, fixed: t.m_fixed } as any)[m] || m;

  async function save(payload: any) {
    setBusy(true);
    try { const r = await fetch('/api/copy/links', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }); const j = await r.json(); if (!r.ok) alert(j.error || 'Error'); else { load(); if (!payload.id) setNl({ ...nl, master_account_id: '', slave_account_id: '' }); } }
    finally { setBusy(false); }
  }
  async function del(id: string) { await fetch('/api/copy/links', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) }); load(); }

  if (!d) return <div className="muted">…</div>;

  const head = (
    <div style={{ marginBottom: 14 }}>
      <h1 style={{ fontSize: 22, marginBottom: 2 }}>🔁 {t.title}</h1>
      <p className="muted" style={{ fontSize: 13.5, margin: 0 }}>{t.sub}</p>
    </div>
  );

  if (!d.inPlan) return (
    <div style={{ maxWidth: 640 }}>{head}
      <div className="card"><p className="muted" style={{ fontSize: 14, marginBottom: 10 }}>{t.lock}</p><Link className="btn btn-ghost" href="/pricing">{t.lockCta}</Link></div>
    </div>
  );

  const modeField = (o: any, set: (k: string, v: any) => void) => {
    if (o.mode === 'risk') return <label className="muted" style={{ fontSize: 12 }}>{t.risk}<input type="number" value={o.risk_pct} onChange={(e) => set('risk_pct', Number(e.target.value))} style={{ marginTop: 3 }} /></label>;
    if (o.mode === 'pips') return <label className="muted" style={{ fontSize: 12 }}>{t.pip}<input type="number" value={o.pip_risk} onChange={(e) => set('pip_risk', Number(e.target.value))} style={{ marginTop: 3 }} /></label>;
    return <label className="muted" style={{ fontSize: 12 }}>{t.mult}<input type="number" step="0.1" value={o.multiplier} onChange={(e) => set('multiplier', Number(e.target.value))} style={{ marginTop: 3 }} /></label>;
  };

  return (
    <div style={{ maxWidth: 860 }}>{head}
      <div className="card" style={{ marginBottom: 12, border: '1px solid var(--amber)', background: 'rgba(255,192,77,.06)' }}>
        <span style={{ fontSize: 12.5, color: 'var(--amber)' }}>⚠ {t.warn}</span>
      </div>

      {accs.length < 2 && <div className="card" style={{ marginBottom: 12 }}><p className="muted" style={{ fontSize: 13, margin: 0 }}>{t.noAcc}</p></div>}

      {/* Enlaces existentes */}
      <div className="card" style={{ marginBottom: 12 }}>
        <b style={{ fontSize: 14 }}>{t.links}</b>
        {!(d.links || []).length && <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>—</p>}
        {(d.links || []).map((l: any) => (
          <div key={l.id} className="row between" style={{ borderTop: '1px solid var(--line)', padding: '11px 0', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 13 }}>
              <b>{label(l.master_account_id)}</b> <span className="muted">→</span> <b>{label(l.slave_account_id)}</b>
              <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{modeLabel(l.mode)}{l.reverse ? ' · ⇄' : ''} · máx {l.max_lot}</div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => save({ id: l.id, master_account_id: l.master_account_id, slave_account_id: l.slave_account_id, mode: l.mode, multiplier: l.multiplier, risk_pct: l.risk_pct, pip_risk: l.pip_risk, max_lot: l.max_lot, reverse: l.reverse, enabled: !l.enabled })}>
                {l.enabled ? '⏸ ' + t.off : '▶ ' + t.on}
              </button>
              <span className="pill" style={l.enabled ? { color: '#7fe9c0', background: 'rgba(52,226,160,.15)' } : { color: 'var(--mut)' }}>{l.enabled ? t.on : t.off}</span>
              <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => del(l.id)}>{t.del}</button>
            </div>
          </div>
        ))}
      </div>

      {/* Nuevo enlace */}
      {accs.length >= 2 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <b style={{ fontSize: 14 }}>{t.newLink}</b>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginTop: 10, alignItems: 'end' }}>
            <label className="muted" style={{ fontSize: 12 }}>{t.master}
              <select value={nl.master_account_id} onChange={(e) => setNl({ ...nl, master_account_id: e.target.value })} style={{ marginTop: 3 }}>
                <option value="">{t.pick}</option>{accs.map((a) => <option key={a.id} value={a.id}>{a.nickname || a.login}</option>)}
              </select>
            </label>
            <label className="muted" style={{ fontSize: 12 }}>{t.slave}
              <select value={nl.slave_account_id} onChange={(e) => setNl({ ...nl, slave_account_id: e.target.value })} style={{ marginTop: 3 }}>
                <option value="">{t.pick}</option>{accs.filter((a) => a.id !== nl.master_account_id).map((a) => <option key={a.id} value={a.id}>{a.nickname || a.login}</option>)}
              </select>
            </label>
            <label className="muted" style={{ fontSize: 12 }}>{t.mode}
              <select value={nl.mode} onChange={(e) => setNl({ ...nl, mode: e.target.value })} style={{ marginTop: 3 }}>
                <option value="balance">{t.m_balance}</option><option value="risk">{t.m_risk}</option><option value="pips">{t.m_pips}</option><option value="fixed">{t.m_fixed}</option>
              </select>
            </label>
            {modeField(nl, (k, v) => setNl({ ...nl, [k]: v }))}
            <label className="muted" style={{ fontSize: 12 }}>{t.maxLot}<input type="number" step="0.01" value={nl.max_lot} onChange={(e) => setNl({ ...nl, max_lot: Number(e.target.value) })} style={{ marginTop: 3 }} /></label>
            <label className="muted row" style={{ fontSize: 12, gap: 8, alignItems: 'center', marginTop: 18 }}><input type="checkbox" checked={nl.reverse} onChange={(e) => setNl({ ...nl, reverse: e.target.checked })} style={{ width: 'auto', margin: 0 }} /> {t.reverse}</label>
          </div>
          <button className="btn btn-primary" style={{ marginTop: 12 }} disabled={busy || !nl.master_account_id || !nl.slave_account_id} onClick={() => save(nl)}>{t.add}</button>
        </div>
      )}

      {/* Log en vivo */}
      <div className="card">
        <b style={{ fontSize: 14 }}>{t.log}</b>
        {!log.length && <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>{t.noLog}</p>}
        {log.map((e, i) => {
          const c = e.kind === 'copied' ? 'var(--green)' : e.kind === 'skipped' ? 'var(--amber)' : 'var(--red)';
          const k = e.kind === 'copied' ? t.kcopied : e.kind === 'skipped' ? t.kskipped : t.kerror;
          return (
            <div key={i} className="row between" style={{ borderTop: '1px solid var(--line)', padding: '8px 0', fontSize: 12.5, gap: 8, flexWrap: 'wrap' }}>
              <span className="row" style={{ gap: 8 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: c }} /><b>{e.symbol || '—'}</b> <span style={{ color: c }}>{k}</span></span>
              <span className="muted">{e.latency_ms ? e.latency_ms + ' ms · ' : ''}{new Date(e.created_at).toLocaleTimeString()}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
