'use client';
import { useEffect, useState } from 'react';
import { toast } from '@/lib/toast';
import { useLang } from '@/lib/lang';

const TIERC: Record<string, string> = { diamond: '#378ADD', gold: 'var(--gold)', silver: '#9aa0ac', none: 'var(--mut)' };

export default function CopyTradersAdmin() {
  const { lang } = useLang();
  const es = lang !== 'en';
  const [config, setConfig] = useState<any>(null);
  const [providers, setProviders] = useState<any[]>([]);
  const [fees, setFees] = useState<any>({});
  const [saving, setSaving] = useState(false);

  async function load() {
    const j = await fetch('/api/admin/copy').then((r) => r.json()).catch(() => null);
    if (j?.ok) { setConfig(j.config); setProviders(j.providers || []); setFees(j.fees || {}); }
  }
  useEffect(() => { load(); }, []);

  async function saveConfig() {
    setSaving(true);
    const r = await fetch('/api/admin/copy', { method: 'POST', body: JSON.stringify({ config }) });
    const j = await r.json(); setSaving(false);
    if (j.ok) toast(es ? '✓ Parámetros guardados. Se aplican en el próximo recálculo.' : '✓ Saved. Applied on next recompute.', 'ok');
    else toast(j.error || 'Error', 'error');
  }
  async function provAction(id: string, patch: any) {
    const r = await fetch('/api/admin/copy', { method: 'PATCH', body: JSON.stringify({ id, ...patch }) });
    const j = await r.json();
    if (j.ok) { toast('✓', 'ok'); load(); } else toast(j.error || 'Error', 'error');
  }

  if (!config) return <div className="muted" style={{ padding: 24 }}>…</div>;

  const setW = (k: string, v: string) => setConfig({ ...config, weights: { ...config.weights, [k]: Number(v) || 0 } });
  const setGate = (t: string, k: string, v: any) => setConfig({ ...config, gates: { ...config.gates, [t]: { ...config.gates[t], [k]: k === 'verified' ? v : (Number(v) || 0) } } });
  const inp = { width: 64, margin: 0, padding: '6px 8px', fontSize: 13 } as any;
  const L = (a: string, b: string) => (es ? a : b);

  const GATE_ROWS: [string, string][] = [['silver', 'Onyx Silver'], ['gold', 'Onyx Gold'], ['diamond', 'Onyx Diamond']];
  const COLS: [string, string, string][] = [['score', 'Score', 'Score'], ['trades', 'Ops', 'Trades'], ['days', 'Días', 'Days'], ['pf', 'PF', 'PF'], ['maxDD', 'DD máx %', 'Max DD %']];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h3 style={{ fontSize: 20 }}>{L('Onyx Copy — calificación y traders', 'Onyx Copy — grading & traders')}</h3>
        <p className="muted" style={{ fontSize: 13 }}>{L('Edita cómo Onyx AI califica a los traders y gestiona el ranking. La comisión de suscripción de Onyx es', 'Edit how Onyx AI grades traders and manage the ranking. Onyx subscription fee is')} {fees.subscription}% ({L('variable ONYX_COPY_FEE_PCT', 'env ONYX_COPY_FEE_PCT')}).</p>
      </div>

      {/* Pesos del score */}
      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 4 }}>{L('Pesos del Onyx Score', 'Onyx Score weights')}</div>
        <p className="muted" style={{ fontSize: 12.5, marginBottom: 10 }}>{L('Se normalizan solos. Por defecto la disciplina y el riesgo pesan más que el retorno.', 'Auto-normalized. By default discipline and risk weigh more than return.')}</p>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {([['discipline', L('Disciplina', 'Discipline')], ['risk', L('Riesgo', 'Risk')], ['performance', L('Rendimiento', 'Performance')], ['consistency', L('Consistencia', 'Consistency')]] as const).map(([k, lbl]) => (
            <div key={k}><div className="muted" style={{ fontSize: 12 }}>{lbl}</div><input value={config.weights[k]} onChange={(e) => setW(k, e.target.value)} style={inp} /></div>
          ))}
        </div>
      </div>

      {/* Puertas por tier */}
      <div className="card" style={{ overflowX: 'auto' }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>{L('Requisitos por nivel (gates)', 'Tier requirements (gates)')}</div>
        <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ textAlign: 'left', color: 'var(--mut)' }}>
            <th style={{ padding: '4px 8px' }}>{L('Nivel', 'Tier')}</th>
            {COLS.map(([k, a, b]) => <th key={k} style={{ padding: '4px 8px' }}>{es ? a : b}</th>)}
            <th style={{ padding: '4px 8px' }}>{L('Verificada', 'Verified')}</th>
          </tr></thead>
          <tbody>
            {GATE_ROWS.map(([t, label]) => (
              <tr key={t}>
                <td style={{ padding: '6px 8px', fontWeight: 700, color: TIERC[t] }}>{label}</td>
                {COLS.map(([k]) => <td key={k} style={{ padding: '6px 8px' }}><input value={config.gates[t][k]} onChange={(e) => setGate(t, k, e.target.value)} style={inp} /></td>)}
                <td style={{ padding: '6px 8px' }}><input type="checkbox" checked={!!config.gates[t].verified} onChange={(e) => setGate(t, 'verified', e.target.checked)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
          <div><div className="muted" style={{ fontSize: 12 }}>{L('Ventana de análisis (días)', 'Analysis window (days)')}</div><input value={config.windowDays} onChange={(e) => setConfig({ ...config, windowDays: Number(e.target.value) || 0 })} style={{ ...inp, width: 80 }} /></div>
          <button className="btn btn-primary" onClick={saveConfig} disabled={saving} style={{ marginLeft: 'auto' }}>{saving ? '…' : L('Guardar parámetros', 'Save parameters')}</button>
        </div>
      </div>

      {/* Traders */}
      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 10 }}>{L('Traders calificados', 'Graded traders')} ({providers.length})</div>
        {providers.length === 0 && <div className="muted" style={{ fontSize: 13 }}>{L('Aún nadie ha postulado su cuenta.', 'No one has listed an account yet.')}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {providers.map((p) => {
            const s = p.stats || {};
            return (
              <div key={p.id} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '10px 12px', background: 'var(--bg2)', borderRadius: 10, borderLeft: `3px solid ${TIERC[p.tier] || 'var(--line)'}` }}>
                <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <b>{p.display_name}</b>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, color: TIERC[p.tier], border: '1px solid ' + (TIERC[p.tier] || 'var(--line)') }}>{p.tier === 'none' ? L('En evaluación', 'In review') : p.tier}</span>
                    {Array.isArray(p.flags) && p.flags.length > 0 && <span title={p.flags.join(', ')} style={{ fontSize: 11, color: 'var(--amber)' }}>⚠ {p.flags.join(', ')}</span>}
                    {p.auto_delisted && <span style={{ fontSize: 11, color: 'var(--red)' }}>{L('retirado auto', 'auto-delisted')}</span>}
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>Score {p.score} · Win {s.winRate ?? 0}% · PF {s.pf ?? 0} · DD {s.maxDDpct ?? 0}% · {s.trades ?? 0} ops · {p.followers || 0} {L('copian', 'copying')}{p.fee_month ? ` · $${p.fee_month}/mo` : ''}{p.perf_fee_pct ? ` · ${p.perf_fee_pct}% perf` : ''}</div>
                </div>
                <label style={{ fontSize: 12, display: 'flex', gap: 5, alignItems: 'center' }}><input type="checkbox" checked={!!p.verified} onChange={(e) => provAction(p.id, { verified: e.target.checked })} /> {L('Verificada', 'Verified')}</label>
                <label style={{ fontSize: 12, display: 'flex', gap: 5, alignItems: 'center' }}><input type="checkbox" checked={!!p.listed} onChange={(e) => provAction(p.id, { listed: e.target.checked })} /> {L('En ranking', 'Listed')}</label>
                <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => provAction(p.id, { action: 'recompute' })}>↻ {L('Recalcular', 'Recompute')}</button>
                <button className="btn btn-ghost" style={{ fontSize: 12, color: 'var(--red)', borderColor: 'rgba(255,107,125,.5)' }} onClick={() => { if (confirm(L('¿Quitar del marketplace?', 'Remove from marketplace?'))) provAction(p.id, { status: 'removed', listed: false }); }}>✕</button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
