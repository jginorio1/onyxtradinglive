'use client';
import { useEffect, useState } from 'react';

// Panel del VENDEDOR / SUPERVISOR. Sus clientes, comisiones, dar prueba/descuento,
// atender tickets, su equipo y cobros (Stripe Connect o USDT).
export default function VentasPanel() {
  const [d, setD] = useState<any>(null);
  const [tab, setTab] = useState<'resumen' | 'desempeno' | 'clientes' | 'equipo' | 'evaluar' | 'soporte' | 'cobros' | 'guia'>('resumen');
  const [msg, setMsg] = useState('');
  const [lang, setLang] = useState<'es' | 'en'>('es');
  const L = (es: string, en: string) => (lang === 'es' ? es : en);

  useEffect(() => {
    try { const m = document.cookie.match(/onyx_lang=(\w+)/); if (m && m[1] === 'en') setLang('en'); } catch {}
    load();
  }, []);
  async function load() { try { const r = await fetch('/api/sales', { cache: 'no-store' }); setD(await r.json()); } catch {} }
  async function act(body: any) {
    setMsg('');
    const r = await fetch('/api/sales', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json(); if (!j.ok && j.error) setMsg(j.error); await load(); return j;
  }

  const card: React.CSSProperties = { background: 'var(--panel,#161c2e)', border: '1px solid var(--line,#2a3350)', borderRadius: 14, padding: 18 };
  const btn: React.CSSProperties = { padding: '8px 14px', borderRadius: 9, border: '1px solid var(--line,#2a3350)', background: 'var(--card,#1b2338)', color: 'var(--tx,#e8ecf5)', cursor: 'pointer', fontSize: 13 };
  const btnP: React.CSSProperties = { ...btn, background: 'var(--accent,#8b93ff)', color: '#fff', border: 'none', fontWeight: 600 };
  const wrap: React.CSSProperties = { maxWidth: 900, margin: '0 auto', padding: '20px 16px 70px' };

  if (!d) return <div style={wrap}><div style={card}>{L('Cargando…', 'Loading…')}</div></div>;
  if (d.isRep === false) return <div style={wrap}><div style={{ ...card, textAlign: 'center' }}>
    <div style={{ fontSize: 34 }}>🔒</div>
    <h2 style={{ color: 'var(--tx,#e8ecf5)' }}>{L('No eres parte del equipo de ventas', 'You’re not part of the sales team')}</h2>
    <p style={{ color: 'var(--mut,#9aa6bd)' }}>{L('Si crees que es un error, contacta al administrador.', 'If you think this is a mistake, contact the admin.')}</p>
  </div></div>;

  const b = d.balances || {};
  const stat = (label: string, val: string) => (
    <div style={{ background: 'var(--card,#1b2338)', borderRadius: 12, padding: '12px 14px', flex: 1, minWidth: 130 }}>
      <div style={{ fontSize: 12, color: 'var(--mut,#9aa6bd)' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--tx,#e8ecf5)', marginTop: 2 }}>{val}</div>
    </div>
  );
  const tabBtn = (id: any, label: string) => (
    <button onClick={() => setTab(id)} style={{ ...btn, background: tab === id ? 'var(--accent,#8b93ff)' : 'var(--card,#1b2338)', color: tab === id ? '#fff' : 'var(--tx,#e8ecf5)', border: tab === id ? 'none' : btn.border }}>{label}</button>
  );

  return (
    <div style={wrap}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 style={{ fontSize: 23, margin: 0, color: 'var(--tx,#e8ecf5)' }}>{L('Mi panel de ventas', 'My sales panel')}</h1>
          <div style={{ fontSize: 13, color: 'var(--mut,#9aa6bd)' }}>{(d.level_names ? (d.rep.level === 'l2' ? d.level_names.l2 : d.rep.level === 'l1' ? d.level_names.l1 : d.level_names.vendedor) : L('Vendedor', 'Seller'))} · {d.rep.display_name || d.rep.code}</div>
        </div>
        <button onClick={() => setLang(lang === 'es' ? 'en' : 'es')} style={btn}>{lang === 'es' ? '🇬🇧 EN' : '🇪🇸 ES'}</button>
      </div>

      {d.rep.on_hold && <div style={{ ...card, borderColor: 'var(--amber,#f0b74e)', marginBottom: 12, fontSize: 13, color: 'var(--amber,#f0b74e)' }}>{L('Tus pagos están en pausa por el administrador. Tu saldo se sigue acumulando.', 'Your payouts are paused by the admin. Your balance keeps accruing.')}</div>}
      {msg && <div style={{ ...card, borderColor: 'var(--red,#f0736f)', marginBottom: 12, fontSize: 13, color: 'var(--red,#f0736f)' }}>{msg}</div>}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {tabBtn('resumen', L('Resumen', 'Overview'))}
        {tabBtn('desempeno', L('Mi desempeño', 'My performance'))}
        {tabBtn('clientes', L('Mis clientes', 'My clients') + ` (${d.clients.length})`)}
        {d.team.length > 0 && tabBtn('equipo', L('Mi equipo', 'My team'))}
        {((d.evalTargets && d.evalTargets.length) || d.mySupervisor) && tabBtn('evaluar', L('Evaluar', 'Evaluate'))}
        {tabBtn('soporte', L('Soporte', 'Support') + (d.tickets.length ? ` (${d.tickets.length})` : ''))}
        {tabBtn('cobros', L('Cobros', 'Payouts'))}
        {tabBtn('guia', L('Guía', 'Guide'))}
      </div>

      {tab === 'resumen' && <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {stat(L('Clientes activos', 'Active clients'), String(d.activeClients))}
          {stat(L('Disponible', 'Available'), '$' + (b.available || 0))}
          {stat(L('En espera', 'Pending'), '$' + (b.pending || 0))}
          {stat(L('Pagado', 'Paid'), '$' + (b.paid || 0))}
        </div>
        <div style={card}>
          <div style={{ fontSize: 13, color: 'var(--mut,#9aa6bd)', marginBottom: 6 }}>{L('Tu enlace de invitación (quien se registre por aquí queda atado a ti):', 'Your invite link (anyone who signs up here is attributed to you):')}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input readOnly value={d.link} style={{ flex: 1, minWidth: 220, padding: '9px 12px', borderRadius: 9, border: '1px solid var(--line,#2a3350)', background: 'var(--bg,#0e1220)', color: 'var(--tx,#e8ecf5)', fontSize: 13 }} />
            <button style={btnP} onClick={() => { navigator.clipboard.writeText(d.link); setMsg(L('Enlace copiado ✓', 'Link copied ✓')); }}>{L('Copiar', 'Copy')}</button>
          </div>
        </div>
      </div>}

      {tab === 'desempeno' && <MyPerf d={d} L={L} act={act} card={card} btn={btn} btnP={btnP} />}

      {tab === 'evaluar' && <Evaluate d={d} L={L} act={act} card={card} btn={btn} btnP={btnP} />}

      {tab === 'clientes' && <div style={card}>
        <div style={{ fontSize: 13, color: 'var(--mut,#9aa6bd)', marginBottom: 10 }}>{L('Puedes darles prueba (hasta', 'You can grant a trial (up to')} {d.caps.trial_max_days} {L('días) o generar un descuento (hasta', 'days) or generate a discount (up to')} {d.caps.discount_max_pct}%).</div>
        <ClientList d={d} L={L} act={act} />
        <div style={{ marginTop: 14, borderTop: '1px solid var(--line,#2a3350)', paddingTop: 12 }}>
          <b style={{ color: 'var(--tx,#e8ecf5)', fontSize: 14 }}>{L('Generar cupón de descuento', 'Generate a discount coupon')}</b>
          <DiscountBox d={d} L={L} act={act} />
        </div>
      </div>}

      {tab === 'equipo' && <div style={card}>
        <b style={{ color: 'var(--tx,#e8ecf5)' }}>{L('Tu equipo', 'Your team')}</b>
        <table style={{ width: '100%', marginTop: 10, fontSize: 13.5, borderCollapse: 'collapse' }}>
          <tbody>
            {d.team.map((t: any) => (
              <tr key={t.id} style={{ borderTop: '1px solid var(--line,#2a3350)' }}>
                <td style={{ padding: '8px 6px', color: 'var(--tx,#e8ecf5)' }}>{t.name} <span style={{ color: 'var(--mut,#9aa6bd)', fontSize: 12 }}>· {t.level === 'l1' ? 'N1' : t.level === 'l2' ? 'N2' : L('Vendedor', 'Seller')}</span></td>
                <td style={{ padding: '8px 6px', color: 'var(--mut,#9aa6bd)', textAlign: 'right' }}>{t.clients} {L('clientes', 'clients')}</td>
                <td style={{ padding: '8px 6px', color: 'var(--green,#5ed6a0)', textAlign: 'right' }}>${t.available}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>}

      {tab === 'soporte' && <div style={card}>
        <b style={{ color: 'var(--tx,#e8ecf5)' }}>{L('Tickets de tus clientes', 'Your clients’ tickets')}</b>
        {d.tickets.length === 0 ? <p style={{ color: 'var(--mut,#9aa6bd)' }}>{L('No hay tickets abiertos. ¡Todo al día!', 'No open tickets. All good!')}</p> :
          d.tickets.map((t: any) => <TicketRow key={t.id} t={t} L={L} act={act} />)}
      </div>}

      {tab === 'cobros' && <PayoutBox d={d} L={L} act={act} btn={btn} btnP={btnP} card={card} />}

      {tab === 'guia' && <div style={card}>
        <h3 style={{ color: 'var(--tx,#e8ecf5)', marginTop: 0 }}>{L('Cómo trabajar y ayudar a tus clientes', 'How to work and help your clients')}</h3>
        <ol style={{ color: 'var(--tx,#e8ecf5)', lineHeight: 1.8, fontSize: 14 }}>
          <li>{L('Comparte tu enlace de invitación (pestaña Resumen). Quien se registre por ahí es tu cliente.', 'Share your invite link (Overview tab). Anyone who signs up there is your client.')}</li>
          <li>{L('Ayúdales a registrarse, conectar su cuenta y activar el Guardian.', 'Help them sign up, connect their account and enable the Guardian.')}</li>
          <li>{L('Para cerrar la venta: dales una prueba o un cupón de descuento (pestaña Mis clientes).', 'To close: give them a trial or a discount coupon (My clients tab).')}</li>
          <li>{L('Atiende sus dudas en la pestaña Soporte.', 'Answer their questions in the Support tab.')}</li>
          <li>{L('Cobras una comisión CADA MES que tu cliente siga pagando. Conecta tu cobro en la pestaña Cobros.', 'You earn a commission EVERY month your client keeps paying. Set up payouts in the Payouts tab.')}</li>
        </ol>
      </div>}
    </div>
  );
}

function ClientList({ d, L, act }: any) {
  const [days, setDays] = useState<Record<string, number>>({});
  return (
    <div>
      {d.clients.length === 0 && <p style={{ color: 'var(--mut,#9aa6bd)' }}>{L('Aún no tienes clientes. Comparte tu enlace.', 'No clients yet. Share your link.')}</p>}
      {d.clients.map((c: any) => (
        <div key={c.user_id} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid var(--line,#2a3350)', padding: '10px 0' }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ color: 'var(--tx,#e8ecf5)', fontSize: 14 }}>{c.email || c.name || c.user_id.slice(0, 8)}</div>
            <div style={{ fontSize: 12, color: c.active ? 'var(--green,#5ed6a0)' : 'var(--mut,#9aa6bd)' }}>{c.active ? L('activo · ', 'active · ') + c.plan : (c.plan || 'free')}</div>
          </div>
          <input type="number" min={1} max={d.caps.trial_max_days} placeholder={L('días', 'days')} value={days[c.user_id] || ''} onChange={(e) => setDays((s) => ({ ...s, [c.user_id]: parseInt(e.target.value, 10) || 0 }))}
            style={{ width: 70, padding: '7px 9px', borderRadius: 8, border: '1px solid var(--line,#2a3350)', background: 'var(--bg,#0e1220)', color: 'var(--tx,#e8ecf5)', fontSize: 13 }} />
          <button onClick={() => act({ action: 'grant_trial', client_user_id: c.user_id, days: days[c.user_id] || d.caps.trial_max_days })}
            style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--line,#2a3350)', background: 'var(--card,#1b2338)', color: 'var(--tx,#e8ecf5)', cursor: 'pointer', fontSize: 12.5 }}>{L('Dar prueba', 'Give trial')}</button>
        </div>
      ))}
    </div>
  );
}

function DiscountBox({ d, L, act }: any) {
  const [pct, setPct] = useState(d.caps.discount_max_pct);
  const [code, setCode] = useState('');
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
      <input type="number" min={1} max={d.caps.discount_max_pct} value={pct} onChange={(e) => setPct(parseInt(e.target.value, 10) || 0)}
        style={{ width: 80, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line,#2a3350)', background: 'var(--bg,#0e1220)', color: 'var(--tx,#e8ecf5)' }} />
      <span style={{ color: 'var(--mut,#9aa6bd)', fontSize: 13 }}>% {L('de descuento', 'off')}</span>
      <button onClick={async () => { const j = await act({ action: 'grant_discount', pct }); if (j.code) setCode(j.code); }}
        style={{ padding: '8px 14px', borderRadius: 9, border: 'none', background: 'var(--accent,#8b93ff)', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>{L('Generar cupón', 'Generate coupon')}</button>
      {code && <div style={{ color: 'var(--green,#5ed6a0)', fontSize: 14 }}>{L('Código:', 'Code:')} <b>{code}</b> <button onClick={() => navigator.clipboard.writeText(code)} style={{ marginLeft: 6, cursor: 'pointer', background: 'none', border: '1px solid var(--line,#2a3350)', color: 'var(--tx,#e8ecf5)', borderRadius: 6, padding: '2px 8px' }}>⧉</button></div>}
    </div>
  );
}

function TicketRow({ t, L, act }: any) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  return (
    <div style={{ borderTop: '1px solid var(--line,#2a3350)', padding: '10px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div><span style={{ color: 'var(--tx,#e8ecf5)', fontSize: 14 }}>{t.subject || '(sin asunto)'}</span> <span style={{ color: 'var(--mut,#9aa6bd)', fontSize: 12 }}>· {t.client} · {t.status}</span></div>
        <button onClick={() => setOpen(!open)} style={{ background: 'none', border: '1px solid var(--line,#2a3350)', color: 'var(--tx,#e8ecf5)', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontSize: 12.5 }}>{L('Responder', 'Reply')}</button>
      </div>
      {open && <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={L('Escribe tu respuesta…', 'Type your reply…')} style={{ flex: 1, minHeight: 54, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line,#2a3350)', background: 'var(--bg,#0e1220)', color: 'var(--tx,#e8ecf5)', resize: 'vertical' }} />
        <button onClick={async () => { if (body.trim()) { await act({ action: 'reply_ticket', ticket_id: t.id, body }); setBody(''); setOpen(false); } }}
          style={{ padding: '8px 14px', borderRadius: 9, border: 'none', background: 'var(--accent,#8b93ff)', color: '#fff', cursor: 'pointer', fontWeight: 600, alignSelf: 'flex-start' }}>{L('Enviar', 'Send')}</button>
      </div>}
    </div>
  );
}

function PayoutBox({ d, L, act, btn, btnP, card }: any) {
  const [method, setMethod] = useState(d.rep.payout_method || 'stripe');
  const [network, setNetwork] = useState(d.wallets.network || 'trc20');
  const [wallet, setWallet] = useState('');
  const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid var(--line,#2a3350)', background: 'var(--bg,#0e1220)', color: 'var(--tx,#e8ecf5)', fontSize: 13, marginTop: 6 };
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={card}>
        <b style={{ color: 'var(--tx,#e8ecf5)' }}>{L('Cómo quieres cobrar', 'How you want to get paid')}</b>
        <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
          <label style={{ ...btn, background: method === 'stripe' ? 'var(--accent,#8b93ff)' : btn.background, color: method === 'stripe' ? '#fff' : btn.color }}>
            <input type="radio" checked={method === 'stripe'} onChange={() => setMethod('stripe')} style={{ marginRight: 6 }} />{L('Stripe (banco/tarjeta) · automático', 'Stripe (bank/card) · automatic')}</label>
          <label style={{ ...btn, background: method === 'usdt' ? 'var(--accent,#8b93ff)' : btn.background, color: method === 'usdt' ? '#fff' : btn.color }}>
            <input type="radio" checked={method === 'usdt'} onChange={() => setMethod('usdt')} style={{ marginRight: 6 }} />USDT (cripto)</label>
        </div>

        {method === 'stripe' && <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 13, color: d.connect.payoutsEnabled ? 'var(--green,#5ed6a0)' : 'var(--mut,#9aa6bd)' }}>
            {d.connect.payoutsEnabled ? L('✓ Cuenta conectada y lista para recibir pagos.', '✓ Account connected and ready to receive payouts.') : L('Aún no has conectado tu cuenta de cobro.', 'You haven’t connected your payout account yet.')}
          </div>
          <button style={{ ...btnP, marginTop: 8 }} onClick={async () => { const j = await act({ action: 'connect_link' }); if (j.url) window.location.href = j.url; }}>
            {d.connect.payoutsEnabled ? L('Actualizar datos de cobro', 'Update payout details') : L('Conectar mi cobro (Stripe)', 'Connect my payout (Stripe)')}
          </button>
        </div>}

        {method === 'usdt' && <div style={{ marginTop: 12 }}>
          <label style={{ fontSize: 13, color: 'var(--mut,#9aa6bd)' }}>{L('Red', 'Network')}
            <select value={network} onChange={(e) => setNetwork(e.target.value)} style={inp}><option value="trc20">TRON (TRC20)</option><option value="erc20">Ethereum (ERC20)</option></select></label>
          <label style={{ fontSize: 13, color: 'var(--mut,#9aa6bd)', display: 'block', marginTop: 8 }}>{L('Tu billetera USDT', 'Your USDT wallet')}
            <input value={wallet} onChange={(e) => setWallet(e.target.value)} placeholder={network === 'erc20' ? '0x…' : 'T…'} style={inp} /></label>
          <div style={{ fontSize: 12, color: 'var(--mut,#9aa6bd)', marginTop: 6 }}>{L('El pago en USDT lo procesa el administrador; tu saldo se acumula igual.', 'USDT payout is processed by the admin; your balance accrues the same.')}</div>
        </div>}

        <button style={{ ...btnP, marginTop: 12 }} onClick={() => act({ action: 'save_payout', payout_method: method, network, wallet })}>{L('Guardar método de cobro', 'Save payout method')}</button>
      </div>

      <div style={card}>
        <b style={{ color: 'var(--tx,#e8ecf5)' }}>{L('Historial de pagos', 'Payout history')}</b>
        {(!d.payouts || d.payouts.length === 0) ? <p style={{ color: 'var(--mut,#9aa6bd)' }}>{L('Aún no hay pagos.', 'No payouts yet.')}</p> :
          <table style={{ width: '100%', marginTop: 8, fontSize: 13.5 }}><tbody>
            {d.payouts.map((p: any, i: number) => <tr key={i} style={{ borderTop: '1px solid var(--line,#2a3350)' }}>
              <td style={{ padding: '7px 4px', color: 'var(--tx,#e8ecf5)' }}>${p.amount}</td>
              <td style={{ padding: '7px 4px', color: 'var(--mut,#9aa6bd)' }}>{p.method}</td>
              <td style={{ padding: '7px 4px', color: p.status === 'paid' ? 'var(--green,#5ed6a0)' : 'var(--mut,#9aa6bd)', textAlign: 'right' }}>{p.status}</td>
            </tr>)}
          </tbody></table>}
      </div>
    </div>
  );
}

// ===== Mi desempeño (vendedor ve su propia tarjeta + IA + reseñas) =====
const TIERC: any = { star: { fg: '#e5b567', lbl: 'Estrella' }, solid: { fg: '#5ed6a0', lbl: 'Sólido' }, risk: { fg: '#f0736f', lbl: 'En riesgo' } };
const starStr = (r: number) => '★★★★★'.slice(0, Math.round(r)) + '☆☆☆☆☆'.slice(0, 5 - Math.round(r));

function MyPerf({ d, L, act, card, btn }: any) {
  const sc = d.scorecard || {};
  const [ins, setIns] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const t = TIERC[sc.tier] || TIERC.solid;
  async function ai() { setBusy(true); const r = await act({ action: 'insight' }); setIns(r?.insight || null); setBusy(false); }
  const mini = (label: string, v: any, c?: string) => (
    <div style={{ background: 'var(--card,#1b2338)', border: '1px solid var(--line,#2a3350)', borderRadius: 10, padding: '10px 12px', minWidth: 110, flex: 1 }}>
      <div style={{ fontSize: 11, color: 'var(--mut,#9aa6bd)' }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 700, color: c || 'var(--tx,#e8ecf5)' }}>{v}</div>
    </div>
  );
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, fontWeight: 800, color: t.fg, lineHeight: 1 }}>{sc.score ?? '—'}</div>
          <div style={{ fontSize: 12, color: t.fg, fontWeight: 600 }}>{t.lbl}</div>
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ color: '#e5b567', fontSize: 16 }}>{sc.reviews ? `${starStr(sc.rating)} ${sc.rating}` : L('Aún sin reseñas', 'No reviews yet')}</div>
          <div style={{ fontSize: 12.5, color: 'var(--mut,#9aa6bd)', marginTop: 2 }}>{L('Tu puntaje mide reseñas, conversión, actividad, atención y retención.', 'Your score blends reviews, conversion, activity, support and retention.')}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {mini(L('Clientes activos', 'Active clients'), `${sc.active}/${sc.clients}`, '#5ed6a0')}
        {mini(L('Conversión prueba', 'Trial conversion'), `${sc.trial_conv || 0}%`)}
        {mini(L('Tickets abiertos', 'Open tickets'), sc.tickets_open ?? 0)}
        {mini(L('Respuesta', 'Response'), sc.resp_hrs == null ? '—' : `${sc.resp_hrs}h`)}
        {mini(L('Comisión 30d', 'Commission 30d'), '$' + (sc.earned30 || 0), '#e5b567')}
      </div>
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <b style={{ color: 'var(--tx,#e8ecf5)' }}>{L('Consejo de la IA', 'AI coaching')}</b>
          <button style={btn} disabled={busy} onClick={ai}>{busy ? L('Analizando…', 'Analyzing…') : L('Generar consejo', 'Get coaching')}</button>
        </div>
        {ins && <div style={{ marginTop: 10 }}>
          <div style={{ fontWeight: 700, color: 'var(--tx,#e8ecf5)' }}>{ins.headline}</div>
          {ins.summary && <p style={{ fontSize: 13.5, color: 'var(--tx,#e8ecf5)', margin: '6px 0 0', lineHeight: 1.5 }}>{ins.summary}</p>}
          {!!(ins.actions || []).length && <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 13, color: 'var(--mut,#9aa6bd)' }}>{ins.actions.map((a: string, i: number) => <li key={i}>{a}</li>)}</ul>}
        </div>}
      </div>
      <div style={card}>
        <b style={{ color: 'var(--tx,#e8ecf5)' }}>{L('Reseñas de tus clientes', 'Your clients’ reviews')}</b>
        {!d.myReviews?.length ? <p style={{ color: 'var(--mut,#9aa6bd)', fontSize: 13 }}>{L('Aún no tienes reseñas.', 'No reviews yet.')}</p> :
          d.myReviews.map((r: any) => (
            <div key={r.id} style={{ borderTop: '1px solid var(--line,#2a3350)', padding: '8px 0' }}>
              <div style={{ color: '#e5b567', fontSize: 13 }}>{starStr(r.rating)} <span style={{ color: 'var(--mut,#9aa6bd)', fontSize: 11 }}>{new Date(r.created_at).toLocaleDateString()}</span></div>
              {r.comment && <div style={{ fontSize: 13, color: 'var(--tx,#e8ecf5)', marginTop: 2 }}>{r.comment}</div>}
            </div>
          ))}
      </div>
    </div>
  );
}

// ===== Evaluar (a mi supervisor y/o a mi equipo) =====
function Evaluate({ d, L, act, card, btn, btnP }: any) {
  const targets: any[] = [];
  if (d.mySupervisor) targets.push({ ...d.mySupervisor, dir: 'sup' });
  (d.evalTargets || []).forEach((t: any) => targets.push({ ...t, dir: 'rep' }));
  const [sel, setSel] = useState<string>(targets[0]?.id || '');
  const criteria: string[] = d.eval_criteria || [];
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comment, setComment] = useState('');
  const [done, setDone] = useState(false);
  const cur = targets.find((t) => t.id === sel);
  async function send() {
    await act({ action: 'submit_eval', ratee_rep_id: sel, scores, comment });
    setDone(true); setScores({}); setComment('');
  }
  if (!targets.length) return <div style={card}><p style={{ color: 'var(--mut,#9aa6bd)' }}>{L('No hay nadie a quien evaluar por ahora.', 'No one to evaluate right now.')}</p></div>;
  return (
    <div style={card}>
      <b style={{ color: 'var(--tx,#e8ecf5)' }}>{L('Evaluación', 'Evaluation')}</b>
      <div style={{ fontSize: 12.5, color: 'var(--mut,#9aa6bd)', margin: '4px 0 10px' }}>{L('Tu evaluación es privada y ayuda a mejorar al equipo.', 'Your evaluation is private and helps the team improve.')}</div>
      <select value={sel} onChange={(e) => { setSel(e.target.value); setDone(false); }} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line,#2a3350)', background: 'var(--bg,#0e1220)', color: 'var(--tx,#e8ecf5)', fontSize: 13, marginBottom: 12 }}>
        {targets.map((t) => <option key={t.id} value={t.id}>{t.name}{t.dir === 'sup' ? L(' (mi supervisor)', ' (my supervisor)') : ''}</option>)}
      </select>
      {criteria.map((c) => (
        <div key={c} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderTop: '1px solid var(--line,#2a3350)' }}>
          <span style={{ fontSize: 13.5, color: 'var(--tx,#e8ecf5)' }}>{c}</span>
          <span style={{ display: 'flex', gap: 3 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setScores((s) => ({ ...s, [c]: n }))} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: (scores[c] || 0) >= n ? '#e5b567' : 'var(--line,#3a4363)', padding: 0 }}>{(scores[c] || 0) >= n ? '★' : '☆'}</button>
            ))}
          </span>
        </div>
      ))}
      <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder={L('Comentario (opcional)', 'Comment (optional)')} style={{ width: '100%', minHeight: 60, resize: 'vertical', marginTop: 10, padding: '9px 11px', borderRadius: 9, border: '1px solid var(--line,#2a3350)', background: 'var(--bg,#0e1220)', color: 'var(--tx,#e8ecf5)', fontSize: 13.5 }} />
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10 }}>
        <button style={btnP} disabled={!Object.keys(scores).length} onClick={send}>{L('Enviar evaluación', 'Submit evaluation')}</button>
        {done && <span style={{ color: 'var(--green,#5ed6a0)', fontSize: 13 }}>{L('¡Gracias! Evaluación guardada.', 'Thanks! Evaluation saved.')}</span>}
      </div>
    </div>
  );
}
