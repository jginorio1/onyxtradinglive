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
  const [sub, setSub] = useState<'resumen' | 'marketplace' | 'servicios' | 'pagos' | 'creadores' | 'chat' | 'ajustes'>('resumen');

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

      {/* Sub-pestañas: el producto entero vive en un solo hub */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderBottom: '1px solid var(--line)', paddingBottom: 10 }}>
        {([['resumen', es ? 'Resumen' : 'Overview'], ['marketplace', es ? 'Marketplace' : 'Marketplace'], ['servicios', es ? 'Servicios' : 'Services'], ['pagos', es ? 'Pagos USDT' : 'USDT payments'], ['creadores', es ? 'Creadores' : 'Creators'], ['chat', es ? 'Chat' : 'Chat'], ['ajustes', es ? 'Ajustes' : 'Settings']] as [any, string][]).map(([k, lbl]) => (
          <button key={k} onClick={() => setSub(k)} style={{ padding: '8px 14px', borderRadius: 10, fontSize: 13.5, fontWeight: 700, cursor: 'pointer', border: '1px solid ' + (sub === k ? 'var(--brand)' : 'var(--line)'), background: sub === k ? 'color-mix(in srgb,var(--brand) 16%,transparent)' : 'transparent', color: sub === k ? 'var(--brand)' : 'var(--tx)' }}>{lbl}</button>
        ))}
      </div>

      {/* Resumen */}
      {sub === 'resumen' && (
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>{es ? 'Centro de mando de Onyx Bot Lab' : 'Onyx Bot Lab command center'}</h3>
          <p className="muted" style={{ fontSize: 13.5 }}>{es ? 'Desde aquí gestionas todo el producto: aprueba robots, atiende las propuestas high-ticket, confirma pagos en USDT, paga a los creadores y responde el chat con traducción automática.' : 'Manage the whole product here: approve robots, handle high-ticket proposals, confirm USDT payments, pay creators and answer the auto-translated chat.'}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginTop: 14 }}>
            {([['servicios', es ? 'Ver propuestas' : 'View proposals', stat.newLeads], ['pagos', es ? 'Pagos USDT' : 'USDT payments', (d.crypto || []).length], ['marketplace', es ? 'Aprobar robots' : 'Approve robots', stat.pendingProducts], ['chat', es ? 'Chat' : 'Chat', 0]] as [any, string, number][]).map(([k, lbl, n]) => (
              <button key={k} onClick={() => setSub(k)} style={{ textAlign: 'left', padding: 14, borderRadius: 12, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--tx)', cursor: 'pointer' }}>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{n || 0}</div><div className="muted" style={{ fontSize: 12.5 }}>{lbl} →</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat traducido */}
      {sub === 'chat' && <ChatInbox es={es} canManage={canManage} />}

      {/* Ajustes */}
      {sub === 'ajustes' && set && (
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>{es ? 'Ajustes' : 'Settings'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12 }}>
            <Field label={es ? 'Comisión Onyx (%)' : 'Onyx fee (%)'} value={set.fee_pct} onChange={(v: any) => setSet({ ...set, fee_pct: v })} />
            <Field label={es ? 'Wallet USDT · Ethereum (0x…)' : 'USDT wallet · Ethereum (0x…)'} value={set.usdt_erc20} onChange={(v: any) => setSet({ ...set, usdt_erc20: v })} wide />
            <Field label={es ? 'Wallet USDT · TRON (T…)' : 'USDT wallet · TRON (T…)'} value={set.usdt_trc20} onChange={(v: any) => setSet({ ...set, usdt_trc20: v })} wide />
            <Field label={es ? 'A medida desde ($)' : 'Bespoke from ($)'} value={set.service_automate_from} onChange={(v: any) => setSet({ ...set, service_automate_from: v })} />
            <Field label={es ? 'Instalación ($)' : 'Install ($)'} value={set.service_install_price} onChange={(v: any) => setSet({ ...set, service_install_price: v })} />
            <Field label={es ? 'Elite desde ($)' : 'Elite from ($)'} value={set.service_elite_from} onChange={(v: any) => setSet({ ...set, service_elite_from: v })} />
            <Field label={es ? 'Correo de avisos (propuestas)' : 'Notify email (leads)'} value={set.notify_email} onChange={(v: any) => setSet({ ...set, notify_email: v })} wide />
            <Field label={es ? 'Chat de Telegram para avisos' : 'Telegram chat for alerts'} value={set.telegram_chat} onChange={(v: any) => setSet({ ...set, telegram_chat: v })} />
          </div>
          <p className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>{es ? 'Pon una o ambas wallets; el cliente elige la red al pagar. Con ETHERSCAN_API_KEY (Ethereum) y/o la wallet TRON, los pagos se confirman SOLOS on-chain (cada 3 min). Sin eso, se confirman a mano aquí.' : 'Set one or both wallets; the buyer picks the network at checkout. With ETHERSCAN_API_KEY (Ethereum) and/or the TRON wallet, payments confirm AUTOMATICALLY on-chain (every 3 min). Otherwise, confirm them here manually.'}</p>
          {canManage && <button onClick={() => act({ action: 'settings', ...set }, es ? 'Ajustes guardados' : 'Settings saved')} style={{ marginTop: 12, padding: '9px 16px', borderRadius: 10, border: 'none', fontWeight: 800, cursor: 'pointer', background: 'var(--brand)', color: '#0b1020' }}>{es ? 'Guardar' : 'Save'}</button>}
        </div>
      )}

      {/* Robots por revisar */}
      {sub === 'marketplace' && <div style={card}>
        <h3 style={{ marginTop: 0 }}>{es ? 'Robots por revisar' : 'Robots to review'} {pend.length ? `(${pend.length})` : ''}</h3>
        {!pend.length && <div className="muted" style={{ fontSize: 13 }}>{es ? 'Nada pendiente.' : 'Nothing pending.'}</div>}
        {pend.length > 0 && (
          <div style={{ fontSize: 12, color: 'var(--mut)', background: 'var(--bg2)', borderRadius: 10, padding: 10, margin: '4px 0 12px' }}>
            {es ? 'Aprueba solo si: la estrategia está descrita, hay prueba de rendimiento (Myfxbook/backtest), es honesto (sin “ganancias garantizadas”), muestra riesgo/drawdown, y no es copia ni spam.' : 'Approve only if: the strategy is described, there is performance proof (Myfxbook/backtest), it is honest (no “guaranteed profits”), shows risk/drawdown, and it is not a copy or spam.'}
          </div>
        )}
        <div style={{ display: 'grid', gap: 10 }}>
          {pend.map((p: any) => <ReviewCard key={p.id} p={p} es={es} canManage={canManage} act={act} />)}
        </div>
      </div>}

      {/* Pagos USDT por confirmar */}
      {sub === 'pagos' && (
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>{es ? 'Pagos USDT por confirmar' : 'USDT payments to confirm'}</h3>
          {!(d.crypto || []).length && <div className="muted" style={{ fontSize: 13 }}>{es ? 'Sin pagos pendientes.' : 'No pending payments.'}</div>}
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
      {sub === 'servicios' && <div style={card}>
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
      </div>}

      {/* Payouts */}
      {sub === 'creadores' && <div style={card}>
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
      </div>}
    </div>
  );
}

function btn(c: string): any { return { padding: '7px 12px', borderRadius: 8, cursor: 'pointer', fontWeight: 800, fontSize: 12.5, border: `1px solid color-mix(in srgb,${c} 40%,transparent)`, background: `color-mix(in srgb,${c} 10%,transparent)`, color: c }; }

// Medidor circular del score (0–100) con color según veredicto.
function ScoreGauge({ score, color }: { score: number; color: string }) {
  const r = 34, c = 2 * Math.PI * r, off = c * (1 - Math.max(0, Math.min(100, score)) / 100);
  return (
    <div style={{ position: 'relative', width: 88, height: 88, flex: 'none' }}>
      <svg width="88" height="88" viewBox="0 0 88 88" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="44" cy="44" r={r} fill="none" stroke="var(--line)" strokeWidth="8" />
        <circle cx="44" cy="44" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} style={{ filter: `drop-shadow(0 0 6px ${color})`, transition: 'stroke-dashoffset .6s' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 24, fontWeight: 800, color, lineHeight: 1 }}>{score}</span>
        <span className="muted" style={{ fontSize: 9, letterSpacing: '.06em' }}>SCORE</span>
      </div>
    </div>
  );
}

// Tarjeta de revisión: score con OPERACIONES REALES + KPIs + desglose + acciones.
function ReviewCard({ p, es, canManage, act }: any) {
  const [reason, setReason] = useState('');
  const [open, setOpen] = useState(false);
  const money2 = (cc: number) => '$' + ((cc || 0) / 100).toLocaleString('en-US');
  const meta = [p.platform && p.platform !== 'any' ? String(p.platform).toUpperCase() : null, p.kind === 'subscription' ? (es ? 'renta ' + (p.interval === 'year' ? 'anual' : 'mensual') : 'rental') : (es ? 'pago único' : 'one-time'), p.category].filter(Boolean).join(' · ');
  const s = p._score || { hasData: false, score: 0, verdict: 'review', flags: [], parts: [] };
  const color = !s.hasData ? 'var(--mut)' : s.verdict === 'approve' ? 'var(--green)' : s.verdict === 'review' ? 'var(--amber)' : 'var(--red)';
  const verdictTx = !s.hasData ? (es ? 'Sin datos reales' : 'No real data') : s.verdict === 'approve' ? (es ? 'Recomendado aprobar' : 'Recommended approve') : s.verdict === 'review' ? (es ? 'Revisar a fondo' : 'Review closely') : (es ? 'No recomendado' : 'Not recommended');
  const kpi = (k: string, v: any, c?: string) => (
    <div style={{ background: 'var(--bg2)', borderRadius: 9, padding: '7px 9px', textAlign: 'center', minWidth: 62 }}>
      <div style={{ fontSize: 14.5, fontWeight: 800, color: c || 'var(--tx)' }}>{v}</div>
      <div className="muted" style={{ fontSize: 10 }}>{k}</div>
    </div>
  );
  return (
    <div style={{ border: `1px solid ${s.hasData ? `color-mix(in srgb,${color} 45%,var(--line))` : 'var(--line)'}`, borderRadius: 14, padding: 14, background: s.hasData ? `linear-gradient(180deg, color-mix(in srgb,${color} 6%,transparent), transparent 60%)` : 'transparent' }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <ScoreGauge score={s.hasData ? s.score : 0} color={color} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <b style={{ fontSize: 15 }}>{p.name}</b>
            <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--gold)' }}>{money2(p.price_cents)}</span>
            <span className="muted" style={{ fontSize: 12 }}>· {es ? 'por' : 'by'} {p.seller_name}</span>
          </div>
          <div style={{ marginTop: 5, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 99, background: `color-mix(in srgb,${color} 15%,transparent)`, border: `1px solid color-mix(in srgb,${color} 45%,transparent)`, color, fontSize: 12, fontWeight: 800 }}>
            {s.hasData ? (s.verdict === 'approve' ? '✓' : s.verdict === 'review' ? '◐' : '✕') : '○'} {verdictTx}
          </div>
          {p.tagline && <div style={{ fontSize: 13, marginTop: 6 }}>{p.tagline}</div>}
          <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>{meta}</div>
        </div>
      </div>

      {/* KPIs reales medidos por nosotros */}
      {s.hasData ? (
        <div style={{ display: 'flex', gap: 7, marginTop: 12, flexWrap: 'wrap' }}>
          {kpi(es ? 'Operac.' : 'Trades', s.trades)}
          {kpi(es ? 'Días' : 'Days', s.days)}
          {kpi('Profit factor', s.pf, s.pf >= 1.3 ? 'var(--green)' : s.pf >= 1 ? 'var(--amber)' : 'var(--red)')}
          {kpi(es ? 'Aciertos' : 'Win', s.winRate + '%')}
          {kpi('Drawdown', s.ddPct + '%', s.ddPct <= 15 ? 'var(--green)' : 'var(--red)')}
          {kpi(es ? 'Neto' : 'Net', '$' + s.netProfit.toLocaleString('en-US'), s.netProfit >= 0 ? 'var(--green)' : 'var(--red)')}
          {kpi(es ? 'Cuenta' : 'Acct', s.live ? (es ? 'Real' : 'Live') : 'Demo', s.live ? 'var(--green)' : 'var(--mut)')}
        </div>
      ) : (
        <div style={{ marginTop: 12, fontSize: 12.5, color: 'var(--amber)', background: 'color-mix(in srgb,var(--amber) 10%,transparent)', border: '1px solid color-mix(in srgb,var(--amber) 35%,transparent)', borderRadius: 10, padding: '9px 11px' }}>
          ⚠ {es ? 'Este robot no está ligado a operaciones reales en la plataforma (o aún no ha operado). Revísalo manualmente o pídele al creador que lo corra en una cuenta conectada.' : 'This robot is not linked to real trades on the platform (or has not traded yet). Review manually or ask the creator to run it on a connected account.'}
          {p.proof_url && <> · <a href={p.proof_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand)', fontWeight: 700 }}>{es ? 'Ver prueba externa' : 'View external proof'}</a></>}
        </div>
      )}

      {/* Desglose del score + banderas (plegable) */}
      {s.hasData && (
        <div style={{ marginTop: 8 }}>
          <button onClick={() => setOpen((o) => !o)} className="muted" style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--brand)' }}>{open ? '▾' : '▸'} {es ? 'Cómo se calculó' : 'How it scored'}{s.flags?.length ? ` · ${s.flags.length} ⚠` : ''}</button>
          {open && (
            <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
              {s.parts.map((pt: any) => (
                <div key={pt.k} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <span style={{ width: 96, color: 'var(--mut)' }}>{pt.k}</span>
                  <span style={{ flex: 1, height: 7, borderRadius: 4, background: 'var(--bg2)', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: `${(pt.v / pt.max) * 100}%`, background: color }} /></span>
                  <span style={{ width: 66, textAlign: 'right' }}>{pt.v}/{pt.max} <span className="muted">· {pt.note}</span></span>
                </div>
              ))}
              {s.flags?.length > 0 && <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 2 }}>⚠ {s.flags.join(' · ')}</div>}
            </div>
          )}
        </div>
      )}

      {p.description && <div style={{ fontSize: 13, marginTop: 10, whiteSpace: 'pre-wrap', color: 'var(--tx)' }}>{p.description}</div>}

      {canManage && (
        <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => act({ action: 'product_status', id: p.id, status: 'active', verified: true }, es ? 'Aprobado y verificado' : 'Approved & verified')} style={btn('var(--green)')}>{es ? 'Aprobar ✓ verificado' : 'Approve ✓ verified'}</button>
          <button onClick={() => act({ action: 'product_status', id: p.id, status: 'active', verified: false }, es ? 'Publicado (sin verificar)' : 'Published (unverified)')} style={btn('var(--brand)')}>{es ? 'Aprobar sin verificar' : 'Approve unverified'}</button>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={es ? 'Motivo de rechazo (opcional)' : 'Reject reason (optional)'} style={{ flex: 1, minWidth: 160, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--tx)', fontSize: 12.5 }} />
          <button onClick={() => act({ action: 'product_status', id: p.id, status: 'rejected', review_note: reason })} style={btn('var(--red)')}>{es ? 'Rechazar' : 'Reject'}</button>
        </div>
      )}
    </div>
  );
}
function Field({ label, value, onChange, wide }: any) {
  return <label style={{ display: 'block', gridColumn: wide ? 'span 2' : 'auto' }}><span className="muted" style={{ fontSize: 12 }}>{label}</span><input value={value ?? ''} onChange={(e) => onChange(e.target.value)} style={{ width: '100%', marginTop: 4, padding: '9px 11px', borderRadius: 9, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--tx)', fontSize: 13.5 }} /></label>;
}
function SelectField({ label, value, onChange, opts }: any) {
  return <label style={{ display: 'block' }}><span className="muted" style={{ fontSize: 12 }}>{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} style={{ width: '100%', marginTop: 4, padding: '9px 11px', borderRadius: 9, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--tx)', fontSize: 13.5 }}>{opts.map((o: string) => <option key={o} value={o}>{o.toUpperCase()}</option>)}</select></label>;
}

// Bandeja de chat traducido: tú ves y respondes en español; el cliente lo recibe en su idioma.
function ChatInbox({ es, canManage }: { es: boolean; canManage: boolean }) {
  const [threads, setThreads] = useState<any[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  async function loadThreads() { try { const r = await fetch('/api/admin/botlab/chat'); const j = await r.json(); setThreads(j.threads || []); } catch {} }
  async function openThread(id: string) { setOpenId(id); try { const r = await fetch('/api/admin/botlab/chat?thread=' + id); const j = await r.json(); setMsgs(j.messages || []); loadThreads(); } catch {} }
  useEffect(() => { loadThreads(); const iv = setInterval(() => { loadThreads(); if (openId) openThread(openId); }, 10000); return () => clearInterval(iv); }, [openId]); // eslint-disable-line

  async function reply() {
    const t = text.trim(); if (!t || !openId) return; setText(''); setSending(true);
    try { const r = await fetch('/api/admin/botlab/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ thread: openId, text: t }) }); const j = await r.json(); if (!r.ok) throw new Error(j.error); setMsgs(j.messages || []); } catch (e: any) { toastErr(e?.message); } finally { setSending(false); }
  }

  const card: any = { background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14 };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 14, minHeight: 420 }}>
      {/* Lista de conversaciones */}
      <div style={{ ...card, padding: 8, overflowY: 'auto', maxHeight: 520 }}>
        {!threads.length && <div className="muted" style={{ fontSize: 13, padding: 12 }}>{es ? 'Sin conversaciones aún.' : 'No conversations yet.'}</div>}
        {threads.map((t) => (
          <button key={t.id} onClick={() => openThread(t.id)} style={{ width: '100%', textAlign: 'left', padding: 10, borderRadius: 10, border: 'none', cursor: 'pointer', marginBottom: 4, background: openId === t.id ? 'color-mix(in srgb,var(--brand) 16%,transparent)' : 'transparent', color: 'var(--tx)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <b style={{ fontSize: 13.5, flex: 1 }}>{t.who}</b>
              {t.lang && <span className="muted" style={{ fontSize: 10.5, textTransform: 'uppercase' }}>{t.lang}</span>}
              {t.unread_admin > 0 && <span style={{ background: 'var(--red)', color: '#fff', fontSize: 10, fontWeight: 800, borderRadius: 99, padding: '1px 6px' }}>{t.unread_admin}</span>}
            </div>
            <div className="muted" style={{ fontSize: 11.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.preview || '—'}</div>
          </button>
        ))}
      </div>
      {/* Conversación */}
      <div style={{ ...card, display: 'flex', flexDirection: 'column' }}>
        {!openId ? (
          <div className="muted" style={{ margin: 'auto', fontSize: 13 }}>{es ? 'Elige una conversación.' : 'Pick a conversation.'}</div>
        ) : (
          <>
            <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 440 }}>
              {msgs.map((m, i) => (
                <div key={i} style={{ maxWidth: '80%', alignSelf: m.sender === 'admin' ? 'flex-end' : 'flex-start' }}>
                  <div style={{ padding: '9px 12px', borderRadius: 12, fontSize: 13.5, background: m.sender === 'admin' ? 'linear-gradient(120deg,var(--brand),var(--brand2,#a06bff))' : 'var(--bg2)', color: m.sender === 'admin' ? '#0b1020' : 'var(--tx)', border: m.sender === 'admin' ? 'none' : '1px solid var(--line)' }}>{m.es}</div>
                  {m.sender === 'user' && m.lang && m.lang !== 'es' && <div className="muted" style={{ fontSize: 10.5, marginTop: 2 }}>{es ? 'original' : 'original'} ({m.lang}): {m.orig}</div>}
                </div>
              ))}
            </div>
            {canManage && (
              <div style={{ display: 'flex', gap: 8, padding: 10, borderTop: '1px solid var(--line)' }}>
                <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') reply(); }} placeholder={es ? 'Responde en español…' : 'Reply in Spanish…'} style={{ flex: 1, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: '9px 12px', color: 'var(--tx)', fontSize: 13.5, outline: 'none' }} />
                <button onClick={reply} disabled={sending} style={{ padding: '9px 16px', borderRadius: 10, border: 'none', fontWeight: 800, cursor: 'pointer', background: 'var(--brand)', color: '#0b1020' }}>{es ? 'Enviar' : 'Send'}</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
