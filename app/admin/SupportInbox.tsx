'use client';
import { useEffect, useState } from 'react';
import { useT } from '@/lib/adminText';

const stColor: any = { open: 'var(--brand)', in_progress: 'var(--amber)', resolved: 'var(--green)' };
const stBg: any = { open: 'rgba(124,140,255,.15)', in_progress: 'rgba(255,192,77,.15)', resolved: 'rgba(52,226,160,.15)' };
const initials = (email: string) => (email || '?').replace(/@.*/, '').slice(0, 2).toUpperCase();

export default function SupportInbox() {
  const t = useT();
  const ST: any = { open: t.st_open, in_progress: t.st_inprogress, resolved: t.st_resolved };
  const CATS: any = { general: t.cat_general, conexion: t.cat_conexion, instalacion: t.cat_instalacion, guardian: t.cat_guardian, facturacion: t.cat_facturacion };
  const CH: any = { ticket: t.ch_ticket, chat: t.ch_chat, lead: t.ch_lead, email: t.ch_email };
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
      <div className="tabhead"><div className="th-row"><span className="th-ic">🎫</span><span className="th-t">{t.h_soporte_t}</span></div><div className="th-s">{t.h_soporte_s}</div></div>

      <div className="row" style={{ gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {([['open', t.s_open], ['in_progress', t.s_inprogress], ['resolved', t.s_resolved], ['all', t.s_all]] as any).map(([k, l]: any) => (
          <button key={k} className={'segbtn' + (filter === k ? ' on-view' : '')} style={{ padding: '6px 12px', fontSize: 13, background: filter === k ? undefined : 'var(--card2)' }} onClick={() => setFilter(k)}>
            {l}{k !== 'all' && counts[k] != null ? ` (${counts[k]})` : ''}
          </button>
        ))}
        <input placeholder={t.s_search} value={q} onChange={(e) => setQ(e.target.value)} style={{ margin: 0, maxWidth: 260, marginLeft: 'auto' }} />
      </div>

      <div className="helpdesk">
        {/* Cola de conversaciones */}
        <div>
          {!list.length && <p className="muted" style={{ fontSize: 14 }}>{t.s_empty}</p>}
          {list.map((it) => {
            const parts = participants.filter((p) => p.ticket_id === it.id);
            return (
              <div key={it.id} className={'hd-item' + (openId === it.id ? ' on' : '')} onClick={() => { setOpenId(it.id); setText(''); }}>
                <div className="row between" style={{ gap: 8 }}>
                  <b style={{ fontSize: 13 }}>{it.subject}</b>
                  <span className="pill" style={{ color: stColor[it.status], background: stBg[it.status] }}>● {ST[it.status]}</span>
                </div>
                <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>{it.email || '—'} · {it.assignee_id ? t.s_assignedTo + emailOf(it.assignee_id).split('@')[0] : t.s_unassigned}</div>
                <div className="row" style={{ gap: 5, marginTop: 6, flexWrap: 'wrap' }}>
                  {it.is_lead && <span className="pill brand">Lead</span>}
                  <span className="pill gray">{CH[it.channel] || it.channel}</span>
                  {parts.length > 0 && <span className="pill gray">👥 {parts.length}</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Conversación abierta */}
        <div className="card" style={{ minHeight: 260 }}>
          {!tk && <div className="muted" style={{ display: 'flex', height: 220, alignItems: 'center', justifyContent: 'center', fontSize: 14, textAlign: 'center' }}>{t.s_pickOne}</div>}
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
                      <div style={{ fontWeight: 600 }}>{tk.email || t.s_visitor}</div>
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
                        <div style={{ fontSize: 11, opacity: .8, marginBottom: 2, color: note ? 'var(--amber)' : undefined }}>{m.sender === 'user' ? t.sender_trader : m.sender === 'ai' ? 'Onyx AI' : note ? t.sender_note : t.sender_support} · {new Date(m.created_at).toLocaleTimeString()}</div>
                        {m.body}
                      </div>
                    );
                  })}
                </div>

                {parts.length > 0 && <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>👥 {t.s_inConvo}{parts.map((p) => emailOf(p.user_id).split('@')[0]).join(', ')}</div>}

                {/* Redactar */}
                <div className="row" style={{ gap: 6, marginBottom: 6 }}>
                  <div className="seg">
                    <button className={'segbtn' + (mode === 'reply' ? ' on-view' : '')} onClick={() => setMode('reply')}>{t.s_reply}</button>
                    <button className={'segbtn' + (mode === 'note' ? ' on-view' : '')} onClick={() => setMode('note')}>🔒 {t.s_note}</button>
                  </div>
                </div>
                <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder={mode === 'note' ? t.s_notePh : t.s_replyPh} style={{ width: '100%', margin: '0 0 8px' }} />

                <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  {mode === 'reply'
                    ? <button className="btn btn-primary" onClick={() => act(tk.id, { body: text })} disabled={busy === tk.id || !text.trim()}>{t.s_sendReply}</button>
                    : <button className="btn btn-primary" onClick={() => act(tk.id, { note: text })} disabled={busy === tk.id || !text.trim()}>{t.s_saveNote}</button>}
                  <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => draft(tk.id, firstUser)} disabled={busy === 'ai' + tk.id}>{busy === 'ai' + tk.id ? '...' : '🤖 ' + t.s_aiDraft}</button>
                  {!tk.assignee_id && <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => act(tk.id, { take: true })}>{t.s_take}</button>}
                  <span style={{ flex: 1 }} />
                  {tk.status !== 'resolved' && <button className="btn btn-ghost" style={{ fontSize: 13, color: 'var(--green)' }} onClick={() => act(tk.id, { status: 'resolved' })}>{t.s_resolve}</button>}
                  {tk.status === 'resolved' && <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => act(tk.id, { status: 'open' })}>{t.s_reopen}</button>}
                </div>

                <div className="row" style={{ gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                  <input placeholder={t.s_invitePh} value={invite} onChange={(e) => setInvite(e.target.value)} style={{ margin: 0, maxWidth: 260, fontSize: 12 }} />
                  <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => act(tk.id, { invite_email: invite })} disabled={!invite.trim()}>{t.s_inviteBtn}</button>
                </div>
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
