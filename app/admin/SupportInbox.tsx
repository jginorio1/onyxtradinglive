'use client';
import { useEffect, useRef, useState } from 'react';
import { toast } from '@/lib/toast';
import { useT } from '@/lib/adminText';
import { useLang } from '@/lib/lang';
import { fmtDate, fmtDateTime } from '@/lib/fmtDate';
import RangeBar, { type Range, defaultRange } from './RangeBar';
import UserDrawer from './UserDrawer';
import { useChatRealtime } from '@/lib/chatRealtime';
import ChatThread, { type Att, type ChatMsg } from '@/app/components/ChatThread';
import Icon from '@/app/components/Icons';

const stColor: any = { open: 'var(--brand)', in_progress: 'var(--amber)', resolved: 'var(--green)' };
const stBg: any = { open: 'rgba(124,140,255,.15)', in_progress: 'rgba(255,192,77,.15)', resolved: 'rgba(52,226,160,.15)' };
const prioColor: any = { high: 'var(--red)', normal: 'var(--mut)', low: 'var(--line)' };
const initials = (email: string) => (email || '?').replace(/@.*/, '').slice(0, 2).toUpperCase();
// Avatares de color por email (consistentes) — para la lista tipo WhatsApp.
const AV = [
  { bg: 'rgba(124,140,255,.20)', fg: '#8f9bff' }, { bg: 'rgba(52,226,160,.20)', fg: '#34e2a0' },
  { bg: 'rgba(255,192,77,.20)', fg: '#ffc04d' }, { bg: 'rgba(255,107,125,.20)', fg: '#ff8a97' },
  { bg: 'rgba(94,207,255,.20)', fg: '#5ecfff' }, { bg: 'rgba(197,132,255,.20)', fg: '#c584ff' },
];
const avatarOf = (s?: string) => AV[Math.abs([...String(s || '?')].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7)) % AV.length];
const EMO = ['👍', '🙏', '✅', '🔥', '🎉', '😀', '😅', '😎', '🤝', '👌', '💪', '🚀', '💰', '📈', '🛡️', '🤖', '❤️', '👀', '⏳', '⚠️'];

// Tiempo relativo corto: "hace 5m", "hace 2h", "ayer"…
function ago(ts: any, es: boolean): string {
  if (!ts) return '';
  const s = (Date.now() - new Date(ts).getTime()) / 1000;
  if (s < 60) return es ? 'ahora' : 'now';
  const m = Math.floor(s / 60); if (m < 60) return es ? `hace ${m}m` : `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return es ? `hace ${h}h` : `${h}h ago`;
  const d = Math.floor(h / 24); if (d === 1) return es ? 'ayer' : 'yesterday';
  return es ? `hace ${d}d` : `${d}d ago`;
}

const L: any = {
  es: {
    fMine: 'Mías', fUnassigned: 'Sin asignar', needsReply: 'Espera respuesta',
    ctxTitle: 'Ficha del trader', ctxLead: 'Visitante sin cuenta (lead)', ctxNoUser: 'No tiene cuenta en Onyx todavía.',
    plan: 'Plan', member: 'Miembro desde', accounts: 'Cuentas', funded: 'de fondeo', prior: 'Tickets antes',
    langF: 'Idioma', country: 'País', firm: 'Prop firm', firstSeen: 'Primer contacto', none: '—',
    canned: 'Respuesta guardada', cannedNew: 'Nueva respuesta guardada', cTitle: 'Título corto',
    cBody: 'Texto de la respuesta', cSave: 'Guardar', cManage: 'Guardadas', cEmpty: 'Aún no tienes respuestas guardadas.',
    cDel: 'Borrar', prio: 'Prioridad', pHigh: 'Alta', pNormal: 'Normal', pLow: 'Baja', insert: 'Usar',
    aiAuto: 'Auto-respuesta IA', aiAutoOn: 'La IA responde sola los tickets fáciles (nunca temas de dinero).', aiAutoOff: 'Apagada: todos los tickets esperan a una persona.',
    invTitle: 'Invitar a un compañero', online: 'En línea', lastSeen: 'Última vez', never: 'Sin actividad aún', allIn: 'Todo el equipo ya está en esta conversación.',
    saveKb: 'Guardar como conocimiento', saveKbOk: 'Guardado en la Base IA. La IA lo reutilizará.', saveKbNone: 'No hay una respuesta que guardar todavía.',
    online5: 'en línea', ficha: 'Ficha', online2: 'activo ahora', typing: 'está escribiendo…', attach: 'Adjuntar', emoji: 'Emojis',
  },
  en: {
    fMine: 'Mine', fUnassigned: 'Unassigned', needsReply: 'Awaiting reply',
    ctxTitle: 'Trader profile', ctxLead: 'Visitor without account (lead)', ctxNoUser: 'No Onyx account yet.',
    plan: 'Plan', member: 'Member since', accounts: 'Accounts', funded: 'funded', prior: 'Prior tickets',
    langF: 'Language', country: 'Country', firm: 'Prop firm', firstSeen: 'First contact', none: '—',
    canned: 'Saved reply', cannedNew: 'New saved reply', cTitle: 'Short title',
    cBody: 'Reply text', cSave: 'Save', cManage: 'Saved replies', cEmpty: 'No saved replies yet.',
    cDel: 'Delete', prio: 'Priority', pHigh: 'High', pNormal: 'Normal', pLow: 'Low', insert: 'Use',
    aiAuto: 'AI auto-reply', aiAutoOn: 'AI answers easy tickets on its own (never money topics).', aiAutoOff: 'Off: every ticket waits for a person.',
    invTitle: 'Invite a teammate', online: 'Online', lastSeen: 'Last seen', never: 'No activity yet', allIn: 'The whole team is already in this conversation.',
    saveKb: 'Save as knowledge', saveKbOk: 'Saved to the Knowledge Base. The AI will reuse it.', saveKbNone: 'There is no answer to save yet.',
    online5: 'online', ficha: 'Profile', online2: 'active now', typing: 'is typing…', attach: 'Attach', emoji: 'Emojis',
  },
};

const kb = (n?: number) => (!n ? '' : n < 1024 ? `${n} B` : n < 1048576 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(1)} MB`);

export default function SupportInbox() {
  const t = useT();
  const { lang } = useLang();
  const l = L[lang] || L.es;
  const es = lang !== 'en';
  const [drawerUser, setDrawerUser] = useState<{ id: string; email: string } | null>(null);
  const [range, setRange] = useState<Range>(() => defaultRange('month'));
  const ST: any = { open: t.st_open, in_progress: t.st_inprogress, resolved: t.st_resolved };
  const CATS: any = { general: t.cat_general, conexion: t.cat_conexion, instalacion: t.cat_instalacion, guardian: t.cat_guardian, facturacion: t.cat_facturacion };
  const CH: any = { ticket: t.ch_ticket, chat: t.ch_chat, lead: t.ch_lead, email: t.ch_email };
  const [tickets, setTickets] = useState<any[]>([]);
  const [msgs, setMsgs] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [team, setTeam] = useState<any[]>([]);
  const [counts, setCounts] = useState<any>({});
  const [me, setMe] = useState<string>('');
  const [filter, setFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved' | 'mine' | 'unassigned'>('open');
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false); // en móvil: chat a pantalla completa
  // Alto medido: los paneles llenan desde su borde superior hasta el fondo de la
  // ventana → el composer SIEMPRE queda visible pase lo que pase arriba.
  const wrapRef = useRef<HTMLDivElement>(null);
  const [paneH, setPaneH] = useState(560);
  useEffect(() => {
    const f = () => { const top = wrapRef.current?.getBoundingClientRect().top ?? 220; setPaneH(Math.max(440, window.innerHeight - top - 16)); };
    f(); window.addEventListener('resize', f); const iv = setInterval(f, 1000);
    return () => { window.removeEventListener('resize', f); clearInterval(iv); };
  }, []);
  const [text, setText] = useState('');
  const [atts, setAtts] = useState<Att[]>([]);
  const [mode, setMode] = useState<'reply' | 'note'>('reply');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [busy, setBusy] = useState('');
  // Ficha del trader
  const [ctx, setCtx] = useState<any>(null);
  const [ctxLoading, setCtxLoading] = useState(false);
  // Respuestas guardadas
  const [canned, setCanned] = useState<any[]>([]);
  const [showCanned, setShowCanned] = useState(false);
  const [newC, setNewC] = useState<{ title: string; body: string } | null>(null);
  // Auto-respuesta IA
  const [aiOn, setAiOn] = useState<boolean | null>(null);
  async function loadAi() { try { const r = await fetch('/api/admin/support/settings'); const j = await r.json(); setAiOn(!!j.enabled); } catch {} }
  async function toggleAi() { const next = !aiOn; setAiOn(next); try { await fetch('/api/admin/support/settings', { method: 'POST', body: JSON.stringify({ enabled: next }) }); } catch {} }

  async function load() {
    try {
      const r = await fetch('/api/admin/support'); const j = await r.json();
      setTickets(j.tickets || []); setMsgs(j.messages || []); setParticipants(j.participants || []);
      setTeam(j.team || []); setCounts(j.counts || {}); setMe(j.me || '');
    } catch {}
  }
  async function loadCanned() { try { const r = await fetch('/api/admin/support/canned'); const j = await r.json(); setCanned(j.canned || []); } catch {} }
  useEffect(() => { load(); loadCanned(); loadAi(); const iv = setInterval(load, 8000); return () => clearInterval(iv); }, []);
  // Si llega con ?ticket=ID (desde el aviso sticky), abre esa conversación.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('ticket');
    if (id) { setFilter('all'); setOpenId(id); }
  }, []);

  // Al abrir un ticket, traer la ficha del trader y limpiar el compositor
  useEffect(() => {
    setShowInvite(false); setShowEmoji(false); setShowCanned(false); setText(''); setMode('reply');
    if (!openId) { setCtx(null); return; }
    setCtxLoading(true); setCtx(null);
    fetch('/api/admin/support/context?ticket_id=' + openId)
      .then((r) => r.json()).then((j) => setCtx(j)).catch(() => setCtx(null))
      .finally(() => setCtxLoading(false));
  }, [openId]);

  // Tiempo real de la conversación abierta + marcar leídos los mensajes del cliente.
  const meRt = openId ? { id: me || 'admin', name: t.sender_support || 'Soporte' } : null;
  const { typing, ping, sendTyping } = useChatRealtime(openId ? `support:${openId}` : null, meRt, load);
  useEffect(() => {
    if (!openId) return;
    fetch('/api/admin/support', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ticket_id: openId, read: true }) }).catch(() => {});
    setAtts([]);
  }, [openId, msgs.length]);

  // Subir foto/documento adjunto a la respuesta.
  async function uploadAtt(files: FileList) {
    for (const f of Array.from(files).slice(0, 5)) {
      if (f.size > 8 * 1024 * 1024) { toast(es ? 'Máximo 8 MB por archivo.' : 'Max 8 MB per file.'); continue; }
      const b64: string = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(f); });
      try {
        const r = await fetch('/api/chat/upload', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: f.name, type: f.type, data: b64 }) });
        const j = await r.json();
        if (j.url) setAtts((a) => [...a, { name: f.name, url: j.url, type: f.type, size: f.size }]);
        else toast(j.error || 'Error');
      } catch { toast('Error'); }
    }
  }

  const emailOf = (id: string) => (team.find((tm) => tm.id === id) || {}).email || '—';

  // ¿el último mensaje del ticket es del trader? → espera respuesta del equipo
  const lastSender: Record<string, string> = {};
  const lastMsgOf: Record<string, any> = {};
  for (const m of msgs) { lastSender[m.ticket_id] = m.sender; lastMsgOf[m.ticket_id] = m; }
  const needsReply = (id: string) => lastSender[id] === 'user';

  async function act(id: string, patch: any) {
    setBusy(id);
    await fetch('/api/admin/support', { method: 'PATCH', body: JSON.stringify({ ticket_id: id, ...patch }) });
    if (patch.body !== undefined || patch.note !== undefined) setText('');
    setBusy(''); await load();
    if (patch.body !== undefined) { setAtts([]); ping(); }
  }
  async function draft(id: string, firstUserMsg: string) {
    setBusy('ai' + id);
    try { const r = await fetch('/api/support/ai', { method: 'POST', body: JSON.stringify({ question: firstUserMsg, lang }) }); const j = await r.json(); setText(j.answer || ''); setMode('reply'); } catch {}
    setBusy('');
  }
  async function saveCanned() {
    if (!newC || !newC.title.trim() || !newC.body.trim()) return;
    await fetch('/api/admin/support/canned', { method: 'POST', body: JSON.stringify({ ...newC, lang }) });
    setNewC(null); await loadCanned();
  }
  async function delCanned(id: string) { await fetch('/api/admin/support/canned?id=' + id, { method: 'DELETE' }); await loadCanned(); }

  async function saveKnowledge(subject: string, tm: any[]) {
    const best = [...tm].reverse().find((m) => m.sender === 'admin' || m.sender === 'ai');
    if (!best || !String(best.body || '').trim()) { toast(l.saveKbNone); return; }
    try {
      await fetch('/api/admin/kb', { method: 'POST', body: JSON.stringify({ title: String(subject || 'Onyx').slice(0, 120), body: best.body, tags: 'soporte', published: true }) });
      toast(l.saveKbOk);
    } catch { }
  }

  let list = tickets.filter((it) => {
    if (filter === 'mine') return it.assignee_id === me;
    if (filter === 'unassigned') return !it.assignee_id;
    if (filter === 'all') return true;
    return it.status === filter;
  });
  if (q.trim()) { const s = q.toLowerCase(); list = list.filter((it) => (it.email || '').toLowerCase().includes(s) || (it.subject || '').toLowerCase().includes(s)); }

  const mineCount = tickets.filter((it) => it.assignee_id === me && it.status !== 'resolved').length;
  const unassignedCount = tickets.filter((it) => !it.assignee_id && it.status !== 'resolved').length;
  const tk = tickets.find((it) => it.id === openId);

  // ¿el trader está en línea? (usamos su presencia en el canal de tiempo real)
  const traderTyping = typing.length > 0;

  return (
    <div style={{ width: '100%' }}>
      <style>{`
        .wa-fil{font-size:12.5px;padding:6px 13px;border-radius:20px;border:1px solid var(--line);background:var(--card2);color:var(--mut);cursor:pointer;transition:all .12s}
        .wa-fil:hover{color:var(--tx)} .wa-fil.on{background:var(--brand);border-color:var(--brand);color:#fff}
        .wa2{display:grid;grid-template-columns:320px minmax(0,1fr);gap:14px;align-items:stretch}
        .wa-search{display:flex;align-items:center;gap:8px;background:var(--bg2);border:1px solid var(--line);border-radius:999px;padding:6px 12px;margin-left:auto;max-width:260px;flex:1;color:var(--mut)}
        .wa-back{display:none}
        @media(max-width:860px){
          .wa2{grid-template-columns:1fr}
          .wa-list{max-height:none;height:66vh}
          .wa-chat{display:none}
          .wa-hide-m{display:none !important}
          .wa-fs-m{display:flex !important;min-height:0;height:82vh}
          .wa-back{display:inline-flex !important}
        }
        .wa-list{background:var(--bg2);border:1px solid var(--line);border-radius:16px;padding:6px;overflow-y:auto}
        .wa-item{display:flex;gap:10px;align-items:flex-start;padding:10px;border-radius:12px;cursor:pointer;box-shadow:inset 0 0 0 0 var(--brand)}
        .wa-item:hover{background:var(--card)} .wa-item.on{background:linear-gradient(90deg,rgba(124,140,255,.16),transparent 82%);box-shadow:inset 2px 0 0 var(--brand)}
        .wa-chat{background:var(--card);border:1px solid var(--line);border-radius:16px;min-height:0;display:flex;flex-direction:column;overflow:hidden}
        .wa-head{display:flex;gap:10px;align-items:center;padding:11px 14px;border-bottom:1px solid var(--line);background:linear-gradient(90deg,rgba(124,140,255,.12),var(--card) 70%);flex-wrap:wrap;flex:none}
        .wa-body{flex:1;min-height:0;padding:6px 14px;display:flex;flex-direction:column;background:radial-gradient(120% 70% at 100% 0%,rgba(124,140,255,.07),transparent 60%),radial-gradient(120% 70% at 0% 100%,rgba(52,226,160,.05),transparent 55%)}
        .wa-comp{border-top:1px solid var(--line);padding:10px 12px;position:relative;flex:none;background:var(--bg2)}
        .wa-chip{display:inline-flex;align-items:center;gap:5px;font-size:12px;padding:6px 11px;border-radius:20px;border:1px solid var(--line);background:var(--card2);color:var(--tx);cursor:pointer}
        .wa-chip:hover{border-color:var(--brand)}
        .wa-av{width:40px;height:40px;border-radius:12px;background:rgba(124,140,255,.18);color:var(--brand);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600;flex:none}
        .wa-avs{width:40px;height:40px;border-radius:12px;background:rgba(124,140,255,.18);color:var(--brand);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;flex:none}
        .wa-hb{background:var(--card2);border:1px solid var(--line);cursor:pointer;color:var(--mut);display:inline-flex;align-items:center;justify-content:center;padding:8px;border-radius:10px}
        .wa-hb:hover{color:var(--tx);border-color:var(--brand)}
      `}</style>
      <div className="tabhead"><div className="th-row"><span className="th-ic" style={{ display: 'inline-flex' }}><Icon name="ticket" size={18} /></span><span className="th-t">{t.h_soporte_t}</span></div><div className="th-s">{t.h_soporte_s}</div></div>
      <RangeBar value={range} onChange={setRange}
        pdfUrl={(f, tt) => `/api/admin/support/report?from=${f}&to=${tt}&lang=${lang}`}
        csvUrl={(f, tt) => `/api/admin/support/report?export=csv&from=${f}&to=${tt}&lang=${lang}`} />

      {/* Interruptor de auto-respuesta IA */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ width: 30, height: 30, borderRadius: 9, flex: 'none', background: 'linear-gradient(135deg,#34e2a0,#7c8cff)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0b0d17' }}><Icon name="sparkles" size={17} /></span>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{l.aiAuto}</div>
          <div className="muted" style={{ fontSize: 12 }}>{aiOn === false ? l.aiAutoOff : l.aiAutoOn}</div>
        </div>
        <button className={'btn ' + (aiOn ? 'btn-primary' : 'btn-ghost')} style={{ fontSize: 13, minWidth: 64 }} onClick={toggleAi} disabled={aiOn === null}>
          {aiOn === null ? '…' : aiOn ? 'ON' : 'OFF'}
        </button>
      </div>

      <div className="row" style={{ gap: 7, marginBottom: 12, flexWrap: 'wrap' }}>
        {([['mine', l.fMine, mineCount], ['unassigned', l.fUnassigned, unassignedCount], ['open', t.s_open, counts.open], ['in_progress', t.s_inprogress, counts.in_progress], ['resolved', t.s_resolved, counts.resolved], ['all', t.s_all, null]] as any).map(([k, lab, c]: any) => (
          <button key={k} className={'wa-fil' + (filter === k ? ' on' : '')} onClick={() => setFilter(k)}>{lab}{c != null ? ` ${c}` : ''}</button>
        ))}
        <div className="wa-search"><Icon name="search" size={15} /><input placeholder={t.s_search} value={q} onChange={(e) => setQ(e.target.value)} style={{ margin: 0, border: 'none', background: 'transparent', padding: 0, fontSize: 13, width: '100%', color: 'var(--tx)' }} /></div>
      </div>

      <div className="wa2" ref={wrapRef}>
        {/* Lista de conversaciones estilo WhatsApp */}
        <div className={'wa-list' + (mobileOpen ? ' wa-hide-m' : '')} style={{ height: paneH }}>
          {!list.length && <p className="muted" style={{ fontSize: 13, padding: '10px 8px' }}>{t.s_empty}</p>}
          {list.map((it) => {
            const parts = participants.filter((p) => p.ticket_id === it.id);
            const nr = needsReply(it.id);
            const who = (it.email || '—').split('@')[0];
            const lm = lastMsgOf[it.id];
            const preview = lm ? ((lm.sender === 'note' ? '📝 ' : lm.sender === 'user' ? '' : '✓ ') + (lm.body || (lm.attachments?.length ? '📎 ' + (es ? 'archivo' : 'file') : ''))) : (it.subject || '');
            return (
              <div key={it.id} className={'wa-item' + (openId === it.id ? ' on' : '')} onClick={() => { setOpenId(it.id); setMobileOpen(true); }}>
                <span className="wa-avs" style={{ background: avatarOf(it.email).bg, color: avatarOf(it.email).fg }}>{initials(it.email || '?')}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row between" style={{ gap: 6 }}>
                    <b style={{ fontSize: 13, fontWeight: nr ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.subject || who}</b>
                    <span className="muted" style={{ fontSize: 10.5, flex: 'none' }}>{ago(it.updated_at, es)}</span>
                  </div>
                  <div className="muted" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{preview || who}</div>
                  <div className="row" style={{ gap: 5, marginTop: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span className="pill" style={{ color: stColor[it.status], background: stBg[it.status], fontSize: 10.5 }}>● {ST[it.status]}</span>
                    {it.is_lead && <span className="pill brand" style={{ fontSize: 10.5 }}>Lead</span>}
                    {it.priority && it.priority !== 'normal' && <span title={it.priority} style={{ width: 7, height: 7, borderRadius: '50%', background: prioColor[it.priority] }} />}
                    {parts.length > 0 && <span className="pill gray" style={{ fontSize: 10.5, display: 'inline-flex', alignItems: 'center', gap: 3 }}><Icon name="users" size={12} /> {parts.length}</span>}
                    {nr && <span title={l.needsReply} style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', background: 'var(--amber)', color: '#3a2a00', borderRadius: 999, padding: '2px 5px' }}><Icon name="back" size={12} stroke={2.4} /></span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Panel de conversación */}
        <div className={'wa-chat' + (mobileOpen ? ' wa-fs-m' : ' wa-hide-m')} style={{ height: paneH }}>
          {!tk && <div className="muted" style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', fontSize: 14, textAlign: 'center', padding: 20 }}>{t.s_pickOne}</div>}
          {tk && (() => {
            const tm = msgs.filter((m) => m.ticket_id === tk.id);
            const firstUser = tm.find((m) => m.sender === 'user')?.body || tk.subject;
            const parts = participants.filter((p) => p.ticket_id === tk.id);
            const cannedForLang = canned.filter((c) => c.lang === lang);
            const cannedList = cannedForLang.length ? cannedForLang : canned;
            const chatMsgs: ChatMsg[] = tm.map((m) => ({
              id: m.id,
              mine: m.sender === 'admin' || m.sender === 'ai',
              authorName: m.sender === 'user' ? (tk.email || t.s_visitor).split('@')[0] : m.sender === 'ai' ? 'Onyx AI' : t.sender_support,
              authorKind: m.sender === 'ai' ? 'ai' : m.sender === 'note' ? 'note' : m.sender === 'admin' ? 'admin' : 'user',
              body: m.body, attachments: m.attachments || [], createdAt: m.created_at, readAt: m.read_at,
            }));
            const inConvo = new Set([tk.assignee_id, me, ...parts.map((p) => p.user_id)].filter(Boolean));
            const cands = team.filter((tm2) => !inConvo.has(tm2.id));
            return (
              <>
                {/* Cabecera WhatsApp */}
                <div className="wa-head">
                  <button className="wa-hb wa-back" onClick={() => setMobileOpen(false)} title={es ? 'Volver' : 'Back'}><Icon name="back" size={20} /></button>
                  <span className="wa-av" style={{ background: avatarOf(tk.email).bg, color: avatarOf(tk.email).fg }}>{initials(tk.email || '?')}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tk.email || t.s_visitor}</div>
                    <div className="muted" style={{ fontSize: 11.5 }}>
                      {CATS[tk.category] || tk.category} · {CH[tk.channel] || tk.channel}{tk.is_lead ? ' · Lead' : ''}
                      {traderTyping && <span style={{ color: 'var(--soft-green)' }}> · {l.typing}</span>}
                    </div>
                  </div>
                  <select value={tk.priority || 'normal'} onChange={(e) => act(tk.id, { priority: e.target.value })} style={{ margin: 0, fontSize: 12, padding: '5px 8px' }} title={l.prio}>
                    <option value="high">{l.pHigh}</option>
                    <option value="normal">{l.pNormal}</option>
                    <option value="low">{l.pLow}</option>
                  </select>
                  {!tk.assignee_id && <button className="wa-hb" title={t.s_take} onClick={() => act(tk.id, { take: true })}><Icon name="hand" size={17} /></button>}
                  <button className="wa-hb" title={l.invTitle} onClick={() => setShowInvite((v) => !v)}><Icon name="userPlus" size={17} /></button>
                  {ctx?.user_id && <button className="wa-hb" title={l.ficha} onClick={() => setDrawerUser({ id: ctx.user_id, email: ctx.email || tk.email || '' })}><Icon name="info" size={17} /></button>}
                  {tk.status !== 'resolved'
                    ? <button className="wa-hb" title={t.s_resolve} style={{ color: 'var(--green)' }} onClick={() => act(tk.id, { status: 'resolved' })}><Icon name="check" size={17} /></button>
                    : <button className="wa-hb" title={t.s_reopen} onClick={() => act(tk.id, { status: 'open' })}><Icon name="refresh" size={17} /></button>}
                </div>

                {/* Invitar (desplegable) */}
                {showInvite && (
                  <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--line)', background: 'var(--bg2)' }}>
                    <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{l.invTitle}</div>
                    {!cands.length ? <div className="muted" style={{ fontSize: 12 }}>{l.allIn}</div> : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
                        {cands.map((tm2) => {
                          const online = tm2.last_active && (Date.now() - new Date(tm2.last_active).getTime()) < 5 * 60 * 1000;
                          return (
                            <div key={tm2.id} className="row between" style={{ gap: 8, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 8, padding: '6px 9px' }}>
                              <div className="row" style={{ gap: 8, minWidth: 0 }}>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: online ? 'var(--green)' : 'var(--mut)', flex: 'none' }} />
                                <span style={{ fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tm2.email}</span>
                              </div>
                              <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px', flex: 'none' }} onClick={() => { act(tk.id, { invite_email: tm2.email }); setShowInvite(false); }} disabled={busy === tk.id}>{t.s_inviteBtn}</button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Hilo estilo WhatsApp (burbujas izq/der, palomitas, adjuntos) */}
                <div className="wa-body">
                  <ChatThread messages={chatMsgs} lang={lang as any} onSend={() => {}} canReply={false} showAuthors
                    typingLabel={traderTyping ? `${t.sender_trader} ${l.typing}` : ''} height={Math.max(220, paneH - 196)} />
                </div>

                {/* Compositor */}
                <div className="wa-comp">
                  <div className="row between" style={{ gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                    <div className="seg">
                      <button className={'segbtn' + (mode === 'reply' ? ' on-view' : '')} onClick={() => setMode('reply')}>{t.s_reply}</button>
                      <button className={'segbtn' + (mode === 'note' ? ' on-view' : '')} onClick={() => setMode('note')} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="lock" size={13} /> {t.s_note}</button>
                    </div>
                    {mode === 'reply' && (
                      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                        <button className="wa-chip" onClick={() => setShowCanned((v) => !v)}><Icon name="plus" size={14} /> {l.canned}</button>
                        <button className="wa-chip" onClick={() => draft(tk.id, firstUser)} disabled={busy === 'ai' + tk.id}><Icon name="sparkles" size={14} /> {busy === 'ai' + tk.id ? '…' : t.s_aiDraft}</button>
                        <button className="wa-chip" title={l.saveKb} onClick={() => saveKnowledge(tk.subject, tm)}><Icon name="bulb" size={15} /></button>
                      </div>
                    )}
                  </div>

                  {/* Respuestas guardadas */}
                  {showCanned && mode === 'reply' && (
                    <div style={{ position: 'absolute', bottom: '100%', left: 12, right: 12, marginBottom: 8, zIndex: 20, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, padding: 10, boxShadow: '0 12px 30px rgba(0,0,0,.3)' }}>
                      {!newC && (
                        <>
                          {!cannedList.length && <div className="muted" style={{ fontSize: 12.5, marginBottom: 8 }}>{l.cEmpty}</div>}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 170, overflowY: 'auto' }}>
                            {cannedList.map((c) => (
                              <div key={c.id} className="row between" style={{ gap: 8, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 8, padding: '7px 9px' }}>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontSize: 12.5, fontWeight: 600 }}>{c.title}</div>
                                  <div className="muted" style={{ fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.body}</div>
                                </div>
                                <div className="row" style={{ gap: 4, flex: 'none' }}>
                                  <button className="btn btn-primary" style={{ fontSize: 11.5, padding: '4px 10px' }} onClick={() => { setText(c.body); setShowCanned(false); }}>{l.insert}</button>
                                  <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 8px', color: 'var(--red)', display: 'inline-flex' }} title={l.cDel} onClick={() => delCanned(c.id)}><Icon name="trash" size={15} /></button>
                                </div>
                              </div>
                            ))}
                          </div>
                          <button className="btn btn-ghost" style={{ fontSize: 12, marginTop: 8 }} onClick={() => setNewC({ title: '', body: '' })}>＋ {l.cannedNew}</button>
                        </>
                      )}
                      {newC && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <input placeholder={l.cTitle} value={newC.title} onChange={(e) => setNewC({ ...newC, title: e.target.value })} style={{ margin: 0, fontSize: 13 }} />
                          <textarea placeholder={l.cBody} value={newC.body} onChange={(e) => setNewC({ ...newC, body: e.target.value })} rows={3} style={{ width: '100%', margin: 0 }} />
                          <div className="row" style={{ gap: 6 }}>
                            <button className="btn btn-primary" style={{ fontSize: 12.5 }} onClick={saveCanned} disabled={!newC.title.trim() || !newC.body.trim()}>{l.cSave}</button>
                            <button className="btn btn-ghost" style={{ fontSize: 12.5, display: 'inline-flex' }} onClick={() => setNewC(null)}><Icon name="x" size={15} /></button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Chips de adjuntos por enviar */}
                  {mode === 'reply' && !!atts.length && (
                    <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                      {atts.map((a, i) => (
                        <span key={i} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 8, padding: '4px 8px', fontSize: 12 }}>
                          <Icon name={a.type.startsWith('image/') ? 'image' : 'file'} size={14} /> {a.name.slice(0, 24)}
                          <button onClick={() => setAtts((x) => x.filter((_, j) => j !== i))} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--mut)', display: 'flex' }}><Icon name="x" size={13} /></button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Emojis */}
                  {showEmoji && mode === 'reply' && (
                    <div style={{ position: 'absolute', bottom: '100%', left: 12, marginBottom: 8, zIndex: 20, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, padding: 8, boxShadow: '0 12px 30px rgba(0,0,0,.3)', display: 'grid', gridTemplateColumns: 'repeat(10,1fr)', gap: 3, width: 320 }}>
                      {EMO.map((e) => <button key={e} onClick={() => { setText((v) => v + e); setShowEmoji(false); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 18, padding: 3 }}>{e}</button>)}
                    </div>
                  )}

                  {/* Fila de entrada estilo WhatsApp */}
                  <div className="row" style={{ gap: 8, alignItems: 'flex-end' }}>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 2, background: mode === 'note' ? 'rgba(255,192,77,.10)' : 'var(--card)', border: '1px solid ' + (mode === 'note' ? 'rgba(255,192,77,.4)' : 'var(--line)'), borderRadius: 16, padding: '3px 4px' }}>
                      {mode === 'reply' && <>
                        <button className="ci-btn" title={l.emoji} onClick={() => setShowEmoji((v) => !v)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--mut)', padding: '8px 6px', display: 'flex' }}><Icon name="smile" size={19} /></button>
                        <label className="ci-btn" title={l.attach} style={{ cursor: 'pointer', color: 'var(--mut)', padding: '8px 6px', display: 'flex' }}><Icon name="paperclip" size={18} />
                          <input type="file" multiple accept="image/*,application/pdf,.doc,.docx,.csv,.xlsx,.txt" style={{ display: 'none' }} onChange={(e) => { if (e.target.files) uploadAtt(e.target.files); e.currentTarget.value = ''; }} />
                        </label>
                      </>}
                      <textarea value={text} onChange={(e) => { setText(e.target.value); if (mode === 'reply') sendTyping(); }}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (mode === 'reply') { if (text.trim() || atts.length) act(tk.id, { body: text, attachments: atts }); } else if (text.trim()) act(tk.id, { note: text }); } }}
                        rows={1} placeholder={mode === 'note' ? t.s_notePh : t.s_replyPh} style={{ flex: 1, margin: 0, resize: 'none', minHeight: 36, maxHeight: 120, padding: '9px 6px', border: 'none', background: 'transparent', fontSize: 14 }} />
                    </div>
                    <button onClick={() => mode === 'reply' ? act(tk.id, { body: text, attachments: atts }) : act(tk.id, { note: text })}
                      disabled={busy === tk.id || (mode === 'reply' ? (!text.trim() && !atts.length) : !text.trim())} title={mode === 'reply' ? t.s_sendReply : t.s_saveNote}
                      style={{ width: 44, height: 44, flex: 'none', borderRadius: 14, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0b0d17', cursor: 'pointer', background: mode === 'note' ? 'linear-gradient(135deg,#ffc04d,#ff9f45)' : 'linear-gradient(135deg,#7c8cff,#34e2a0)', boxShadow: '0 8px 20px rgba(124,140,255,.3)' }}>
                      {mode === 'note' ? <Icon name="lock" size={18} /> : <Icon name="send" size={19} />}
                    </button>
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {drawerUser && <UserDrawer userId={drawerUser.id} email={drawerUser.email} onClose={() => setDrawerUser(null)} />}
    </div>
  );
}
