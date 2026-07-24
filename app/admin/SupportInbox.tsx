'use client';
import { useEffect, useState } from 'react';

const ST: any = { open: 'Abierto', in_progress: 'En curso', resolved: 'Resuelto' };
const stColor: any = { open: 'var(--brand)', in_progress: 'var(--amber)', resolved: 'var(--green)' };
const stBg: any = { open: 'rgba(124,140,255,.15)', in_progress: 'rgba(255,192,77,.15)', resolved: 'rgba(52,226,160,.15)' };
const CATS: any = { general: 'General', conexion: 'Conexión', instalacion: 'Instalación', guardian: 'Onyx Guardian', facturacion: 'Facturación' };
const CH: any = { ticket: 'Ticket', chat: 'Chat', lead: 'Lead', email: 'Email' };

export default function SupportInbox() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [msgs, setMsgs] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [team, setTeam] = useState<any[]>([]);
  const [counts, setCounts] = useState<any>({});
  const [filter, setFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved' | 'mine'>('open');
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState('');
  const [text, setText] = useState('');
  const [mode, setMode] = useState<'reply' | 'note'>('reply');
  const [invite, setInvite] = useState('');
  const [busy, setBusy] = useState('');

  async function load() {
    try { const r = await fetch('/api/admin/support'); const j = await r.json(); setTickets(j.tickets || []); setMsgs(j.messages || []); setParticipants(j.participants || []); setTeam(j.team || []); setCounts(j.counts || {}); } catch {}
  }
  useEffect(() => { load(); }, []);

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

  let list = tickets.filter((t) => filter === 'all' || filter === 'mine' || t.status === filter);
  if (q.trim()) { const s = q.toLowerCase(); list = list.filter((t) => (t.email || '').toLowerCase().includes(s) || (t.subject || '').toLowerCase().includes(s)); }

  return (
    <div>
      <div className="row" style={{ gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        {([['open', 'Abiertos'], ['in_progress', 'En curso'], ['resolved', 'Resueltos'], ['all', 'Todos']] as any).map(([k, l]: any) => (
          <button key={k} className={'btn ' + (filter === k ? 'btn-primary' : 'btn-ghost')} style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => setFilter(k)}>
            {l}{k !== 'all' && counts[k] != null ? ` (${counts[k]})` : ''}
          </button>
        ))}
      </div>
      <input placeholder="Buscar trader por correo o asunto…" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 14, maxWidth: 340 }} />

      {!list.length && <p className="muted" style={{ fontSize: 14 }}>No hay conversaciones en esta vista.</p>}

      {list.map((tk) => {
        const tm = msgs.filter((m) => m.ticket_id === tk.id);
        const firstUser = tm.find((m) => m.sender === 'user')?.body || tk.subject;
        const parts = participants.filter((p) => p.ticket_id === tk.id);
        const open = openId === tk.id;
        return (
          <div key={tk.id} className="card" style={{ marginBottom: 10 }}>
            <div className="row between" style={{ gap: 8, flexWrap: 'wrap', cursor: 'pointer' }} onClick={() => setOpenId(open ? '' : tk.id)}>
              <div>
                <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <b>{tk.subject}</b>
                  {tk.is_lead && <span className="pill" style={{ color: 'var(--brand)', background: 'rgba(124,140,255,.15)' }}>Lead</span>}
                  <span className="pill" style={{ color: 'var(--mut)' }}>{CH[tk.channel] || tk.channel}</span>
                </div>
                <div className="muted" style={{ fontSize: 12 }}>{tk.email || '—'} · {CATS[tk.category] || tk.category} · {tk.assignee_id ? 'asignado a ' + emailOf(tk.assignee_id).split('@')[0] : 'sin asignar'} · {new Date(tk.updated_at).toLocaleString()}</div>
              </div>
              <span className="pill" style={{ color: stColor[tk.status], background: stBg[tk.status] }}>{ST[tk.status]}</span>
            </div>

            {open && (
              <div style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
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

                {/* Colaboradores */}
                {parts.length > 0 && <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>👥 En la conversación: {parts.map((p) => emailOf(p.user_id).split('@')[0]).join(', ')}</div>}

                {/* Redactar: responder o nota interna */}
                <div className="row" style={{ gap: 6, marginBottom: 6 }}>
                  <button className={'btn ' + (mode === 'reply' ? 'btn-primary' : 'btn-ghost')} style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setMode('reply')}>Responder al trader</button>
                  <button className={'btn ' + (mode === 'note' ? 'btn-primary' : 'btn-ghost')} style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setMode('note')}>🔒 Nota interna</button>
                </div>
                <textarea value={openId === tk.id ? text : ''} onChange={(e) => setText(e.target.value)} rows={4} placeholder={mode === 'note' ? 'Nota que solo ve el equipo…' : 'Respuesta para el trader (le llega por correo)…'} style={{ width: '100%', margin: '0 0 8px' }} />

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

                {/* Invitar compañero */}
                <div className="row" style={{ gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                  <input placeholder="Invitar compañero (su email de equipo)" value={invite} onChange={(e) => setInvite(e.target.value)} style={{ margin: 0, maxWidth: 260, fontSize: 12 }} />
                  <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => act(tk.id, { invite_email: invite })} disabled={!invite.trim()}>Invitar</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
