'use client';
import { useEffect, useState } from 'react';

// Panel self-serve del empleado: ve su sueldo e historial de pagos y conecta su
// cobro (Stripe Connect) o guarda su billetera USDT. No es el panel admin.

const money = (n: number, c = 'USD') => (c === 'USD' ? '$' : '') + (Math.round((n || 0) * 100) / 100).toLocaleString('en-US') + (c !== 'USD' ? ' ' + c : '');
const DL: Record<string, string> = { dev: 'Desarrollo', management: 'Gerencia', marketing: 'Marketing', design: 'Diseño', ops: 'Operaciones', other: 'Equipo' };

export default function StaffClient() {
  const [d, setD] = useState<any>(null);
  const [msg, setMsg] = useState('');
  const [wallet, setWallet] = useState('');
  const [network, setNetwork] = useState('trc20');

  useEffect(() => { load(); }, []);
  async function load() { try { const r = await fetch('/api/staff', { cache: 'no-store' }); const j = await r.json(); setD(j); setNetwork(j?.wallets?.network || 'trc20'); } catch {} }
  async function act(body: any) {
    setMsg('');
    const r = await fetch('/api/staff', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json(); if (j.error) setMsg('⚠ ' + j.error); else setMsg('Hecho ✓'); await load(); return j;
  }

  const wrap: React.CSSProperties = { maxWidth: 760, margin: '0 auto', padding: '24px 16px 70px' };
  const card: React.CSSProperties = { background: 'var(--panel,#161c2e)', border: '1px solid var(--line,#2a3350)', borderRadius: 14, padding: 18 };
  const btn: React.CSSProperties = { padding: '9px 14px', borderRadius: 9, border: '1px solid var(--line,#2a3350)', background: 'var(--card,#1b2338)', color: 'var(--tx,#e8ecf5)', cursor: 'pointer', fontSize: 13 };
  const btnP: React.CSSProperties = { ...btn, background: 'var(--accent,#8b93ff)', color: '#fff', border: 'none', fontWeight: 600 };
  const inp: React.CSSProperties = { padding: '9px 11px', borderRadius: 9, border: '1px solid var(--line,#2a3350)', background: 'var(--bg,#0e1220)', color: 'var(--tx,#e8ecf5)', fontSize: 13.5 };

  if (!d) return <div style={wrap}><div className="muted">Cargando…</div></div>;
  if (!d.isStaff) return <div style={wrap}><div style={card}><h2 style={{ marginTop: 0 }}>No estás en la nómina</h2><p className="muted">Si crees que es un error, contacta al administrador.</p></div></div>;

  const st = d.staff; const c = d.connect || {};

  return (
    <div style={wrap}>
      <h1 style={{ fontSize: 23, margin: '0 0 4px' }}>Mi nómina</h1>
      <div className="muted" style={{ fontSize: 13, marginBottom: 16 }}>{st.name} · {DL[st.department] || st.department}{st.position ? ` · ${st.position}` : ''}</div>

      {msg && <div style={{ ...card, padding: '10px 14px', marginBottom: 12, borderColor: 'var(--accent,#8b93ff)', color: 'var(--accent,#8b93ff)', fontSize: 13 }}>{msg}</div>}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ ...card, flex: 1, minWidth: 160 }}>
          <div className="muted" style={{ fontSize: 12 }}>Sueldo mensual</div>
          <div style={{ fontSize: 26, fontWeight: 700 }}>{money(st.salary, st.currency)}</div>
        </div>
        <div style={{ ...card, flex: 1, minWidth: 160 }}>
          <div className="muted" style={{ fontSize: 12 }}>Método de cobro</div>
          <div style={{ fontSize: 18, fontWeight: 600, marginTop: 4 }}>{st.payout_method === 'stripe' ? 'Stripe' : st.payout_method === 'usdt' ? 'USDT' : 'Manual'}</div>
        </div>
      </div>

      {/* Conectar cobro */}
      <div style={{ ...card, marginBottom: 16 }}>
        <b>Tu cobro</b>
        {st.payout_method === 'stripe' && <div style={{ marginTop: 10 }}>
          {c.payoutsEnabled
            ? <div style={{ color: 'var(--green,#5ed6a0)', fontSize: 14 }}>✓ Stripe conectado. Recibirás tu pago aquí.</div>
            : <>
              <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>Conecta tu cuenta para recibir tu sueldo por Stripe.</div>
              <button style={btnP} onClick={async () => { const j = await act({ action: 'connect_link' }); if (j?.url) window.location.href = j.url; }}>{c.connected ? 'Completar conexión' : 'Conectar Stripe'}</button>
            </>}
        </div>}
        {st.payout_method === 'usdt' && <div style={{ marginTop: 10 }}>
          <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>Guarda tu billetera USDT para recibir tu pago.</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={network} onChange={(e) => setNetwork(e.target.value)} style={inp}><option value="trc20">TRC20 (Tron)</option><option value="erc20">ERC20 (Ethereum)</option></select>
            <input placeholder="Tu dirección USDT" value={wallet} onChange={(e) => setWallet(e.target.value)} style={{ ...inp, flex: 1, minWidth: 220 }} />
            <button style={btnP} onClick={() => wallet && act({ action: 'save_payout', payout_method: 'usdt', wallet, network })}>Guardar</button>
          </div>
          {(d.wallets?.trc20 || d.wallets?.erc20) && <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Guardada: {d.wallets.network === 'erc20' ? d.wallets.erc20 : d.wallets.trc20}</div>}
        </div>}
        {st.payout_method === 'manual' && <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>Tu pago se gestiona manualmente por el administrador.</div>}
      </div>

      {/* Historial */}
      <div style={card}>
        <b>Historial de pagos</b>
        {(d.payments || []).length === 0 ? <p className="muted" style={{ fontSize: 13 }}>Aún no hay pagos registrados.</p> :
          <table style={{ width: '100%', marginTop: 10, fontSize: 13, borderCollapse: 'collapse' }}><tbody>
            {(d.payments || []).map((p: any, i: number) => (
              <tr key={i} style={{ borderTop: '1px solid var(--line,#2a3350)' }}>
                <td style={{ padding: '8px 4px' }}>{p.period}</td>
                <td style={{ padding: '8px 4px', fontWeight: 600 }}>{money(p.amount, p.currency)}</td>
                <td style={{ padding: '8px 4px', color: 'var(--mut,#9aa6bd)' }}>{p.method}</td>
                <td style={{ padding: '8px 4px', textAlign: 'right', color: p.status === 'paid' ? 'var(--green,#5ed6a0)' : 'var(--mut,#9aa6bd)' }}>{p.status === 'paid' ? 'pagado' : p.status}</td>
              </tr>
            ))}
          </tbody></table>}
      </div>
    </div>
  );
}
