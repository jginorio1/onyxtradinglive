'use client';
import { useState } from 'react';
import { useLang } from '@/lib/lang';
import { toast, toastErr } from '@/lib/toast';
import { fmtDateTime } from '@/lib/fmtDate';

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
