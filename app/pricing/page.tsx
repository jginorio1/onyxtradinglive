'use client';
import { useState } from 'react';
import Link from 'next/link';

const plans = [
  { id: 'free', name: 'Free', price: '$0', items: ['1 cuenta MT', 'Estadísticas básicas', '30 días de historial'], cta: 'Empezar gratis', pop: false },
  { id: 'pro', name: 'Pro', price: '$19', items: ['5 cuentas MT', 'Todas las estadísticas', 'Historial ilimitado', 'Reglas de fondeo'], cta: 'Elegir Pro', pop: true },
  { id: 'elite', name: 'Elite', price: '$39', items: ['Cuentas ilimitadas', 'Todo lo de Pro', 'Informes automáticos', 'Alertas Telegram'], cta: 'Elegir Elite', pop: false },
];

export default function Pricing() {
  const [loading, setLoading] = useState('');

  async function subscribe(plan: string) {
    if (plan === 'free') { window.location.href = '/login?mode=signup'; return; }
    setLoading(plan);
    const r = await fetch('/api/stripe/checkout', { method: 'POST', body: JSON.stringify({ plan }) });
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
        <p className="muted" style={{ margin: '10px 0 34px' }}>Cancela cuando quieras.</p>
        <div className="grid g3" style={{ textAlign: 'left' }}>
          {plans.map((p) => (
            <div key={p.id} className="card" style={p.pop ? { border: '2px solid var(--brand)' } : {}}>
              {p.pop && <span className="pill green" style={{ marginBottom: 8, display: 'inline-block' }}>Más popular</span>}
              <h3>{p.name}</h3>
              <div style={{ fontSize: 40, fontWeight: 800, margin: '6px 0 4px' }}>{p.price}<span className="muted" style={{ fontSize: 15, fontWeight: 500 }}>/mes</span></div>
              <ul style={{ listStyle: 'none', margin: '16px 0' }}>
                {p.items.map((it, i) => <li key={i} style={{ padding: '7px 0', color: '#cdd3e0' }}>✓ {it}</li>)}
              </ul>
              <button className={'btn ' + (p.pop ? 'btn-primary' : 'btn-ghost')} style={{ width: '100%' }} onClick={() => subscribe(p.id)} disabled={loading === p.id}>
                {loading === p.id ? '...' : p.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
