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

      <ScheduleCard card={card} btn={btn} btnP={btnP} />
      <LeaveCard card={card} btn={btn} btnP={btnP} inp={inp} />

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
                <td style={{ padding: '8px 4px', fontWeight: 600 }}>{money(p.net ?? p.amount, p.currency)}<span className="muted" style={{ fontWeight: 400, fontSize: 11 }}> neto</span></td>
                <td style={{ padding: '8px 4px', color: 'var(--mut,#9aa6bd)' }}>{p.method}</td>
                <td style={{ padding: '8px 4px', color: p.status === 'paid' ? 'var(--green,#5ed6a0)' : 'var(--mut,#9aa6bd)' }}>{p.status === 'paid' ? 'pagado' : p.status}</td>
                <td style={{ padding: '8px 4px', textAlign: 'right' }}><a href={`/api/staff/payslip?payment_id=${p.id}`} target="_blank" rel="noopener" style={{ color: 'var(--accent,#8b93ff)', fontSize: 12 }}>recibo</a></td>
              </tr>
            ))}
          </tbody></table>}
      </div>
    </div>
  );
}

// ── Mi horario + fichaje (clock in/out) ──────────────────────────────
const WD_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
function dur(min: number) { const h = Math.floor(min / 60), m = min % 60; return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`; }

function ScheduleCard({ card, btn, btnP }: { card: React.CSSProperties; btn: React.CSSProperties; btnP: React.CSSProperties }) {
  const [d, setD] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);   // refresca el cronómetro en vivo

  async function load() { try { const r = await fetch('/api/staff/schedule', { cache: 'no-store' }); const j = await r.json(); setD(j); } catch {} }
  useEffect(() => { load(); }, []);
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 30000); return () => clearInterval(t); }, []);

  async function clock(action: 'clock_in' | 'clock_out') {
    setBusy(true);
    try { await fetch('/api/staff/schedule', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action }) }); await load(); } catch {} finally { setBusy(false); }
  }

  if (!d || d.isStaff === false) return null;
  const open = d.open;
  const openMin = open ? Math.max(0, Math.round((Date.now() - new Date(open.clock_in).getTime()) / 60000)) : 0;
  const todayShift: any[] = d.todayShift || [];
  // Plantilla semanal agrupada por día.
  const byDay: Record<number, any[]> = {}; for (let i = 0; i < 7; i++) byDay[i] = [];
  (d.shifts || []).forEach((s: any) => byDay[s.weekday]?.push(s));

  return (
    <div style={{ ...card, marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <b>Mi horario y fichaje</b>
          <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
            {todayShift.length ? `Hoy: ${todayShift.map((t) => `${t.start}–${t.end}`).join(', ')}` : 'Hoy no tienes turno asignado.'}
            {' · '}Este mes: <b style={{ color: 'var(--tx)' }}>{dur(d.workedMin || 0)}</b>
          </div>
        </div>
        {open
          ? <button style={{ ...btnP, background: 'var(--red,#e5484d)' }} disabled={busy} onClick={() => clock('clock_out')}>Fichar salida · {dur(openMin)}</button>
          : <button style={{ ...btnP, background: 'var(--green,#2fbf88)', color: '#0b1020' }} disabled={busy} onClick={() => clock('clock_in')}>Fichar entrada</button>}
      </div>

      {open && <div style={{ fontSize: 12, color: 'var(--green,#5ed6a0)', marginTop: 8 }}>● Fichado desde las {new Date(open.clock_in).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</div>}

      {/* Plantilla semanal (solo lectura para el empleado). */}
      <div style={{ marginTop: 12, borderTop: '1px solid var(--line,#2a3350)', paddingTop: 10 }}>
        <div className="muted" style={{ fontSize: 11.5, marginBottom: 6 }}>Turno semanal</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {[1, 2, 3, 4, 5, 6, 0].map((wd) => (
            <span key={wd} style={{ fontSize: 11.5, background: 'var(--bg2,#0e1220)', borderRadius: 8, padding: '4px 8px' }}>
              <b>{WD_ES[wd]}</b> {byDay[wd].length ? byDay[wd].map((s: any) => `${s.start_time}–${s.end_time}`).join(', ') : <span className="muted">libre</span>}
            </span>
          ))}
        </div>
        {(d.exceptions || []).length > 0 && (
          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {(d.exceptions || []).map((e: any) => (
              <span key={e.id} style={{ fontSize: 11, background: 'var(--bg2,#0e1220)', borderRadius: 8, padding: '3px 8px' }}>
                <b>{e.day.slice(5)}</b> <span style={{ color: e.kind === 'off' ? 'var(--red,#e5484d)' : 'var(--green,#5ed6a0)' }}>{e.kind === 'off' ? 'libre' : `${e.start_time}–${e.end_time}`}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Mis días libres (saldo + solicitar) ──────────────────────────────
const TYPE_ES: any = { vacation: 'Vacaciones', sick: 'Enfermedad', personal: 'Personal' };
const ST_ES: any = { pending: 'pendiente', approved: 'aprobada', rejected: 'rechazada', cancelled: 'cancelada' };
const ST_COLOR: any = { pending: 'var(--amber,#e0a33e)', approved: 'var(--green,#5ed6a0)', rejected: 'var(--red,#e5484d)', cancelled: 'var(--mut,#9aa6bd)' };

function LeaveCard({ card, btn, btnP, inp }: { card: React.CSSProperties; btn: React.CSSProperties; btnP: React.CSSProperties; inp: React.CSSProperties }) {
  const [d, setD] = useState<any>(null);
  const [type, setType] = useState('vacation');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function load() { try { const r = await fetch('/api/staff/leave', { cache: 'no-store' }); const j = await r.json(); setD(j); } catch {} }
  useEffect(() => { load(); }, []);

  async function submit() {
    if (!start || !end) { setMsg('Elige las fechas.'); return; }
    setBusy(true); setMsg('');
    try {
      const r = await fetch('/api/staff/leave', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'request', type, start_day: start, end_day: end, reason }) });
      const j = await r.json();
      if (j.ok) { setMsg(`Solicitud enviada (${j.days} día(s)).`); setStart(''); setEnd(''); setReason(''); await load(); }
      else setMsg('⚠ ' + (j.error || 'Error'));
    } catch { setMsg('Error'); } finally { setBusy(false); }
  }
  async function cancel(id: string) {
    setBusy(true);
    try { await fetch('/api/staff/leave', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'cancel', id }) }); await load(); } catch {} finally { setBusy(false); }
  }

  if (!d || d.isStaff === false) return null;
  const bal = d.balances || {};
  const reqs: any[] = d.requests || [];

  return (
    <div style={{ ...card, marginBottom: 16 }}>
      <b>Mis días libres</b>
      {/* Saldos */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
        {['vacation', 'sick', 'personal'].map((t) => (
          <div key={t} style={{ flex: 1, minWidth: 110, background: 'var(--bg2,#0e1220)', borderRadius: 10, padding: '10px 12px' }}>
            <div className="muted" style={{ fontSize: 11.5 }}>{TYPE_ES[t]}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: (bal[t]?.remaining || 0) > 0 ? 'var(--green,#5ed6a0)' : 'var(--mut,#9aa6bd)' }}>{bal[t]?.remaining ?? 0}</div>
            <div className="muted" style={{ fontSize: 10.5 }}>de {bal[t]?.allotted ?? 0} · usados {bal[t]?.used ?? 0}</div>
          </div>
        ))}
      </div>

      {/* Solicitar */}
      <div style={{ marginTop: 12, borderTop: '1px solid var(--line,#2a3350)', paddingTop: 12 }}>
        <div className="muted" style={{ fontSize: 11.5, marginBottom: 8 }}>Solicitar días libres</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={type} onChange={(e) => setType(e.target.value)} style={inp}><option value="vacation">Vacaciones</option><option value="sick">Enfermedad</option><option value="personal">Personal</option></select>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} style={inp} />
          <span className="muted">→</span>
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} style={inp} />
          <input placeholder="Motivo (opcional)" value={reason} onChange={(e) => setReason(e.target.value)} style={{ ...inp, flex: 1, minWidth: 160 }} />
          <button style={btnP} disabled={busy} onClick={submit}>Solicitar</button>
        </div>
        {msg && <div style={{ fontSize: 12, marginTop: 8, color: msg.startsWith('⚠') ? 'var(--red,#e5484d)' : 'var(--green,#5ed6a0)' }}>{msg}</div>}
      </div>

      {/* Mis solicitudes */}
      {reqs.length > 0 && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {reqs.map((r) => (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, background: 'var(--bg2,#0e1220)', borderRadius: 8, padding: '7px 11px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12.5 }}>{TYPE_ES[r.type]} · {r.start_day.slice(5)}→{r.end_day.slice(5)} · {r.days}d{r.admin_note ? ` · “${r.admin_note}”` : ''}</span>
              <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: ST_COLOR[r.status] }}>{ST_ES[r.status]}</span>
                {r.status === 'pending' && <button style={{ ...btn, fontSize: 11, padding: '2px 8px' }} disabled={busy} onClick={() => cancel(r.id)}>Cancelar</button>}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
