'use client';
// Chat en vivo del equipo: canales + mensajes directos, @menciones (compañero /
// cliente / ticket), adjuntar fotos y documentos, emojis, @Onyx AI y búsqueda por
// día. Reusa el motor ChatThread del soporte, con tiempo real por broadcast.
// Extras: añadir compañeros a la conversación, ver nombre + rol de cada miembro,
// y tener VARIOS chats abiertos a la vez (ventanas acopladas abajo).
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLang } from '@/lib/lang';
import ChatThread, { type ChatMsg, type Att, type MentionItem } from '@/app/components/ChatThread';
import { useChatRealtime, type Presence } from '@/lib/chatRealtime';

type Channel = { id: string; name: string; kind: string; topic?: string; unread: number; last: any; members: string[] };
type Member = { id: string; name: string; email: string; role: string; available: boolean; last_active: string };

const initials = (n?: string) => (n || '?').trim().split(/\s+/).slice(0, 2).map((s) => s[0]).join('').toUpperCase();

function roleLabel(role: string, en: boolean) {
  const m: any = { owner: en ? 'Owner' : 'Dueño', admin: 'Admin', support: en ? 'Support' : 'Soporte', marketing: 'Marketing', custom: en ? 'Team' : 'Equipo' };
  return m[role] || (en ? 'Team' : 'Equipo');
}

// Convierte los mensajes de la API a lo que espera ChatThread.
function toChat(rows: any[], me: string): ChatMsg[] {
  return rows.map((m) => ({
    id: m.id, mine: m.sender_id === me && m.sender_id != null,
    authorName: m.sender_name, authorKind: m.sender_id == null ? 'ai' : 'admin',
    body: m.body, attachments: m.attachments || [], createdAt: m.created_at,
  }));
}

const mentionSource = async (q: string): Promise<MentionItem[]> => {
  try { const r = await fetch('/api/team/mentions?q=' + encodeURIComponent(q)); const j = await r.json(); return j.items || []; } catch { return []; }
};

async function postMessage(channel: string, text: string, attachments: Att[]) {
  const mentions: any[] = [];
  if (/@onyx/i.test(text)) mentions.push({ type: 'user', id: 'onyx', label: 'Onyx AI' });
  const r = await fetch('/api/team/chat/messages', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ channel, body: text, attachments, mentions }) });
  return r.json().catch(() => ({}));
}

export default function TeamChat() {
  const { lang } = useLang();
  const en = lang === 'en';
  const L = (es: string, e: string) => (en ? e : es);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [team, setTeam] = useState<Member[]>([]);
  const [me, setMe] = useState('');
  const [active, setActive] = useState('');
  const [msgs, setMsgs] = useState<any[]>([]);
  const [date, setDate] = useState('');
  const [newCh, setNewCh] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [docks, setDocks] = useState<string[]>([]);   // canales abiertos como ventanas
  const loadedOnce = useRef(false);

  const teamById = useMemo(() => Object.fromEntries(team.map((t) => [t.id, t])), [team]);
  const meName = teamById[me]?.name || 'Yo';
  const meP: Presence | null = me ? { id: me, name: meName } : null;

  async function loadChannels() {
    try {
      const r = await fetch('/api/team/chat'); const j = await r.json();
      setChannels(j.channels || []); setTeam(j.team || []); setMe(j.me || '');
      if (!loadedOnce.current && (j.channels || []).length) { setActive(j.channels[0].id); loadedOnce.current = true; }
    } catch {}
  }
  async function loadMsgs(ch = active, d = date) {
    if (!ch) return;
    try {
      const qs = new URLSearchParams({ channel: ch }); if (d) qs.set('date', d);
      const r = await fetch('/api/team/chat/messages?' + qs.toString()); const j = await r.json();
      setMsgs(j.messages || []);
    } catch {}
    try { await fetch('/api/team/chat/read', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ channel: ch }) }); } catch {}
  }
  useEffect(() => { loadChannels(); const iv = setInterval(loadChannels, 15000); return () => clearInterval(iv); }, []);
  useEffect(() => { if (active) loadMsgs(active, date); }, [active, date]);

  const { online, typing, ping, sendTyping } = useChatRealtime(active ? `team:${active}` : null, meP, () => loadMsgs(active, date));
  const onlineIds = new Set(online.map((o) => o.id));

  async function send(text: string, attachments: Att[]) {
    const j = await postMessage(active, text, attachments);
    if (j.ok) { await loadMsgs(active, date); ping(); loadChannels(); }
  }

  const activeCh = channels.find((c) => c.id === active);
  const mapped = toChat(msgs, me);
  const typingLabel = typing.length ? `${typing.slice(0, 2).join(', ')} ${L('está escribiendo…', 'is typing…')}` : '';

  // Miembros de la conversación (con nombre + rol). Canal abierto = todo el equipo.
  const convoMembers: Member[] = activeCh
    ? (activeCh.kind === 'dm' ? activeCh.members.map((id) => teamById[id]).filter(Boolean) : team)
    : [];
  const canAdd = team.filter((t) => activeCh && activeCh.kind === 'dm' && !activeCh.members.includes(t.id));

  async function addMember(uid: string) {
    await fetch('/api/team/chat/members', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ channel: active, user_id: uid }) });
    setShowAdd(false); await loadChannels();
  }
  async function createChannel() {
    const name = newCh.trim(); if (!name) return;
    const r = await fetch('/api/team/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }) });
    const j = await r.json(); setNewCh(''); setShowNew(false);
    await loadChannels(); if (j.id) setActive(j.id);
  }
  // Abrir DM con un compañero (reusa uno existente si ya lo hay).
  async function openDM(otherId: string) {
    const existing = channels.find((c) => c.kind === 'dm' && c.members.length === 2 && c.members.includes(me) && c.members.includes(otherId));
    if (existing) { openDock(existing.id); return; }
    const r = await fetch('/api/team/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'dm', name: teamById[otherId]?.name || 'DM', members: [otherId] }) });
    const j = await r.json(); await loadChannels(); if (j.id) openDock(j.id);
  }
  function openDock(id: string) { setDocks((d) => (d.includes(id) ? d : [...d, id].slice(-3))); }
  function closeDock(id: string) { setDocks((d) => d.filter((x) => x !== id)); }

  return (
    <div style={{ maxWidth: 1140, margin: '0 auto' }}>
      <div className="row between" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 style={{ margin: 0 }}>💬 {L('Chat del equipo', 'Team chat')}</h2>
          <div className="muted" style={{ fontSize: 13 }}>{L('Habla con tu equipo, etiqueta clientes y tickets, y pregunta a @Onyx AI.', 'Talk to your team, tag clients and tickets, and ask @Onyx AI.')}</div>
        </div>
        <span className="pill" style={{ fontSize: 12, color: 'var(--soft-green)', background: 'rgba(52,226,160,.15)' }}>● {online.length} {L('en línea', 'online')}</span>
      </div>

      {/* Qué puede hacer el Onyx interno */}
      <div className="card" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 14px', marginBottom: 12 }}>
        <span style={{ fontSize: 18 }}>🤖</span>
        <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>
          <b>{L('Escribe @Onyx para preguntar de conjunto:', 'Type @Onyx to ask across everything:')}</b>{' '}
          <span className="muted">{L('«¿cuántas consultas de fondeo hay?», «¿qué tickets llevan más de 24h esperando?», «historial de juan@correo.com». Solo lee tickets/clientes del equipo; nunca da secretos ni consejo financiero.', '“how many funding tickets are there?”, “which tickets have waited over 24h?”, “history of juan@email.com”. It only reads team tickets/clients; never secrets or financial advice.')}</span>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', minHeight: 540 }} className="teamchat-grid">
          {/* Canales + equipo */}
          <div style={{ borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column' }}>
            <div className="row between" style={{ padding: '11px 12px', borderBottom: '1px solid var(--line)' }}>
              <b style={{ fontSize: 13 }}># {L('Canales', 'Channels')}</b>
              <button className="btn btn-ghost" style={{ padding: '3px 8px', fontSize: 16, lineHeight: 1 }} onClick={() => setShowNew((s) => !s)} title={L('Nuevo canal', 'New channel')}>+</button>
            </div>
            {showNew && (
              <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--line)' }}>
                <input value={newCh} onChange={(e) => setNewCh(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') createChannel(); }} placeholder={L('nombre-del-canal', 'channel-name')} style={{ margin: 0, fontSize: 13 }} />
              </div>
            )}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {channels.filter((c) => c.kind !== 'dm').map((c) => (
                <ChannelRow key={c.id} c={c} active={c.id === active} onClick={() => setActive(c.id)} onPop={() => openDock(c.id)} popTitle={L('Abrir en ventana', 'Open in window')} />
              ))}
              {channels.some((c) => c.kind === 'dm') && <div className="muted" style={{ fontSize: 11, padding: '10px 12px 4px' }}>{L('Directos', 'Direct')}</div>}
              {channels.filter((c) => c.kind === 'dm').map((c) => {
                const other = c.members.find((id) => id !== me);
                const nm = teamById[other || '']?.name || c.name;
                return <ChannelRow key={c.id} c={{ ...c, name: nm }} active={c.id === active} onClick={() => setActive(c.id)} onPop={() => openDock(c.id)} popTitle={L('Abrir en ventana', 'Open in window')} dm />;
              })}
            </div>
            {/* Equipo con nombre + rol + presencia. Doble clic abre un DM. */}
            <div style={{ borderTop: '1px solid var(--line)', padding: '8px 10px', maxHeight: 190, overflowY: 'auto' }}>
              <div className="muted" style={{ fontSize: 11, marginBottom: 5 }}>{L('Equipo', 'Team')} · {L('doble clic = mensaje directo', 'double-click = direct message')}</div>
              {team.map((t) => (
                <div key={t.id} className="row" style={{ gap: 7, alignItems: 'center', padding: '4px 0', cursor: t.id === me ? 'default' : 'pointer', borderRadius: 8 }} onDoubleClick={() => { if (t.id !== me) openDM(t.id); }} title={t.id === me ? '' : L('Doble clic: mensaje directo', 'Double-click: direct message')}>
                  <span style={{ position: 'relative', width: 26, height: 26, borderRadius: '50%', background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9.5, fontWeight: 700, color: 'var(--mut)', flex: 'none' }}>
                    {initials(t.name)}
                    <span style={{ position: 'absolute', right: -1, bottom: -1, width: 8, height: 8, borderRadius: '50%', background: onlineIds.has(t.id) ? 'var(--soft-green)' : 'var(--mut)', border: '1.5px solid var(--card)' }} />
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 12.5, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}{t.id === me && <span className="muted"> ({L('tú', 'you')})</span>}</span>
                    <span className="muted" style={{ fontSize: 10.5 }}>{roleLabel(t.role, en)} · {onlineIds.has(t.id) ? L('en línea', 'online') : L('desconectado', 'offline')}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Conversación principal */}
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--line)' }}>
              <div className="row between" style={{ flexWrap: 'wrap', gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <b style={{ fontSize: 14 }}>{activeCh ? (activeCh.kind === 'dm' ? '' : '# ') + (activeCh.kind === 'dm' ? (teamById[activeCh.members.find((id) => id !== me) || '']?.name || activeCh.name) : activeCh.name) : L('Elige un canal', 'Pick a channel')}</b>
                  {activeCh?.topic && <span className="muted" style={{ fontSize: 12 }}> · {activeCh.topic}</span>}
                </div>
                <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                  {activeCh && <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => openDock(active)} title={L('Abrir en ventana aparte', 'Open in a separate window')}>⧉ {L('Ventana', 'Window')}</button>}
                  {activeCh && <div style={{ position: 'relative' }}>
                    <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => setShowAdd((s) => !s)} title={L('Añadir compañero', 'Add teammate')}>＋ {L('Añadir', 'Add')}</button>
                    {showAdd && (
                      <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 6, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, boxShadow: '0 12px 30px rgba(0,0,0,.3)', zIndex: 30, width: 220, maxHeight: 240, overflowY: 'auto' }}>
                        {(activeCh.kind === 'dm' ? canAdd : team.filter((t) => t.id !== me)).map((t) => (
                          <button key={t.id} onClick={() => addMember(t.id)} style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', borderBottom: '1px solid var(--line)', padding: '8px 11px', cursor: 'pointer', color: 'var(--tx)' }}>
                            <span style={{ fontSize: 12, fontWeight: 700 }}>{initials(t.name)}</span>
                            <span style={{ fontSize: 12.5, flex: 1 }}>{t.name}<span className="muted" style={{ fontSize: 11 }}> · {roleLabel(t.role, en)}</span></span>
                          </button>
                        ))}
                        {activeCh.kind === 'dm' && !canAdd.length && <div className="muted" style={{ fontSize: 12, padding: 10 }}>{L('Ya están todos.', 'Everyone is in.')}</div>}
                      </div>
                    )}
                  </div>}
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} title={L('Buscar por día', 'Search by day')} style={{ margin: 0, fontSize: 12, padding: '5px 8px' }} />
                  {date && <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => setDate('')}>{L('Todo', 'All')}</button>}
                </div>
              </div>
              {/* Miembros de la conversación con su rol */}
              {activeCh && (
                <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  {activeCh.kind !== 'dm' && <span className="muted" style={{ fontSize: 11 }}>{L('Canal abierto · todo el equipo:', 'Open channel · whole team:')}</span>}
                  {convoMembers.slice(0, 8).map((mem) => (
                    <span key={mem.id} className="pill" style={{ fontSize: 11, background: 'var(--bg2)', color: 'var(--mut)' }}>{mem.name} · {roleLabel(mem.role, en)}</span>
                  ))}
                </div>
              )}
            </div>
            <div style={{ padding: '10px 14px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              {active ? (
                <ChatThread messages={mapped} lang={lang as any} onSend={send} onTyping={sendTyping} mentionSource={mentionSource} showAuthors height={410} typingLabel={typingLabel}
                  placeholder={L('Escribe… @ para etiquetar, @Onyx para la IA', 'Type… @ to tag, @Onyx for AI')}
                  emptyText={date ? L('Sin mensajes ese día.', 'No messages that day.') : L('Sé el primero en escribir 👋', 'Be the first to write 👋')} />
              ) : <div className="muted" style={{ margin: 'auto', fontSize: 13 }}>{L('Crea o elige un canal para empezar.', 'Create or pick a channel to start.')}</div>}
            </div>
          </div>
        </div>
      </div>

      {/* Ventanas acopladas: varios chats abiertos a la vez */}
      <div style={{ position: 'fixed', right: 16, bottom: 12, display: 'flex', gap: 12, alignItems: 'flex-end', zIndex: 1500 }}>
        {docks.map((id) => {
          const c = channels.find((x) => x.id === id); if (!c) return null;
          const title = c.kind === 'dm' ? (teamById[c.members.find((m) => m !== me) || '']?.name || c.name) : '# ' + c.name;
          return <DockWindow key={id} channelId={id} title={title} me={meP} lang={lang as any} onClose={() => closeDock(id)} onActivity={loadChannels} />;
        })}
      </div>

      <style>{`@media(max-width:720px){.teamchat-grid{grid-template-columns:1fr !important}}`}</style>
    </div>
  );
}

function ChannelRow({ c, active, onClick, onPop, popTitle, dm }: { c: Channel; active: boolean; onClick: () => void; onPop: () => void; popTitle: string; dm?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', background: active ? 'var(--bg2)' : 'transparent', borderLeft: active ? '3px solid var(--brand)' : '3px solid transparent' }}>
      <button onClick={onClick} style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1, minWidth: 0, textAlign: 'left', background: 'transparent', border: 'none', padding: '10px 4px 10px 11px', cursor: 'pointer', color: 'var(--tx)' }}>
        <span style={{ fontSize: 14 }}>{dm ? '👤' : '#'}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: c.unread ? 700 : 500, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
          {c.last && <span className="muted" style={{ fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{c.last.body || '📎'}</span>}
        </span>
        {c.unread > 0 && <span style={{ background: 'var(--red)', color: '#fff', fontSize: 10, fontWeight: 700, minWidth: 16, height: 16, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>{c.unread}</span>}
      </button>
      <button onClick={onPop} title={popTitle} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--mut)', fontSize: 13, padding: '0 8px' }}>⧉</button>
    </div>
  );
}

// Ventana de chat acoplada (mini). Tiene su propio estado y tiempo real.
function DockWindow({ channelId, title, me, lang, onClose, onActivity }: { channelId: string; title: string; me: Presence | null; lang: 'es' | 'en'; onClose: () => void; onActivity: () => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const [min, setMin] = useState(false);
  async function load() {
    try { const r = await fetch('/api/team/chat/messages?channel=' + channelId); const j = await r.json(); setRows(j.messages || []); } catch {}
    try { await fetch('/api/team/chat/read', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ channel: channelId }) }); } catch {}
  }
  useEffect(() => { load(); }, [channelId]);
  const { typing, ping, sendTyping } = useChatRealtime(`team:${channelId}`, me, load);
  async function send(text: string, attachments: Att[]) { const j = await postMessage(channelId, text, attachments); if (j.ok) { await load(); ping(); onActivity(); } }
  const typingLabel = typing.length ? `${typing[0]} ${lang === 'en' ? 'is typing…' : 'está escribiendo…'}` : '';

  return (
    <div style={{ width: 300, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '12px 12px 0 0', boxShadow: '0 -6px 30px rgba(0,0,0,.35)', overflow: 'hidden' }}>
      <div className="row between" style={{ padding: '8px 11px', borderBottom: min ? 'none' : '1px solid var(--line)', background: 'var(--bg2)', cursor: 'pointer' }} onClick={() => setMin((m) => !m)}>
        <b style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</b>
        <span className="row" style={{ gap: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--mut)' }}>{min ? '▴' : '▾'}</span>
          <button onClick={(e) => { e.stopPropagation(); onClose(); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--mut)', fontSize: 14 }}>✕</button>
        </span>
      </div>
      {!min && (
        <div style={{ padding: '8px 10px' }}>
          <ChatThread messages={toChat(rows, me?.id || '')} lang={lang} onSend={send} onTyping={sendTyping} mentionSource={mentionSource} showAuthors height={260} typingLabel={typingLabel}
            placeholder={lang === 'en' ? 'Type…' : 'Escribe…'} />
        </div>
      )}
    </div>
  );
}
