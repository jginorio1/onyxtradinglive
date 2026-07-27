'use client';
import { useMemo, useState } from 'react';

// ============================================================
// Calculadora de lote por riesgo (position sizing).
//   Lotes = (balance × riesgo%) ÷ (stop en pips × valor del pip por lote)
// De navegador, sin backend. Gratis para todos: útil y engancha.
// Los valores por pip son estimaciones; el trader confirma con su bróker.
// ============================================================

type Lang = 'es' | 'en';

const T: any = {
  es: {
    t: 'Calculadora de lote', s: 'Cuántos lotes arriesgar según tu cuenta, sin cálculos a mano.',
    bal: 'Balance de la cuenta', risk: 'Riesgo por operación (%)', stop: 'Stop loss (pips)', inst: 'Instrumento',
    res: 'Tamaño sugerido', lots: 'lotes', atRisk: 'Arriesgas', perPip: 'Valor por pip', money: 'en dinero',
    note: 'Estimación orientativa. El valor por pip real depende de tu bróker, el par y la moneda de la cuenta. Confírmalo antes de operar.',
    custom: 'Otro (valor por pip por lote)', pipVal: 'Valor del pip por lote ($)',
    fill: 'Completa balance, riesgo y stop para ver el resultado.',
    hiRisk: '⚠ Arriesgar más del 2% por operación es agresivo.',
    hiLot: '⚠ Sale un lotaje muy alto para ese stop; revisa los datos.',
  },
  en: {
    t: 'Lot size calculator', s: 'How many lots to risk based on your account, no manual math.',
    bal: 'Account balance', risk: 'Risk per trade (%)', stop: 'Stop loss (pips)', inst: 'Instrument',
    res: 'Suggested size', lots: 'lots', atRisk: 'You risk', perPip: 'Pip value', money: 'in money',
    note: 'Rough estimate. Real pip value depends on your broker, the pair and the account currency. Confirm before trading.',
    custom: 'Other (pip value per lot)', pipVal: 'Pip value per lot ($)',
    fill: 'Fill in balance, risk and stop to see the result.',
    hiRisk: '⚠ Risking more than 2% per trade is aggressive.',
    hiLot: '⚠ That is a very high lot size for that stop; check the numbers.',
  },
};

// valor en dinero de 1 pip por 1.0 lote (aprox., cuenta en USD)
const INSTRUMENTS: { id: string; es: string; en: string; pip: number | null }[] = [
  { id: 'usd', es: 'Forex · par en USD (EURUSD, GBPUSD…)', en: 'Forex · USD pair (EURUSD, GBPUSD…)', pip: 10 },
  { id: 'jpy', es: 'Forex · par en JPY (USDJPY, EURJPY…)', en: 'Forex · JPY pair (USDJPY, EURJPY…)', pip: 9.1 },
  { id: 'xau', es: 'Oro · XAUUSD', en: 'Gold · XAUUSD', pip: 10 },
  { id: 'custom', es: 'Otro (valor por pip por lote)', en: 'Other (pip value per lot)', pip: null },
];

export default function LotCalculator({ lang, balance }: { lang: Lang; balance?: number }) {
  const L = T[lang];
  const [bal, setBal] = useState<string>(balance ? String(Math.round(balance)) : '');
  const [risk, setRisk] = useState<string>('1');
  const [stop, setStop] = useState<string>('');
  const [inst, setInst] = useState<string>('usd');
  const [customPip, setCustomPip] = useState<string>('10');

  const pipValue = useMemo(() => {
    const found = INSTRUMENTS.find((i) => i.id === inst);
    return found?.pip ?? (Number(customPip) || 0);
  }, [inst, customPip]);

  const calc = useMemo(() => {
    const b = Number(bal), r = Number(risk), s = Number(stop), pv = pipValue;
    if (!b || !r || !s || !pv) return null;
    const riskMoney = b * (r / 100);
    const lots = riskMoney / (s * pv);
    return { riskMoney, lots, perPip: lots * pv };
  }, [bal, risk, stop, pipValue]);

  const lbl = { fontSize: 12, color: 'var(--mut)', marginTop: 10, display: 'block' } as any;
  const hiRisk = Number(risk) > 2;
  const hiLot = calc && calc.lots > 50;

  return (
    <div className="card">
      <div className="row" style={{ gap: 9, alignItems: 'center', marginBottom: 2 }}>
        <span style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(124,140,255,.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🧮</span>
        <b style={{ fontSize: 15 }}>{L.t}</b>
      </div>
      <p className="muted" style={{ fontSize: 13, margin: '2px 0 6px' }}>{L.s}</p>

      <div className="grid g2" style={{ gap: 12 }}>
        <div>
          <span style={lbl}>{L.bal}</span>
          <input type="number" inputMode="decimal" value={bal} onChange={(e) => setBal(e.target.value)} placeholder="10000" style={{ margin: '4px 0 0' }} />
        </div>
        <div>
          <span style={lbl}>{L.risk}</span>
          <input type="number" inputMode="decimal" value={risk} onChange={(e) => setRisk(e.target.value)} placeholder="1" style={{ margin: '4px 0 0' }} />
        </div>
        <div>
          <span style={lbl}>{L.stop}</span>
          <input type="number" inputMode="decimal" value={stop} onChange={(e) => setStop(e.target.value)} placeholder="20" style={{ margin: '4px 0 0' }} />
        </div>
        <div>
          <span style={lbl}>{L.inst}</span>
          <select value={inst} onChange={(e) => setInst(e.target.value)} style={{ margin: '4px 0 0' }}>
            {INSTRUMENTS.map((i) => <option key={i.id} value={i.id}>{lang === 'es' ? i.es : i.en}</option>)}
          </select>
        </div>
        {inst === 'custom' && (
          <div>
            <span style={lbl}>{L.pipVal}</span>
            <input type="number" inputMode="decimal" value={customPip} onChange={(e) => setCustomPip(e.target.value)} placeholder="10" style={{ margin: '4px 0 0' }} />
          </div>
        )}
      </div>

      {hiRisk && <div style={{ color: 'var(--amber)', fontSize: 12.5, marginTop: 10 }}>{L.hiRisk}</div>}

      <div style={{ borderTop: '1px solid var(--line)', marginTop: 14, paddingTop: 14 }}>
        {!calc && <div className="muted" style={{ fontSize: 13 }}>{L.fill}</div>}
        {calc && (
          <div className="row between" style={{ flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
            <div>
              <div className="muted" style={{ fontSize: 12 }}>{L.res}</div>
              <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.1 }}>{calc.lots.toFixed(2)} <span style={{ fontSize: 15, fontWeight: 500 }} className="muted">{L.lots}</span></div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 13 }}>
              <div>{L.atRisk}: <b>${calc.riskMoney.toFixed(2)}</b></div>
              <div className="muted">{L.perPip}: ${calc.perPip.toFixed(2)} {L.money}</div>
            </div>
          </div>
        )}
        {hiLot && <div style={{ color: 'var(--amber)', fontSize: 12.5, marginTop: 8 }}>{L.hiLot}</div>}
      </div>

      <p className="muted" style={{ fontSize: 11.5, marginTop: 12, lineHeight: 1.5 }}>ℹ️ {L.note}</p>
    </div>
  );
}
