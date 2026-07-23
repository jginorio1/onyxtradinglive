'use client';
import { useEffect, useState } from 'react';

// Bandeja de soporte para el admin: ve todos los tickets, responde,
// cambia el estado y puede pedir a Onyx AI un borrador basado en la Guía.
const ST: any = { open: 'Abierto', in_progress: 'En curso', resolved: 'Resuelto' };
const stColor: any = { open: 'var(--brand)', in_progress: 'var(--amber)', resolved: 'var(--green)' };
const stBg: any = { open: 'rgba(124,140,255,.15)', in_progress: 'rgba(255,192,77,.15)', resolved: 'rgba(52,226,160,.15)' };
const CATS: any = { general: 'General', conexion: 'Conexión', instalacion: 'Instalación', guardian: 'Onyx Guardian', facturacion: 'Facturación' };

export default function SupportInbox() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [msgs, setMsgs] = useState<any[]>([]);
  const [counts, setCounts] = useState<any>({});
  const [filter, setFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved'>('open');
  const [openId, setOpenId] = useState('');
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState('');

  async function load() {
    try { const r = await fetch('/api/admin/support'); const j = await r.json(); setTickets(j.tickets || []); setMsgs(j.messages || []); setCounts(j.counts || {}); } catch {}
  }
  useEffect(() => { load(); }, []);

  async function act(id: string, patch: any) {
    setBusy(id);
    await fetch('/api/admin/support', { method: 'PATCH', body: JSON.stringify({ ticket_id: id, ...patch }) });
    setReply(''); setBusy(''); await load();
  }

  async function draft(id: string, firstUserMsg: string) {
    setBusy('ai' + id);
    try {
      const r = await fetch('/api/support/ai', { method: 'POST', body: JSON.stringify({ question: firstUserMsg, lang: 'es' }) });
      const j = await r.json();
      setReply(j.answer || '');
    } catch {}
    setBusy('');
  }

  const list = tickets.filter((t) => filter === 'all' || t.status === filter);
  const bubble = (sender: string) => sender === 'user'
    ? { background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10 }
    : { background: 'rgba(124,140,255,.10)', border: '1px solid var(--brand)', borderRadius: 10 };

  return (
    <div>
      <div className="row" style={{ gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {([['open', 'Abiertos'], ['in_progress', 'En curso'], ['resolved', 'Resueltos'], ['all', 'Todos']] as any).map(([k, l]: any) => (
          <button key={k} className={'btn ' + (filter === k ? 'btn-primary' : 'btn-ghost')} style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => setFilter(k)}>
            {l}{k !== 'all' && counts[k] != null ? ` (${counts[k]})` : ''}
          </button>
        ))}
      </div>

      {!list.length && <p className="muted" style={{ fontSize: 14 }}>No hay tickets en esta vista.</p>}

      {list.map((tk) => {
        const tm = msgs.filter((m) => m.ticket_id === tk.id);
        const firstUser = tm.find((m) => m.sender === 'user')?.body || tk.subject;
        const open = openId === tk.id;
        return (
          <div key={tk.id} className="card" style={{ marginBottom: 10 }}>
            <div className="row between" style={{ gap: 8, flexWrap: 'wrap', cursor: 'pointer' }} onClick={() => setOpenId(open ? '' : tk.id)}>
              <div>
                <div style={{ fontWeight: 700 }}>{tk.subject}</div>
                <div className="muted" style={{ fontSize: 12 }}>{tk.email || '—'} · {CATS[tk.category] || tk.category} · {new Date(tk.updated_at).toLocaleString()}</div>
              </div>
              <span className="pill" style={{ color: stColor[tk.status], background: stBg[tk.status] }}>{ST[tk.status]}</span>
            </div>

            {open && (
              <div style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                  {tm.map((m) => (
                    <div key={m.id} style={{ padding: '8px 11px', fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap', ...bubble(m.sender) }}>
                      <div style={{ fontSize: 11, opacity: .7, marginBottom: 2 }}>{m.sender === 'user' ? 'Trader' : m.sender === 'ai' ? 'Onyx AI' : 'Soporte'} · {new Date(m.created_at).toLocaleTimeString()}</div>
                      {m.body}
                    </div>
                  ))}
                </div>

                <textarea value={openId === tk.id ? reply : ''} onChange={(e) => setReply(e.target.value)} rows={3} placeholder="Escribe tu respuesta…" style={{ width: '100%', margin: '0 0 8px' }} />
                <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn btn-primary" onClick={() => act(tk.id, { body: reply })} disabled={busy === tk.id || !reply.trim()}>Responder</button>
                  <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => draft(tk.id, firstUser)} disabled={busy === 'ai' + tk.id}>{busy === 'ai' + tk.id ? '...' : '🤖 Borrador IA'}</button>
                  <span style={{ flex: 1 }} />
                  {tk.status !== 'in_progress' && <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => act(tk.id, { status: 'in_progress' })}>Marcar en curso</button>}
                  {tk.status !== 'resolved' && <button className="btn btn-ghost" style={{ fontSize: 13, color: 'var(--green)' }} onClick={() => act(tk.id, { status: 'resolved' })}>Resolver</button>}
                  {tk.status === 'resolved' && <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => act(tk.id, { status: 'open' })}>Reabrir</button>}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
