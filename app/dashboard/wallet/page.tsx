'use client';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/lang';
import { toast, toastErr } from '@/lib/toast';
import { fmtDateTime } from '@/lib/fmtDate';
import { nativePlatform, isNativeApp } from '@/lib/native';
import WalletCheckoutModal from '@/app/WalletCheckoutModal';

// ============================================================
// MONEDERO (cliente). Saldo recargable para comprar dentro de Onyx. No retirable.
// Recarga con tarjeta (Stripe) o USDT. Muestra el historial de movimientos.
// ============================================================
const PRESETS = [10, 25, 50, 100];

// Usar el saldo para las facturas (add-ons, plan): pasa saldo a crédito de Stripe.
// Stripe lo usa primero en la próxima factura y cobra a la tarjeta solo el resto.
function ApplyCredit({ es, reload }: { es: boolean; reload: () => void }) {
  const [amt, setAmt] = useState(10);
  const [busy, setBusy] = useState(false);
  async function apply() {
    if (!(amt >= 1)) { toastErr(es ? 'Mínimo $1.' : 'Minimum $1.'); return; }
    setBusy(true);
    try {
      const r = await fetch('/api/wallet/apply-credit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: amt }) });
      const j = await r.json(); if (!r.ok) throw new Error(j?.error || 'error');
      toast(es ? '✅ Saldo aplicado como crédito. Se usará en tu próxima factura.' : '✅ Balance applied as credit. It will be used on your next invoice.');
      reload();
    } catch (e: any) { toastErr(e?.message); } finally { setBusy(false); }
  }
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 18, marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>{es ? 'Usar mi saldo en mis facturas' : 'Use my balance on my invoices'}</div>
      <div className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>{es ? 'Pasa parte de tu saldo a crédito. Se usa primero en tu próxima factura (add-ons, plan) y la tarjeta cubre solo el resto.' : 'Move part of your balance to credit. It is used first on your next invoice (add-ons, plan); the card covers only the remainder.'}</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span className="muted">$</span>
        <input type="number" min={1} value={amt} onChange={(e) => setAmt(Math.max(0, Number(e.target.value) || 0))} style={{ width: 110, margin: 0 }} />
        <button className="btn btn-primary" onClick={apply} disabled={busy}>{es ? 'Aplicar como crédito' : 'Apply as credit'}</button>
      </div>
    </div>
  );
}

// Auto-recarga: tarjeta guardada + "recarga sola cuando el saldo baje de X".
function AutoReload({ es }: { es: boolean }) {
  const [cfg, setCfg] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  async function load() { try { const r = await fetch('/api/wallet/autoreload', { cache: 'no-store' }); const j = await r.json(); if (r.ok) setCfg(j); } catch {} }
  useEffect(() => { load(); const onF = () => load(); window.addEventListener('focus', onF); return () => window.removeEventListener('focus', onF); }, []);
  async function save(patch: any) {
    setBusy(true);
    try { const r = await fetch('/api/wallet/autoreload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) }); const j = await r.json(); if (!r.ok) throw new Error(j?.error || 'error'); setCfg(j); }
    catch (e: any) { toastErr(e?.message); await load(); } finally { setBusy(false); }
  }
  async function addCard() {
    setBusy(true);
    try { const r = await fetch('/api/wallet/autoreload/setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); const j = await r.json(); if (!r.ok) throw new Error(j?.error || 'error'); if (j.url) window.location.href = j.url; }
    catch (e: any) { toastErr(e?.message); setBusy(false); }
  }
  if (!cfg) return null;
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 18, marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>{es ? 'Auto-recarga' : 'Auto-reload'}</div>
      <div className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>{es ? 'Recarga sola cuando tu saldo baje de un mínimo. Usa una tarjeta guardada.' : 'Tops up automatically when your balance drops below a minimum. Uses a saved card.'}</div>
      {!cfg.has_card ? (
        <button className="btn btn-primary" onClick={addCard} disabled={busy}>{es ? '＋ Guardar una tarjeta' : '＋ Save a card'}</button>
      ) : (<>
        <label className="row" style={{ gap: 8, marginBottom: 12, cursor: 'pointer' }}>
          <input type="checkbox" checked={!!cfg.enabled} onChange={(e) => save({ enabled: e.target.checked })} disabled={busy} style={{ width: 'auto', margin: 0 }} />
          <span style={{ fontWeight: 600 }}>{es ? 'Auto-recarga activada' : 'Auto-reload on'}</span>
        </label>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div><div className="muted" style={{ fontSize: 12 }}>{es ? 'Cuando baje de' : 'When below'}</div>
            <div className="row" style={{ gap: 4 }}><span>$</span><input type="number" min={0} defaultValue={Math.round(cfg.threshold_cents / 100)} onBlur={(e) => save({ threshold_cents: Math.max(0, Number(e.target.value) || 0) * 100 })} style={{ width: 90, margin: 0 }} disabled={busy} /></div>
          </div>
          <div><div className="muted" style={{ fontSize: 12 }}>{es ? 'Recargar' : 'Reload'}</div>
            <div className="row" style={{ gap: 4 }}><span>$</span><input type="number" min={5} defaultValue={Math.round(cfg.amount_cents / 100)} onBlur={(e) => save({ amount_cents: Math.max(5, Number(e.target.value) || 5) * 100 })} style={{ width: 90, margin: 0 }} disabled={busy} /></div>
          </div>
        </div>
        <div className="muted" style={{ fontSize: 11.5, marginTop: 10 }}>{es ? `Tarjeta guardada ✓ · máx. ${cfg.max_per_day} recargas automáticas por día.` : `Card saved ✓ · max ${cfg.max_per_day} auto-reloads per day.`} <button onClick={addCard} style={{ background: 'none', border: 'none', color: 'var(--brand)', cursor: 'pointer', padding: 0, fontSize: 11.5 }}>{es ? 'Cambiar tarjeta' : 'Change card'}</button></div>
      </>)}
    </div>
  );
}

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
  const [ios, setIos] = useState(false);
  const [payAmt, setPayAmt] = useState(0);   // monto del pago con tarjeta embebido (>0 abre el modal)
  useEffect(() => { try { setIos(nativePlatform() === 'ios'); } catch {} }, []);

  async function load() {
    try { const r = await fetch('/api/wallet', { cache: 'no-store' }); const j = await r.json(); if (r.ok) { setCents(Number(j.balanceCents) || 0); setMv(j.movements || []); } } catch {}
  }
  useEffect(() => { load(); }, []);

  const money = (c: number) => '$' + (Math.round(c || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  async function topup() {
    if (!(amount >= 5 && amount <= 2000)) { toastErr(es ? 'Monto entre $5 y $2000.' : 'Amount between $5 and $2000.'); return; }
    // TARJETA en web: abre el pago EMBEBIDO dentro de Onyx (no sale al checkout alojado).
    // El modal pide el client_secret y monta el Payment Element; el abono lo hace el webhook.
    if (method === 'card' && !isNativeApp()) { setUsdt(null); setPayAmt(amount); return; }
    setBusy(true); setUsdt(null);
    try {
      const r = await fetch('/api/wallet/topup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount, method, lang }) });
      const j = await r.json(); if (!r.ok) throw new Error(j?.error || 'error');
      if (j.method === 'card' && j.url) { window.location.href = j.url; return; }  // app nativa → navegador
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

      {/* Recargar — oculto en la app de iPhone (regla de Apple). Se puede recargar
          desde el navegador en el sitio web. El saldo y los movimientos sí se ven. */}
      {ios ? (
        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 18, marginBottom: 16 }}>
          <div className="muted" style={{ fontSize: 13 }}>{es ? 'Las recargas no están disponibles dentro de la app de iPhone. Para recargar saldo, entra a Onyx desde el navegador de tu teléfono o computadora.' : 'Top-ups are not available inside the iPhone app. To add balance, open Onyx from your phone or computer browser.'}</div>
        </div>
      ) : (<>
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

      <AutoReload es={es} />
      <ApplyCredit es={es} reload={load} />
      </>)}

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

      {/* Pago con tarjeta EMBEBIDO (no sale de Onyx). Al terminar, Stripe vuelve a ?topup=ok. */}
      {payAmt > 0 && <WalletCheckoutModal amount={payAmt} lang={es ? 'es' : 'en'} onClose={() => setPayAmt(0)} />}
    </div>
  );
}
