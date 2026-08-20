'use client';
import { mkL } from '@/lib/i18n';
// Chat en vivo del equipo: canales + mensajes directos, @menciones (compañero /
// cliente / ticket), adjuntar fotos y documentos, emojis, @Onyx AI y búsqueda por
// día. Reusa el motor ChatThread del soporte, con tiempo real por broadcast.
// Extras: añadir compañeros a la conversación, ver nombre + rol de cada miembro,
// y tener VARIOS chats abiertos a la vez (ventanas acopladas abajo).
import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLang } from '@/lib/lang';
import ChatThread, { type ChatMsg, type Att, type MentionItem } from '@/app/components/ChatThread';
import Icon from '@/app/components/Icons';
import { useChatRealtime, type Presence } from '@/lib/chatRealtime';

type Channel = { id: string; name: string; kind: string; topic?: string; unread: number; last: any; members: string[] };
type Member = { id: string; name: string; email: string; role: string; available: boolean; last_active: string };

const initials = (n?: string) => (n || '?').trim().split(/\s+/).slice(0, 2).map((s) => s[0]).join('').toUpperCase();

// Avatares de color por nombre (consistentes) — para la lista tipo WhatsApp.
const AV = [
  { bg: 'rgba(124,140,255,.20)', fg: '#8f9bff' }, { bg: 'rgba(52,226,160,.20)', fg: '#34e2a0' },
  { bg: 'rgba(255,192,77,.20)', fg: '#ffc04d' }, { bg: 'rgba(255,107,125,.20)', fg: '#ff8a97' },
  { bg: 'rgba(94,207,255,.20)', fg: '#5ecfff' }, { bg: 'rgba(197,132,255,.20)', fg: '#c584ff' },
];
const avatarOf = (s?: string) => AV[Math.abs([...String(s || '?')].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7)) % AV.length];
// Hora corta relativa para la lista (hoy → HH:MM, ayer → "ayer", antes → dd/mm)
function shortWhen(iso?: string, en?: boolean) {
  if (!iso) return '';
  const d = new Date(iso); const now = new Date();
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (same(d, now)) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (same(d, y)) return en ? 'yest.' : 'ayer';
  return d.toLocaleDateString(en ? 'en-US' : 'es-ES', { day: '2-digit', month: '2-digit' });
}

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
  const tz = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return ''; } })();
  const r = await fetch('/api/team/chat/messages', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ channel, body: text, attachments, mentions, tz }) });
  return r.json().catch(() => ({}));
}

// Muro de contención: si algo del chat falla, no tumba TODO el panel de admin;
// muestra el error para poder diagnosticarlo.
class ChatBoundary extends Component<{ children: ReactNode }, { err: string }> {
  constructor(p: any) { super(p); this.state = { err: '' }; }
  static getDerivedStateFromError(e: any) { return { err: String(e?.message || e) }; }
  render() {
    if (this.state.err) return (
      <div className="card" style={{ padding: 20 }}>
        <b>💬 {'Chat del equipo'}</b>
        <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>No se pudo cargar el chat en este momento. Recarga la página. Si sigue, avísanos con este detalle:</p>
        <pre style={{ fontSize: 12, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 8, padding: 10, overflowX: 'auto' }}>{this.state.err}</pre>
      </div>
    );
    return this.props.children;
  }
}

export default function TeamChat() {
  return <ChatBoundary><TeamChatInner /></ChatBoundary>;
}

function TeamChatInner() {
  const { lang } = useLang();
  const en = lang === 'en';
  const L = mkL(lang);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [team, setTeam] = useState<Member[]>([]);
  const [me, setMe] = useState('');
  const [active, setActive] = useState('');
  const [msgs, setMsgs] = useState<any[]>([]);
  const [date, setDate] = useState('');
  const [newCh, setNewCh] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState('');            // buscador de conversaciones
  const [showCompose, setShowCompose] = useState(false); // panel "nueva conversación"
  const [showDate, setShowDate] = useState(false);     // buscar por día (toggle)
  const [mobileOpen, setMobileOpen] = useState(false); // en móvil: chat a pantalla completa
  const [docks, setDocks] = useState<string[]>([]);   // canales abiertos como ventanas
  // Alto medido: el panel llena desde su borde superior hasta el fondo de la
  // ventana. Así el composer SIEMPRE queda visible, sin importar la cabecera.
  const wrapRef = useRef<HTMLDivElement>(null);
  const [gridH, setGridH] = useState(520);
  useEffect(() => {
    const f = () => { const top = wrapRef.current?.getBoundingClientRect().top ?? 180; setGridH(Math.max(420, window.innerHeight - top - 16)); };
    f(); window.addEventListener('resize', f); const iv = setInterval(f, 1000);
    return () => { window.removeEventListener('resize', f); clearInterval(iv); };
  }, []);
  const loadedOnce = useRef(false);

  const teamById = useMemo(() => Object.fromEntries(team.map((t) => [t.id, t])), [team]);
  const meName = teamById[me]?.name || 'Yo';
  const meP: Presence | null = me ? { id: me, name: meName } : null;

  async function loadChannels() {
    try {
      const r = await fetch('/api/team/chat'); const j = await r.json();
      // Normalizamos: members SIEMPRE es arreglo (evita crashes al abrir ventanas/DMs).
      const chs = (j.channels || []).map((c: any) => ({ ...c, members: Array.isArray(c.members) ? c.members : [] }));
      setChannels(chs); setTeam(j.team || []); setMe(j.me || '');
      if (!loadedOnce.current && chs.length) { setActive(chs[0].id); loadedOnce.current = true; }
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

  // Lista de conversaciones (canales + DMs) para la lista tipo WhatsApp, filtrable.
  const convos = channels.map((c) => {
    const isDm = c.kind === 'dm';
    const otherId = isDm ? (c.members.find((id) => id !== me) || '') : '';
    const display = isDm ? (teamById[otherId]?.name || c.name) : c.name;
    return { ...c, isDm, otherId, display };
  }).filter((c) => c.display.toLowerCase().includes(filter.trim().toLowerCase()));
  const dmOther = activeCh?.kind === 'dm' ? (activeCh.members.find((id) => id !== me) || '') : '';
  const headerName = activeCh ? (activeCh.kind === 'dm' ? (teamById[dmOther]?.name || activeCh.name) : activeCh.name) : '';
  const headerStatus = typingLabel ? typingLabel
    : activeCh ? (activeCh.kind === 'dm'
        ? (onlineIds.has(dmOther) ? L('en línea', 'online') : L('desconectado', 'offline'))
        : `${team.length} ${L('miembros', 'members')} · ${online.length} ${L('en línea', 'online')}`)
    : '';
  const iconBtn: any = { background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--mut)', padding: '5px 6px', lineHeight: 1 };

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
    <div ref={wrapRef} style={{ width: '100%' }}>
      <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', height: gridH }} className="teamchat-grid">
          {/* Lista de conversaciones (tipo WhatsApp) */}
          <div className={'teamchat-side' + (mobileOpen ? ' tc-hidden-m' : '')} style={{ borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column', minHeight: 0, background: 'var(--bg2)' }}>
            <div style={{ padding: '14px 14px 10px', display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ width: 34, height: 34, borderRadius: 10, flex: 'none', background: 'linear-gradient(135deg,#7c8cff,#34e2a0)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0b0d17' }}><Icon name="message" size={18} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{L('Equipo', 'Team')}</div>
                <div className="muted" style={{ fontSize: 11 }}><span style={{ color: 'var(--soft-green)' }}>●</span> {online.length} {L('en línea', 'online')}</div>
              </div>
            </div>
            <div style={{ padding: '0 12px 8px', display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 999, padding: '7px 12px', color: 'var(--mut)' }}>
                <Icon name="search" size={15} />
                <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={L('Buscar', 'Search')} style={{ margin: 0, border: 'none', background: 'transparent', padding: 0, fontSize: 13, width: '100%', color: 'var(--tx)' }} />
              </div>
              <button className="btn btn-primary" onClick={() => setShowCompose((s) => !s)} title={L('Nueva conversación', 'New chat')} style={{ width: 36, height: 36, padding: 0, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon name="plus" size={19} /></button>
            </div>
            {showCompose && (
              <div style={{ padding: '4px 12px 10px', borderBottom: '1px solid var(--line)' }}>
                <div className="muted" style={{ fontSize: 11, margin: '2px 0 6px' }}>{L('Nuevo canal', 'New channel')}</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input value={newCh} onChange={(e) => setNewCh(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { createChannel(); setShowCompose(false); } }} placeholder={L('nombre-del-canal', 'channel-name')} style={{ margin: 0, fontSize: 13 }} />
                  <button className="btn btn-ghost" onClick={() => { createChannel(); setShowCompose(false); }} style={{ padding: '0 12px', flex: 'none' }}>{L('Crear', 'Create')}</button>
                </div>
                <div className="muted" style={{ fontSize: 11, margin: '10px 0 4px' }}>{L('Mensaje directo con…', 'Direct message with…')}</div>
                <div style={{ maxHeight: 150, overflowY: 'auto' }}>
                  {team.filter((t) => t.id !== me).map((t) => { const av = avatarOf(t.name); return (
                    <button key={t.id} onClick={() => { openDM(t.id); setShowCompose(false); }} style={{ display: 'flex', gap: 9, alignItems: 'center', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', padding: '6px 4px', cursor: 'pointer', color: 'var(--tx)', borderRadius: 8 }}>
                      <span style={{ position: 'relative', width: 30, height: 30, borderRadius: '50%', background: av.bg, color: av.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flex: 'none' }}>{initials(t.name)}
                        <span style={{ position: 'absolute', right: -1, bottom: -1, width: 8, height: 8, borderRadius: '50%', background: onlineIds.has(t.id) ? 'var(--soft-green)' : 'var(--mut)', border: '1.5px solid var(--card)' }} />
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}><span style={{ fontSize: 13, display: 'block' }}>{t.name}</span><span className="muted" style={{ fontSize: 10.5 }}>{roleLabel(t.role, en)}</span></span>
                    </button>
                  ); })}
                </div>
              </div>
            )}
            <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
              {convos.length === 0 && <div className="muted" style={{ fontSize: 12, padding: 18, textAlign: 'center' }}>{L('Sin conversaciones.', 'No chats.')}</div>}
              {convos.map((c) => (
                <ConvCard key={c.id} c={c} active={c.id === active} online={c.isDm ? onlineIds.has(c.otherId) : undefined} en={en} onClick={() => { setActive(c.id); setMobileOpen(true); }} />
              ))}
            </div>
          </div>

          {/* Panel de chat */}
          <div className={'teamchat-main' + (mobileOpen ? ' tc-fs-m' : ' tc-hidden-m')} style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
            {activeCh ? (<>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderBottom: '1px solid var(--line)', background: 'linear-gradient(90deg, rgba(124,140,255,.10), transparent 70%)' }}>
                <button className="tc-back" onClick={() => setMobileOpen(false)} style={{ display: 'none', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--tx)', lineHeight: 1, padding: '4px 2px' }}><Icon name="back" size={22} /></button>
                {(() => { const av = avatarOf(headerName); const dm = activeCh.kind === 'dm'; return (
                  <span style={{ width: 38, height: 38, borderRadius: 12, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: dm ? 12 : 17, fontWeight: 700, background: dm ? av.bg : 'rgba(124,140,255,.14)', color: dm ? av.fg : 'var(--soft-brand)' }}>{dm ? initials(headerName) : <Icon name="hash" size={18} />}</span>
                ); })()}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{(activeCh.kind === 'dm' ? '' : '# ') + headerName}</div>
                  <div style={{ fontSize: 11.5, color: typingLabel ? 'var(--soft-green)' : 'var(--mut)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{headerStatus}</div>
                </div>
                <button title={L('Buscar por día', 'Search by day')} onClick={() => setShowDate((s) => !s)} style={iconBtn}><Icon name="calendar" size={18} /></button>
                <div style={{ position: 'relative' }}>
                  <button title={L('Añadir compañero', 'Add teammate')} onClick={() => setShowAdd((s) => !s)} style={iconBtn}><Icon name="userPlus" size={18} /></button>
                  {showAdd && (
                    <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 6, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, boxShadow: '0 12px 30px rgba(0,0,0,.3)', zIndex: 30, width: 230, maxHeight: 260, overflowY: 'auto' }}>
                      {(activeCh.kind === 'dm' ? canAdd : team.filter((t) => t.id !== me)).map((t) => { const av = avatarOf(t.name); return (
                        <button key={t.id} onClick={() => addMember(t.id)} style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', borderBottom: '1px solid var(--line)', padding: '8px 11px', cursor: 'pointer', color: 'var(--tx)' }}>
                          <span style={{ width: 26, height: 26, borderRadius: '50%', background: av.bg, color: av.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flex: 'none' }}>{initials(t.name)}</span>
                          <span style={{ fontSize: 12.5, flex: 1 }}>{t.name}<span className="muted" style={{ fontSize: 11 }}> · {roleLabel(t.role, en)}</span></span>
                        </button>
                      ); })}
                      {activeCh.kind === 'dm' && !canAdd.length && <div className="muted" style={{ fontSize: 12, padding: 10 }}>{L('Ya están todos.', 'Everyone is in.')}</div>}
                    </div>
                  )}
                </div>
                <button title={L('Abrir en ventana', 'Open in window')} onClick={() => openDock(active)} style={iconBtn}><Icon name="window" size={18} /></button>
              </div>
              {showDate && (
                <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--line)', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ margin: 0, fontSize: 12, padding: '5px 8px' }} />
                  {date && <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => setDate('')}>{L('Todo', 'All')}</button>}
                </div>
              )}
              <div style={{ padding: '10px 14px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, background: 'radial-gradient(120% 80% at 100% 0%, rgba(124,140,255,.06), transparent 60%), radial-gradient(120% 80% at 0% 100%, rgba(52,226,160,.05), transparent 55%)' }}>
                <ChatThread messages={mapped} lang={lang as any} onSend={send} onTyping={sendTyping} mentionSource={mentionSource} showAuthors height={Math.max(240, gridH - 150)} typingLabel={typingLabel}
                  placeholder={L('Escribe… @ para etiquetar, @Onyx para la IA', 'Type… @ to tag, @Onyx for AI')}
                  emptyText={date ? L('Sin mensajes ese día.', 'No messages that day.') : L('Sé el primero en escribir 👋', 'Be the first to write 👋')} />
              </div>
            </>) : <div className="muted" style={{ margin: 'auto', fontSize: 13, padding: 24, textAlign: 'center' }}>{L('Elige una conversación para empezar.', 'Pick a chat to start.')}</div>}
          </div>
        </div>
      </div>

      {/* Ventanas acopladas: varios chats abiertos a la vez */}
      <div className="teamchat-docks" style={{ position: 'fixed', right: 16, bottom: 12, display: 'flex', gap: 12, alignItems: 'flex-end', zIndex: 1500 }}>
        {docks.map((id) => {
          const c = channels.find((x) => x.id === id); if (!c) return null;
          const title = c.kind === 'dm' ? (teamById[c.members.find((m) => m !== me) || '']?.name || c.name) : '# ' + c.name;
          return <DockWindow key={id} channelId={id} title={title} me={meP} lang={lang as any} onClose={() => closeDock(id)} onActivity={loadChannels} />;
        })}
      </div>

      <style>{`
        @media(max-width:720px){
          .teamchat-grid{grid-template-columns:1fr !important; height:auto !important}
          .teamchat-side{height:70vh; border-right:none !important}
          .teamchat-main{display:none}
          .tc-hidden-m{display:none !important}
          .tc-fs-m{display:flex !important; height:80vh}
          .tc-back{display:block !important}
        }
        @media(max-width:560px){
          .teamchat-docks{left:0 !important; right:0 !important; bottom:0 !important; gap:0 !important; padding:0 8px; flex-direction:column; align-items:stretch}
          .teamchat-dock{width:100% !important; border-radius:12px 12px 0 0}
          .teamchat-docks .teamchat-dock:not(:last-child){display:none}
        }
      `}</style>
    </div>
  );
}

// Tarjeta de conversación (lista tipo WhatsApp): avatar de color, nombre, última
// línea, hora, no leídos y punto de "en línea" (en los directos).
function ConvCard({ c, active, online, en, onClick }: { c: any; active: boolean; online?: boolean; en: boolean; onClick: () => void }) {
  const av = avatarOf(c.display);
  return (
    <div onClick={onClick} style={{ display: 'flex', gap: 11, alignItems: 'center', margin: '0 8px', padding: '10px', borderRadius: 12, cursor: 'pointer', background: active ? 'linear-gradient(90deg,rgba(124,140,255,.18),transparent 85%)' : 'transparent', boxShadow: active ? 'inset 2px 0 0 var(--brand)' : 'none' }}>
      <span style={{ position: 'relative', width: 42, height: 42, borderRadius: 13, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: c.isDm ? 14 : 18, fontWeight: 700, background: c.isDm ? av.bg : 'rgba(124,140,255,.14)', color: c.isDm ? av.fg : 'var(--soft-brand)' }}>
        {c.isDm ? initials(c.display) : <Icon name="hash" size={18} />}
        {c.isDm && <span style={{ position: 'absolute', right: -1, bottom: -1, width: 11, height: 11, borderRadius: '50%', background: online ? 'var(--soft-green)' : 'var(--mut)', border: '2px solid var(--bg2)' }} />}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
          <span style={{ fontSize: 13.5, fontWeight: c.unread ? 700 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.display}</span>
          <span style={{ fontSize: 11, color: c.unread ? 'var(--soft-brand)' : 'var(--mut)', flex: 'none' }}>{shortWhen(c.last?.created_at, en)}</span>
        </span>
        <span style={{ display: 'flex', justifyContent: 'space-between', gap: 6, alignItems: 'center', marginTop: 1 }}>
          <span className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.last ? (c.last.body || (en ? '📎 attachment' : '📎 adjunto')) : (en ? 'No messages' : 'Sin mensajes')}</span>
          {c.unread > 0 && <span style={{ background: 'var(--brand)', color: '#fff', fontSize: 10.5, fontWeight: 700, minWidth: 18, height: 18, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', flex: 'none' }}>{c.unread}</span>}
        </span>
      </span>
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
    <div className="teamchat-dock" style={{ width: 300, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '12px 12px 0 0', boxShadow: '0 -6px 30px rgba(0,0,0,.35)', overflow: 'hidden' }}>
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
