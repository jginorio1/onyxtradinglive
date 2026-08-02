'use client';
import { useState } from 'react';
import { mkL } from '@/lib/i18n';
import type { Lang } from '@/lib/navText';

// ============================================================
// Calculadora de ganancias, en tarjeta iluminada (resalta sobre el fondo).
//  · mode 'academy'    → alumnos × precio; el mentor se queda con (100 - pct)%.
//  · mode 'ambassador' → suscriptores × plan; el embajador gana pct% recurrente.
// `pct` viene del panel admin (fee de academia por plan / comisión de embajador),
// así al cambiarlo se actualiza aquí y en todos lados. Es una ESTIMACIÓN.
// ============================================================
export default function EarningsCalc({ mode, pct, lang }: { mode: 'academy' | 'ambassador'; pct: number; lang: Lang }) {
  const L = mkL(lang);
  const acad = mode === 'academy';
  const fee = Math.max(0, Math.min(100, Number(pct) || (acad ? 10 : 30)));
  const [n, setN] = useState(acad ? 50 : 20);
  const [price, setPrice] = useState(acad ? 30 : 19);
  const gross = n * price;
  const onyx = Math.round((gross * fee) / 100);
  const net = acad ? gross - onyx : onyx; // academia: te quedas con lo que sobra · embajador: ganas la comisión
  const money = (v: number) => '$' + Math.round(v).toLocaleString('en-US');

  const row = (label: string, value: number, min: number, max: number, step: number, set: (v: number) => void, out: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 11 }}>
      <label style={{ fontSize: 13.5, color: 'var(--mut)', width: 130, flex: 'none' }}>{label}</label>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => set(Number(e.target.value))} style={{ flex: 1, margin: 0 }} />
      <span style={{ fontSize: 14.5, fontWeight: 700, width: 52, textAlign: 'right', flex: 'none' }}>{out}</span>
    </div>
  );

  const box = (k: string, v: string, tint?: 'green' | 'brand') => (
    <div style={{ background: tint === 'green' ? 'rgba(35,197,120,.12)' : tint === 'brand' ? 'rgba(124,140,255,.14)' : 'var(--card2)', borderRadius: 12, padding: '11px 13px' }}>
      <div style={{ fontSize: 12, color: tint === 'green' ? 'var(--green)' : tint === 'brand' ? 'var(--brand)' : 'var(--mut)' }}>{k}</div>
      <div style={{ fontSize: 21, fontWeight: 800, color: tint === 'green' ? 'var(--green)' : tint === 'brand' ? 'var(--brand)' : 'var(--tx)' }}>{v}</div>
    </div>
  );

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', background: 'var(--card)', border: '2px solid var(--brand)', borderRadius: 18, padding: 22, boxShadow: '0 0 0 1px rgba(124,140,255,.5), 0 0 44px rgba(124,140,255,.35)' }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, background: 'rgba(124,140,255,.15)', color: 'var(--brand)', padding: '5px 13px', borderRadius: 999, marginBottom: 16, fontWeight: 700 }}>
        🧮 {acad ? L('Calcula lo que ganarías', 'See what you could earn') : L('Calcula tu comisión', 'Estimate your commission')}
      </div>

      {row(acad ? L('Alumnos', 'Students') : L('Suscriptores', 'Subscribers'), n, acad ? 5 : 1, acad ? 500 : 300, acad ? 5 : 1, setN, String(n))}
      {row(L('Precio / mes', 'Price / mo'), price, acad ? 5 : 19, acad ? 200 : 99, acad ? 5 : 20, setPrice, '$' + price)}

      {acad ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 10, marginTop: 6 }}>
          {box(L('Ingreso bruto', 'Gross'), money(gross))}
          {box('Onyx (' + fee + '%)', '−' + money(onyx))}
          {box(L('Tú ganas / mes', 'You keep / mo'), money(net), 'green')}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10, marginTop: 6 }}>
          {box(L('Comisión', 'Commission') + ' (' + fee + '%)', L('recurrente', 'recurring'))}
          {box(L('Ganas cada mes', 'You earn monthly'), money(net), 'brand')}
        </div>
      )}

      <div style={{ fontSize: 11.5, color: 'var(--mut)', marginTop: 14 }}>
        {acad
          ? L('El % de Onyx sale de tu plan (panel admin). Estimación, no una promesa de ingresos.', "Onyx's % comes from your plan (admin panel). An estimate, not an income promise.")
          : L('Ingreso recurrente mientras sigan suscritos. Estimación, no una promesa de ingresos.', 'Recurring income while they stay subscribed. An estimate, not an income promise.')}
      </div>
    </div>
  );
}
