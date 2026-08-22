'use client';
import { useEffect, useState } from 'react';
import { toast } from '@/lib/toast';
import { useLang } from '@/lib/lang';

const TIERC: Record<string, string> = { diamond: '#5aa0e6', gold: 'var(--gold)', silver: '#aab0bd', none: 'var(--mut)' };
// Color de cada pilar (para las tarjetas iluminadas y las barras).
const PC = { discipline: 'var(--purple)', risk: 'var(--green)', performance: 'var(--brand)', consistency: 'var(--gold)' } as const;
const glow = (c: string) => ({ border: '1px solid ' + c, boxShadow: `0 0 0 1px ${c}, 0 0 30px -14px ${c}` }) as any;

export default function CopyTradersAdmin() {
  const { lang } = useLang();
  const es = lang !== 'en';
  const L = (a: string, b: string) => (es ? a : b);
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
    if (j.ok) toast(L('✓ Parámetros guardados. Se aplican en el próximo recálculo.', '✓ Saved. Applied on next recompute.'), 'ok');
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
  const secHead = (icon: string, title: string, sub?: string) => (
    <div style={{ marginBottom: 12 }}>
      <h3 style={{ fontSize: 18, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 16 }}>{icon}</span> {title}</h3>
      {sub && <p className="muted" style={{ fontSize: 12.5, margin: '4px 0 0' }}>{sub}</p>}
    </div>
  );

  // Definición de los 4 pilares (qué mide, de dónde sale, qué lo mueve).
  const PILLARS = [
    { k: 'discipline', ic: '🎯', name: L('Disciplina', 'Discipline'), w: '30%',
      what: L('¿Cumple su plan y documenta sus operaciones?', 'Does he follow his plan and journal his trades?'),
      from: L('Diario del trader', 'Trader journal'),
      detail: L('Adherencia al plan (sí/parcial) · calidad autoevaluada A/B/C · cuánto documenta · +8 si tiene plan escrito.', 'Plan adherence (yes/partial) · self-grade A/B/C · how much he journals · +8 if he has a written plan.') },
    { k: 'risk', ic: '🛡️', name: L('Gestión de riesgo', 'Risk management'), w: '25%',
      what: L('¿Controla su drawdown y respeta sus reglas?', 'Does he control drawdown and respect his rules?'),
      from: L('Curva de equity + diario', 'Equity curve + journal'),
      detail: L('Drawdown máx % (menos es más) · penaliza cada regla rota marcada en el diario (moví SL, sobreoperé…).', 'Max drawdown % (lower is better) · penalizes each broken rule flagged in the journal.') },
    { k: 'performance', ic: '📈', name: L('Rendimiento', 'Performance'), w: '25%',
      what: L('¿Gana de forma ajustada al riesgo?', 'Does he win in a risk-adjusted way?'),
      from: L('Operaciones', 'Trades'),
      detail: L('Profit factor (60%) + R:R (40%). NO el retorno bruto. Si pierde o hace martingala, se limita.', 'Profit factor (60%) + R:R (40%). NOT gross return. Capped if losing or martingale.') },
    { k: 'consistency', ic: '📅', name: L('Consistencia', 'Consistency'), w: '20%',
      what: L('¿Es constante y con muestra suficiente?', 'Is he steady with a large enough sample?'),
      from: L('Operaciones', 'Trades'),
      detail: L('Días operados + nº de trades. Un solo día que concentre la ganancia hunde este pilar.', 'Trading days + number of trades. A single dominant day sinks this pillar.') },
  ] as const;

  const bar = (label: string, val: number, color: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11 }}>
      <span style={{ width: 66, color: 'var(--mut)', flex: '0 0 auto' }}>{label}</span>
      <span style={{ flex: 1, height: 6, background: 'var(--bg2)', borderRadius: 6, overflow: 'hidden' }}><span style={{ display: 'block', width: `${Math.max(3, Math.min(100, val))}%`, height: '100%', background: color, boxShadow: `0 0 8px -2px ${color}` }} /></span>
      <span style={{ width: 22, textAlign: 'right', color: 'var(--tx)' }}>{Math.round(val)}</span>
    </div>
  );

  const GATE_ROWS: [string, string][] = [['silver', 'Onyx Silver'], ['gold', 'Onyx Gold'], ['diamond', 'Onyx Diamond']];
  const COLS: [string, string, string][] = [['score', 'Score', 'Score'], ['trades', 'Ops', 'Trades'], ['days', 'Días', 'Days'], ['pf', 'PF', 'PF'], ['maxDD', 'DD máx %', 'Max DD %']];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <h3 style={{ fontSize: 21 }}>{L('Onyx Copy — calificación y traders', 'Onyx Copy — grading & traders')}</h3>
        <p className="muted" style={{ fontSize: 13 }}>{L('Así califica Onyx AI a cada trader y así gestionas el ranking, la monetización y el acceso.', 'How Onyx AI grades each trader and how you manage the ranking, monetization and access.')}</p>
      </div>

      {/* Monetización y acceso */}
      <div className="card" style={glow('var(--green)')}>
        <div style={{ fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>💵 {L('Monetización y acceso', 'Monetization & access')}</div>
        <p className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>{L('Define cuánto se queda Onyx de cada suscripción, si permites comisión por rendimiento y quién puede copiar.', 'Set how much Onyx keeps from each subscription, whether to allow performance fees, and who can copy.')}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
          <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>{L('Comisión de Onyx (%)', 'Onyx fee (%)')}</div>
            <input value={config.feePct ?? 30} onChange={(e) => setConfig({ ...config, feePct: Number(e.target.value) || 0 })} style={{ ...inp, width: 80 }} />
            <div className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>{L('Onyx retiene', 'Onyx keeps')} <b style={{ color: 'var(--green)' }}>{config.feePct ?? 30}%</b> · {L('trader recibe', 'trader gets')} <b style={{ color: 'var(--tx)' }}>{Math.max(0, 100 - (config.feePct ?? 30))}%</b>. {L('Ponlo en 50+ para quedarte con la mayoría.', 'Set 50+ to keep the majority.')}</div>
          </div>
          <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>{L('Comisión por rendimiento', 'Performance fee')}</div>
            <label style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={!!config.perfEnabled} onChange={(e) => setConfig({ ...config, perfEnabled: e.target.checked })} /> {config.perfEnabled ? L('Permitida', 'Allowed') : L('Desactivada (solo suscripción)', 'Off (subscription only)')}</label>
            <div className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>{L('Recomendado apagada: la ganancia está en el bróker del copiador (se cobraría a su tarjeta y da fricción).', 'Recommended off: the profit sits in the copier\'s broker (would be billed to their card and causes friction).')}</div>
          </div>
          <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>{L('¿Quién puede copiar?', 'Who can copy?')}</div>
            <select value={config.followGate || 'all'} onChange={(e) => setConfig({ ...config, followGate: e.target.value })} style={{ width: '100%', margin: 0, padding: '7px 9px', fontSize: 13 }}>
              <option value="all">{L('Todos (incluye Free) — más ingresos', 'Everyone (incl. Free) — more revenue')}</option>
              <option value="copy">{L('Solo planes con copy (Pro+)', 'Only plans with copy (Pro+)')}</option>
            </select>
            <div className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>{L('Abierto a todos = más copiadores = más suscripciones para ti y para el trader.', 'Open to all = more copiers = more subscriptions for you and the trader.')}</div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <button className="btn btn-primary" onClick={saveConfig} disabled={saving}>{saving ? '…' : L('Guardar', 'Save')}</button>
        </div>
      </div>

      {/* Cómo se califica — 4 pilares iluminados */}
      <div>
        {secHead('🏆', L('Cómo se calcula el Onyx Score (0–100)', 'How the Onyx Score is computed (0–100)'), L('Ventana de análisis: últimos ' + config.windowDays + ' días. Pesa más la disciplina y el riesgo que el retorno bruto.', 'Analysis window: last ' + config.windowDays + ' days. Discipline and risk weigh more than raw return.'))}
        <div className="grid g4" style={{ gap: 12 }}>
          {PILLARS.map((p) => {
            const c = (PC as any)[p.k];
            return (
              <div key={p.k} className="card" style={{ ...glow(c), display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}><span>{p.ic}</span> {p.name}</span>
                  <span style={{ fontSize: 20, fontWeight: 800, color: c }}>{config.weights[p.k] != null ? Math.round((config.weights[p.k] / ((config.weights.discipline + config.weights.risk + config.weights.performance + config.weights.consistency) || 1)) * 100) + '%' : p.w}</span>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--tx)' }}>{p.what}</div>
                <div style={{ fontSize: 11, color: c, fontWeight: 600 }}>◆ {p.from}</div>
                <div className="muted" style={{ fontSize: 11.5, lineHeight: 1.55 }}>{p.detail}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Niveles + anti-gaming */}
      <div className="grid" style={{ gridTemplateColumns: '1.4fr 1fr', gap: 12 }}>
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 10 }}>{L('Los niveles', 'The tiers')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {GATE_ROWS.map(([t, label]) => {
              const g = config.gates[t];
              return (
                <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: 'var(--bg2)', borderLeft: `3px solid ${TIERC[t]}` }}>
                  <span style={{ width: 108, fontWeight: 700, color: TIERC[t], fontSize: 13 }}>{label}</span>
                  <span className="muted" style={{ fontSize: 12 }}>{L('Score', 'Score')} ≥{g.score} · {g.trades} {L('ops', 'trades')} · {g.days}d · PF ≥{g.pf} · DD ≤{g.maxDD}%{g.verified ? ' · ' + L('verificada', 'verified') : ''}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="card" style={glow('var(--amber)')}>
          <div style={{ fontWeight: 700, marginBottom: 8, color: 'var(--amber)' }}>⚠ {L('Anti-gaming', 'Anti-gaming')}</div>
          <p className="muted" style={{ fontSize: 12, marginBottom: 8 }}>{L('Patrones que castigan el score o retiran del ranking:', 'Patterns that penalize the score or delist:')}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {[L('día dominante', 'dominant day'), L('martingala', 'martingale'), L('pérdida atroz', 'huge loss'), L('muestra corta', 'small sample')].map((f) => (
              <span key={f} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 999, background: 'rgba(255,192,77,.12)', border: '1px solid var(--amber)', color: 'var(--amber)' }}>{f}</span>
            ))}
            <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 999, background: 'rgba(255,107,125,.12)', border: '1px solid var(--red)', color: 'var(--red)' }}>{L('circuit breaker: DD>15% → retiro auto', 'circuit breaker: DD>15% → auto-delist')}</span>
          </div>
        </div>
      </div>

      {/* Parámetros editables */}
      <div className="card">
        {secHead('⚙️', L('Editar parámetros de calificación', 'Edit grading parameters'), L('Cambia los pesos y los requisitos. Se aplican en el próximo recálculo (cron diario o botón Recalcular).', 'Change weights and requirements. Applied on the next recompute (daily cron or Recompute button).'))}
        <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: 12, marginBottom: 12 }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>{L('Pesos del score (se normalizan solos)', 'Score weights (auto-normalized)')}</div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {([['discipline', L('Disciplina', 'Discipline')], ['risk', L('Riesgo', 'Risk')], ['performance', L('Rendimiento', 'Performance')], ['consistency', L('Consistencia', 'Consistency')]] as const).map(([k, lbl]) => (
              <div key={k}><div style={{ fontSize: 12, color: (PC as any)[k], fontWeight: 600 }}>{lbl}</div><input value={config.weights[k]} onChange={(e) => setW(k, e.target.value)} style={inp} /></div>
            ))}
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
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
        </div>
        <div className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>{L('Score = puntaje mínimo · Ops/Días = muestra mínima · PF = profit factor mínimo · DD máx = drawdown tope · Verificada = exige cuenta live confirmada.', 'Score = min score · Ops/Days = min sample · PF = min profit factor · Max DD = drawdown cap · Verified = requires confirmed live account.')}</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
          <div><div className="muted" style={{ fontSize: 12 }}>{L('Ventana de análisis (días)', 'Analysis window (days)')}</div><input value={config.windowDays} onChange={(e) => setConfig({ ...config, windowDays: Number(e.target.value) || 0 })} style={{ ...inp, width: 80 }} /></div>
          <button className="btn btn-primary" onClick={saveConfig} disabled={saving} style={{ marginLeft: 'auto' }}>{saving ? '…' : L('Guardar parámetros', 'Save parameters')}</button>
        </div>
      </div>

      {/* Traders — fichas enriquecidas */}
      <div>
        {secHead('👤', L('Traders calificados', 'Graded traders') + ` (${providers.length})`, L('Cada ficha muestra el desglose por pilar, sus banderas y su verificación.', 'Each card shows the pillar breakdown, flags and verification.'))}
        {providers.length === 0 && <div className="card muted" style={{ textAlign: 'center', padding: 24 }}>{L('Aún nadie ha postulado su cuenta.', 'No one has listed an account yet.')}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {providers.map((p) => {
            const s = p.stats || {}; const pl = p.pillars || {};
            const initials = String(p.display_name || 'O').split(' ').map((x: string) => x[0]).join('').slice(0, 2).toUpperCase();
            const tc = TIERC[p.tier] || 'var(--line)';
            return (
              <div key={p.id} className="card" style={{ borderLeft: `3px solid ${tc}` }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--bg2)', color: tc, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flex: '0 0 auto' }}>{p.avatar_url ? <img src={p.avatar_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : initials}</div>
                  <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <b>{p.display_name}</b>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, color: tc, border: `1px solid ${tc}` }}>{p.tier === 'none' ? L('En evaluación', 'In review') : p.tier}</span>
                      {p.verified && <span style={{ fontSize: 11, color: 'var(--green)' }}>✓ {L('verificada', 'verified')}</span>}
                      {Array.isArray(p.flags) && p.flags.map((f: string) => <span key={f} style={{ fontSize: 10.5, padding: '1px 7px', borderRadius: 999, background: 'rgba(255,192,77,.12)', border: '1px solid var(--amber)', color: 'var(--amber)' }}>⚠ {f}</span>)}
                      {p.auto_delisted && <span style={{ fontSize: 10.5, color: 'var(--red)' }}>{L('retirado (drawdown)', 'delisted (drawdown)')}</span>}
                    </div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>Win {s.winRate ?? 0}% · PF {s.pf ?? 0} · R:R {s.rr ?? 0} · DD {s.maxDDpct ?? 0}% · {s.trades ?? 0} ops · {s.tradingDays ?? 0} {L('días', 'days')} · {p.followers || 0} {L('copian', 'copying')}{p.fee_month ? ` · $${p.fee_month}/mo` : ''}{p.perf_fee_pct ? ` · ${p.perf_fee_pct}% perf` : ''}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 16px', marginTop: 8, maxWidth: 420 }}>
                      {bar(L('Disciplina', 'Discipline'), pl.discipline || 0, PC.discipline)}
                      {bar(L('Riesgo', 'Risk'), pl.risk || 0, PC.risk)}
                      {bar(L('Rendim.', 'Perform.'), pl.performance || 0, PC.performance)}
                      {bar(L('Consist.', 'Consist.'), pl.consistency || 0, PC.consistency)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', flex: '0 0 auto' }}><div style={{ fontSize: 30, fontWeight: 800, color: tc }}>{p.score}</div><div className="muted" style={{ fontSize: 10 }}>Onyx Score</div></div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
                  <label style={{ fontSize: 12, display: 'flex', gap: 5, alignItems: 'center' }}><input type="checkbox" checked={!!p.verified} onChange={(e) => provAction(p.id, { verified: e.target.checked })} /> {L('Verificada', 'Verified')}</label>
                  <label style={{ fontSize: 12, display: 'flex', gap: 5, alignItems: 'center' }}><input type="checkbox" checked={!!p.listed} onChange={(e) => provAction(p.id, { listed: e.target.checked })} /> {L('En ranking', 'Listed')}</label>
                  <button className="btn btn-ghost" style={{ fontSize: 12, marginLeft: 'auto' }} onClick={() => provAction(p.id, { action: 'recompute' })}>↻ {L('Recalcular', 'Recompute')}</button>
                  <button className="btn btn-ghost" style={{ fontSize: 12, color: 'var(--red)', borderColor: 'rgba(255,107,125,.5)' }} onClick={() => { if (confirm(L('¿Quitar del marketplace?', 'Remove from marketplace?'))) provAction(p.id, { status: 'removed', listed: false }); }}>✕</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
