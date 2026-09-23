'use client';
import { useEffect, useState } from 'react';
import { PLAN_ROWS } from '@/lib/plansData';
import OnyxIcon from '@/app/components/OnyxIcon';
import { trialDaysOf } from '@/lib/planFacts';

// Icono del encabezado de cada sección (Guardian, Copy trading, Academy).
function sectionIcon(es: string): string {
  if (es.includes('Academy')) return 'graduation';
  if (es.includes('Copy')) return 'swap';
  return 'guardian';
}

// ============================================================
// Tabla comparativa de planes, compartida por el landing y /pricing.
//
// Cada página le pasa su acción de compra:
//   · landing  → un onChoose que lleva a registrarse
//   · pricing  → un onChoose que abre Stripe Checkout
// Así la tabla es la misma en los dos sitios y no se vuelve a desincronizar.
// ============================================================
type Plan = {
  id: string; name: string; name_en?: string; badge?: string | null; badge_en?: string | null;
  max_accounts: number; price_month: number; price_year: number;
};

export default function PlansCompareTable({
  plans, lang, annual = false, onChoose, loadingId = '',
}: {
  plans: Plan[]; lang: 'es' | 'en'; annual?: boolean;
  onChoose: (planId: string, price: number) => void; loadingId?: string;
}) {
  // Filas de comparación: si el admin las editó en Landing Builder, usamos esas;
  // si no, caemos a las del código (PLAN_ROWS). Nunca se queda en blanco.
  const [ovRows, setOvRows] = useState<typeof PLAN_ROWS | null>(null);
  useEffect(() => {
    fetch('/api/landing-content?t=' + Date.now(), { cache: 'no-store' })
      .then((r) => r.json())
      .then((c) => { if (Array.isArray(c?.compare) && c.compare.length) setOvRows(c.compare); })
      .catch(() => {});
  }, []);
  const rows = ovRows && ovRows.length ? ovRows : PLAN_ROWS;

  if (!plans.length) return null;

  const byId = (id: string) => plans.find((p) => p.id === id);
  // Columnas = TODOS los planes reales, ordenados por precio (Gratis → … → Black).
  // Así el plan de bots (o cualquier plan nuevo) aparece automáticamente.
  const cols = [...plans].sort((a, b) => Number(a.price_month) - Number(b.price_month)).map((p) => p.id);
  // Las filas de PLAN_ROWS traen 4 valores en orden [free, pro, elite, black].
  // Para un plan fuera de ese orden (p. ej. el de bots), tomamos el valor de la
  // banda de precio más cercana: gratis, entrada de pago, medio o tope.
  const BASE_ORDER = ['free', 'pro', 'elite', 'black'];
  const baseIdx = (id: string): number => {
    const i = BASE_ORDER.indexOf(id); if (i >= 0) return i;
    const price = Number(byId(id)?.price_month || 0);
    if (price <= 0) return 0;
    const elite = Number(byId('elite')?.price_month || 79);
    const black = Number(byId('black')?.price_month || 199);
    if (price < elite) return 1; if (price < black) return 2; return 3;
  };
  const rowVal = (r: any, id: string): boolean | string => {
    const idx = baseIdx(id);
    return Array.isArray(r.v) ? (r.v[idx] ?? r.v[r.v.length - 1]) : r.v;
  };
  const name = (p?: Plan, id?: string) => p ? (lang === 'es' ? p.name : (p.name_en || p.name)) : (id || '');
  const isPro = (p?: Plan) => !!(p && (lang === 'es' ? p.badge : p.badge_en));
  const acc = (id: string) => {
    const p = byId(id); if (!p || p.max_accounts == null) return '—';
    return p.max_accounts >= 999 ? (lang === 'es' ? 'Ilimitadas' : 'Unlimited') : String(p.max_accounts);
  };
  const chk = (v: boolean | string) => typeof v === 'string'
    ? <span style={{ fontSize: 13 }}>{v}</span>
    : v
      ? <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 6, background: 'var(--green)', color: '#04120b' }}><OnyxIcon name="check" size={14} glow={false} /></span>
      : <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 6, background: 'var(--card2)', color: 'var(--mut)' }}><OnyxIcon name="lock" size={13} glow={false} /></span>;

  return (
    <div style={{ marginTop: 46 }}>
      <h2 style={{ textAlign: 'center', marginBottom: 18 }}>{lang === 'es' ? 'Compara los planes' : 'Compare plans'}</h2>
      <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
        <table style={{ minWidth: 640 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '14px 16px' }}></th>
              {cols.map((id) => {
                const p = byId(id);
                const price = p ? (annual ? p.price_year : p.price_month) : null;
                const per = annual ? (lang === 'es' ? '/año' : '/yr') : (lang === 'es' ? '/mes' : '/mo');
                // "Gratis" solo para el Free real; si falta el plan mostramos "—" (nunca "Gratis" por error).
                const priceLabel = price == null ? '—' : (price === 0 && id === 'free') ? (lang === 'es' ? 'Gratis' : 'Free') : `$${price}`;
                const showPer = price != null && price > 0;
                // Ahorro anual: si el año cuesta menos que 12 meses sueltos, mostramos el % de ahorro.
                const pm = p ? Number(p.price_month) : 0;
                const savePct = (annual && price != null && price > 0 && pm > 0 && pm * 12 > price)
                  ? Math.round((1 - price / (pm * 12)) * 100) : 0;
                return (
                  <th key={id} style={{ textAlign: 'center', padding: '14px 16px', color: isPro(p) ? 'var(--brand)' : 'var(--tx)', fontSize: 15 }}>
                    <div>{name(p, id)}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx)' }}>{priceLabel}<span style={{ fontSize: 11, color: 'var(--mut)', fontWeight: 500 }}>{showPer ? per : ''}</span></div>
                    {savePct > 0 && <div style={{ marginTop: 3 }}><span style={{ fontSize: 10, fontWeight: 800, color: '#04120b', background: 'var(--green)', borderRadius: 20, padding: '1px 7px' }}>{lang === 'es' ? `Ahorra ${savePct}%` : `Save ${savePct}%`}</span></div>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: '12px 16px', color: 'var(--mut)' }}>{lang === 'es' ? 'Cuentas conectadas' : 'Connected accounts'}</td>
              {cols.map((id) => <td key={id} style={{ textAlign: 'center', padding: '12px 16px', fontWeight: 700 }}>{acc(id)}</td>)}
            </tr>

            {/* Prueba gratis por plan (días configurables en Admin → Planes). Solo se
                muestra la fila si algún plan tiene prueba; nada de números fijos. */}
            {cols.some((id) => trialDaysOf(byId(id) as any) > 0) && (
              <tr>
                <td style={{ padding: '12px 16px', color: 'var(--mut)' }}>{lang === 'es' ? 'Prueba gratis' : 'Free trial'}</td>
                {cols.map((id) => {
                  const td = trialDaysOf(byId(id) as any);
                  return <td key={id} style={{ textAlign: 'center', padding: '12px 16px' }}>
                    {td > 0
                      ? <span style={{ fontSize: 12, fontWeight: 800, color: '#3a2a06', background: 'var(--gold, #ffd45e)', borderRadius: 20, padding: '2px 9px' }}>{td} {lang === 'es' ? 'días' : 'days'}</span>
                      : <span style={{ color: 'var(--mut)' }}>—</span>}
                  </td>;
                })}
              </tr>
            )}

            {rows.map((r, ri) => r.head
              ? (<tr key={ri}><td colSpan={cols.length + 1} style={{ padding: '16px 16px 8px', color: 'var(--brand)', fontWeight: 700, fontSize: 13, letterSpacing: '.02em' }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><OnyxIcon name={sectionIcon(r.es)} size={16} /> {lang === 'es' ? r.es : r.en}</span></td></tr>)
              : (<tr key={ri}><td style={{ padding: '12px 16px', color: 'var(--mut)' }}>{lang === 'es' ? r.es : r.en}</td>{cols.map((id) => {
                  // Fila de comisión: lee el % por plan del admin (capabilities.academy_fee_pct) → se actualiza solo.
                  const isFee = /por venta|per sale/i.test(r.es + r.en);
                  let cell: boolean | string = rowVal(r, id);
                  if (isFee) { const pct = (byId(id) as any)?.capabilities?.academy_fee_pct; if (pct != null && !isNaN(Number(pct))) cell = `${Number(pct)}%`; }
                  return <td key={id} style={{ textAlign: 'center', padding: '12px 16px' }}>{chk(cell)}</td>;
                })}</tr>))}

            {/* Botones de compra al final, alineados con cada columna */}
            <tr>
              <td style={{ padding: '18px 16px 16px' }}>
                <div style={{ fontSize: 14, color: 'var(--tx)' }}>{lang === 'es' ? 'Elige tu plan' : 'Choose your plan'}</div>
                <div className="muted" style={{ fontSize: 12 }}>{lang === 'es' ? 'Cambia o cancela cuando quieras' : 'Switch or cancel anytime'}</div>
              </td>
              {cols.map((id) => {
                const p = byId(id);
                const price = p ? (annual ? p.price_year : p.price_month) : null;
                // "Empezar gratis" SOLO para el Free real; los de pago dicen "Elegir …".
                const isFree = id === 'free';
                const label = isFree ? (lang === 'es' ? 'Empezar gratis' : 'Start free')
                  : (lang === 'es' ? 'Elegir ' : 'Choose ') + name(p, id);
                return (
                  <td key={id} style={{ textAlign: 'center', padding: '18px 12px 16px' }}>
                    <button className={'btn ' + (isPro(p) ? 'btn-primary' : 'btn-ghost')}
                      style={{ fontSize: 13, padding: '8px 14px', whiteSpace: 'nowrap' }}
                      onClick={() => onChoose(id, price ?? 0)} disabled={loadingId === id || (!isFree && price == null)}>
                      {loadingId === id ? '...' : label}
                    </button>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
