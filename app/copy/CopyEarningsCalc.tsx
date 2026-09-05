'use client';
import { useState } from 'react';
import OnyxIcon from '@/app/components/OnyxIcon';

// Calculadora de ganancias del TRADER calificado: copiadores × precio × (1 − comisión Onyx).
// Muestra su parte (recurrente) y lo que retiene Onyx. Usada en el landing /copy
// (valores de ejemplo) y en el hub del trader (precargada con sus números reales).
export default function CopyEarningsCalc({ feePct = 30, subs0 = 40, price0 = 29, lang = 'es', live = false }: { feePct?: number; subs0?: number; price0?: number; lang?: 'es' | 'en'; live?: boolean }) {
  const es = lang !== 'en';
  const [subs, setSubs] = useState(Math.max(0, Math.round(subs0 || 0)));
  const [price, setPrice] = useState(Math.max(1, Math.round(price0 || 29)));
  const fee = Math.max(0, Math.min(95, feePct));
  const traderPct = Math.max(0, 100 - fee);
  const gross = subs * price;
  const you = gross * (traderPct / 100);
  const onyx = gross * (fee / 100);
  const money = (n: number) => '$' + Math.round(n).toLocaleString('en-US');

  const label = { fontSize: 13, color: 'var(--mut)', minWidth: 92 } as any;
  const val = { fontSize: 14, fontWeight: 700, minWidth: 40, textAlign: 'right' as const };

  return (
    <div className="card" style={{ border: '1px solid var(--green)', boxShadow: '0 0 0 1px var(--green), 0 0 30px -14px var(--green)' }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 11px', borderRadius: 999, background: 'rgba(52,226,160,.12)', border: '1px solid var(--green)', color: 'var(--soft-green)', fontSize: 12.5, fontWeight: 600, marginBottom: 16 }}><OnyxIcon emoji="🧮" size={14} /> {live ? (es ? 'Tus ingresos' : 'Your earnings') : (es ? 'Calcula lo que ganarías' : 'Calculate what you\'d earn')}</div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <span style={label}>{es ? 'Copiadores' : 'Copiers'}</span>
        <input type="range" min={0} max={500} step={1} value={subs} onChange={(e) => setSubs(+e.target.value)} style={{ flex: 1 }} />
        <span style={val}>{subs}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <span style={label}>{es ? 'Precio / mes' : 'Price / mo'}</span>
        <input type="range" min={5} max={99} step={1} value={price} onChange={(e) => setPrice(+e.target.value)} style={{ flex: 1 }} />
        <span style={val}>${price}</span>
      </div>

      <div className="grid g2" style={{ gap: 12 }}>
        <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: 14, border: '1px solid var(--green)' }}>
          <div className="muted" style={{ fontSize: 12.5 }}>{es ? 'Tú recibes cada mes' : 'You get each month'}</div>
          <b style={{ color: 'var(--green)', fontSize: 26 }}>{money(you)}</b>
          <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{traderPct}% · {es ? 'recurrente' : 'recurring'}</div>
        </div>
        <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: 14 }}>
          <div className="muted" style={{ fontSize: 12.5 }}>{es ? 'Onyx retiene' : 'Onyx keeps'}</div>
          <b style={{ fontSize: 26 }}>{money(onyx)}</b>
          <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{fee}% {es ? 'comisión' : 'fee'}</div>
        </div>
      </div>

      <div className="muted" style={{ fontSize: 11.5, marginTop: 12 }}>{es ? 'Ingreso recurrente mientras sigan copiándote. Estimación, no una promesa de ingresos.' : 'Recurring income while they keep copying you. An estimate, not a promise of income.'}</div>
    </div>
  );
}
