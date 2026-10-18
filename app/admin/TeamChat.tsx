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
import OnyxIcon from '@/app/components/OnyxIcon';
import Calendar from '@/app/components/Calendar';

type Channel = { id: string; name: string; kind: string; topic?: string; unread: number; last: any; members: string[] };
type Member = { id: string; name: string; email: string; role: string; available: boolean; last_active: string; job_title?: string; country?: string; languages?: string };

// Línea de ficha de un compañero: ÁREA · puesto específico · país · idiomas.
// El puesto específico combina el área (Admin/Ventas/…) con el puesto propio del
// perfil (ej. "Admin · Soporte N2", "Ventas · Oro"), para saber exactamente el nivel.
// Idiomas comunes para el selector de chips (captura cómoda del perfil).
const LANGS = ['Español', 'Inglés', 'Portugués', 'Francés', 'Italiano', 'Alemán', 'Chino', 'Árabe'];

// Países comunes (nombre en ES + bandera). Se guarda el NOMBRE en el perfil; la
// bandera se deriva para mostrarla en la ficha. Lista enfocada en LATAM + mercados
// clave; si el país no está, se muestra solo 📍 con el texto.
const COUNTRIES: { name: string; flag: string }[] = [
  { name: 'México', flag: '🇲🇽' }, { name: 'Colombia', flag: '🇨🇴' }, { name: 'Argentina', flag: '🇦🇷' },
  { name: 'Perú', flag: '🇵🇪' }, { name: 'Chile', flag: '🇨🇱' }, { name: 'Ecuador', flag: '🇪🇨' },
  { name: 'Venezuela', flag: '🇻🇪' }, { name: 'Guatemala', flag: '🇬🇹' }, { name: 'Bolivia', flag: '🇧🇴' },
  { name: 'República Dominicana', flag: '🇩🇴' }, { name: 'Honduras', flag: '🇭🇳' }, { name: 'Paraguay', flag: '🇵🇾' },
  { name: 'El Salvador', flag: '🇸🇻' }, { name: 'Nicaragua', flag: '🇳🇮' }, { name: 'Costa Rica', flag: '🇨🇷' },
  { name: 'Panamá', flag: '🇵🇦' }, { name: 'Uruguay', flag: '🇺🇾' }, { name: 'Puerto Rico', flag: '🇵🇷' },
  { name: 'España', flag: '🇪🇸' }, { name: 'Estados Unidos', flag: '🇺🇸' }, { name: 'Brasil', flag: '🇧🇷' },
  { name: 'Portugal', flag: '🇵🇹' }, { name: 'Italia', flag: '🇮🇹' }, { name: 'Francia', flag: '🇫🇷' },
  { name: 'Alemania', flag: '🇩🇪' }, { name: 'Reino Unido', flag: '🇬🇧' }, { name: 'Canadá', flag: '🇨🇦' },
  { name: 'China', flag: '🇨🇳' }, { name: 'India', flag: '🇮🇳' }, { name: 'Filipinas', flag: '🇵🇭' },
  { name: 'Marruecos', flag: '🇲🇦' }, { name: 'Otro', flag: '🌍' },
];
function flagOf(country?: string): string {
  if (!country) return '';
  const hit = COUNTRIES.find((c) => c.name.toLowerCase() === country.trim().toLowerCase());
  return hit ? hit.flag : '📍';
}

function metaOf(t: Member, roleTxt: string): string {
  const pos = t.job_title ? `${roleTxt} · ${t.job_title}` : roleTxt;
  const bits = [pos];
  if (t.country) bits.push(flagOf(t.country) + ' ' + t.country);
  if (t.languages) bits.push('🗣 ' + t.languages);
  return bits.filter(Boolean).join(' · ');
}

const initials = (n?: string) => (n || '?').trim().split(/\s+/).slice(0, 2).map((s) => s[0]).join('').toUpperCase();
// Para las vistas previas (lista y búsqueda): convierte el token de tarjeta de
// ticket [[tk:id|asunto|...]] en un texto legible "🎫 asunto".
const tkClean = (s?: string) => String(s || '').replace(/\[\[tk:[^|\]]+\|([^|]*)\|[^\]]*\]\]/g, '🎫 $1').replace(/\s+/g, ' ').trim();

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
    replyTo: m.reply_snippet || null, pinned: !!m.pinned, reactions: m.reactions || [], urgent: !!m.urgent,
  }));
}

// Reaccionar (toggle) o fijar/desfijar un mensaje del equipo.
async function reactMsg(message: string, emoji: string) {
  try { await fetch('/api/team/chat/messages', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message, action: 'react', emoji }) }); } catch {}
}
async function pinMsg(message: string, pinned: boolean) {
  try { await fetch('/api/team/chat/messages', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message, action: 'pin', pinned }) }); } catch {}
}

const mentionSource = async (q: string): Promise<MentionItem[]> => {
  try { const r = await fetch('/api/team/mentions?q=' + encodeURIComponent(q)); const j = await r.json(); return j.items || []; } catch { return []; }
};

async function postMessage(channel: string, text: string, attachments: Att[], opts?: { replyTo?: string; urgent?: boolean }) {
  const mentions: any[] = [];
  if (/@onyx/i.test(text)) mentions.push({ type: 'user', id: 'onyx', label: 'Onyx AI' });
  const tz = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return ''; } })();
  const r = await fetch('/api/team/chat/messages', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ channel, body: text, attachments, mentions, tz, reply_to: opts?.replyTo || null, urgent: !!opts?.urgent }) });
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
        <b><OnyxIcon emoji="💬" size={15} /> {'Chat del equipo'}</b>
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
  const [composeTab, setComposeTab] = useState<'channel' | 'group' | 'dm'>('channel'); // tipo en el panel nuevo
  const [grpName, setGrpName] = useState('');          // nombre del grupo privado
  const [grpMembers, setGrpMembers] = useState<string[]>([]); // miembros elegidos del grupo
  const [showSearch, setShowSearch] = useState(false); // buscar DENTRO de los mensajes
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showProfile, setShowProfile] = useState(false); // editar mi ficha de equipo
  const [pf, setPf] = useState({ job_title: '', country: '', languages: '' });
  const [pfTarget, setPfTarget] = useState(''); // id del empleado que se está editando ('' = yo)
  useEffect(() => {
    if (!showSearch) return;
    const t = searchQ.trim();
    if (t.length < 2) { setSearchResults([]); return; }
    let live = true;
    const id = setTimeout(() => { fetch('/api/team/chat/search?q=' + encodeURIComponent(t)).then((r) => r.json()).then((j) => { if (live) setSearchResults(j.results || []); }).catch(() => {}); }, 250);
    return () => { live = false; clearTimeout(id); };
  }, [searchQ, showSearch]);
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

  async function send(text: string, attachments: Att[], opts?: { replyTo?: string; urgent?: boolean }) {
    const j = await postMessage(active, text, attachments, opts);
    if (j.ok) { await loadMsgs(active, date); ping(); loadChannels(); }
  }
  // Reaccionar / fijar en el panel principal: aplica y recarga el hilo.
  async function onReactMain(id: string, emoji: string) { await reactMsg(id, emoji); await loadMsgs(active, date); }
  async function onPinMain(id: string, pinned: boolean) { await pinMsg(id, pinned); await loadMsgs(active, date); }
  // Puente equipo → ticket: convierte el mensaje en un ticket de soporte (triage + ruteo).
  async function onToTicketMain(m: any) {
    const bodyTxt = String(m?.body || '').trim();
    if (!bodyTxt) { alert(L('El mensaje no tiene texto para convertir.', 'The message has no text to convert.')); return; }
    const subject = window.prompt(L('Asunto del ticket:', 'Ticket subject:'), bodyTxt.slice(0, 80)) ;
    if (subject === null) return;
    const email = window.prompt(L('Correo del cliente (opcional):', 'Customer email (optional):'), '') || '';
    try {
      const r = await fetch('/api/admin/support/from-team', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ subject: subject || bodyTxt.slice(0, 80), body: bodyTxt, email }) });
      const j = await r.json();
      if (j.ok) alert(L('Ticket creado ✓ — en Admin → Soporte.', 'Ticket created ✓ — in Admin → Support.'));
      else alert(L('No se pudo crear el ticket.', 'Could not create the ticket.'));
    } catch { alert(L('Error de red al crear el ticket.', 'Network error creating the ticket.')); }
  }

  const activeCh = channels.find((c) => c.id === active);
  const mapped = toChat(msgs, me);
  const typingLabel = typing.length ? `${typing.slice(0, 2).join(', ')} ${L('está escribiendo…', 'is typing…')}` : '';

  // Lista de conversaciones (canales + DMs) para la lista tipo WhatsApp, filtrable.
  const convos = channels.map((c) => {
    const isDm = c.kind === 'dm';
    const isGroup = c.kind === 'group';
    const otherId = isDm ? (c.members.find((id) => id !== me) || '') : '';
    const display = isDm ? (teamById[otherId]?.name || c.name) : c.name;
    return { ...c, isDm, isGroup, otherId, display, last: c.last ? { ...c.last, body: tkClean(c.last.body) } : null };
  }).filter((c) => c.display.toLowerCase().includes(filter.trim().toLowerCase()));
  const isGroupCh = activeCh?.kind === 'group';
  const dmOther = activeCh?.kind === 'dm' ? (activeCh.members.find((id) => id !== me) || '') : '';
  const headerName = activeCh ? (activeCh.kind === 'dm' ? (teamById[dmOther]?.name || activeCh.name) : activeCh.name) : '';
  const grpOnline = isGroupCh ? (activeCh?.members || []).filter((id) => onlineIds.has(id)).length : 0;
  const headerStatus = typingLabel ? typingLabel
    : activeCh ? (activeCh.kind === 'dm'
        ? (onlineIds.has(dmOther) ? L('en línea', 'online') : L('desconectado', 'offline'))
        : isGroupCh
        ? `${(activeCh.members || []).length} ${L('miembros', 'members')} · ${grpOnline} ${L('en línea', 'online')}`
        : `${team.length} ${L('miembros', 'members')} · ${online.length} ${L('en línea', 'online')}`)
    : '';
  const iconBtn: any = { background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--mut)', padding: '5px 6px', lineHeight: 1 };

  // Miembros de la conversación (con nombre + rol). Canal abierto = todo el equipo;
  // DM y grupo privado = solo sus miembros explícitos.
  const gated = !!activeCh && (activeCh.kind === 'dm' || activeCh.kind === 'group');
  const convoMembers: Member[] = activeCh
    ? (gated ? activeCh.members.map((id) => teamById[id]).filter(Boolean) : team)
    : [];
  const canAdd = team.filter((t) => gated && !activeCh!.members.includes(t.id));

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
  // Crear un GRUPO PRIVADO: nombre + miembros elegidos (yo siempre dentro). Solo lo
  // ven quienes estén en la lista; no aparece para el resto del equipo.
  async function createGroup() {
    const name = grpName.trim(); if (!name) return;
    const r = await fetch('/api/team/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'group', name, members: grpMembers }) });
    const j = await r.json(); setGrpName(''); setGrpMembers([]); setShowCompose(false);
    await loadChannels(); if (j.id) { setActive(j.id); setMobileOpen(true); }
  }
  // Quitar a alguien de un grupo/DM (o salir uno mismo si uid === me).
  async function removeMember(uid: string) {
    if (!activeCh) return;
    const leaving = uid === me;
    if (leaving && !window.confirm(L('¿Salir de esta conversación?', 'Leave this conversation?'))) return;
    const j = await fetch('/api/team/chat/members', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ channel: active, user_id: uid }) }).then((r) => r.json()).catch(() => ({}));
    setShowAdd(false);
    if (leaving) { loadedOnce.current = false; setActive(''); setMobileOpen(false); }
    await loadChannels();
  }
  // Abrir DM con un compañero (reusa uno existente si ya lo hay).
  // En móvil las conversaciones se abren a PANTALLA COMPLETA (no ventana flotante,
  // que se salía de la pantalla). En escritorio, como ventana acoplada.
  function openConv(id: string) {
    const mobile = typeof window !== 'undefined' && window.innerWidth <= 720;
    if (mobile) { setActive(id); setMobileOpen(true); } else openDock(id);
  }
  async function openDM(otherId: string) {
    const existing = channels.find((c) => c.kind === 'dm' && c.members.length === 2 && c.members.includes(me) && c.members.includes(otherId));
    if (existing) { openConv(existing.id); return; }
    const r = await fetch('/api/team/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'dm', name: teamById[otherId]?.name || 'DM', members: [otherId] }) });
    const j = await r.json(); await loadChannels(); if (j.id) openConv(j.id);
  }
  function openDock(id: string) { setDocks((d) => (d.includes(id) ? d : [...d, id].slice(-3))); }
  function closeDock(id: string) { setDocks((d) => d.filter((x) => x !== id)); }
  // Abrir/guardar ficha de equipo (puesto · país · idiomas). Sin id = la mía;
  // con id = la de otro empleado (solo dueño/admin pueden).
  const myRole = teamById[me]?.role;
  const canEditOthers = myRole === 'owner' || myRole === 'admin';
  function openProfile(id?: string) {
    const target = id && id !== me ? id : '';
    const m = teamById[target || me];
    setPfTarget(target);
    setPf({ job_title: m?.job_title || '', country: m?.country || '', languages: m?.languages || '' });
    setShowProfile(true);
  }
  async function saveProfile() {
    const body: any = { ...pf };
    if (pfTarget) body.id = pfTarget;
    await fetch('/api/team/profile', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).catch(() => {});
    setShowProfile(false); setPfTarget(''); await loadChannels();
  }

  return (
    <div ref={wrapRef} style={{ width: '100%' }}>
      <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', height: gridH }} className="teamchat-grid">
          {/* Lista de conversaciones (tipo WhatsApp) */}
          <div className={'teamchat-side' + (mobileOpen ? ' tc-hidden-m' : '')} style={{ borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column', minHeight: 0, background: 'var(--bg2)' }}>
            <div style={{ padding: '14px 14px 10px', display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ width: 34, height: 34, borderRadius: 10, flex: 'none', background: 'var(--tx)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--card)' }}><Icon name="message" size={18} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{L('Equipo', 'Team')}</div>
                <div className="muted" style={{ fontSize: 11 }}><span style={{ color: 'var(--soft-green)' }}>●</span> {online.length} {L('en línea', 'online')}</div>
              </div>
              {canEditOthers && <button title={L('Fichas del equipo (puesto · país · idiomas)', 'Team profiles (role · country · languages)')} onClick={() => openProfile()} style={{ width: 34, height: 34, flex: 'none', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--card)', color: 'var(--mut)', border: '1px solid var(--line)', cursor: 'pointer' }}><Icon name="user" size={16} /></button>}
              <button title={L('Buscar en los mensajes', 'Search in messages')} onClick={() => { setShowSearch((s) => !s); setSearchQ(''); setSearchResults([]); }} style={{ width: 34, height: 34, flex: 'none', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: showSearch ? 'var(--tx)' : 'var(--card)', color: showSearch ? 'var(--card)' : 'var(--mut)', border: '1px solid var(--line)', cursor: 'pointer' }}><Icon name="search" size={16} /></button>
            </div>
            {/* Buscar DENTRO de los mensajes de todas las conversaciones visibles. */}
            {showSearch && (
              <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
                <div style={{ padding: '0 12px 8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 999, padding: '7px 12px', color: 'var(--mut)' }}>
                    <Icon name="search" size={15} />
                    <input autoFocus value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder={L('Buscar en los mensajes…', 'Search messages…')} style={{ margin: 0, border: 'none', background: 'transparent', padding: 0, fontSize: 13, width: '100%', color: 'var(--tx)' }} />
                    {searchQ && <button onClick={() => setSearchQ('')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--mut)', display: 'flex' }}><Icon name="x" size={14} /></button>}
                  </div>
                </div>
                <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, padding: '0 8px 8px' }}>
                  {searchQ.trim().length < 2 && <div className="muted" style={{ fontSize: 12, padding: 18, textAlign: 'center' }}>{L('Escribe al menos 2 letras.', 'Type at least 2 letters.')}</div>}
                  {searchQ.trim().length >= 2 && !searchResults.length && <div className="muted" style={{ fontSize: 12, padding: 18, textAlign: 'center' }}>{L('Sin resultados.', 'No results.')}</div>}
                  {searchResults.map((r) => {
                    const name = r.channel_kind === 'group' ? '🔒 ' + r.channel_name : r.channel_kind === 'dm' ? (r.channel_name || L('Directo', 'DM')) : '# ' + r.channel_name;
                    return (
                      <button key={r.id} onClick={() => { setActive(r.channel_id); setMobileOpen(true); setShowSearch(false); }} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', borderBottom: '1px solid var(--line)', padding: '9px 8px', cursor: 'pointer', color: 'var(--tx)' }}>
                        <span style={{ display: 'flex', justifyContent: 'space-between', gap: 6, marginBottom: 2 }}>
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--mut)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
                          <span style={{ fontSize: 10.5, color: 'var(--mut)', flex: 'none' }}>{shortWhen(r.created_at, en)}</span>
                        </span>
                        <span style={{ fontSize: 12.5, display: 'block', lineHeight: 1.4 }}>{r.sender_name ? <b style={{ fontWeight: 600 }}>{r.sender_name}: </b> : ''}{tkClean(r.body)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {!showSearch && (<>
            <div style={{ padding: '0 12px 8px', display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 999, padding: '7px 12px', color: 'var(--mut)' }}>
                <Icon name="search" size={15} />
                <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={L('Buscar', 'Search')} style={{ margin: 0, border: 'none', background: 'transparent', padding: 0, fontSize: 13, width: '100%', color: 'var(--tx)' }} />
              </div>
              <button onClick={() => setShowCompose((s) => !s)} title={L('Nueva conversación', 'New chat')} style={{ width: 36, height: 36, padding: 0, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', background: 'var(--tx)', color: 'var(--card)', border: 'none', cursor: 'pointer' }}><Icon name="plus" size={19} /></button>
            </div>
            {showCompose && (
              <div style={{ padding: '4px 12px 10px', borderBottom: '1px solid var(--line)' }}>
                {/* Selector de tipo de conversación */}
                <div style={{ display: 'flex', gap: 4, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10, padding: 3, marginBottom: 10 }}>
                  {([['channel', L('Canal', 'Channel'), 'hash'], ['group', L('Grupo privado', 'Private group'), 'lock'], ['dm', L('Directo', 'Direct'), 'message']] as const).map(([k, lbl, ic]) => (
                    <button key={k} onClick={() => setComposeTab(k as any)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '6px 4px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 600, background: composeTab === k ? 'var(--tx)' : 'transparent', color: composeTab === k ? 'var(--card)' : 'var(--mut)' }}><Icon name={ic as any} size={13} /> {lbl}</button>
                  ))}
                </div>

                {composeTab === 'channel' && (<>
                  <div className="muted" style={{ fontSize: 11, margin: '2px 0 6px' }}>{L('Canal abierto — lo ve todo el equipo', 'Open channel — the whole team sees it')}</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input value={newCh} onChange={(e) => setNewCh(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') createChannel(); }} placeholder={L('nombre-del-canal', 'channel-name')} style={{ margin: 0, fontSize: 13 }} />
                    <button className="btn btn-ghost" onClick={() => createChannel()} style={{ padding: '0 12px', flex: 'none' }}>{L('Crear', 'Create')}</button>
                  </div>
                </>)}

                {composeTab === 'group' && (<>
                  <div className="muted" style={{ fontSize: 11, margin: '2px 0 6px' }}><Icon name="lock" size={11} /> {L('Grupo privado — solo lo ven quienes elijas', 'Private group — only the people you pick can see it')}</div>
                  <input value={grpName} onChange={(e) => setGrpName(e.target.value)} placeholder={L('Nombre del grupo', 'Group name')} style={{ margin: '0 0 8px', fontSize: 13 }} />
                  <div className="muted" style={{ fontSize: 11, margin: '0 0 4px', display: 'flex', justifyContent: 'space-between' }}><span>{L('Miembros', 'Members')}</span><span>{grpMembers.length} {L('elegidos', 'picked')}</span></div>
                  <div style={{ maxHeight: 150, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 10, padding: 4 }}>
                    {team.filter((t) => t.id !== me).map((t) => { const av = avatarOf(t.name); const on = grpMembers.includes(t.id); return (
                      <button key={t.id} onClick={() => setGrpMembers((m) => (m.includes(t.id) ? m.filter((x) => x !== t.id) : [...m, t.id]))} style={{ display: 'flex', gap: 9, alignItems: 'center', width: '100%', textAlign: 'left', background: on ? 'var(--bg2)' : 'transparent', border: 'none', padding: '6px 6px', cursor: 'pointer', color: 'var(--tx)', borderRadius: 8 }}>
                        <span style={{ width: 28, height: 28, borderRadius: '50%', background: av.bg, color: av.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flex: 'none' }}>{initials(t.name)}</span>
                        <span style={{ flex: 1, minWidth: 0 }}><span style={{ fontSize: 13, display: 'block' }}>{t.name}</span><span className="muted" style={{ fontSize: 10.5 }}>{roleLabel(t.role, en)}</span></span>
                        <span style={{ width: 20, height: 20, borderRadius: 6, flex: 'none', border: on ? 'none' : '1.5px solid var(--line)', background: on ? 'var(--tx)' : 'transparent', color: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{on && <Icon name="check" size={13} />}</span>
                      </button>
                    ); })}
                  </div>
                  <button className="btn btn-ghost" onClick={() => createGroup()} disabled={!grpName.trim() || !grpMembers.length} style={{ marginTop: 8, width: '100%', opacity: (!grpName.trim() || !grpMembers.length) ? .5 : 1 }}>{L('Crear grupo', 'Create group')}</button>
                </>)}

                {composeTab === 'dm' && (<>
                  <div className="muted" style={{ fontSize: 11, margin: '2px 0 4px' }}>{L('Mensaje directo con…', 'Direct message with…')}</div>
                  <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                    {team.filter((t) => t.id !== me).map((t) => { const av = avatarOf(t.name); return (
                      <div key={t.id} style={{ display: 'flex', gap: 9, alignItems: 'center', width: '100%', padding: '6px 4px', borderRadius: 8 }}>
                        <button onClick={() => { openDM(t.id); setShowCompose(false); }} style={{ display: 'flex', gap: 9, alignItems: 'center', flex: 1, minWidth: 0, textAlign: 'left', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--tx)' }}>
                          <span style={{ position: 'relative', width: 30, height: 30, borderRadius: '50%', background: av.bg, color: av.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flex: 'none' }}>{initials(t.name)}
                            <span style={{ position: 'absolute', right: -1, bottom: -1, width: 8, height: 8, borderRadius: '50%', background: onlineIds.has(t.id) ? 'var(--soft-green)' : 'var(--mut)', border: '1.5px solid var(--card)' }} />
                          </span>
                          <span style={{ flex: 1, minWidth: 0 }}><span style={{ fontSize: 13, display: 'block' }}>{t.name}</span><span className="muted" style={{ fontSize: 10.5, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{metaOf(t, roleLabel(t.role, en))}</span></span>
                        </button>
                        {canEditOthers && (
                          <button onClick={(e) => { e.stopPropagation(); openProfile(t.id); }} title={L('Editar ficha (puesto · país · idiomas)', 'Edit profile (role · country · languages)')} style={{ width: 28, height: 28, flex: 'none', borderRadius: 8, background: 'var(--bg2)', border: '1px solid var(--line)', color: 'var(--mut)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><OnyxIcon emoji="✏️" size={13} glow={false} /></button>
                        )}
                      </div>
                    ); })}
                  </div>
                </>)}
              </div>
            )}
            <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
              {convos.length === 0 && <div className="muted" style={{ fontSize: 12, padding: 18, textAlign: 'center' }}>{L('Sin conversaciones.', 'No chats.')}</div>}
              {convos.map((c) => (
                <ConvCard key={c.id} c={c} active={c.id === active} online={c.isDm ? onlineIds.has(c.otherId) : undefined} en={en} onClick={() => { setActive(c.id); setMobileOpen(true); }} />
              ))}
            </div>
            </>)}
          </div>

          {/* Panel de chat */}
          <div className={'teamchat-main' + (mobileOpen ? ' tc-fs-m' : ' tc-hidden-m')} style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
            {activeCh ? (<>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderBottom: '1px solid var(--line)', background: 'var(--bg2)' }}>
                <button className="tc-back" onClick={() => setMobileOpen(false)} style={{ display: 'none', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--tx)', lineHeight: 1, padding: '4px 2px' }}><Icon name="back" size={22} /></button>
                {(() => { const dm = activeCh.kind === 'dm'; const grp = activeCh.kind === 'group'; return (
                  <span style={{ width: 38, height: 38, borderRadius: 12, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: dm ? 12 : 17, fontWeight: 700, background: 'var(--bg2)', border: '1px solid var(--line)', color: 'var(--tx)' }}>{dm ? initials(headerName) : grp ? <Icon name="lock" size={16} /> : <Icon name="hash" size={18} />}</span>
                ); })()}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{(activeCh.kind === 'dm' ? '' : activeCh.kind === 'group' ? '' : '# ') + headerName}</div>
                  <div style={{ fontSize: 11.5, color: typingLabel ? 'var(--soft-green)' : 'var(--mut)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{headerStatus}</div>
                </div>
                <button title={L('Buscar por día', 'Search by day')} onClick={() => setShowDate((s) => !s)} style={iconBtn}><Icon name="calendar" size={18} /></button>
                <div style={{ position: 'relative' }}>
                  <button title={isGroupCh ? L('Miembros del grupo', 'Group members') : L('Añadir compañero', 'Add teammate')} onClick={() => setShowAdd((s) => !s)} style={iconBtn}><Icon name={isGroupCh ? 'users' : 'userPlus'} size={18} /></button>
                  {showAdd && (
                    <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 6, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, boxShadow: '0 12px 30px rgba(0,0,0,.3)', zIndex: 30, width: 244, maxHeight: 320, overflowY: 'auto' }}>
                      {/* En un grupo: miembros actuales (con quitar) + añadir + salir */}
                      {isGroupCh && (<>
                        <div className="muted" style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: .3, textTransform: 'uppercase', padding: '9px 11px 5px' }}>{L('En el grupo', 'In the group')}</div>
                        {convoMembers.map((t) => { const av = avatarOf(t.name); const self = t.id === me; return (
                          <div key={t.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '7px 11px', borderBottom: '1px solid var(--line)' }}>
                            <span style={{ width: 26, height: 26, borderRadius: '50%', background: av.bg, color: av.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flex: 'none' }}>{initials(t.name)}</span>
                            <span style={{ fontSize: 12.5, flex: 1, minWidth: 0 }}>{t.name}{self && <span className="muted"> · {L('tú', 'you')}</span>}</span>
                            {!self && <button title={L('Quitar', 'Remove')} onClick={() => removeMember(t.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--mut)', padding: 2, display: 'flex' }}><Icon name="x" size={14} /></button>}
                          </div>
                        ); })}
                        {!!canAdd.length && <div className="muted" style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: .3, textTransform: 'uppercase', padding: '9px 11px 5px' }}>{L('Añadir', 'Add')}</div>}
                      </>)}
                      {(isGroupCh || activeCh.kind === 'dm' ? canAdd : team.filter((t) => t.id !== me)).map((t) => { const av = avatarOf(t.name); return (
                        <button key={t.id} onClick={() => addMember(t.id)} style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', borderBottom: '1px solid var(--line)', padding: '8px 11px', cursor: 'pointer', color: 'var(--tx)' }}>
                          <span style={{ width: 26, height: 26, borderRadius: '50%', background: av.bg, color: av.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flex: 'none' }}>{initials(t.name)}</span>
                          <span style={{ fontSize: 12.5, flex: 1, minWidth: 0 }}>{t.name}<span className="muted" style={{ fontSize: 10.5, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{metaOf(t, roleLabel(t.role, en))}</span></span>
                          <Icon name="plus" size={14} style={{ color: 'var(--mut)' }} />
                        </button>
                      ); })}
                      {(isGroupCh || activeCh.kind === 'dm') && !canAdd.length && <div className="muted" style={{ fontSize: 12, padding: 10 }}>{L('Ya están todos.', 'Everyone is in.')}</div>}
                      {isGroupCh && (
                        <button onClick={() => removeMember(me)} style={{ display: 'flex', gap: 7, alignItems: 'center', justifyContent: 'center', width: '100%', background: 'transparent', border: 'none', borderTop: '1px solid var(--line)', padding: '9px 11px', cursor: 'pointer', color: 'var(--soft-red, #ff8a97)', fontSize: 12.5, fontWeight: 600 }}><Icon name="back" size={14} /> {L('Salir del grupo', 'Leave group')}</button>
                      )}
                    </div>
                  )}
                </div>
                <button className="tc-hidden-m" title={L('Abrir en ventana', 'Open in window')} onClick={() => openDock(active)} style={iconBtn}><Icon name="window" size={18} /></button>
              </div>
              {showDate && (
                <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'center' }}>
                  <Calendar value={date} en={en} max={new Date().toISOString().slice(0, 10)} onChange={(d) => { setDate(d); if (d) setShowDate(false); }} />
                </div>
              )}
              <div style={{ padding: '10px 14px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, background: 'var(--bg)' }}>
                <ChatThread variant="mono" fill enableActions vivid onReact={onReactMain} onPin={onPinMain} onToTicket={onToTicketMain} messages={mapped} lang={lang as any} onSend={send} onTyping={sendTyping} mentionSource={mentionSource} showAuthors height={Math.max(240, gridH - 150)} typingLabel={typingLabel}
                  placeholder={L('Escribe… @ para etiquetar, @Onyx para la IA', 'Type… @ to tag, @Onyx for AI')}
                  emptyText={date ? L('Sin mensajes ese día.', 'No messages that day.') : L('Sé el primero en escribir 👋', 'Be the first to write 👋')} />
              </div>
            </>) : <div className="muted" style={{ margin: 'auto', fontSize: 13, padding: 24, textAlign: 'center' }}>{L('Elige una conversación para empezar.', 'Pick a chat to start.')}</div>}
          </div>
        </div>
      </div>

      {/* Modal: editar MI ficha de equipo (puesto · país · idiomas) */}
      {showProfile && (
        <div onClick={() => setShowProfile(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16, padding: 20, width: 360, maxWidth: '100%', boxShadow: '0 20px 50px rgba(0,0,0,.4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <span style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="user" size={17} /></span>
              <b style={{ fontSize: 15 }}>{pfTarget ? (L('Ficha de ', 'Profile of ') + (teamById[pfTarget]?.name || '')) : L('Mi ficha de equipo', 'My team profile')}</b>
            </div>
            <label className="muted" style={{ fontSize: 11.5, display: 'block', marginBottom: 4 }}>{L('Puesto', 'Job title')}</label>
            <input value={pf.job_title} onChange={(e) => setPf({ ...pf, job_title: e.target.value })} placeholder={L('p. ej. Soporte N2', 'e.g. Support L2')} style={{ margin: '0 0 12px', fontSize: 13 }} />
            <label className="muted" style={{ fontSize: 11.5, display: 'block', marginBottom: 4 }}>{L('País', 'Country')}</label>
            <select value={COUNTRIES.some((c) => c.name.toLowerCase() === (pf.country || '').toLowerCase()) ? pf.country : ''} onChange={(e) => setPf({ ...pf, country: e.target.value })} style={{ margin: '0 0 12px', fontSize: 13, width: '100%' }}>
              <option value="">{L('— Elige tu país —', '— Choose your country —')}</option>
              {COUNTRIES.map((c) => <option key={c.name} value={c.name}>{c.flag} {c.name}</option>)}
            </select>
            <label className="muted" style={{ fontSize: 11.5, display: 'block', marginBottom: 6 }}>{L('Idiomas que hablas', 'Languages you speak')}</label>
            {(() => {
              const sel = (pf.languages || '').split(',').map((s) => s.trim()).filter(Boolean);
              const has = (x: string) => sel.some((s) => s.toLowerCase() === x.toLowerCase());
              const toggle = (x: string) => { const next = has(x) ? sel.filter((s) => s.toLowerCase() !== x.toLowerCase()) : [...sel, x]; setPf({ ...pf, languages: next.join(', ') }); };
              return (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '0 0 16px' }}>
                  {LANGS.map((lg) => {
                    const on = has(lg);
                    return <button key={lg} type="button" onClick={() => toggle(lg)} style={{ fontSize: 11.5, padding: '4px 10px', borderRadius: 999, cursor: 'pointer', border: '1px solid ' + (on ? 'var(--brand)' : 'var(--line)'), background: on ? 'color-mix(in srgb, var(--brand) 18%, var(--bg2))' : 'var(--bg2)', color: on ? 'var(--brand)' : 'var(--tx)' }}>{lg}</button>;
                  })}
                </div>
              );
            })()}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowProfile(false)}>{L('Cancelar', 'Cancel')}</button>
              <button className="btn btn-ghost" style={{ background: 'var(--tx)', color: 'var(--card)', border: 'none' }} onClick={saveProfile}>{L('Guardar', 'Save')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Ventanas acopladas: varios chats abiertos a la vez */}
      <div className="teamchat-docks" style={{ position: 'fixed', right: 16, bottom: 12, display: 'flex', gap: 12, alignItems: 'flex-end', zIndex: 1500 }}>
        {docks.map((id, i) => {
          const c = channels.find((x) => x.id === id); if (!c) return null;
          const title = c.kind === 'dm' ? (teamById[c.members.find((m) => m !== me) || '']?.name || c.name) : c.kind === 'group' ? '🔒 ' + c.name : '# ' + c.name;
          return <DockWindow key={id} channelId={id} title={title} me={meP} lang={lang as any} onClose={() => closeDock(id)} onActivity={loadChannels} index={i} />;
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
          .teamchat-docks{display:none !important}
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
    <div onClick={onClick} style={{ display: 'flex', gap: 11, alignItems: 'center', margin: '0 8px', padding: '10px', borderRadius: 12, cursor: 'pointer', background: active ? 'var(--bg2)' : 'transparent', boxShadow: active ? 'inset 2px 0 0 var(--tx)' : 'none' }}>
      <span style={{ position: 'relative', width: 42, height: 42, borderRadius: 13, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: c.isDm ? 14 : 18, fontWeight: 700, background: 'var(--bg2)', border: '1px solid var(--line)', color: 'var(--tx)' }}>
        {c.isDm ? initials(c.display) : c.isGroup ? <Icon name="lock" size={16} /> : <Icon name="hash" size={18} />}
        {c.isDm && <span style={{ position: 'absolute', right: -1, bottom: -1, width: 11, height: 11, borderRadius: '50%', background: online ? 'var(--soft-green)' : 'var(--mut)', border: '2px solid var(--bg2)' }} />}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
          <span style={{ fontSize: 13.5, fontWeight: c.unread ? 700 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.display}</span>
          <span style={{ fontSize: 11, color: c.unread ? 'var(--tx)' : 'var(--mut)', fontWeight: c.unread ? 700 : 400, flex: 'none' }}>{shortWhen(c.last?.created_at, en)}</span>
        </span>
        <span style={{ display: 'flex', justifyContent: 'space-between', gap: 6, alignItems: 'center', marginTop: 1, minWidth: 0 }}>
          <span className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0, flex: 1 }}>{c.last ? (c.last.body || (en ? '📎 attachment' : '📎 adjunto')) : (en ? 'No messages' : 'Sin mensajes')}</span>
          {c.unread > 0 && <span style={{ background: 'var(--tx)', color: 'var(--card)', fontSize: 10.5, fontWeight: 700, minWidth: 18, height: 18, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', flex: 'none' }}>{c.unread}</span>}
        </span>
      </span>
    </div>
  );
}

// Ventana de chat acoplada (flotante). Estado y tiempo real propios.
// El empleado la puede MOVER (arrastrando la cabecera), AGRANDAR (esquina o
// botón expandir) y RECOGER (chevron). Nunca se sale de la pantalla y recuerda
// su tamaño y posición entre sesiones (localStorage). En móvil se ancla abajo.
type Box = { x: number; y: number; w: number; h: number };
const DOCK_MIN_W = 260, DOCK_MIN_H = 240, DOCK_DEF_W = 320, DOCK_DEF_H = 440, DOCK_BAR = 42, DOCK_PAD = 12;
const clampBox = (b: Box): Box => {
  const vw = window.innerWidth, vh = window.innerHeight;
  const w = Math.max(DOCK_MIN_W, Math.min(b.w, vw - 16));
  const h = Math.max(DOCK_MIN_H, Math.min(b.h, vh - 16));
  const x = Math.max(8, Math.min(b.x, vw - w - 8));
  const y = Math.max(8, Math.min(b.y, vh - h - 8));
  return { x, y, w, h };
};

function DockWindow({ channelId, title, me, lang, onClose, onActivity, index }: { channelId: string; title: string; me: Presence | null; lang: 'es' | 'en'; onClose: () => void; onActivity: () => void; index: number }) {
  const [rows, setRows] = useState<any[]>([]);
  const [min, setMin] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [box, setBox] = useState<Box>({ x: 0, y: 0, w: DOCK_DEF_W, h: DOCK_DEF_H });
  const prevBox = useRef<Box | null>(null);   // para el botón expandir (recuerda el tamaño anterior)
  const KEY = 'onyx_dock_' + channelId;

  async function load() {
    try { const r = await fetch('/api/team/chat/messages?channel=' + channelId); const j = await r.json(); setRows(j.messages || []); } catch {}
    try { await fetch('/api/team/chat/read', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ channel: channelId }) }); } catch {}
  }
  useEffect(() => { load(); }, [channelId]);
  const { typing, ping, sendTyping } = useChatRealtime(`team:${channelId}`, me, load);
  async function send(text: string, attachments: Att[], opts?: { replyTo?: string; urgent?: boolean }) { const j = await postMessage(channelId, text, attachments, opts); if (j.ok) { await load(); ping(); onActivity(); } }
  async function onReactDock(id: string, emoji: string) { await reactMsg(id, emoji); await load(); }
  async function onPinDock(id: string, pinned: boolean) { await pinMsg(id, pinned); await load(); }
  async function onToTicketDock(m: any) {
    const bodyTxt = String(m?.body || '').trim();
    if (!bodyTxt) { alert(lang === 'en' ? 'The message has no text to convert.' : 'El mensaje no tiene texto para convertir.'); return; }
    const subject = window.prompt(lang === 'en' ? 'Ticket subject:' : 'Asunto del ticket:', bodyTxt.slice(0, 80));
    if (subject === null) return;
    const email = window.prompt(lang === 'en' ? 'Customer email (optional):' : 'Correo del cliente (opcional):', '') || '';
    try {
      const r = await fetch('/api/admin/support/from-team', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ subject: subject || bodyTxt.slice(0, 80), body: bodyTxt, email }) });
      const j = await r.json();
      alert(j.ok ? (lang === 'en' ? 'Ticket created ✓ — in Admin → Support.' : 'Ticket creado ✓ — en Admin → Soporte.') : (lang === 'en' ? 'Could not create the ticket.' : 'No se pudo crear el ticket.'));
    } catch { alert(lang === 'en' ? 'Network error creating the ticket.' : 'Error de red al crear el ticket.'); }
  }
  const typingLabel = typing.length ? `${typing[0]} ${lang === 'en' ? 'is typing…' : 'está escribiendo…'}` : '';

  // Al montar: leer tamaño/posición guardados; si no hay, esquina inferior derecha (apilando).
  useEffect(() => {
    const isM = window.innerWidth <= 560; setMobile(isM);
    if (isM) return;
    let s: any = null; try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch {}
    const w = s?.w || DOCK_DEF_W, h = s?.h || DOCK_DEF_H;
    const off = index * 30;
    const x = s?.x != null ? s.x : window.innerWidth - w - 16 - off;
    const y = s?.y != null ? s.y : window.innerHeight - h - 16 - off;
    setBox(clampBox({ x, y, w, h }));
  }, []);
  // Si cambia el tamaño de la ventana del navegador, reacomodar dentro de la pantalla.
  useEffect(() => {
    const f = () => { const isM = window.innerWidth <= 560; setMobile(isM); if (!isM) setBox((b) => clampBox(b)); };
    window.addEventListener('resize', f); return () => window.removeEventListener('resize', f);
  }, []);
  const persist = (b: Box) => { try { localStorage.setItem(KEY, JSON.stringify(b)); } catch {} };

  // Arrastrar desde la cabecera.
  function startDrag(e: React.PointerEvent) {
    if (mobile) return;
    const sx = e.clientX, sy = e.clientY, ox = box.x, oy = box.y;
    const move = (ev: PointerEvent) => setBox((b) => clampBox({ ...b, x: ox + (ev.clientX - sx), y: oy + (ev.clientY - sy) }));
    const up = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.body.style.userSelect = ''; setBox((b) => { persist(b); return b; }); };
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', up); document.body.style.userSelect = 'none';
  }
  // Redimensionar desde la esquina inferior derecha.
  function startResize(e: React.PointerEvent) {
    e.stopPropagation();
    const sx = e.clientX, sy = e.clientY, ow = box.w, oh = box.h;
    const move = (ev: PointerEvent) => setBox((b) => clampBox({ ...b, w: ow + (ev.clientX - sx), h: oh + (ev.clientY - sy) }));
    const up = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.body.style.userSelect = ''; setBox((b) => { persist(b); return b; }); };
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', up); document.body.style.userSelect = 'none';
  }
  // Expandir / restaurar.
  function toggleExpand() {
    if (prevBox.current) { const b = clampBox(prevBox.current); prevBox.current = null; setBox(b); persist(b); }
    else { prevBox.current = box; const b = clampBox({ x: 8, y: 8, w: Math.min(760, window.innerWidth - 16), h: window.innerHeight - 16 }); setBox(b); persist(b); }
  }

  const barBtn: any = { width: 28, height: 28, borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--mut)', display: 'flex', alignItems: 'center', justifyContent: 'center' };
  const frame: any = mobile
    ? { width: '100%', background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '14px 14px 0 0', boxShadow: '0 -6px 30px rgba(0,0,0,.35)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }
    : { position: 'fixed', left: box.x, top: box.y, width: box.w, height: min ? undefined : box.h, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, boxShadow: '0 18px 50px rgba(0,0,0,.5)', overflow: 'hidden', display: 'flex', flexDirection: 'column', zIndex: 1600 };
  const innerH = Math.max(160, box.h - DOCK_BAR - 60);

  return (
    <div className="teamchat-dock" style={frame}>
      <div onPointerDown={startDrag} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderBottom: min ? 'none' : '1px solid var(--line)', background: 'var(--bg2)', cursor: mobile ? 'default' : 'grab', flex: 'none', touchAction: 'none' }}>
        {!mobile && <span style={{ color: 'var(--mut)', display: 'flex' }}><Icon name="grip" size={16} /></span>}
        <b style={{ fontSize: 13, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</b>
        {!mobile && <button title={prevBox.current ? (lang === 'en' ? 'Restore' : 'Restaurar') : (lang === 'en' ? 'Expand' : 'Expandir')} onPointerDown={(e) => e.stopPropagation()} onClick={toggleExpand} style={barBtn}><Icon name="expand" size={15} /></button>}
        <button title={min ? (lang === 'en' ? 'Open' : 'Abrir') : (lang === 'en' ? 'Collapse' : 'Recoger')} onPointerDown={(e) => e.stopPropagation()} onClick={() => setMin((m) => !m)} style={barBtn}><Icon name="chevronDown" size={16} style={{ transform: min ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} /></button>
        <button title={lang === 'en' ? 'Close' : 'Cerrar'} onPointerDown={(e) => e.stopPropagation()} onClick={onClose} style={barBtn}><Icon name="x" size={15} /></button>
      </div>
      {!min && (
        <div style={{ flex: 1, minHeight: 0, padding: '8px 10px', display: 'flex', flexDirection: 'column' }}>
          <ChatThread variant="mono" fill enableActions vivid onReact={onReactDock} onPin={onPinDock} onToTicket={onToTicketDock} messages={toChat(rows, me?.id || '')} lang={lang} onSend={send} onTyping={sendTyping} mentionSource={mentionSource} showAuthors height={mobile ? 300 : innerH} typingLabel={typingLabel}
            placeholder={lang === 'en' ? 'Type…' : 'Escribe…'} />
        </div>
      )}
      {!min && !mobile && (
        <div onPointerDown={startResize} title={lang === 'en' ? 'Resize' : 'Cambiar tamaño'} style={{ position: 'absolute', right: 2, bottom: 2, width: 18, height: 18, cursor: 'nwse-resize', color: 'var(--mut)', display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', touchAction: 'none' }}><Icon name="resize" size={16} /></div>
      )}
    </div>
  );
}
