'use client';
import OnyxIcon from '@/app/components/OnyxIcon';

// ============================================================
// Tarjeta DESTACADA de diagnóstico cuantitativo del "edge" (ventaja).
// Reúne todos los KPIs de este tema, calculados en lib/analytics.ts:
//  · Esperanza matemática (por operación, en R y en $).
//  · Ley de los grandes números: fiabilidad de la muestra (nº de operaciones).
//  · Detección de ruido vs edge: t-stat de la esperanza + SQN (Van Tharp).
// Es una ESTIMACIÓN estadística, no una garantía: se avisa siempre.
// ============================================================
const money = (n: number) => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString();

export default function QuantEdgeCard({ a, lang }: { a: any; lang: string }) {
  const es = lang !== 'en';
  const L = (x: string, y: string) => (es ? x : y);
  const GREEN = 'var(--green)', RED = 'var(--red)', AMBER = 'var(--amber)', MUT = 'var(--mut)';

  const n = a?.n || 0;
  // Necesitamos pérdida media (1R) y una muestra mínima para medir en R.
  if (!a?.rValid) {
    return (
      <div className="card" style={{ margin: 0, border: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontWeight: 800, fontSize: 14.5 }}>
          <OnyxIcon name="ruler" size={18} /> {L('Diagnóstico cuantitativo del edge', 'Quant edge diagnostic')}
        </div>
        <div className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>
          {L('Aún no hay suficientes operaciones cerradas (con al menos una pérdida) para medir tu esperanza con fiabilidad. Sigue operando y vuelve aquí.',
             'Not enough closed trades yet (with at least one loss) to reliably measure your expectancy. Keep trading and come back here.')}
        </div>
      </div>
    );
  }

  const rMean = a.rMean || 0, rStd = a.rStd || 0, tStat = a.tStat || 0, sqn = a.sqn || 0;
  const expectancy = a.expectancy || 0, avgLoss = a.avgLoss || 0;

  // Fiabilidad de la muestra (ley de los grandes números). Objetivo "alta" = 200.
  const target = 200;
  const relPct = Math.min(1, n / target);
  const rel = n < 30 ? { t: L('muy baja', 'very low'), c: RED }
    : n < 100 ? { t: L('baja', 'low'), c: AMBER }
    : n < 200 ? { t: L('media', 'medium'), c: GOLDish() }
    : { t: L('alta', 'high'), c: GREEN };
  function GOLDish() { return 'var(--gold, #ffd45e)'; }

  // Veredicto edge vs ruido (t-stat). Orientativo.
  const verdict = n < 30
    ? { t: L('Muestra pequeña · no concluyente', 'Small sample · inconclusive'), c: MUT, sub: L('Con menos de 30 operaciones la estadística engaña.', 'Under 30 trades the statistics are misleading.') }
    : rMean <= 0
      ? { t: L('Esperanza negativa · sin edge', 'Negative expectancy · no edge'), c: RED, sub: L('En promedio pierdes por operación.', 'On average you lose per trade.') }
      : tStat >= 2
        ? { t: L('Edge probable · se distingue del azar', 'Likely edge · beats randomness'), c: GREEN, sub: L('Tus resultados no parecen ruido (t ≥ 2).', 'Your results do not look like noise (t ≥ 2).') }
        : tStat >= 1
          ? { t: L('No concluyente · sigue midiendo', 'Inconclusive · keep measuring'), c: AMBER, sub: L('Hay señal, pero aún no es significativa.', 'There is signal, but not significant yet.') }
          : { t: L('Parece ruido · no se distingue del azar', 'Looks like noise · not distinguishable'), c: RED, sub: L('Tu ventaja no supera lo esperable por azar (t < 1).', 'Your edge does not beat chance (t < 1).') };

  // Calidad global (SQN de Van Tharp).
  const sqnLbl = sqn < 1.6 ? L('pobre', 'poor') : sqn < 2 ? L('medio', 'average') : sqn < 3 ? L('bueno', 'good') : sqn < 5 ? L('excelente', 'excellent') : L('excepcional', 'exceptional');
  const sqnCol = sqn < 1.6 ? RED : sqn < 2 ? AMBER : sqn < 3 ? GREEN : GREEN;

  const cell: any = { background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 11, padding: '10px 11px' };
  const lbl: any = { fontSize: 10.5, color: MUT, fontWeight: 700, letterSpacing: '.02em' };
  const big: any = { fontSize: 19, fontWeight: 800, lineHeight: 1.05, marginTop: 3 };
  const sub: any = { fontSize: 10, color: MUT, marginTop: 2 };

  return (
    <div className="card" style={{ margin: 0, position: 'relative', border: '1.5px solid var(--brand)', boxShadow: '0 0 26px -10px rgba(124,140,255,.55)', background: 'linear-gradient(160deg, color-mix(in srgb,var(--brand) 8%,var(--card)), var(--card))' }}>
      <span style={{ position: 'absolute', top: -10, left: 16, background: 'var(--grad)', color: '#fff', fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 99, letterSpacing: '.06em' }}>{L('CUANTITATIVO', 'QUANT')}</span>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontWeight: 800, fontSize: 15 }}>
          <OnyxIcon name="ruler" size={19} /> {L('Diagnóstico cuantitativo del edge', 'Quant edge diagnostic')}
        </div>
        <span className="muted" style={{ fontSize: 11.5 }}>{n} {L('operaciones', 'trades')}</span>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 9, marginTop: 12 }}>
        <div style={cell}>
          <div style={lbl}>{L('ESPERANZA / OP', 'EXPECTANCY / TRADE')}</div>
          <div style={{ ...big, color: rMean >= 0 ? GREEN : RED }}>{(rMean >= 0 ? '+' : '') + rMean.toFixed(2)} R</div>
          <div style={sub}>≈ {(expectancy >= 0 ? '+' : '') + money(expectancy)} {L('por operación', 'per trade')}</div>
        </div>
        <div style={cell}>
          <div style={lbl}>{L('DISPERSIÓN (R)', 'DISPERSION (R)')}</div>
          <div style={big}>±{rStd.toFixed(2)} R</div>
          <div style={sub}>{L('volatilidad de resultados', 'result volatility')}</div>
        </div>
        <div style={cell}>
          <div style={lbl}>{L('CALIDAD (SQN)', 'QUALITY (SQN)')}</div>
          <div style={{ ...big, color: sqnCol }}>{sqn.toFixed(2)}</div>
          <div style={sub}>{sqnLbl} · Van Tharp</div>
        </div>
        <div style={cell}>
          <div style={lbl}>{L('SIGNIFICANCIA (t)', 'SIGNIFICANCE (t)')}</div>
          <div style={{ ...big, color: verdict.c }}>{tStat.toFixed(2)}</div>
          <div style={sub}>{L('edge vs azar', 'edge vs chance')}</div>
        </div>
      </div>

      {/* Ley de los grandes números: fiabilidad de la muestra */}
      <div style={{ ...cell, marginTop: 9 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <span style={lbl}>{L('MUESTRA · LEY DE LOS GRANDES NÚMEROS', 'SAMPLE · LAW OF LARGE NUMBERS')}</span>
          <span style={{ fontSize: 11.5, fontWeight: 800, color: rel.c }}>{L('fiabilidad', 'reliability')} {rel.t}</span>
        </div>
        <div style={{ height: 6, background: 'var(--card)', borderRadius: 6, marginTop: 8, overflow: 'hidden' }}>
          <div style={{ width: (relPct * 100).toFixed(0) + '%', height: '100%', background: rel.c }} />
        </div>
        <div style={sub}>{n} / {target} {L('operaciones · a más operaciones, tu resultado real converge a la esperanza.', 'trades · with more trades, real results converge to expectancy.')}</div>
      </div>

      {/* Veredicto (semáforo) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginTop: 9, background: 'var(--bg2)', border: '1px solid ' + (verdict.c === MUT ? 'var(--line)' : 'color-mix(in srgb,' + verdict.c + ' 45%,transparent)'), borderRadius: 12, padding: '11px 13px' }}>
        <span style={{ width: 12, height: 12, borderRadius: '50%', background: verdict.c, boxShadow: verdict.c === MUT ? 'none' : '0 0 9px ' + verdict.c, flex: 'none' }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800 }}>{verdict.t}</div>
          <div style={{ fontSize: 11, color: MUT }}>{verdict.sub}</div>
        </div>
      </div>

      <div style={{ fontSize: 10, color: MUT, marginTop: 8 }}>
        {L('Estimación estadística, no una garantía. Asume operaciones independientes y mejora con más datos; no predice resultados futuros.',
           'Statistical estimate, not a guarantee. It assumes independent trades and improves with more data; it does not predict future results.')}
      </div>
    </div>
  );
}
