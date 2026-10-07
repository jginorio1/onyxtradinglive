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
    const caps = (byId(id) as any)?.capabilities || {};
    // Filas numéricas: leen el campo real del plan (historial, master, esclava).
    if (r.dyn === 'history') { const d = Number(caps.history_days) || 0; return d <= 0 ? (lang === 'es' ? 'Ilimitado' : 'Unlimited') : `${d} ${lang === 'es' ? 'días' : 'days'}`; }
    // Copy master/esclava: mismo fallback que el editor de Admin (masters→1, esclavas→2)
    // para que la tabla y el editor SIEMPRE cuadren. 0 o ≥999 = ilimitado (∞); 1–998 = número.
    if (r.dyn === 'masters') { if (!caps.copy) return false; const n = Number(caps.copy_masters ?? 1); return (n <= 0 || n >= 999) ? '∞' : String(n); }
    if (r.dyn === 'slaves') { if (!caps.copy) return false; const n = Number(caps.copy_slaves ?? 2); return (n <= 0 || n >= 999) ? '∞' : String(n); }
    // Filas con capacidad: la marca sale del interruptor REAL del plan en Admin.
    if (r.cap) return !!caps[r.cap];
    // Resto: valor de respaldo por banda de precio.
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

  // Columnas destacadas, a juego con sus tarjetas: Guardian Pro ("popular" →
  // dorado) y Black Onyx (tope de gama → violeta/obsidiana). Tinte MUY suave en
  // toda la columna para no romper la lectura de la tabla.
  const isBlackCol = (id: string) => ['black', 'black_onyx', 'blackonyx'].includes(String(id).toLowerCase());
  const isPopCol = (id: string) => /popular/i.test((lang === 'es' ? byId(id)?.badge : byId(id)?.badge_en) || '');
  const colBg = (id: string): any => isBlackCol(id)
    ? { background: 'color-mix(in srgb, #7a5cff 9%, transparent)' }
    : isPopCol(id)
      ? { background: 'color-mix(in srgb, var(--gold, #e8b923) 8%, transparent)' }
      : {};

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
                const black = isBlackCol(id); const pop = isPopCol(id);
                const nameColor = black ? '#e9e2ff' : pop ? 'var(--gold, #e8b923)' : isPro(p) ? 'var(--brand)' : 'var(--tx)';
                return (
                  <th key={id} style={{ textAlign: 'center', padding: '14px 16px', color: nameColor, fontSize: 15, position: 'relative', ...colBg(id), ...((black || pop) ? { borderTop: `2px solid ${black ? '#e8b923' : 'var(--gold, #e8b923)'}` } : {}) }}>
                    {(black || pop) && <span style={{ position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)', background: black ? 'linear-gradient(100deg,#ffe08a,#e8b923)' : 'var(--gold, #e8b923)', color: '#2a1e02', fontSize: 9, fontWeight: 800, padding: '1px 9px', borderRadius: '0 0 8px 8px', letterSpacing: '.03em', whiteSpace: 'nowrap' }}>{black ? (lang === 'es' ? '◆ EL DEFINITIVO' : '◆ ULTIMATE') : (lang === 'es' ? '★ POPULAR' : '★ POPULAR')}</span>}
                    <div style={{ marginTop: (black || pop) ? 8 : 0, ...(black ? { background: 'linear-gradient(90deg,#fff,#d8c9ff)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', display: 'inline-block' } : {}) }}>{name(p, id)}</div>
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
              {cols.map((id) => <td key={id} style={{ textAlign: 'center', padding: '12px 16px', fontWeight: 700, ...colBg(id) }}>{acc(id)}</td>)}
            </tr>

            {/* Prueba gratis por plan (días configurables en Admin → Planes). Solo se
                muestra la fila si algún plan tiene prueba; nada de números fijos. */}
            {cols.some((id) => trialDaysOf(byId(id) as any) > 0) && (
              <tr>
                <td style={{ padding: '12px 16px', color: 'var(--mut)' }}>{lang === 'es' ? 'Prueba gratis' : 'Free trial'}</td>
                {cols.map((id) => {
                  const td = trialDaysOf(byId(id) as any);
                  return <td key={id} style={{ textAlign: 'center', padding: '12px 16px', ...colBg(id) }}>
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
                  // Traduce los textos de celda (p. ej. History "30 días / Ilimitado") al idioma activo.
                  if (typeof cell === 'string' && lang !== 'es') cell = cell.replace(/Ilimitado/g, 'Unlimited').replace(/d[ií]as/g, 'days').replace(/D[ií]as/g, 'Days');
                  return <td key={id} style={{ textAlign: 'center', padding: '12px 16px', ...colBg(id) }}>{chk(cell)}</td>;
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
                const black = isBlackCol(id); const pop = isPopCol(id);
                const btnStyle: any = black
                  ? { fontSize: 13, padding: '8px 14px', whiteSpace: 'nowrap', background: 'linear-gradient(100deg,#ffe08a,#e8b923 50%,#ff9d3d)', color: '#2a1e02', border: 'none', fontWeight: 800, boxShadow: '0 6px 18px -5px rgba(232,185,35,.5)' }
                  : pop
                    ? { fontSize: 13, padding: '8px 14px', whiteSpace: 'nowrap', background: 'linear-gradient(100deg,#ffcf5c,#ff6a2b)', color: '#241002', border: 'none', fontWeight: 800 }
                    : { fontSize: 13, padding: '8px 14px', whiteSpace: 'nowrap' };
                return (
                  <td key={id} style={{ textAlign: 'center', padding: '18px 12px 16px', ...colBg(id) }}>
                    <button className={'btn ' + (black || pop ? '' : isPro(p) ? 'btn-primary' : 'btn-ghost')}
                      style={btnStyle}
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
