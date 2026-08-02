'use client';
import { PLAN_ROWS } from '@/lib/plansData';
import OnyxIcon from '@/app/components/OnyxIcon';

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
  if (!plans.length) return null;

  const cols = ['free', 'pro', 'elite', 'black'];
  const byId = (id: string) => plans.find((p) => p.id === id);
  const name = (p?: Plan, id?: string) => p ? (lang === 'es' ? p.name : (p.name_en || p.name)) : (id || '');
  const isPro = (p?: Plan) => !!(p && (lang === 'es' ? p.badge : p.badge_en));
  const acc = (id: string) => {
    const p = byId(id); if (!p) return '—';
    return p.max_accounts >= 999 ? (lang === 'es' ? 'Ilimitadas' : 'Unlimited') : String(p.max_accounts);
  };
  const chk = (v: boolean | string) => typeof v === 'string'
    ? <span style={{ fontSize: 13 }}>{v}</span>
    : v
      ? <span style={{ color: 'var(--green)', display: 'inline-flex' }}><OnyxIcon name="check" size={17} glow={false} /></span>
      : <span style={{ color: '#66708a', display: 'inline-flex' }}><OnyxIcon name="lock" size={15} glow={false} /></span>;

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
                const price = p ? (annual ? p.price_year : p.price_month) : 0;
                const per = annual ? (lang === 'es' ? '/año' : '/yr') : (lang === 'es' ? '/mes' : '/mo');
                return (
                  <th key={id} style={{ textAlign: 'center', padding: '14px 16px', color: isPro(p) ? 'var(--brand)' : 'var(--tx)', fontSize: 15 }}>
                    <div>{name(p, id)}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx)' }}>{price === 0 ? (lang === 'es' ? 'Gratis' : 'Free') : `$${price}`}<span style={{ fontSize: 11, color: 'var(--mut)', fontWeight: 500 }}>{price === 0 ? '' : per}</span></div>
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

            {PLAN_ROWS.map((r, ri) => r.head
              ? (<tr key={ri}><td colSpan={5} style={{ padding: '16px 16px 8px', color: 'var(--brand)', fontWeight: 700, fontSize: 13, letterSpacing: '.02em' }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><OnyxIcon name={sectionIcon(r.es)} size={16} /> {lang === 'es' ? r.es : r.en}</span></td></tr>)
              : (<tr key={ri}><td style={{ padding: '12px 16px', color: 'var(--mut)' }}>{lang === 'es' ? r.es : r.en}</td>{r.v.map((v, ci) => {
                  // Fila de comisión: lee el % por plan del admin (capabilities.academy_fee_pct) → se actualiza solo.
                  const isFee = /por venta|per sale/i.test(r.es + r.en);
                  let cell: boolean | string = v;
                  if (isFee) { const pct = (byId(cols[ci]) as any)?.capabilities?.academy_fee_pct; if (pct != null && !isNaN(Number(pct))) cell = `${Number(pct)}%`; }
                  return <td key={ci} style={{ textAlign: 'center', padding: '12px 16px' }}>{chk(cell)}</td>;
                })}</tr>))}

            {/* Botones de compra al final, alineados con cada columna */}
            <tr>
              <td style={{ padding: '18px 16px 16px' }}>
                <div style={{ fontSize: 14, color: 'var(--tx)' }}>{lang === 'es' ? 'Elige tu plan' : 'Choose your plan'}</div>
                <div className="muted" style={{ fontSize: 12 }}>{lang === 'es' ? 'Cambia o cancela cuando quieras' : 'Switch or cancel anytime'}</div>
              </td>
              {cols.map((id) => {
                const p = byId(id);
                const price = p ? (annual ? p.price_year : p.price_month) : 0;
                const free = id === 'free' || price === 0;
                const label = free ? (lang === 'es' ? 'Empezar gratis' : 'Start free')
                  : (lang === 'es' ? 'Elegir ' : 'Choose ') + name(p, id);
                return (
                  <td key={id} style={{ textAlign: 'center', padding: '18px 12px 16px' }}>
                    <button className={'btn ' + (isPro(p) ? 'btn-primary' : 'btn-ghost')}
                      style={{ fontSize: 13, padding: '8px 14px', whiteSpace: 'nowrap' }}
                      onClick={() => onChoose(id, price)} disabled={loadingId === id}>
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
