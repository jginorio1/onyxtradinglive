'use client';
import { useEffect, useState } from 'react';

const ST: any = { open: 'Abierto', in_progress: 'En curso', resolved: 'Resuelto' };
const stColor: any = { open: 'var(--brand)', in_progress: 'var(--amber)', resolved: 'var(--green)' };
const stBg: any = { open: 'rgba(124,140,255,.15)', in_progress: 'rgba(255,192,77,.15)', resolved: 'rgba(52,226,160,.15)' };
const CATS: any = { general: 'General', conexion: 'Conexión', instalacion: 'Instalación', guardian: 'Onyx Guardian', facturacion: 'Facturación' };
const CH: any = { ticket: 'Ticket', chat: 'Chat', lead: 'Lead', email: 'Email' };
const initials = (email: string) => (email || '?').replace(/@.*/, '').slice(0, 2).toUpperCase();

export default function SupportInbox() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [msgs, setMsgs] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [team, setTeam] = useState<any[]>([]);
  const [counts, setCounts] = useState<any>({});
  const [filter, setFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved'>('open');
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState('');
  const [text, setText] = useState('');
  const [mode, setMode] = useState<'reply' | 'note'>('reply');
  const [invite, setInvite] = useState('');
  const [busy, setBusy] = useState('');

  async function load() {
    try { const r = await fetch('/api/admin/support'); const j = await r.json(); setTickets(j.tickets || []); setMsgs(j.messages || []); setParticipants(j.participants || []); setTeam(j.team || []); setCounts(j.counts || {}); } catch {}
  }
  useEffect(() => { load(); const iv = setInterval(load, 8000); return () => clearInterval(iv); }, []);

  const emailOf = (id: string) => (team.find((t) => t.id === id) || {}).email || '—';

  async function act(id: string, patch: any) {
    setBusy(id);
    await fetch('/api/admin/support', { method: 'PATCH', body: JSON.stringify({ ticket_id: id, ...patch }) });
    setText(''); setInvite(''); setBusy(''); await load();
  }
  async function draft(id: string, firstUserMsg: string) {
    setBusy('ai' + id);
    try { const r = await fetch('/api/support/ai', { method: 'POST', body: JSON.stringify({ question: firstUserMsg, lang: 'es' }) }); const j = await r.json(); setText(j.answer || ''); setMode('reply'); } catch {}
    setBusy('');
  }

  let list = tickets.filter((t) => filter === 'all' || t.status === filter);
  if (q.trim()) { const s = q.toLowerCase(); list = list.filter((t) => (t.email || '').toLowerCase().includes(s) || (t.subject || '').toLowerCase().includes(s)); }

  const tk = tickets.find((t) => t.id === openId);

  return (
    <div>
      <div className="tabhead"><div className="th-row"><span className="th-ic">🎫</span><span className="th-t">Soporte</span></div><div className="th-s">Cola compartida — toma, responde, invita a un compañero.</div></div>

      <div className="row" style={{ gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {([['open', 'Abiertos'], ['in_progress', 'En curso'], ['resolved', 'Resueltos'], ['all', 'Todos']] as any).map(([k, l]: any) => (
          <button key={k} className={'segbtn' + (filter === k ? ' on-view' : '')} style={{ padding: '6px 12px', fontSize: 13, background: filter === k ? undefined : 'var(--card2)' }} onClick={() => setFilter(k)}>
            {l}{k !== 'all' && counts[k] != null ? ` (${counts[k]})` : ''}
          </button>
        ))}
        <input placeholder="Buscar por correo o asunto…" value={q} onChange={(e) => setQ(e.target.value)} style={{ margin: 0, maxWidth: 260, marginLeft: 'auto' }} />
      </div>

      <div className="helpdesk">
        {/* Cola de conversaciones */}
        <div>
          {!list.length && <p className="muted" style={{ fontSize: 14 }}>No hay conversaciones en esta vista.</p>}
          {list.map((t) => {
            const parts = participants.filter((p) => p.ticket_id === t.id);
            return (
              <div key={t.id} className={'hd-item' + (openId === t.id ? ' on' : '')} onClick={() => { setOpenId(t.id); setText(''); }}>
                <div className="row between" style={{ gap: 8 }}>
                  <b style={{ fontSize: 13 }}>{t.subject}</b>
                  <span className="pill" style={{ color: stColor[t.status], background: stBg[t.status] }}>● {ST[t.status]}</span>
                </div>
                <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>{t.email || '—'} · {t.assignee_id ? 'asignado a ' + emailOf(t.assignee_id).split('@')[0] : 'sin asignar'}</div>
                <div className="row" style={{ gap: 5, marginTop: 6, flexWrap: 'wrap' }}>
                  {t.is_lead && <span className="pill brand">Lead</span>}
                  <span className="pill gray">{CH[t.channel] || t.channel}</span>
                  {parts.length > 0 && <span className="pill gray">👥 {parts.length}</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Conversación abierta */}
        <div className="card" style={{ minHeight: 260 }}>
          {!tk && <div className="muted" style={{ display: 'flex', height: 220, alignItems: 'center', justifyContent: 'center', fontSize: 14, textAlign: 'center' }}>Elige una conversación de la izquierda para verla aquí.</div>}
          {tk && (() => {
            const tm = msgs.filter((m) => m.ticket_id === tk.id);
            const firstUser = tm.find((m) => m.sender === 'user')?.body || tk.subject;
            const parts = participants.filter((p) => p.ticket_id === tk.id);
            return (
              <>
                {/* Ficha del trader */}
                <div className="row between" style={{ flexWrap: 'wrap', gap: 8, paddingBottom: 12, borderBottom: '1px solid var(--line)' }}>
                  <div className="row" style={{ gap: 10 }}>
                    <span className="avatar-init">{initials(tk.email || '?')}</span>
                    <div>
                      <div style={{ fontWeight: 600 }}>{tk.email || 'Visitante'}</div>
                      <div className="muted" style={{ fontSize: 11.5 }}>{CATS[tk.category] || tk.category} · {CH[tk.channel] || tk.channel}{tk.is_lead ? ' · Lead' : ''}</div>
                    </div>
                  </div>
                  <span className="pill" style={{ color: stColor[tk.status], background: stBg[tk.status] }}>● {ST[tk.status]}</span>
                </div>

                {/* Hilo */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '12px 0' }}>
                  {tm.map((m) => {
                    const note = m.sender === 'note';
                    const style = note
                      ? { background: 'rgba(255,192,77,.10)', border: '1px dashed var(--amber)', borderRadius: 10 }
                      : m.sender === 'user' ? { background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10 }
                        : { background: 'rgba(124,140,255,.10)', border: '1px solid var(--brand)', borderRadius: 10 };
                    return (
                      <div key={m.id} style={{ padding: '8px 11px', fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap', ...style }}>
                        <div style={{ fontSize: 11, opacity: .8, marginBottom: 2, color: note ? 'var(--amber)' : undefined }}>{m.sender === 'user' ? 'Trader' : m.sender === 'ai' ? 'Onyx AI' : note ? '🔒 Nota interna' : 'Soporte'} · {new Date(m.created_at).toLocaleTimeString()}</div>
                        {m.body}
                      </div>
                    );
                  })}
                </div>

                {parts.length > 0 && <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>👥 En la conversación: {parts.map((p) => emailOf(p.user_id).split('@')[0]).join(', ')}</div>}

                {/* Redactar */}
                <div className="row" style={{ gap: 6, marginBottom: 6 }}>
                  <div className="seg">
                    <button className={'segbtn' + (mode === 'reply' ? ' on-view' : '')} onClick={() => setMode('reply')}>Responder</button>
                    <button className={'segbtn' + (mode === 'note' ? ' on-view' : '')} onClick={() => setMode('note')}>🔒 Nota interna</button>
                  </div>
                </div>
                <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder={mode === 'note' ? 'Nota que solo ve el equipo…' : 'Respuesta para el trader (le llega por correo)…'} style={{ width: '100%', margin: '0 0 8px' }} />

                <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  {mode === 'reply'
                    ? <button className="btn btn-primary" onClick={() => act(tk.id, { body: text })} disabled={busy === tk.id || !text.trim()}>Enviar respuesta</button>
                    : <button className="btn btn-primary" onClick={() => act(tk.id, { note: text })} disabled={busy === tk.id || !text.trim()}>Guardar nota</button>}
                  <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => draft(tk.id, firstUser)} disabled={busy === 'ai' + tk.id}>{busy === 'ai' + tk.id ? '...' : '🤖 Borrador IA'}</button>
                  {!tk.assignee_id && <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => act(tk.id, { take: true })}>Tomar</button>}
                  <span style={{ flex: 1 }} />
                  {tk.status !== 'resolved' && <button className="btn btn-ghost" style={{ fontSize: 13, color: 'var(--green)' }} onClick={() => act(tk.id, { status: 'resolved' })}>Resolver</button>}
                  {tk.status === 'resolved' && <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => act(tk.id, { status: 'open' })}>Reabrir</button>}
                </div>

                <div className="row" style={{ gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                  <input placeholder="Invitar compañero (su email de equipo)" value={invite} onChange={(e) => setInvite(e.target.value)} style={{ margin: 0, maxWidth: 260, fontSize: 12 }} />
                  <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => act(tk.id, { invite_email: invite })} disabled={!invite.trim()}>Invitar</button>
                </div>
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
