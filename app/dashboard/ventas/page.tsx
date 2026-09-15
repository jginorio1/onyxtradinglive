'use client';
import { useEffect, useState } from 'react';

// Icono "?" con explicación (clic para abrir/cerrar; title como respaldo).
function Hint({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: 'relative', display: 'inline-flex', verticalAlign: 'middle', marginLeft: 5 }}>
      <button type="button" title={text} aria-label="Ayuda"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(!open); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        style={{ width: 16, height: 16, borderRadius: '50%', border: '1px solid var(--line,#3a4363)', background: 'var(--card,#1b2338)', color: 'var(--mut,#9aa6bd)', fontSize: 10.5, lineHeight: '14px', cursor: 'pointer', padding: 0, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>?</button>
      {open && <span style={{ position: 'absolute', bottom: '135%', left: '50%', transform: 'translateX(-50%)', width: 240, maxWidth: '75vw', background: 'var(--panel,#161c2e)', border: '1px solid var(--accent,#8b93ff)', borderRadius: 10, padding: '9px 11px', fontSize: 12, color: 'var(--tx,#e8ecf5)', lineHeight: 1.5, zIndex: 80, boxShadow: '0 8px 30px rgba(0,0,0,.45)', fontWeight: 400, whiteSpace: 'normal', textAlign: 'left' }}>{text}</span>}
    </span>
  );
}

// Panel del VENDEDOR / SUPERVISOR. Sus clientes, comisiones, dar prueba/descuento,
// atender tickets, su equipo y cobros (Stripe Connect o USDT).
export default function VentasPanel() {
  const [d, setD] = useState<any>(null);
  const [tab, setTab] = useState<'resumen' | 'desempeno' | 'extracto' | 'clientes' | 'equipo' | 'evaluar' | 'soporte' | 'cobros' | 'kit' | 'guia'>('resumen');
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
        {tabBtn('extracto', L('Extracto', 'Statement'))}
        {tabBtn('clientes', L('Mis clientes', 'My clients') + ` (${d.clients.length})`)}
        {d.team.length > 0 && tabBtn('equipo', L('Mi equipo', 'My team'))}
        {((d.evalTargets && d.evalTargets.length) || d.mySupervisor) && tabBtn('evaluar', L('Evaluar', 'Evaluate'))}
        {tabBtn('soporte', L('Soporte', 'Support') + (d.tickets.length ? ` (${d.tickets.length})` : ''))}
        {tabBtn('cobros', L('Cobros', 'Payouts'))}
        {d.kit && d.kit.length > 0 && tabBtn('kit', L('Kit', 'Kit'))}
        {tabBtn('guia', L('Guía', 'Guide'))}
      </div>

      {tab === 'resumen' && <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {stat(L('Clientes activos', 'Active clients'), String(d.activeClients))}
          {stat(L('Disponible', 'Available'), '$' + (b.available || 0))}
          {stat(L('En espera', 'Pending'), '$' + (b.pending || 0))}
          {stat(L('Pagado', 'Paid'), '$' + (b.paid || 0))}
        </div>
        {d.goal && (d.goal.target_clients > 0 || d.goal.target_amount > 0) && <GoalCard g={d.goal} L={L} card={card} />}
        <div style={card}>
          <div style={{ fontSize: 13, color: 'var(--mut,#9aa6bd)', marginBottom: 6, display: 'flex', alignItems: 'center' }}><span>{L('Tu enlace de invitación (quien se registre por aquí queda atado a ti):', 'Your invite link (anyone who signs up here is attributed to you):')}</span><Hint text={L('Comparte este enlace. Todo el que se registre a través de él queda como tu cliente de por vida y cobras comisión cada mes que pague. Es tu herramienta #1.', 'Share this link. Anyone who signs up through it becomes your client for life and you earn commission every month they pay. This is your #1 tool.')} /></div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input readOnly value={d.link} style={{ flex: 1, minWidth: 220, padding: '9px 12px', borderRadius: 9, border: '1px solid var(--line,#2a3350)', background: 'var(--bg,#0e1220)', color: 'var(--tx,#e8ecf5)', fontSize: 13 }} />
            <button style={btnP} onClick={() => { navigator.clipboard.writeText(d.link); setMsg(L('Enlace copiado ✓', 'Link copied ✓')); }}>{L('Copiar', 'Copy')}</button>
          </div>
        </div>
        {d.perms?.can_recruit && (() => {
          const origin = typeof window !== 'undefined' ? window.location.origin : '';
          const recruitLink = `${origin}/unete-ventas?sponsor=${d.rep.code}`;
          return (
            <div style={{ ...card, borderColor: 'var(--accent,#8b93ff)' }}>
              <div style={{ fontSize: 13, color: 'var(--tx,#e8ecf5)', fontWeight: 600, display: 'flex', alignItems: 'center' }}>{L('Arma tu equipo de ventas', 'Build your sales team')}<Hint text={L('Este enlace es para RECLUTAR vendedores para tu equipo (distinto al de invitar clientes). Quien aplique por aquí queda marcado como tuyo y se cuelga de tu rama; tú cobras override sobre lo que venda.', 'This link is to RECRUIT sellers into your team (different from the client invite link). Anyone who applies here is tagged as yours and joins your branch; you earn override on what they sell.')} /></div>
              <div style={{ fontSize: 12, color: 'var(--mut,#9aa6bd)', margin: '3px 0 8px' }}>{L('Comparte este enlace con quien quiera vender contigo:', 'Share this link with anyone who wants to sell with you:')}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input readOnly value={recruitLink} style={{ flex: 1, minWidth: 220, padding: '9px 12px', borderRadius: 9, border: '1px solid var(--line,#2a3350)', background: 'var(--bg,#0e1220)', color: 'var(--tx,#e8ecf5)', fontSize: 13 }} />
                <button style={btnP} onClick={() => { navigator.clipboard.writeText(recruitLink); setMsg(L('Enlace de reclutamiento copiado ✓', 'Recruit link copied ✓')); }}>{L('Copiar', 'Copy')}</button>
              </div>
            </div>
          );
        })()}
      </div>}

      {tab === 'desempeno' && <MyPerf d={d} L={L} act={act} card={card} btn={btn} btnP={btnP} />}

      {tab === 'extracto' && <Statement rows={d.statement || []} L={L} card={card} />}

      {tab === 'evaluar' && <Evaluate d={d} L={L} act={act} card={card} btn={btn} btnP={btnP} />}

      {tab === 'clientes' && <div style={card}>
        <div style={{ fontSize: 13, color: 'var(--mut,#9aa6bd)', marginBottom: 10 }}>{L('Puedes darles prueba (hasta', 'You can grant a trial (up to')} {d.caps.trial_max_days} {L('días) o generar un descuento (hasta', 'days) or generate a discount (up to')} {d.caps.discount_max_pct}%).</div>
        <ClientList d={d} L={L} act={act} />
        <div style={{ marginTop: 14, borderTop: '1px solid var(--line,#2a3350)', paddingTop: 12 }}>
          <b style={{ color: 'var(--tx,#e8ecf5)', fontSize: 14 }}>{L('Generar cupón de descuento', 'Generate a discount coupon')}<Hint text={L('Crea un código de descuento para cerrar una venta. Tiene un tope de % y un límite de cuántos puedes generar al día. El descuento baja el precio y la comisión se calcula sobre lo que el cliente realmente paga.', 'Create a discount code to close a sale. It has a max % and a daily limit. The discount lowers the price, and commission is calculated on what the client actually pays.')} /></b>
          <DiscountBox d={d} L={L} act={act} />
        </div>
      </div>}

      {tab === 'equipo' && <div style={card}>
        <b style={{ color: 'var(--tx,#e8ecf5)' }}>{L('Tu equipo', 'Your team')}<Hint text={L('Las personas debajo de ti en la red, con sus clientes y su saldo. Ganas un override (comisión extra) sobre lo que ellos venden.', 'The people below you in the network, with their clients and balance. You earn an override (extra commission) on what they sell.')} /></b>
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
        <b style={{ color: 'var(--tx,#e8ecf5)' }}>{L('Tickets de tus clientes', 'Your clients’ tickets')}<Hint text={L('Dudas y problemas abiertos por tus clientes. Respóndeles rápido aquí: la atención cuenta para tu puntaje y ayuda a que no se den de baja.', 'Questions and issues opened by your clients. Reply fast here: support counts toward your score and helps prevent churn.')} /></b>
        {d.tickets.length === 0 ? <p style={{ color: 'var(--mut,#9aa6bd)' }}>{L('No hay tickets abiertos. ¡Todo al día!', 'No open tickets. All good!')}</p> :
          d.tickets.map((t: any) => <TicketRow key={t.id} t={t} L={L} act={act} />)}
      </div>}

      {tab === 'cobros' && <div style={{ display: 'grid', gap: 12 }}>
        <ContractBox d={d} L={L} act={act} card={card} btn={btn} btnP={btnP} />
        <PayoutBox d={d} L={L} act={act} btn={btn} btnP={btnP} card={card} />
      </div>}

      {tab === 'kit' && <KitTab kit={d.kit || []} lang={lang} L={L} card={card} btn={btn} setMsg={setMsg} />}

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
  const [openNotes, setOpenNotes] = useState<string>('');
  return (
    <div>
      {d.clients.length === 0 && <p style={{ color: 'var(--mut,#9aa6bd)' }}>{L('Aún no tienes clientes. Comparte tu enlace.', 'No clients yet. Share your link.')}</p>}
      {d.clients.map((c: any) => (
        <div key={c.user_id} style={{ borderTop: '1px solid var(--line,#2a3350)', padding: '10px 0' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ color: 'var(--tx,#e8ecf5)', fontSize: 14 }}>{c.email || c.name || c.user_id.slice(0, 8)}</div>
              <div style={{ fontSize: 12, color: c.active ? 'var(--green,#5ed6a0)' : 'var(--mut,#9aa6bd)' }}>{c.active ? L('activo · ', 'active · ') + c.plan : (c.plan || 'free')}</div>
            </div>
            <input type="number" min={1} max={d.caps.trial_max_days} placeholder={L('días', 'days')} value={days[c.user_id] || ''} onChange={(e) => setDays((s) => ({ ...s, [c.user_id]: parseInt(e.target.value, 10) || 0 }))}
              style={{ width: 70, padding: '7px 9px', borderRadius: 8, border: '1px solid var(--line,#2a3350)', background: 'var(--bg,#0e1220)', color: 'var(--tx,#e8ecf5)', fontSize: 13 }} />
            <button onClick={() => act({ action: 'grant_trial', client_user_id: c.user_id, days: days[c.user_id] || d.caps.trial_max_days })}
              style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--line,#2a3350)', background: 'var(--card,#1b2338)', color: 'var(--tx,#e8ecf5)', cursor: 'pointer', fontSize: 12.5 }}>{L('Dar prueba', 'Give trial')}</button>
            <button onClick={() => setOpenNotes(openNotes === c.user_id ? '' : c.user_id)}
              style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--line,#2a3350)', background: openNotes === c.user_id ? 'var(--accent,#8b93ff)' : 'var(--card,#1b2338)', color: openNotes === c.user_id ? '#fff' : 'var(--tx,#e8ecf5)', cursor: 'pointer', fontSize: 12.5 }}>{L('Notas', 'Notes')}</button>
          </div>
          {openNotes === c.user_id && <NotesPanel clientId={c.user_id} L={L} />}
        </div>
      ))}
    </div>
  );
}

// Mini-CRM: notas y recordatorio de seguimiento por cliente.
function NotesPanel({ clientId, L }: any) {
  const [notes, setNotes] = useState<any[]>([]);
  const [note, setNote] = useState('');
  const [follow, setFollow] = useState('');
  const [busy, setBusy] = useState(true);
  async function post(body: any) { const r = await fetch('/api/sales', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); return r.json(); }
  async function load() { setBusy(true); try { const j = await post({ action: 'client_notes', client_user_id: clientId }); setNotes(j.notes || []); } catch {} setBusy(false); }
  useEffect(() => { load(); }, []);
  const inp: React.CSSProperties = { padding: '7px 10px', borderRadius: 8, border: '1px solid var(--line,#2a3350)', background: 'var(--bg,#0e1220)', color: 'var(--tx,#e8ecf5)', fontSize: 13 };
  return (
    <div style={{ marginTop: 8, background: 'var(--bg,#0e1220)', borderRadius: 10, padding: 10 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={L('Nueva nota…', 'New note…')} style={{ ...inp, flex: 1, minWidth: 160 }} />
        <input type="date" value={follow} onChange={(e) => setFollow(e.target.value)} title={L('Recordatorio', 'Reminder')} style={{ ...inp, width: 150 }} />
        <button onClick={async () => { if (note.trim() || follow) { await post({ action: 'add_note', client_user_id: clientId, note, followup_at: follow ? new Date(follow).toISOString() : null }); setNote(''); setFollow(''); load(); } }}
          style={{ padding: '7px 12px', borderRadius: 8, border: 'none', background: 'var(--accent,#8b93ff)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 12.5 }}>{L('Guardar', 'Save')}</button>
      </div>
      {busy ? <div style={{ color: 'var(--mut,#9aa6bd)', fontSize: 12, marginTop: 8 }}>…</div> :
        notes.length === 0 ? <div style={{ color: 'var(--mut,#9aa6bd)', fontSize: 12, marginTop: 8 }}>{L('Sin notas aún.', 'No notes yet.')}</div> :
          <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
            {notes.map((n: any) => (
              <div key={n.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5 }}>
                <input type="checkbox" checked={!!n.done} onChange={async () => { await post({ action: 'note_done', note_id: n.id, done: !n.done }); load(); }} style={{ marginTop: 2 }} />
                <div style={{ flex: 1 }}>
                  <span style={{ color: 'var(--tx,#e8ecf5)', textDecoration: n.done ? 'line-through' : 'none' }}>{n.note}</span>
                  {n.followup_at && <span style={{ color: '#e5b567', fontSize: 11, marginLeft: 6 }}>⏰ {new Date(n.followup_at).toLocaleDateString()}</span>}
                </div>
              </div>
            ))}
          </div>}
    </div>
  );
}

// Kit de materiales de venta (guiones copiables, enlaces, imágenes).
function KitTab({ kit, lang, L, card, btn, setMsg }: any) {
  const items = (kit || []).filter((a: any) => a.lang === 'all' || a.lang === lang);
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={card}>
        <b style={{ color: 'var(--tx,#e8ecf5)' }}>{L('Kit de ventas', 'Sales kit')}</b>
        <div style={{ fontSize: 12.5, color: 'var(--mut,#9aa6bd)', marginTop: 3 }}>{L('Guiones, plantillas y materiales para vender mejor.', 'Scripts, templates and materials to sell better.')}</div>
      </div>
      {items.length === 0 && <div style={card}><p style={{ color: 'var(--mut,#9aa6bd)' }}>{L('Aún no hay materiales.', 'No materials yet.')}</p></div>}
      {items.map((a: any) => (
        <div key={a.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <b style={{ color: 'var(--tx,#e8ecf5)', fontSize: 14 }}>{a.title}</b>
            <span style={{ fontSize: 11, color: 'var(--mut,#9aa6bd)', textTransform: 'uppercase' }}>{a.kind}</span>
          </div>
          {a.kind === 'image' && a.url && <img src={a.url} alt={a.title} style={{ maxWidth: '100%', borderRadius: 10, marginTop: 8 }} />}
          {a.body && <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: 'var(--tx,#e8ecf5)', marginTop: 8, lineHeight: 1.5, background: 'var(--bg,#0e1220)', borderRadius: 8, padding: 10 }}>{a.body}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            {a.body && <button style={btn} onClick={() => { navigator.clipboard.writeText(a.body); setMsg(L('Copiado ✓', 'Copied ✓')); }}>{L('Copiar texto', 'Copy text')}</button>}
            {a.url && <a href={a.url} target="_blank" rel="noopener" style={{ ...btn, textDecoration: 'none' }}>{L('Abrir enlace', 'Open link')}</a>}
          </div>
        </div>
      ))}
    </div>
  );
}

// Contrato + datos fiscales + perfil público para el landing personalizado.
function ContractBox({ d, L, act, card, btn, btnP }: any) {
  const r = d.rep || {};
  const [name, setName] = useState(r.contract_name || r.display_name || '');
  const [bio, setBio] = useState(r.bio || '');
  const [photo, setPhoto] = useState(r.photo_url || '');
  const td = r.tax_data || {};
  const [taxType, setTaxType] = useState(r.tax_form_type || 'none');
  const [legal, setLegal] = useState(td.legal_name || '');
  const [country, setCountry] = useState(td.country || '');
  const [last4, setLast4] = useState(td.tax_id_last4 || '');
  const signed = !!r.contract_signed_at;
  const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid var(--line,#2a3350)', background: 'var(--bg,#0e1220)', color: 'var(--tx,#e8ecf5)', fontSize: 13, marginTop: 6 };
  return (
    <div style={{ ...card, borderColor: signed ? (card.border as string) : 'var(--amber,#f0b74e)' }}>
      <b style={{ color: 'var(--tx,#e8ecf5)' }}>{L('Contrato, fiscal y tu perfil', 'Contract, tax & your profile')}</b>
      {!signed && <div style={{ fontSize: 12.5, color: 'var(--amber,#f0b74e)', marginTop: 4 }}>{L('Firma tu acuerdo de comisionista para poder cobrar.', 'Sign your contractor agreement to get paid.')}</div>}

      <div style={{ marginTop: 12 }}>
        <label style={{ fontSize: 12.5, color: 'var(--mut,#9aa6bd)' }}>{L('Nombre legal (firma del acuerdo)', 'Legal name (agreement signature)')}
          <input value={name} onChange={(e) => setName(e.target.value)} style={inp} /></label>
        {signed
          ? <div style={{ fontSize: 12.5, color: 'var(--green,#5ed6a0)', marginTop: 8 }}>{L('✓ Firmado el ', '✓ Signed on ')}{new Date(r.contract_signed_at).toLocaleDateString()} {L('por', 'by')} {r.contract_name}</div>
          : <button style={{ ...btnP, marginTop: 8 }} onClick={async () => { if (name.trim()) await act({ action: 'sign_contract', name }); }}>{L('Aceptar y firmar el acuerdo', 'Accept & sign agreement')}</button>}
      </div>

      <div style={{ marginTop: 16, borderTop: '1px solid var(--line,#2a3350)', paddingTop: 12 }}>
        <b style={{ color: 'var(--tx,#e8ecf5)', fontSize: 13.5 }}>{L('Datos fiscales', 'Tax info')}</b>
        <div style={{ fontSize: 11.5, color: 'var(--mut,#9aa6bd)', margin: '2px 0 6px' }}>{L('No pongas números completos; solo los últimos 4.', 'Never full numbers; last 4 only.')}</div>
        <select value={taxType} onChange={(e) => setTaxType(e.target.value)} style={inp}>
          <option value="none">{L('Sin definir', 'Not set')}</option><option value="w9">W-9 (EE. UU.)</option><option value="w8">W-8 ({L('fuera EE. UU.', 'non-US')})</option><option value="other">{L('Otro', 'Other')}</option>
        </select>
        <input value={legal} onChange={(e) => setLegal(e.target.value)} placeholder={L('Nombre/razón fiscal', 'Legal/tax name')} style={inp} />
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder={L('País', 'Country')} style={{ ...inp, flex: 1 }} />
          <input value={last4} onChange={(e) => setLast4(e.target.value.slice(0, 4))} placeholder={L('ID fiscal (últimos 4)', 'Tax ID (last 4)')} style={{ ...inp, flex: 1 }} />
        </div>
        <button style={{ ...btn, marginTop: 8 }} onClick={() => act({ action: 'save_tax', form_type: taxType, tax_data: { legal_name: legal, country, tax_id_last4: last4 } })}>{L('Guardar fiscal', 'Save tax')}</button>
      </div>

      <div style={{ marginTop: 16, borderTop: '1px solid var(--line,#2a3350)', paddingTop: 12 }}>
        <b style={{ color: 'var(--tx,#e8ecf5)', fontSize: 13.5 }}>{L('Tu perfil (landing con tu enlace)', 'Your profile (landing with your link)')}</b>
        <div style={{ fontSize: 11.5, color: 'var(--mut,#9aa6bd)', margin: '2px 0 6px' }}>{L('Quien entre con tu enlace verá tu nombre y esto.', 'Whoever opens your link sees your name and this.')}</div>
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder={L('Breve presentación (2 líneas)', 'Short intro (2 lines)')} style={{ ...inp, minHeight: 54, resize: 'vertical' }} />
        <input value={photo} onChange={(e) => setPhoto(e.target.value)} placeholder={L('URL de tu foto (opcional)', 'Photo URL (optional)')} style={inp} />
        <button style={{ ...btn, marginTop: 8 }} onClick={() => act({ action: 'save_profile', bio, photo_url: photo })}>{L('Guardar perfil', 'Save profile')}</button>
      </div>
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
        <b style={{ color: 'var(--tx,#e8ecf5)' }}>{L('Cómo quieres cobrar', 'How you want to get paid')}<Hint text={L('Elige Stripe (banco/tarjeta, pago automático al conectar tu cuenta) o USDT (cripto). Sin un método conectado, tu saldo se acumula pero no se puede pagar.', 'Choose Stripe (bank/card, automatic once connected) or USDT (crypto). Without a connected method, your balance accrues but can’t be paid out.')} /></b>
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

// ===== Meta del mes (barra de progreso) =====
function GoalCard({ g, L, card }: any) {
  const pctC = g.target_clients > 0 ? Math.min(100, Math.round((g.clients / g.target_clients) * 100)) : null;
  const pctA = g.target_amount > 0 ? Math.min(100, Math.round((g.amount / g.target_amount) * 100)) : null;
  const bar = (label: string, cur: string, tgt: string, pct: number) => (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--mut,#9aa6bd)' }}>
        <span>{label}</span><span style={{ color: 'var(--tx,#e8ecf5)' }}>{cur} / {tgt}</span>
      </div>
      <div style={{ height: 9, borderRadius: 6, background: 'var(--bg,#0e1220)', marginTop: 4, overflow: 'hidden' }}>
        <div style={{ width: pct + '%', height: '100%', borderRadius: 6, background: pct >= 100 ? 'var(--green,#5ed6a0)' : 'var(--accent,#8b93ff)', transition: 'width .4s' }} />
      </div>
    </div>
  );
  return (
    <div style={{ ...card, borderColor: g.met ? 'var(--green,#5ed6a0)' : (card.border as string) }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
        <b style={{ color: 'var(--tx,#e8ecf5)' }}>{L('Meta del mes', 'Monthly goal')}</b>
        {g.bonus_amount > 0 && <span style={{ fontSize: 12.5, color: g.met ? 'var(--green,#5ed6a0)' : '#e5b567' }}>{g.met ? L('¡Bono ganado! ', 'Bonus earned! ') : L('Bono al cumplir: ', 'Bonus on hit: ')}${g.bonus_amount}</span>}
      </div>
      {pctC != null && bar(L('Clientes nuevos', 'New clients'), String(g.clients), String(g.target_clients), pctC)}
      {pctA != null && bar(L('Comisión generada', 'Commission earned'), '$' + g.amount, '$' + g.target_amount, pctA)}
    </div>
  );
}

// ===== Extracto (comisiones línea por línea) =====
function Statement({ rows, L, card }: any) {
  const badge = (st: string) => {
    const m: Record<string, [string, string]> = {
      paid: ['#5ed6a0', L('Pagado', 'Paid')], available: ['#8b93ff', L('Disponible', 'Available')],
      pending: ['#9aa6bd', L('Madurando', 'Maturing')], reversed: ['#f0736f', L('Reversado', 'Reversed')],
    };
    const [c, t] = m[st] || ['#9aa6bd', st];
    return <span style={{ color: c, fontSize: 12, fontWeight: 600 }}>{t}</span>;
  };
  const lvl = (l: string) => l === 'override1' ? 'Ov.1' : l === 'override2' ? 'Ov.2' : l === 'bonus' ? L('Bono', 'Bonus') : L('Directo', 'Direct');
  return (
    <div style={card}>
      <b style={{ color: 'var(--tx,#e8ecf5)' }}>{L('Extracto de comisiones', 'Commission statement')}</b>
      <div style={{ fontSize: 12.5, color: 'var(--mut,#9aa6bd)', margin: '4px 0 10px' }}>{L('Cada comisión: de qué cliente, sobre cuánto, tu % y en qué estado está.', 'Each commission: which client, on how much, your % and its status.')}</div>
      {!rows.length ? <p style={{ color: 'var(--mut,#9aa6bd)' }}>{L('Aún no hay comisiones.', 'No commissions yet.')}</p> :
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480, fontSize: 13 }}>
            <thead><tr style={{ color: 'var(--mut,#9aa6bd)', fontSize: 11.5, textAlign: 'left' }}>
              <th style={{ padding: '6px 6px' }}>{L('Cliente', 'Client')}</th>
              <th style={{ padding: '6px 6px' }}>{L('Nivel', 'Level')}</th>
              <th style={{ padding: '6px 6px', textAlign: 'right' }}>{L('Base', 'Base')}</th>
              <th style={{ padding: '6px 6px', textAlign: 'right' }}>%</th>
              <th style={{ padding: '6px 6px', textAlign: 'right' }}>{L('Tu comisión', 'Your cut')}</th>
              <th style={{ padding: '6px 6px' }}>{L('Estado', 'Status')}</th>
              <th style={{ padding: '6px 6px' }}>{L('Fecha', 'Date')}</th>
            </tr></thead>
            <tbody>
              {rows.map((r: any, i: number) => (
                <tr key={i} style={{ borderTop: '1px solid var(--line,#2a3350)' }}>
                  <td style={{ padding: '7px 6px', color: 'var(--tx,#e8ecf5)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.client}</td>
                  <td style={{ padding: '7px 6px', color: 'var(--mut,#9aa6bd)' }}>{lvl(r.level)}</td>
                  <td style={{ padding: '7px 6px', textAlign: 'right', color: 'var(--mut,#9aa6bd)' }}>{r.base ? '$' + r.base : '—'}</td>
                  <td style={{ padding: '7px 6px', textAlign: 'right', color: 'var(--mut,#9aa6bd)' }}>{r.pct ? r.pct + '%' : '—'}</td>
                  <td style={{ padding: '7px 6px', textAlign: 'right', color: r.status === 'reversed' ? '#f0736f' : 'var(--tx,#e8ecf5)', fontWeight: 600, textDecoration: r.status === 'reversed' ? 'line-through' : 'none' }}>${r.amount}</td>
                  <td style={{ padding: '7px 6px' }}>{badge(r.status)}</td>
                  <td style={{ padding: '7px 6px', color: 'var(--mut,#9aa6bd)', fontSize: 12 }}>{r.when ? new Date(r.when).toLocaleDateString() : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>}
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
