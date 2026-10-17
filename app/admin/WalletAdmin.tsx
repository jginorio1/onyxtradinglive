'use client';
import { useState, useEffect } from 'react';
import { useLang } from '@/lib/lang';
import { toast, toastErr } from '@/lib/toast';
import { fmtDateTime } from '@/lib/fmtDate';

// ============================================================
// TARIFAS DE PAGO POR USO (admin) · comisión de recarga escalonada + precios por
// uso (IA por llamada, cuenta extra por mes). Interruptor maestro. Guarda en el
// ajuste 'usage_fees'. Aquí es DONDE se configuran los cargos del topup.
// ============================================================
function UsageFees({ canManage, es }: { canManage: boolean; es: boolean }) {
  const [cfg, setCfg] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  async function load() { try { const r = await fetch('/api/admin/usage-fees', { cache: 'no-store' }); const j = await r.json(); if (r.ok) setCfg(j); } catch {} }
  useEffect(() => { load(); }, []);
  function setTier(i: number, k: 'min' | 'pct', v: number) { const t = [...(cfg.topup_fee_tiers || [])]; t[i] = { ...t[i], [k]: v }; setCfg({ ...cfg, topup_fee_tiers: t }); }
  async function save() {
    if (!canManage) return;
    setBusy(true);
    try {
      const r = await fetch('/api/admin/usage-fees', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) });
      const j = await r.json(); if (!r.ok) throw new Error(j?.error || 'error'); setCfg(j);
      toast(es ? 'Tarifas guardadas ✓' : 'Fees saved ✓');
    } catch (e: any) { toastErr(e?.message); } finally { setBusy(false); }
  }
  if (!cfg) return null;
  const box: any = { background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 16, marginBottom: 18 };
  const dollars = (c: number) => (Math.round(c || 0) / 100).toFixed(2);
  return (
    <div style={box}>
      <div className="row between" style={{ cursor: 'pointer' }} onClick={() => setOpen(!open)}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800 }}>{es ? 'Tarifas de pago por uso' : 'Pay-as-you-go fees'}</div>
          <div className="muted" style={{ fontSize: 12.5 }}>{es ? 'Comisión de recarga (topup) y precios por uso del plan gratis.' : 'Top-up fee and per-use prices for the free plan.'}</div>
        </div>
        <span style={{ fontSize: 18 }}>{open ? '▾' : '▸'}</span>
      </div>
      {open && (
        <div style={{ marginTop: 14 }}>
          <label className="row" style={{ gap: 8, marginBottom: 14, cursor: 'pointer' }}>
            <input type="checkbox" checked={cfg.usage_on !== false} onChange={(e) => setCfg({ ...cfg, usage_on: e.target.checked })} style={{ width: 'auto', margin: 0 }} disabled={!canManage} />
            <span style={{ fontWeight: 600 }}>{es ? 'Pago por uso activado (comisión + cobro por uso)' : 'Pay-as-you-go on (fee + usage charges)'}</span>
          </label>

          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{es ? 'Comisión de recarga con tarjeta (escalonada)' : 'Card top-up fee (tiered)'}</div>
          <p className="muted" style={{ fontSize: 11.5, marginBottom: 8 }}>{es ? 'A más recarga, menor %. Se cobra ENCIMA del monto; USDT va a valor nominal.' : 'The more you top up, the lower the %. Charged ON TOP of the amount; USDT is at face value.'}</p>
          {(cfg.topup_fee_tiers || []).map((t: any, i: number) => (
            <div key={i} className="row" style={{ gap: 8, marginBottom: 6, alignItems: 'center' }}>
              <span className="muted" style={{ fontSize: 12.5, width: 70 }}>{es ? 'desde $' : 'from $'}</span>
              <input type="number" min={0} value={t.min} onChange={(e) => setTier(i, 'min', Math.max(0, Number(e.target.value) || 0))} style={{ width: 90, margin: 0 }} disabled={!canManage} />
              <span className="muted" style={{ fontSize: 12.5 }}>→</span>
              <input type="number" min={0} max={100} step={0.5} value={t.pct} onChange={(e) => setTier(i, 'pct', Math.max(0, Number(e.target.value) || 0))} style={{ width: 80, margin: 0 }} disabled={!canManage} />
              <span className="muted" style={{ fontSize: 12.5 }}>%</span>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div><div className="muted" style={{ fontSize: 12 }}>{es ? 'Comisión mínima $' : 'Minimum fee $'}</div>
              <input type="number" min={0} step={0.01} value={dollars(cfg.topup_fee_min_cents)} onChange={(e) => setCfg({ ...cfg, topup_fee_min_cents: Math.round((Number(e.target.value) || 0) * 100) })} style={{ width: 100, margin: 0 }} disabled={!canManage} /></div>
          </div>

          <div style={{ fontSize: 13, fontWeight: 700, margin: '16px 0 6px' }}>{es ? 'Precios por uso (del saldo)' : 'Usage prices (from balance)'}</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div><div className="muted" style={{ fontSize: 12 }}>{es ? 'Llamada de IA $' : 'AI call $'}</div>
              <input type="number" min={0} step={0.01} value={dollars(cfg.ai_call_cents)} onChange={(e) => setCfg({ ...cfg, ai_call_cents: Math.round((Number(e.target.value) || 0) * 100) })} style={{ width: 100, margin: 0 }} disabled={!canManage} /></div>
            <div><div className="muted" style={{ fontSize: 12 }}>{es ? 'Cuenta extra / mes $' : 'Extra account / mo $'}</div>
              <input type="number" min={0} step={0.01} value={dollars(cfg.account_month_cents)} onChange={(e) => setCfg({ ...cfg, account_month_cents: Math.round((Number(e.target.value) || 0) * 100) })} style={{ width: 120, margin: 0 }} disabled={!canManage} /></div>
          </div>

          {canManage && <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={save} disabled={busy}>{busy ? '…' : (es ? 'Guardar tarifas' : 'Save fees')}</button>}
        </div>
      )}
    </div>
  );
}

// ============================================================
// MONEDERO (admin) · buscar un usuario por correo, ver su saldo y movimientos,
// y ajustar/reembolsar manualmente. El motor es el mismo libro wallet_ledger.
// ============================================================
export default function WalletAdmin({ canManage }: { canManage: boolean }) {
  const { lang } = useLang();
  const es = lang !== 'en';
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);
  const [u, setU] = useState<any>(null);
  const [cents, setCents] = useState(0);
  const [mv, setMv] = useState<any[]>([]);
  const [amt, setAmt] = useState(10);
  const [note, setNote] = useState('');

  const money = (c: number) => '$' + (Math.round(c || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  async function search(email?: string) {
    const term = (email ?? q).trim(); if (!term) return;
    setBusy(true); setResults(null);
    try {
      const r = await fetch('/api/admin/wallet?q=' + encodeURIComponent(term), { cache: 'no-store' });
      const j = await r.json(); if (!r.ok) throw new Error(j?.error || 'error');
      if (j.results && !j.user) { setResults(j.results); setU(null); return; }
      if (j.user) { setU(j.user); setCents(Number(j.balanceCents) || 0); setMv(j.movements || []); setResults(null); }
      else { setU(null); toastErr(es ? 'No se encontró ese usuario.' : 'User not found.'); }
    } catch (e: any) { toastErr(e?.message); } finally { setBusy(false); }
  }

  async function apply(sign: 1 | -1, kind: 'adjust' | 'refund') {
    if (!canManage || !u) return;
    const delta = sign * Math.round((Number(amt) || 0) * 100);
    if (!delta) { toastErr(es ? 'Pon un monto.' : 'Enter an amount.'); return; }
    setBusy(true);
    try {
      const r = await fetch('/api/admin/wallet', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: u.id, deltaCents: delta, kind, note }) });
      const j = await r.json(); if (!r.ok) throw new Error(j?.error || 'error');
      toast(es ? 'Aplicado ✓' : 'Applied ✓'); setNote(''); await search(u.email);
    } catch (e: any) { toastErr(e?.message); } finally { setBusy(false); }
  }

  return (
    <div style={{ maxWidth: 720 }}>
      {/* DÓNDE se configuran los cargos del topup y los precios por uso. */}
      <UsageFees canManage={canManage} es={es} />

      <h2 style={{ fontSize: 20, display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 2px' }}>💰 {es ? 'Monedero de usuarios' : 'User wallets'}</h2>
      <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>{es ? 'Busca un usuario por correo para ver su saldo, su historial y ajustar o reembolsar saldo.' : 'Search a user by email to see balance, history and adjust or refund balance.'}</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') search(); }} placeholder={es ? 'correo del usuario…' : 'user email…'} style={{ flex: 1, margin: 0 }} />
        <button className="btn btn-primary" onClick={() => search()} disabled={busy}>{es ? 'Buscar' : 'Search'}</button>
      </div>

      {results && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
          {results.map((r, i) => (
            <button key={r.id} onClick={() => search(r.email)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', background: 'none', border: 'none', borderTop: i ? '1px solid var(--line)' : 'none', color: 'var(--tx)', cursor: 'pointer' }}>
              <b>{r.email}</b> {r.name && <span className="muted">· {r.name}</span>}
            </button>
          ))}
        </div>
      )}

      {u && (<>
        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 16, marginBottom: 14 }}>
          <div className="muted" style={{ fontSize: 12.5 }}>{u.email}{u.name ? ` · ${u.name}` : ''}</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--green)' }}>{money(cents)}</div>
        </div>

        {canManage && (
          <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 16, marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 8 }}>{es ? 'Ajustar saldo' : 'Adjust balance'}</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
              <span className="muted" style={{ fontSize: 13 }}>$</span>
              <input type="number" min={0} value={amt} onChange={(e) => setAmt(Math.max(0, Number(e.target.value) || 0))} style={{ width: 110, margin: 0 }} />
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={es ? 'nota (opcional)' : 'note (optional)'} style={{ flex: 1, minWidth: 160, margin: 0 }} />
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-ghost" onClick={() => apply(1, 'adjust')} disabled={busy} style={{ color: 'var(--green)' }}>＋ {es ? 'Acreditar' : 'Credit'}</button>
              <button className="btn btn-ghost" onClick={() => apply(1, 'refund')} disabled={busy}>↩ {es ? 'Reembolsar al saldo' : 'Refund to balance'}</button>
              <button className="btn btn-ghost" onClick={() => apply(-1, 'adjust')} disabled={busy} style={{ color: 'var(--red)' }}>− {es ? 'Quitar' : 'Remove'}</button>
            </div>
          </div>
        )}

        <div style={{ fontSize: 14, fontWeight: 800, margin: '0 0 8px' }}>{es ? 'Movimientos' : 'Movements'}</div>
        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden' }}>
          {mv.length === 0 ? <div className="muted" style={{ padding: 20, textAlign: 'center', fontSize: 13 }}>{es ? 'Sin movimientos.' : 'No movements.'}</div> : mv.map((m, i) => {
            const pos = Number(m.amount_cents) >= 0;
            return (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderTop: i ? '1px solid var(--line)' : 'none' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{m.note || m.kind}{m.source ? <span className="muted" style={{ fontWeight: 400 }}> · {m.source}</span> : ''}</div>
                  <div className="muted" style={{ fontSize: 11.5 }}>{m.created_at ? fmtDateTime(m.created_at) : ''}</div>
                </div>
                <div style={{ fontWeight: 800, color: pos ? 'var(--green)' : 'var(--tx)' }}>{pos ? '+' : '−'}{money(Math.abs(Number(m.amount_cents) || 0))}</div>
              </div>
            );
          })}
        </div>
      </>)}
    </div>
  );
}
