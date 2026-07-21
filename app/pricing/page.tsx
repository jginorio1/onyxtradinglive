'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

type Plan = { id: string; name: string; price_month: number; price_year: number; max_accounts: number; features: string[]; badge: string | null };

export default function Pricing() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [annual, setAnnual] = useState(false);
  const [loading, setLoading] = useState('');

  useEffect(() => {
    fetch('/api/admin/plans').then((r) => r.json()).then((j) => setPlans(j.plans || []));
  }, []);

  async function subscribe(plan: string, price: number) {
    if (plan === 'free' || price === 0) { window.location.href = '/login?mode=signup'; return; }
    setLoading(plan);
    const r = await fetch('/api/stripe/checkout', { method: 'POST', body: JSON.stringify({ plan, annual }) });
    const j = await r.json();
    if (j.url) window.location.href = j.url;
    else { alert(j.error || 'Debes iniciar sesión primero'); setLoading(''); }
  }

  return (
    <>
      <div className="topbar"><div className="wrap">
        <Link className="logo" href="/"><span className="mark">◆</span> Onyx Trading Live</Link>
        <Link className="btn btn-ghost" href="/dashboard">Mi cuenta</Link>
      </div></div>

      <div className="wrap" style={{ padding: '48px 22px', textAlign: 'center' }}>
        <h1>Planes para cada trader</h1>
        <p className="muted" style={{ margin: '10px 0 20px' }}>Cancela cuando quieras.</p>

        <div className="row" style={{ justifyContent: 'center', marginBottom: 30 }}>
          <button className={'btn ' + (!annual ? 'btn-primary' : 'btn-ghost')} onClick={() => setAnnual(false)}>Mensual</button>
          <button className={'btn ' + (annual ? 'btn-primary' : 'btn-ghost')} onClick={() => setAnnual(true)}>Anual</button>
        </div>

        <div className="grid g3" style={{ textAlign: 'left' }}>
          {plans.map((p) => {
            const price = annual ? p.price_year : p.price_month;
            const pop = !!p.badge;
            return (
              <div key={p.id} className="card" style={pop ? { border: '2px solid var(--brand)' } : {}}>
                {p.badge && <span className="pill green" style={{ marginBottom: 8, display: 'inline-block' }}>{p.badge}</span>}
                <h3>{p.name}</h3>
                <div style={{ fontSize: 40, fontWeight: 800, margin: '6px 0 4px' }}>${price}<span className="muted" style={{ fontSize: 15, fontWeight: 500 }}>/{annual ? 'año' : 'mes'}</span></div>
                <ul style={{ listStyle: 'none', margin: '16px 0' }}>
                  {(p.features || []).map((it, i) => <li key={i} style={{ padding: '7px 0', color: '#cdd3e0' }}>✓ {it}</li>)}
                </ul>
                <button className={'btn ' + (pop ? 'btn-primary' : 'btn-ghost')} style={{ width: '100%' }} onClick={() => subscribe(p.id, price)} disabled={loading === p.id}>
                  {loading === p.id ? '...' : (price === 0 ? 'Empezar gratis' : 'Elegir ' + p.name)}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
