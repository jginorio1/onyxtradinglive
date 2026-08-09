'use client';
import { useMemo, useState } from 'react';
import { mkL } from '@/lib/i18n';
import type { Lang } from '@/lib/navText';
import OnyxIcon from '@/app/components/OnyxIcon';

// ============================================================
// Calculadora de ganancias, en tarjeta iluminada (resalta sobre el fondo).
//  · mode 'academy'    → el mentor elige su PLAN; se calcula con el % real de ese
//                        plan (capabilities.academy_fee_pct, editable en Facturación)
//                        menos el costo del plan. Recomienda el plan que más deja.
//  · mode 'ambassador' → suscriptores × plan; el embajador gana pct% recurrente.
// `pct` es el % de respaldo (si un plan no fija su propio %). Es una ESTIMACIÓN.
// ============================================================
type PlanRow = { id: string; name: string; name_en?: string; price_month?: number; price_year?: number; capabilities?: any };

const money = (v: number) => '$' + Math.round(v).toLocaleString('en-US');
const clampPct = (n: any) => Math.max(0, Math.min(100, Number(n) || 0));

export default function EarningsCalc({ mode, pct, lang, plans }: { mode: 'academy' | 'ambassador'; pct: number; lang: Lang; plans?: PlanRow[] }) {
  const L = mkL(lang);
  const acad = mode === 'academy';

  // Planes que pueden crear academia (excluye Free y planes sin academia).
  const academyPlans = useMemo(() => (plans || [])
    .filter((p) => p?.capabilities?.academy && Number(p.price_month) > 0)
    .sort((a, b) => Number(a.price_month) - Number(b.price_month)), [plans]);

  const shell = (children: any) => (
    <div style={{ maxWidth: 560, margin: '0 auto', background: 'var(--card)', border: '2px solid var(--brand)', borderRadius: 18, padding: 22, boxShadow: '0 0 0 1px rgba(124,140,255,.5), 0 0 44px rgba(124,140,255,.35)' }}>
      {children}
    </div>
  );
  const chip = (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, background: 'rgba(124,140,255,.15)', color: 'var(--brand)', padding: '5px 13px', borderRadius: 999, marginBottom: 16, fontWeight: 700 }}>
      <OnyxIcon name="coins" size={15} glow={false} /> {acad ? L('Calcula lo que ganarías', 'See what you could earn') : L('Calcula tu comisión', 'Estimate your commission')}
    </div>
  );
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

  // ---- Academia con selector de plan (nuevo) ----
  if (acad && academyPlans.length) {
    return <PlanCalc plans={academyPlans} fallbackPct={pct} lang={lang} shell={shell} chip={chip} row={row} box={box} />;
  }

  // ---- Legacy: % fijo (academia sin planes) / embajador ----
  const fee = clampPct(pct) || (acad ? 10 : 30);
  const [n, setN] = useState(acad ? 50 : 20);
  const [price, setPrice] = useState(acad ? 30 : 19);
  const gross = n * price;
  const onyx = Math.round((gross * fee) / 100);
  const net = acad ? gross - onyx : onyx;

  return shell(
    <>
      {chip}
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
    </>
  );
}

// ============================================================
// Calculadora con selector de plan. Cada plan usa su % real y su costo mensual.
// ============================================================
function PlanCalc({ plans, fallbackPct, lang, shell, chip, row, box }: {
  plans: PlanRow[]; fallbackPct: number; lang: Lang;
  shell: (c: any) => any; chip: any;
  row: (l: string, v: number, mn: number, mx: number, st: number, set: (v: number) => void, out: string) => any;
  box: (k: string, v: string, tint?: 'green' | 'brand') => any;
}) {
  const L = mkL(lang);
  const nameOf = (p: PlanRow) => (lang === 'en' ? (p.name_en || p.name) : p.name);
  const feeOf = (p: PlanRow) => clampPct(p.capabilities?.academy_fee_pct != null ? p.capabilities.academy_fee_pct : fallbackPct);
  const [sel, setSel] = useState<string>(plans[0].id);
  const [annual, setAnnual] = useState(false);
  const [n, setN] = useState(50);
  const [price, setPrice] = useState(30);

  const costOf = (p: PlanRow) => annual ? (Number(p.price_year || 0) / 12) : Number(p.price_month || 0);
  const gross = n * price;
  const netOf = (p: PlanRow) => gross * (1 - feeOf(p) / 100) - costOf(p);

  const cur = plans.find((p) => p.id === sel) || plans[0];
  const fee = feeOf(cur);
  const onyx = gross * fee / 100;
  const cost = costOf(cur);
  const net = netOf(cur);
  const best = plans.slice().sort((a, b) => netOf(b) - netOf(a))[0];

  return shell(
    <>
      {chip}

      {/* Selector de plan */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {plans.map((p) => {
          const on = p.id === sel;
          return (
            <button key={p.id} onClick={() => setSel(p.id)} style={{
              flex: '1 1 0', minWidth: 92, cursor: 'pointer', textAlign: 'center', borderRadius: 12, padding: '10px 8px',
              background: on ? 'rgba(124,140,255,.14)' : 'var(--card2)',
              border: on ? '2px solid var(--brand)' : '1px solid var(--line)', color: 'var(--tx)',
            }}>
              <div style={{ fontSize: 14.5, fontWeight: 800 }}>{nameOf(p)}</div>
              <div style={{ fontSize: 11.5, color: 'var(--mut)', marginTop: 2 }}>{money(costOf(p))}/mes · {feeOf(p)}%</div>
            </button>
          );
        })}
      </div>

      {/* Toggle mensual / anual */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
        <div style={{ display: 'inline-flex', border: '1px solid var(--line)', borderRadius: 999, padding: 3, fontSize: 12.5 }}>
          {[[false, L('Mensual', 'Monthly')], [true, L('Anual', 'Annual')]].map(([val, lbl]: any) => (
            <button key={String(val)} onClick={() => setAnnual(val)} style={{
              padding: '6px 16px', borderRadius: 999, cursor: 'pointer', border: 'none', fontWeight: 700,
              background: annual === val ? 'var(--brand)' : 'transparent', color: annual === val ? '#fff' : 'var(--mut)',
            }}>{lbl}</button>
          ))}
        </div>
      </div>

      {row(L('Alumnos', 'Students'), n, 5, 500, 5, setN, String(n))}
      {row(L('Precio / mes', 'Price / mo'), price, 5, 200, 5, setPrice, '$' + price)}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10, marginTop: 6 }}>
        {box(L('Ingreso bruto', 'Gross'), money(gross))}
        {box('Onyx (' + fee + '%)', '−' + money(onyx))}
        {box(L('Plan', 'Plan') + ' ' + nameOf(cur), '−' + money(cost))}
        {box(L('Tú ganas / mes', 'You keep / mo'), money(net), 'green')}
      </div>

      {/* Recomendación: el plan que más deja para este volumen */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'rgba(124,140,255,.12)', color: 'var(--brand)', borderRadius: 12, padding: '10px 13px', marginTop: 12, fontSize: 13.5 }}>
        <OnyxIcon name="coins" size={16} glow={false} />
        <span>{best.id === sel
          ? L('Estás en el plan que más te deja para tu volumen: ' + nameOf(best) + '.', "You're on the plan that keeps you the most for your volume: " + nameOf(best) + '.')
          : L('Para tu volumen, el plan que más te deja es ' + nameOf(best) + ' (' + money(netOf(best)) + '/mes).', 'For your volume, the plan that keeps you the most is ' + nameOf(best) + ' (' + money(netOf(best)) + '/mo).')}</span>
      </div>

      <a href={'/login?mode=signup&plan=' + cur.id} className="btn btn-primary" style={{ display: 'block', textAlign: 'center', marginTop: 14, padding: '12px 20px', fontSize: 15 }}>
        {L('Empezar con ' + nameOf(cur), 'Start with ' + nameOf(cur))}
      </a>

      <div style={{ fontSize: 11.5, color: 'var(--mut)', marginTop: 12, textAlign: 'center' }}>
        {L('El % sale de tu plan (Facturación → comisión por plan). Estimación, no una promesa de ingresos.', "The % comes from your plan (Billing → fee per plan). An estimate, not an income promise.")}
      </div>
    </>
  );
}
