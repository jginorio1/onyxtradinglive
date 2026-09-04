'use client';
import { useEffect, useState } from 'react';
import { toast, toastErr } from '@/lib/toast';
import { useLang } from '@/lib/lang';

// Panel admin de Onyx Bot Lab: aprobar robots, atender leads de servicios,
// confirmar pagos en USDT, marcar payouts y ajustar comisión/wallet.
function money(cents: number) { return '$' + ((cents || 0) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 }); }
const GOLD = 'var(--gold, #ffd45e)';

export default function BotLab({ canManage = true }: { canManage?: boolean }) {
  const { lang } = useLang(); const es = lang === 'es';
  const [d, setD] = useState<any>(null);
  const [set, setSet] = useState<any>(null);

  async function load() { try { const r = await fetch('/api/admin/botlab'); const j = await r.json(); setD(j); setSet(j.settings); } catch {} }
  useEffect(() => { load(); }, []);

  async function act(body: any, ok?: string) {
    try { const r = await fetch('/api/admin/botlab', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const j = await r.json(); if (!r.ok) throw new Error(j.error); if (ok) toast(ok); load(); return j; } catch (e: any) { toastErr(e?.message || 'error'); }
  }

  if (!d) return <div className="muted" style={{ padding: 20 }}>{es ? 'Cargando…' : 'Loading…'}</div>;
  const card: any = { background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 16 };
  const stat = d.stats || {};
  const pend = (d.products || []).filter((p: any) => p.status === 'pending');

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>
        {[[es ? 'Robots por revisar' : 'Robots to review', stat.pendingProducts || 0, 'var(--amber)'], [es ? 'Leads nuevos' : 'New leads', stat.newLeads || 0, 'var(--brand)'], [es ? 'Comisión Onyx' : 'Onyx commission', money(stat.commissionCents || 0), 'var(--green)'], [es ? 'Pagos USDT por confirmar' : 'USDT to confirm', (d.crypto || []).length, GOLD]].map(([l, v, c], i) => (
          <div key={i} style={{ background: 'var(--bg2)', borderRadius: 12, padding: 14 }}><div className="muted" style={{ fontSize: 12 }}>{l}</div><div style={{ fontSize: 22, fontWeight: 800, color: c as string }}>{v}</div></div>
        ))}
      </div>

      {/* Ajustes */}
      {set && (
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>{es ? 'Ajustes' : 'Settings'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12 }}>
            <Field label={es ? 'Comisión Onyx (%)' : 'Onyx fee (%)'} value={set.fee_pct} onChange={(v: any) => setSet({ ...set, fee_pct: v })} />
            <Field label={es ? 'Wallet USDT' : 'USDT wallet'} value={set.usdt_address} onChange={(v: any) => setSet({ ...set, usdt_address: v })} wide />
            <SelectField label={es ? 'Red USDT' : 'USDT network'} value={set.usdt_network} onChange={(v: any) => setSet({ ...set, usdt_network: v })} opts={['trc20', 'erc20', 'bep20']} />
            <Field label={es ? 'A medida desde ($)' : 'Bespoke from ($)'} value={set.service_automate_from} onChange={(v: any) => setSet({ ...set, service_automate_from: v })} />
            <Field label={es ? 'Instalación ($)' : 'Install ($)'} value={set.service_install_price} onChange={(v: any) => setSet({ ...set, service_install_price: v })} />
            <Field label={es ? 'Elite desde ($)' : 'Elite from ($)'} value={set.service_elite_from} onChange={(v: any) => setSet({ ...set, service_elite_from: v })} />
          </div>
          {canManage && <button onClick={() => act({ action: 'settings', ...set }, es ? 'Ajustes guardados' : 'Settings saved')} style={{ marginTop: 12, padding: '9px 16px', borderRadius: 10, border: 'none', fontWeight: 800, cursor: 'pointer', background: 'var(--brand)', color: '#0b1020' }}>{es ? 'Guardar' : 'Save'}</button>}
        </div>
      )}

      {/* Robots por revisar */}
      <div style={card}>
        <h3 style={{ marginTop: 0 }}>{es ? 'Robots por revisar' : 'Robots to review'} {pend.length ? `(${pend.length})` : ''}</h3>
        {!pend.length && <div className="muted" style={{ fontSize: 13 }}>{es ? 'Nada pendiente.' : 'Nothing pending.'}</div>}
        <div style={{ display: 'grid', gap: 8 }}>
          {pend.map((p: any) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', borderTop: '1px solid var(--line)', paddingTop: 8 }}>
              <div style={{ flex: 1, minWidth: 160 }}><b>{p.name}</b> <span className="muted" style={{ fontSize: 12 }}>· {p.seller_name} · {money(p.price_cents)}</span><div className="muted" style={{ fontSize: 12 }}>{p.tagline}</div></div>
              {canManage && <>
                <button onClick={() => act({ action: 'product_status', id: p.id, status: 'active', verified: true }, es ? 'Aprobado' : 'Approved')} style={btn('var(--green)')}>{es ? 'Aprobar' : 'Approve'}</button>
                <button onClick={() => act({ action: 'product_status', id: p.id, status: 'rejected' })} style={btn('var(--red)')}>{es ? 'Rechazar' : 'Reject'}</button>
              </>}
            </div>
          ))}
        </div>
      </div>

      {/* Pagos USDT por confirmar */}
      {(d.crypto || []).length > 0 && (
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>{es ? 'Pagos USDT por confirmar' : 'USDT payments to confirm'}</h3>
          <div style={{ display: 'grid', gap: 8 }}>
            {(d.crypto || []).map((c: any) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', borderTop: '1px solid var(--line)', paddingTop: 8 }}>
                <div style={{ flex: 1, minWidth: 180 }}><b>${c.amount_usd} USDT</b> <span className="muted" style={{ fontSize: 12 }}>· {c.buyer} · {c.purpose}</span><div className="muted" style={{ fontSize: 11.5, fontFamily: 'monospace', wordBreak: 'break-all' }}>{c.txid || (es ? '(sin hash aún)' : '(no hash yet)')}</div></div>
                {canManage && <>
                  <button onClick={() => act({ action: 'crypto_confirm', id: c.id }, es ? 'Confirmado' : 'Confirmed')} style={btn('var(--green)')}>{es ? 'Confirmar' : 'Confirm'}</button>
                  <button onClick={() => act({ action: 'crypto_reject', id: c.id })} style={btn('var(--red)')}>{es ? 'Rechazar' : 'Reject'}</button>
                </>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Leads de servicios */}
      <div style={card}>
        <h3 style={{ marginTop: 0 }}>{es ? 'Solicitudes de servicio' : 'Service requests'}</h3>
        {!(d.leads || []).length && <div className="muted" style={{ fontSize: 13 }}>{es ? 'Sin solicitudes.' : 'No requests.'}</div>}
        <div style={{ display: 'grid', gap: 8 }}>
          {(d.leads || []).slice(0, 30).map((l: any) => (
            <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', borderTop: '1px solid var(--line)', paddingTop: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 7, background: 'color-mix(in srgb,var(--brand) 14%,transparent)', color: 'var(--brand)' }}>{l.service}</span>
              <div style={{ flex: 1, minWidth: 160 }}><b>{l.name || l.email || (es ? 'Lead' : 'Lead')}</b> <span className="muted" style={{ fontSize: 12 }}>· {l.platform || '—'} · {l.budget || ''}</span><div className="muted" style={{ fontSize: 12 }}>{l.message}</div></div>
              {canManage && (
                <select value={l.status} onChange={(e) => act({ action: 'lead_status', id: l.id, status: e.target.value })} style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--tx)', fontSize: 12 }}>
                  {['new', 'contacted', 'in_progress', 'won', 'lost'].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Payouts */}
      <div style={card}>
        <h3 style={{ marginTop: 0 }}>{es ? 'Pagos a creadores' : 'Creator payouts'}</h3>
        {!(d.payouts || []).length && <div className="muted" style={{ fontSize: 13 }}>{es ? 'Sin retiros.' : 'No payouts.'}</div>}
        <div style={{ display: 'grid', gap: 8 }}>
          {(d.payouts || []).slice(0, 30).map((p: any) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', borderTop: '1px solid var(--line)', paddingTop: 8 }}>
              <div style={{ flex: 1, minWidth: 160 }}><b>{money(p.amount_cents)}</b> <span className="muted" style={{ fontSize: 12 }}>· {p.method} · {p.destination || ''}</span></div>
              <span style={{ fontSize: 11.5, fontWeight: 800, color: p.status === 'paid' ? 'var(--green)' : 'var(--amber)' }}>{p.status === 'paid' ? (es ? 'Pagado' : 'Paid') : (es ? 'Pendiente' : 'Pending')}</span>
              {canManage && p.status !== 'paid' && <button onClick={() => act({ action: 'payout_paid', id: p.id }, es ? 'Marcado pagado' : 'Marked paid')} style={btn('var(--green)')}>{es ? 'Marcar pagado' : 'Mark paid'}</button>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function btn(c: string): any { return { padding: '7px 12px', borderRadius: 8, cursor: 'pointer', fontWeight: 800, fontSize: 12.5, border: `1px solid color-mix(in srgb,${c} 40%,transparent)`, background: `color-mix(in srgb,${c} 10%,transparent)`, color: c }; }
function Field({ label, value, onChange, wide }: any) {
  return <label style={{ display: 'block', gridColumn: wide ? 'span 2' : 'auto' }}><span className="muted" style={{ fontSize: 12 }}>{label}</span><input value={value ?? ''} onChange={(e) => onChange(e.target.value)} style={{ width: '100%', marginTop: 4, padding: '9px 11px', borderRadius: 9, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--tx)', fontSize: 13.5 }} /></label>;
}
function SelectField({ label, value, onChange, opts }: any) {
  return <label style={{ display: 'block' }}><span className="muted" style={{ fontSize: 12 }}>{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} style={{ width: '100%', marginTop: 4, padding: '9px 11px', borderRadius: 9, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--tx)', fontSize: 13.5 }}>{opts.map((o: string) => <option key={o} value={o}>{o.toUpperCase()}</option>)}</select></label>;
}
