'use client';
import { useEffect, useState } from 'react';

// ============================================================
// PAGO POR USO (cliente) · tarjeta simple para la pestaña Suscripción.
// Muestra saldo, gasto del mes por categoría, tarifas, incluido gratis y un
// upsell suave hacia el plan más barato. La recarga se hace en el monedero.
// Esta tarjeta se oculta en la app de iPhone (regla 3.1.1 de Apple): se monta
// solo cuando !iosApp.
// ============================================================

const usd = (c: number) => '$' + (Math.round(c || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const BARS = ['#7F77DD', '#1D9E75', '#D85A30', '#378ADD', '#BA7517'];

export default function UsageCard({ lang }: { lang: 'es' | 'en' }) {
  const es = lang !== 'en';
  const [d, setD] = useState<any>(null);
  useEffect(() => { (async () => { try { const r = await fetch('/api/wallet/usage', { cache: 'no-store' }); const j = await r.json(); if (r.ok) setD(j); } catch {} })(); }, []);
  if (!d || !d.on) return null;

  const maxCat = Math.max(1, ...((d.byCategory || []).map((c: any) => c.cents)));
  const upsell = d.upsell;
  const spent = d.monthSpentCents || 0;
  // Upsell: si lo que gasta por uso se acerca al precio del plan más barato.
  const showUpsell = upsell && upsell.priceMonth > 0 && spent > 0;
  const cheaperToStay = showUpsell && spent < upsell.priceMonth * 100;

  const box: any = { background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 18, marginTop: 16 };

  return (
    <div style={box}>
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 2 }}>{es ? 'Pago por uso' : 'Pay as you go'}</div>
      <div className="muted" style={{ fontSize: 12.5, marginBottom: 14 }}>
        {es ? 'Tu plan gratis no tiene mensualidad: pagas del saldo solo lo que uses de más.' : 'Your free plan has no monthly fee: you pay from balance only for what you use beyond the free allowance.'}
      </div>

      {/* Saldo + gasto del mes */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 120, background: 'var(--bg)', borderRadius: 12, padding: 12 }}>
          <div className="muted" style={{ fontSize: 12 }}>{es ? 'Tu saldo' : 'Your balance'}</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--green)' }}>{usd(d.balanceCents)}</div>
        </div>
        <div style={{ flex: 1, minWidth: 120, background: 'var(--bg)', borderRadius: 12, padding: 12 }}>
          <div className="muted" style={{ fontSize: 12 }}>{es ? 'Gasto este mes' : 'Spent this month'}</div>
          <div style={{ fontSize: 22, fontWeight: 900 }}>{usd(spent)}</div>
        </div>
      </div>

      {/* Upsell suave */}
      {showUpsell && (
        <div style={{ background: 'rgba(55,138,221,.08)', border: '1px solid rgba(55,138,221,.3)', borderRadius: 12, padding: '10px 12px', marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>
            {cheaperToStay
              ? (es ? `Vas gastando ${usd(spent)} este mes.` : `You've spent ${usd(spent)} this month.`)
              : (es ? `Este mes el uso ya supera el plan ${upsell.cheapestPlanName}.` : `This month your usage already exceeds the ${upsell.cheapestPlanName} plan.`)}
          </div>
          <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
            {es
              ? `Con ${upsell.cheapestPlanName} ($${upsell.priceMonth}/mes) sería ilimitado. ${cheaperToStay ? 'Por ahora te conviene pago por uso.' : 'Súbete y deja de pagar por uso.'}`
              : `With ${upsell.cheapestPlanName} ($${upsell.priceMonth}/mo) it'd be unlimited. ${cheaperToStay ? 'For now pay-as-you-go is cheaper for you.' : 'Upgrade and stop paying per use.'}`}
          </div>
        </div>
      )}

      {/* A qué se fue el gasto */}
      {(d.byCategory || []).length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{es ? 'A qué se fue tu gasto' : 'Where it went'}</div>
          {d.byCategory.map((c: any, i: number) => (
            <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span className="muted" style={{ width: 140, fontSize: 12.5 }}>{es ? c.label_es : c.label_en}</span>
              <div style={{ flex: 1, height: 8, background: 'var(--bg)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${Math.round(c.cents / maxCat * 100)}%`, height: '100%', background: BARS[i % BARS.length] }} />
              </div>
              <span style={{ width: 60, textAlign: 'right', fontSize: 12.5 }}>{usd(c.cents)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tarifas + incluido gratis */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ flex: 1, minWidth: 150 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{es ? 'Tarifas por uso' : 'Usage rates'}</div>
          <div className="muted" style={{ fontSize: 12.5, display: 'flex', justifyContent: 'space-between' }}><span>{es ? 'Llamada de IA' : 'AI call'}</span><span>{usd(d.rates.ai_call_cents)}</span></div>
          <div className="muted" style={{ fontSize: 12.5, display: 'flex', justifyContent: 'space-between' }}><span>{es ? 'Cuenta extra / mes' : 'Extra account / mo'}</span><span>{usd(d.rates.account_month_cents)}</span></div>
        </div>
        <div style={{ flex: 1, minWidth: 150 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{es ? 'Incluido gratis' : 'Included free'}</div>
          <div className="muted" style={{ fontSize: 12.5 }}>{es ? `${d.free.accounts} cuenta · ${d.free.ai} IA al mes` : `${d.free.accounts} account · ${d.free.ai} AI/month`}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{es ? `IA usada: ${d.ai.used}/${d.ai.limit}` : `AI used: ${d.ai.used}/${d.ai.limit}`}</div>
        </div>
      </div>

      <a href="/dashboard/wallet" className="btn btn-primary" style={{ display: 'inline-block' }}>{es ? 'Recargar saldo' : 'Top up balance'}</a>
    </div>
  );
}
