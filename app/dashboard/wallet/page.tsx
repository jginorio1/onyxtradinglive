'use client';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/lang';
import { toast, toastErr } from '@/lib/toast';
import { fmtDateTime } from '@/lib/fmtDate';

// ============================================================
// MONEDERO (cliente). Saldo recargable para comprar dentro de Onyx. No retirable.
// Recarga con tarjeta (Stripe) o USDT. Muestra el historial de movimientos.
// ============================================================
const PRESETS = [10, 25, 50, 100];

export default function WalletPage() {
  const { lang } = useLang();
  const es = lang !== 'en';
  const [cents, setCents] = useState(0);
  const [mv, setMv] = useState<any[]>([]);
  const [amount, setAmount] = useState(25);
  const [method, setMethod] = useState<'card' | 'usdt'>('card');
  const [busy, setBusy] = useState(false);
  const [usdt, setUsdt] = useState<any>(null);   // datos del pago USDT pendiente
  const [txid, setTxid] = useState('');

  async function load() {
    try { const r = await fetch('/api/wallet', { cache: 'no-store' }); const j = await r.json(); if (r.ok) { setCents(Number(j.balanceCents) || 0); setMv(j.movements || []); } } catch {}
  }
  useEffect(() => { load(); }, []);

  const money = (c: number) => '$' + (Math.round(c || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  async function topup() {
    if (!(amount >= 5 && amount <= 2000)) { toastErr(es ? 'Monto entre $5 y $2000.' : 'Amount between $5 and $2000.'); return; }
    setBusy(true); setUsdt(null);
    try {
      const r = await fetch('/api/wallet/topup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount, method, lang }) });
      const j = await r.json(); if (!r.ok) throw new Error(j?.error || 'error');
      if (j.method === 'card' && j.url) { window.location.href = j.url; return; }
      if (j.method === 'usdt') { setUsdt(j.payment); }
    } catch (e: any) { toastErr(e?.message); } finally { setBusy(false); }
  }

  async function reportTxid() {
    if (!usdt?.id || !txid.trim()) { toastErr(es ? 'Pega el hash de tu transacción.' : 'Paste your transaction hash.'); return; }
    setBusy(true);
    try {
      const r = await fetch('/api/botlab/crypto', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paymentId: usdt.id, txid: txid.trim() }) });
      const j = await r.json(); if (!r.ok) throw new Error(j?.error || 'error');
      toast(es ? 'Recibido. Confirmamos y acreditamos tu saldo pronto.' : 'Received. We will confirm and credit your balance soon.');
      setUsdt(null); setTxid('');
    } catch (e: any) { toastErr(e?.message); } finally { setBusy(false); }
  }

  const kindLabel = (m: any) => {
    const k = m.kind, src = m.source;
    if (k === 'topup') return (es ? 'Recarga' : 'Top-up') + (m.method === 'usdt' ? ' · USDT' : m.method === 'card' ? (es ? ' · tarjeta' : ' · card') : '');
    if (k === 'spend') return m.note || (es ? 'Compra' : 'Purchase');
    if (k === 'refund') return es ? 'Reembolso' : 'Refund';
    if (k === 'reversal') return es ? 'Reversa' : 'Reversal';
    return m.note || k;
  };

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '8px 0' }}>
      <h1 style={{ fontSize: 22, display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 2px' }}>💰 {es ? 'Mi monedero' : 'My wallet'}</h1>
      <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>{es ? 'Recarga saldo y úsalo para comprar dentro de Onyx (soporte remoto, add-ons, Academia, Bot Lab). El saldo no es retirable.' : 'Top up and use your balance to buy inside Onyx (remote support, add-ons, Academy, Bot Lab). Balance is not withdrawable.'}</p>

      {/* Saldo */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 18, marginBottom: 16 }}>
        <div className="muted" style={{ fontSize: 13 }}>{es ? 'Tu saldo' : 'Your balance'}</div>
        <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--green)' }}>{money(cents)}</div>
      </div>

      {/* Recargar */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 18, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>{es ? 'Recargar' : 'Top up'}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 10 }}>
          {PRESETS.map((p) => (
            <button key={p} onClick={() => setAmount(p)} style={{ padding: '10px', borderRadius: 10, fontWeight: 800, cursor: 'pointer', border: `1.5px solid ${amount === p ? 'var(--brand)' : 'var(--line)'}`, background: amount === p ? 'color-mix(in srgb,var(--brand) 12%,transparent)' : 'transparent', color: amount === p ? 'var(--brand)' : 'var(--tx)' }}>${p}</button>
          ))}
        </div>
        <input type="number" min={5} max={2000} value={amount} onChange={(e) => setAmount(Math.round(Number(e.target.value) || 0))} style={{ marginBottom: 12 }} />

        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{es ? 'Método' : 'Method'}</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <button onClick={() => setMethod('card')} style={{ flex: 1, padding: '10px 12px', borderRadius: 10, fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${method === 'card' ? 'var(--brand)' : 'var(--line)'}`, background: method === 'card' ? 'color-mix(in srgb,var(--brand) 12%,transparent)' : 'transparent', color: method === 'card' ? 'var(--brand)' : 'var(--tx)' }}>🏦 {es ? 'Tarjeta' : 'Card'}</button>
          <button onClick={() => setMethod('usdt')} style={{ flex: 1, padding: '10px 12px', borderRadius: 10, fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${method === 'usdt' ? 'var(--brand)' : 'var(--line)'}`, background: method === 'usdt' ? 'color-mix(in srgb,var(--brand) 12%,transparent)' : 'transparent', color: method === 'usdt' ? '#26a17b' : 'var(--tx)' }}>₮ USDT</button>
        </div>
        <button className="btn btn-primary" style={{ width: '100%' }} onClick={topup} disabled={busy}>{es ? `Recargar $${amount}` : `Top up $${amount}`}</button>
      </div>

      {/* Instrucciones USDT (tras pedir recarga) */}
      {usdt && (
        <div style={{ background: 'var(--card)', border: '1px solid #26a17b55', borderRadius: 14, padding: 18, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 8, color: '#26a17b' }}>₮ {es ? 'Envía USDT' : 'Send USDT'} ({(usdt.network || '').toUpperCase()})</div>
          <div className="muted" style={{ fontSize: 12.5, marginBottom: 10 }}>{es ? 'Envía exactamente este monto a esta dirección. El monto exacto nos ayuda a identificar tu pago.' : 'Send exactly this amount to this address. The exact amount helps us identify your payment.'}</div>
          <div style={{ fontSize: 13, marginBottom: 6 }}><b>{es ? 'Monto exacto' : 'Exact amount'}:</b> <span style={{ fontFamily: 'ui-monospace,monospace' }}>{usdt.matchAmount} USDT</span></div>
          <div style={{ fontSize: 13, marginBottom: 12, wordBreak: 'break-all' }}><b>{es ? 'Dirección' : 'Address'}:</b> <span style={{ fontFamily: 'ui-monospace,monospace' }}>{usdt.address || '—'}</span></div>
          {usdt.hostedUrl && <a href={usdt.hostedUrl} target="_blank" rel="noreferrer" className="btn btn-ghost" style={{ marginBottom: 12, display: 'inline-block' }}>{es ? 'Pagar en la pasarela' : 'Pay on gateway'}</a>}
          <div style={{ fontSize: 13, fontWeight: 700, margin: '8px 0 6px' }}>{es ? 'Ya envié · pega tu hash' : 'Sent · paste your hash'}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={txid} onChange={(e) => setTxid(e.target.value)} placeholder="0x… / txid" style={{ flex: 1, margin: 0 }} />
            <button className="btn btn-primary" onClick={reportTxid} disabled={busy}>{es ? 'Reportar' : 'Report'}</button>
          </div>
        </div>
      )}

      {/* Movimientos */}
      <div style={{ fontSize: 14, fontWeight: 800, margin: '0 0 8px' }}>{es ? 'Movimientos' : 'Movements'}</div>
      <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden' }}>
        {mv.length === 0 ? (
          <div className="muted" style={{ padding: 24, textAlign: 'center', fontSize: 13 }}>{es ? 'Aún no hay movimientos.' : 'No movements yet.'}</div>
        ) : mv.map((m, i) => {
          const pos = Number(m.amount_cents) >= 0;
          return (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderTop: i ? '1px solid var(--line)' : 'none' }}>
              <span style={{ fontSize: 16 }}>{pos ? '↙' : '↗'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{kindLabel(m)}</div>
                <div className="muted" style={{ fontSize: 11.5 }}>{m.created_at ? fmtDateTime(m.created_at) : ''}</div>
              </div>
              <div style={{ fontWeight: 800, color: pos ? 'var(--green)' : 'var(--tx)' }}>{pos ? '+' : '−'}{money(Math.abs(Number(m.amount_cents) || 0))}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
