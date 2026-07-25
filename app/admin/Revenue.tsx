'use client';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/lang';
import { useT } from '@/lib/adminText';

const T: any = {
  es: {
    notConfigured: 'Conecta tu clave de Stripe (STRIPE_SECRET_KEY en Vercel) para ver los ingresos en vivo.',
    mrr: 'Ingreso mensual (MRR)', arr: 'Proyección anual', active: 'Suscripciones activas',
    collected: 'Cobrado (30 días)', paid: 'cobros', failed: 'Pagos fallidos (30 días)',
    newSubs: 'Nuevas (30 días)', canceled: 'Canceladas (30 días)',
    recent: 'Últimos cobros', ok: 'Cobrado', ko: 'Fallido', noRecent: 'Sin cobros recientes.',
    liveBadge: 'En vivo', errPrefix: 'Stripe respondió con un error: ',
    tip: 'El MRR es tu ingreso recurrente mensual: la base más importante del negocio. Vigila que suba y que los pagos fallidos bajen.',
  },
  en: {
    notConfigured: 'Connect your Stripe key (STRIPE_SECRET_KEY in Vercel) to see live revenue.',
    mrr: 'Monthly revenue (MRR)', arr: 'Annual projection', active: 'Active subscriptions',
    collected: 'Collected (30 days)', paid: 'charges', failed: 'Failed payments (30 days)',
    newSubs: 'New (30 days)', canceled: 'Canceled (30 days)',
    recent: 'Recent charges', ok: 'Paid', ko: 'Failed', noRecent: 'No recent charges.',
    liveBadge: 'Live', errPrefix: 'Stripe returned an error: ',
    tip: 'MRR is your recurring monthly revenue: the most important base of the business. Keep it rising and failed payments falling.',
  },
};

const money = (n: number, cur: string) => new Intl.NumberFormat(undefined, { style: 'currency', currency: (cur || 'usd').toUpperCase() }).format(n || 0);

export default function Revenue() {
  const { lang } = useLang();
  const t = T[lang];
  const gt = useT();
  const [d, setD] = useState<any>(null);

  useEffect(() => {
    const load = () => fetch('/api/admin/revenue').then((r) => r.json()).then(setD).catch(() => setD({ configured: false }));
    load(); const iv = setInterval(load, 60000); return () => clearInterval(iv);
  }, []);

  const cur = d?.currency || 'usd';
  const Tile = ({ label, value, color, live }: { label: string; value: any; color?: string; live?: boolean }) => (
    <div className="tile">
      <div className="muted" style={{ fontSize: 11.5 }}>{label}</div>
      <div className="row" style={{ gap: 7, marginTop: 3 }}>
        <span style={{ fontSize: 22, fontWeight: 800, color: color || 'var(--tx)' }}>{value}</span>{live && <span className="livedot" />}
      </div>
    </div>
  );

  return (
    <>
      <div className="row between" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div className="tabhead"><div className="th-row"><span className="th-ic">💰</span><span className="th-t">{gt.nav_ingresos}</span></div><div className="th-s">{gt.h_ingresos_s}</div></div>
        {d?.configured && !d?.error && <span className="pill" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#7fe9c0', background: 'rgba(52,226,160,.15)' }}><span className="livedot" />{t.liveBadge}</span>}
      </div>

      {!d && <div className="muted">…</div>}
      {d && d.configured === false && <div className="card"><p className="muted" style={{ fontSize: 14, margin: 0 }}>{t.notConfigured}</p></div>}
      {d && d.error && <div className="card"><p style={{ fontSize: 13.5, margin: 0, color: 'var(--amber)' }}>{t.errPrefix}{d.error}</p></div>}

      {d && d.configured && !d.error && (
        <>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginBottom: 12 }}>
            {Tile({ label: t.mrr, value: money(d.mrr, cur), color: 'var(--green)', live: true })}
            {Tile({ label: t.arr, value: money(d.arr, cur) })}
            {Tile({ label: t.active, value: d.activeSubs })}
            {Tile({ label: t.collected, value: money(d.collected30, cur), color: 'var(--brand)' })}
          </div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginBottom: 12 }}>
            {Tile({ label: t.newSubs, value: '+' + d.newSubs30, color: 'var(--green)' })}
            {Tile({ label: t.canceled, value: '−' + d.canceled30, color: d.canceled30 ? 'var(--red)' : undefined })}
            {Tile({ label: t.failed, value: d.failed30, color: d.failed30 ? 'var(--red)' : undefined })}
          </div>

          <div className="card">
            <b style={{ fontSize: 14 }}>{t.recent}</b>
            {!d.recent?.length && <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>{t.noRecent}</p>}
            {d.recent?.map((r: any, i: number) => (
              <div key={i} className="row between" style={{ borderTop: '1px solid var(--line)', padding: '9px 0', fontSize: 13, gap: 8, flexWrap: 'wrap' }}>
                <span className="row" style={{ gap: 8 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: r.ok ? '#34e2a0' : '#ff6b7d' }} />
                  {r.email || '—'}
                </span>
                <span className="row" style={{ gap: 12 }}>
                  <span style={{ fontWeight: 700, color: r.ok ? 'var(--green)' : 'var(--red)' }}>{money(r.amount, cur)}</span>
                  <span className="muted" style={{ fontSize: 12 }}>{new Date(r.at * 1000).toLocaleDateString()}</span>
                </span>
              </div>
            ))}
            <div className="muted" style={{ fontSize: 11.5, marginTop: 10 }}>{t.tip}</div>
          </div>
        </>
      )}
    </>
  );
}
