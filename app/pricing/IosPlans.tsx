'use client';
import { useEffect, useState } from 'react';
import { configureIAP, getIapPlans, buyPlan, restoreIap, type IapPlan } from '@/lib/iap';

// ============================================================
// Planes DENTRO de la app de iOS con COMPRA NATIVA de Apple (In-App Purchase).
// Cumple la regla 3.1.1: los planes se compran con Apple (Face ID / Apple Pay). El
// plan se activa en el servidor por el webhook de RevenueCat.
// ============================================================
type Plan = { id: string; name: string; name_en: string; price_month: number; features?: string[]; features_en?: string[] };

export default function IosPlans({ plans, lang, currentPlan }: { plans: Plan[]; lang: 'es' | 'en'; currentPlan?: string }) {
  const es = lang === 'es';
  const [ready, setReady] = useState(false);
  const [avail, setAvail] = useState(false);
  const [prices, setPrices] = useState<Record<string, IapPlan>>({});
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    let done = false;
    const finish = () => { if (!done) { done = true; setReady(true); } };
    const hard = setTimeout(finish, 8000);
    (async () => {
      try {
        const uid = await fetch('/api/account', { cache: 'no-store' }).then((r) => r.json()).then((j: any) => j?.id || j?.user?.id || j?.profile?.id || '').catch(() => '');
        const ok = await configureIAP(String(uid || ''));
        setAvail(ok);
        finish();
        if (ok) {
          const paid = plans.filter((p) => p.id !== 'free' && Number(p.price_month) > 0).map((p) => p.id);
          const list = await getIapPlans(paid);
          const map: Record<string, IapPlan> = {}; list.forEach((x) => { map[x.planId] = x; });
          setPrices(map);
        }
      } catch {} finally { finish(); clearTimeout(hard); }
    })();
    return () => clearTimeout(hard);
  }, [plans]);

  const purchase = async (p: Plan) => {
    const ip = prices[p.id]; if (!ip?.pkg) return;
    setBusy(p.id); setMsg('');
    const r = await buyPlan(ip.pkg);
    setBusy('');
    if (r.ok) {
      setMsg(es ? '¡Listo! Activando tu plan…' : 'Done! Activating your plan…');
      setTimeout(() => { try { window.location.href = '/dashboard'; } catch {} }, 1800);
    } else if (r.cancelled) { /* cancelado */ }
    else setMsg('Error: ' + (r.error || ''));
  };

  const restore = async () => { setBusy('restore'); await restoreIap(); setBusy(''); setMsg(es ? 'Compras restauradas. Si tenías un plan, se reactivará.' : 'Purchases restored. If you had a plan, it will reactivate.'); };

  if (!ready) return <div className="wrap" style={{ padding: '40px 22px', textAlign: 'center' }}><p className="muted">{es ? 'Cargando…' : 'Loading…'}</p></div>;

  if (!avail) {
    return (
      <div className="wrap" style={{ padding: '48px 22px 60px', textAlign: 'center', maxWidth: 560, margin: '0 auto' }}>
        <h1 style={{ fontSize: 26 }}>{es ? 'Tu plan' : 'Your plan'}</h1>
        <p className="muted" style={{ margin: '10px 0 0', lineHeight: 1.7 }}>
          {es ? 'Tu cuenta está activa y puedes usar todo lo que tu plan incluye.' : 'Your account is active and you can use everything your plan includes.'}
        </p>
      </div>
    );
  }

  const paid = plans.filter((p) => p.id !== 'free' && Number(p.price_month) > 0 && prices[p.id]);

  return (
    <div className="wrap" style={{ padding: '44px 18px 60px', maxWidth: 560, margin: '0 auto' }}>
      <h1 style={{ fontSize: 26, textAlign: 'center' }}>{es ? 'Planes' : 'Plans'}</h1>
      <p className="muted" style={{ textAlign: 'center', margin: '8px 0 22px' }}>{es ? 'Compra con tu Apple ID. Cancela cuando quieras desde Ajustes.' : 'Buy with your Apple ID. Cancel anytime from Settings.'}</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {paid.map((p) => {
          const ip = prices[p.id];
          const nm = es ? p.name : (p.name_en || p.name);
          const feats = (es ? p.features : p.features_en) || [];
          const active = currentPlan === p.id;
          return (
            <div key={p.id} className="card" style={{ padding: 16 }}>
              <div className="row between" style={{ alignItems: 'baseline', gap: 8 }}>
                <b style={{ fontSize: 17 }}>{nm}</b>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{ip.priceString}</span>
              </div>
              {feats.length > 0 && (
                <ul style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: 12.5, color: 'var(--mut)', lineHeight: 1.7 }}>
                  {feats.slice(0, 5).map((f, i) => <li key={i}>{f}</li>)}
                </ul>
              )}
              <button className="btn btn-primary" style={{ width: '100%', marginTop: 12 }} disabled={!!busy || active} onClick={() => purchase(p)}>
                {active ? (es ? 'Tu plan actual' : 'Your current plan') : busy === p.id ? '…' : (es ? `Comprar ${nm}` : `Buy ${nm}`)}
              </button>
            </div>
          );
        })}
      </div>

      {msg ? <p className="muted" style={{ textAlign: 'center', marginTop: 14, fontSize: 13 }}>{msg}</p> : null}

      <div style={{ textAlign: 'center', marginTop: 18, display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn-ghost" style={{ fontSize: 12.5 }} disabled={!!busy} onClick={restore}>{es ? 'Restaurar compras' : 'Restore purchases'}</button>
        <a className="btn btn-ghost" style={{ fontSize: 12.5 }} href="https://apps.apple.com/account/subscriptions" target="_blank" rel="noreferrer">{es ? 'Gestionar suscripción' : 'Manage subscription'}</a>
      </div>
      <p className="muted" style={{ textAlign: 'center', marginTop: 14, fontSize: 11, lineHeight: 1.6 }}>
        {es ? 'El pago se hace con tu Apple ID. La suscripción se renueva sola hasta que la canceles en Ajustes de tu iPhone.' : 'Payment is charged to your Apple ID. The subscription auto-renews until you cancel it in your iPhone Settings.'}
      </p>
    </div>
  );
}
