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
import { nativePlatform } from '@/lib/native';

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
const EMO = [
  '😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚',
  '😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🥳','🤩','😏','😒','😞','😔','😟','😕','🙁','☹️','😣',
  '😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗',
  '🤔','🤭','🤫','🤥','😶','😐','😑','😬','🙄','😯','😦','😧','😮','😲','🥱','😴','🤤','😪','😵','🤐',
  '🥴','🤢','🤮','🤧','😷','🤒','🤕','🤑','🤠','😈','👿','👻','💀','☠️','👽','🤖','🎃','😺','😸','😹',
  '👍','👎','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','☝️','✋','🤚','🖐️','🖖','👋',
  '🤝','🙏','✍️','💪','🦾','👏','🙌','👐','🤲','🫶','❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔',
  '❣️','💕','💞','💓','💗','💖','💘','💝','💯','✅','❌','❗','❓','⚠️','🔥','⭐','🌟','✨','⚡','💥',
  '🎉','🎊','🎁','🏆','🥇','🚀','📈','📉','💰','💵','💳','📊','📌','📎','🔒','🔑','🛡️','⏳','⏰','🔔',
];

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
    rShorten: 'Acortar', rFormal: 'Más formal', rTranslate: 'Traducir', rBusy: 'Puliendo…', aiErr: 'La IA no pudo redactar ahora. Intenta otra vez.',
    suggested: 'Sugerida', slashHint: 'Escribe / para respuestas guardadas', triageAuto: 'Clasificado por IA',
    remTitle: 'Soporte remoto (de pago)', remOn: 'Los clientes pueden pagar y agendar una sesión remota.', remOff: 'Apagado: no se ofrece sesión remota de pago.',
    remPrice: 'Precio (USD)', remMin: 'Minutos', remTool: 'Herramienta', remLink: 'Enlace de descarga', remNote: 'Instrucción al cliente', remSave: 'Guardar', remSaved: 'Guardado',
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
    rShorten: 'Shorten', rFormal: 'More formal', rTranslate: 'Translate', rBusy: 'Polishing…', aiErr: "The AI couldn't draft right now. Try again.",
    suggested: 'Suggested', slashHint: 'Type / for saved replies', triageAuto: 'AI-classified',
    remTitle: 'Remote support (paid)', remOn: 'Clients can pay and book a remote session.', remOff: 'Off: no paid remote session offered.',
    remPrice: 'Price (USD)', remMin: 'Minutes', remTool: 'Tool', remLink: 'Download link', remNote: 'Instruction to client', remSave: 'Save', remSaved: 'Saved',
  },
};

const kb = (n?: number) => (!n ? '' : n < 1024 ? `${n} B` : n < 1048576 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(1)} MB`);

// Interruptor visual (switch con perilla), mismo estilo que el resto del panel.
// Se usa para Auto-respuesta IA y Soporte remoto, para que se note más que un ON/OFF.
function Switch({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <span role="switch" aria-checked={on} onClick={() => { if (!disabled) onClick(); }} className="toggle"
      style={{ background: on ? 'var(--green)' : '#556080', opacity: disabled ? 0.5 : 1, cursor: disabled ? 'default' : 'pointer', boxShadow: on ? 'none' : 'inset 0 0 0 1px rgba(255,255,255,.12)' }}>
      <span className="knob" style={{ left: on ? 21 : 3 }} />
    </span>
  );
}

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
  const [roleFilter, setRoleFilter] = useState<'all' | 'mentor' | 'ambassador' | 'botlab' | 'paid' | 'lead'>('all');
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false); // en móvil: chat a pantalla completa
  const [cfgOpen, setCfgOpen] = useState(false);        // en móvil: panel de ajustes plegable
  const [smallScreen, setSmallScreen] = useState(false);
  // Alto medido: los paneles llenan desde su borde superior hasta el fondo de la
  // ventana → el composer SIEMPRE queda visible pase lo que pase arriba.
  const wrapRef = useRef<HTMLDivElement>(null);
  const [paneH, setPaneH] = useState(560);
  useEffect(() => {
    const f = () => { const top = wrapRef.current?.getBoundingClientRect().top ?? 220; setPaneH(Math.max(440, window.innerHeight - top - 16)); };
    f(); window.addEventListener('resize', f); const iv = setInterval(f, 1000);
    return () => { window.removeEventListener('resize', f); clearInterval(iv); };
  }, []);
  useEffect(() => {
    const f = () => setSmallScreen(window.innerWidth <= 860);
    f(); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f);
  }, []);
  // Teclado del móvil: ajustamos la altura real del chat a pantalla completa para
  // que el compositor NO quede tapado (mismo manejo que el widget del cliente).
  const [vv, setVv] = useState<{ h: number; top: number } | null>(null);
  // iOS app NATIVA: su WebView no encoge el visualViewport, así que usamos el evento
  // de teclado de Capacitor (lo dispara NativeInit como 'onyxkb' + var --onyx-kb).
  useEffect(() => {
    if (!(smallScreen && mobileOpen) || nativePlatform() !== 'ios') return;
    const apply = (h: number) => {
      const H = (typeof window !== 'undefined' ? window.innerHeight : 0);
      setVv(h > 0 ? { h: Math.max(240, H - h), top: 0 } : { h: H, top: 0 });
    };
    try { const cur = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--onyx-kb')) || 0; apply(cur); } catch { apply(0); }
    const on = (e: any) => apply((e && e.detail && e.detail.h) || 0);
    window.addEventListener('onyxkb', on as any);
    return () => window.removeEventListener('onyxkb', on as any);
  }, [smallScreen, mobileOpen]);
  // Web y Android (su visualViewport SÍ se encoge con el teclado). iOS queda fuera.
  useEffect(() => {
    const ios = nativePlatform() === 'ios';
    if (!(smallScreen && mobileOpen) || ios) { if (!ios) setVv(null); return; }
    const vp: any = (typeof window !== 'undefined') ? (window as any).visualViewport : null;
    if (!vp) return;
    const measure = () => setVv({ h: Math.round(vp.height), top: Math.round(vp.offsetTop || 0) });
    let t: any;
    const on = () => { clearTimeout(t); t = setTimeout(measure, 110); };   // debounce: Safari dispara muchos resize
    measure();
    const bump = () => { [60, 250, 500, 850].forEach((ms) => setTimeout(measure, ms)); };
    vp.addEventListener('resize', on); vp.addEventListener('scroll', on);
    window.addEventListener('focusin', bump); window.addEventListener('focusout', bump); window.addEventListener('orientationchange', bump);
    return () => {
      clearTimeout(t);
      vp.removeEventListener('resize', on); vp.removeEventListener('scroll', on);
      window.removeEventListener('focusin', bump); window.removeEventListener('focusout', bump); window.removeEventListener('orientationchange', bump);
    };
  }, [smallScreen, mobileOpen]);
  // Con el chat a pantalla completa en móvil, bloquear el scroll del fondo.
  useEffect(() => {
    if (!(smallScreen && mobileOpen)) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [smallScreen, mobileOpen]);
  const [text, setText] = useState('');
  // Compositor que crece con el texto (como WhatsApp): hasta ~5 líneas y luego scroll.
  const taRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = taRef.current; if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(120, Math.max(36, el.scrollHeight)) + 'px';
  }, [text]);
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
  // SLA: recordatorio/cierre al cliente inactivo + aviso/vencido cuando el equipo tarda.
  const [sla, setSla] = useState<any>(null);
  const [slaOpen, setSlaOpen] = useState(false);
  async function loadSla() { try { const r = await fetch('/api/admin/support/sla'); setSla(await r.json()); } catch {} }
  async function saveSla() { try { const r = await fetch('/api/admin/support/sla', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(sla) }); setSla(await r.json()); } catch {} }

  async function load() {
    try {
      const r = await fetch('/api/admin/support'); const j = await r.json();
      setTickets(j.tickets || []); setMsgs(j.messages || []); setParticipants(j.participants || []);
      setTeam(j.team || []); setCounts(j.counts || {}); setMe(j.me || '');
    } catch {}
  }
  async function loadCanned() { try { const r = await fetch('/api/admin/support/canned'); const j = await r.json(); setCanned(j.canned || []); } catch {} }
  useEffect(() => { load(); loadCanned(); loadAi(); loadSla(); const iv = setInterval(load, 8000); return () => clearInterval(iv); }, []);
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

  // Auto-borrador al abrir: si el último mensaje es del cliente y el compositor
  // está vacío, pide un borrador a la IA UNA vez por ticket (el agente solo revisa
  // y envía). Para seguimientos puede volver a pulsar "Redactar con IA".
  const autoDrafted = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!openId) return;
    if (autoDrafted.current.has(openId)) return;
    const tm = msgs.filter((m) => m.ticket_id === openId);
    if (!tm.length) return;                                  // aún sin hilo cargado
    const last = tm[tm.length - 1];
    if (last?.sender !== 'user') return;                      // ya respondió el equipo
    if (text.trim()) return;                                  // no pisar lo que escribe
    autoDrafted.current.add(openId);
    draft(openId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId, msgs]);

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
  // Borrador CON CONTEXTO: la IA ve la ficha del trader + el hilo completo (no solo
  // el primer mensaje), así que el borrador sale personalizado y casi listo.
  async function draft(id: string) {
    setBusy('ai' + id);
    try {
      const r = await fetch('/api/admin/support/draft', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ticket_id: id, lang, mode: 'draft' }) });
      const j = await r.json();
      if (j.answer) { setText(j.answer); setMode('reply'); }
      else toast(l.aiErr);
    } catch { toast(l.aiErr); }
    setBusy('');
  }
  // Retoca el borrador YA escrito en un clic (acortar / más formal / traducir).
  const [refining, setRefining] = useState('');
  async function refine(op: 'shorten' | 'formal' | 'translate') {
    const current = text.trim();
    if (!current) return;
    setRefining(op);
    try {
      const r = await fetch('/api/admin/support/draft', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'refine', op, current, lang }) });
      const j = await r.json();
      if (j.answer) setText(j.answer); else toast(l.aiErr);
    } catch { toast(l.aiErr); }
    setRefining('');
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
  if (roleFilter !== 'all') list = list.filter((it) => (it.role || 'user') === roleFilter);
  if (q.trim()) { const s = q.toLowerCase(); list = list.filter((it) => (it.email || '').toLowerCase().includes(s) || (it.subject || '').toLowerCase().includes(s)); }
  // Meta de cada rol: emoji, etiqueta y color de la píldora.
  const ROLE_META: Record<string, { ic: string; es: string; en: string; bg: string; fg: string }> = {
    mentor: { ic: '🎓', es: 'Mentor', en: 'Mentor', bg: 'rgba(124,140,255,.14)', fg: '#4a44b0' },
    ambassador: { ic: '🎁', es: 'Embajador', en: 'Ambassador', bg: 'rgba(217,84,126,.14)', fg: '#993556' },
    botlab: { ic: '🤖', es: 'Bot Lab', en: 'Bot Lab', bg: 'rgba(52,199,120,.14)', fg: '#1f7a4d' },
    paid: { ic: '💳', es: 'Cliente', en: 'Customer', bg: 'rgba(255,159,10,.14)', fg: '#b26a00' },
  };
  const roleCounts: Record<string, number> = {};
  tickets.forEach((it) => { const r = it.role || 'user'; roleCounts[r] = (roleCounts[r] || 0) + 1; });

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
        .wa-cfg-btn{display:none}
        @media(max-width:860px){
          .wa2{grid-template-columns:1fr}
          .wa-list{max-height:none;height:calc(100dvh - 215px);min-height:320px}
          .wa-chat{display:none}
          .wa-hide-m{display:none !important}
          /* En móvil el chat va a PANTALLA COMPLETA, como el widget de soporte.
             La altura real la fija visualViewport (--wa-h) para que, al abrir el
             teclado, el compositor quede SIEMPRE visible encima del teclado.
             padding-top = notch/barra de estado del iPhone para no taparse. */
          .wa-fs-m{display:flex !important;position:fixed;left:0;right:0;top:var(--wa-top,0);height:var(--wa-h,100dvh) !important;max-height:var(--wa-h,100dvh);width:100%;border:none;border-radius:0;z-index:2147483000;background:var(--card);padding-top:env(safe-area-inset-top)}
          .wa-back{display:inline-flex !important}
          /* Ajustes (IA, SLA, rango) ocultos tras un botón para no saturar. */
          .wa-cfg{display:none}
          .wa-cfg.wa-cfg-open{display:block}
          .wa-cfg-btn{display:inline-flex !important}
          .wa-head{padding:12px 12px;position:sticky;top:0;z-index:5}
          .wa-comp{padding-bottom:calc(10px + env(safe-area-inset-bottom))}
          /* Botón de volver más visible y con buen área de toque. */
          .wa-back{background:var(--brand) !important;color:#fff !important;border:none !important;width:auto !important;padding:8px 12px !important;gap:6px;font-size:13px;font-weight:600;border-radius:10px}
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
      {/* En móvil, los ajustes (rango, IA, SLA) van tras este botón para no saturar. */}
      <button className="wa-cfg-btn btn btn-ghost" style={{ width: '100%', marginBottom: 10, justifyContent: 'center', gap: 8, alignItems: 'center' }} onClick={() => setCfgOpen((v) => !v)}>
        <Icon name="sparkles" size={15} /> {es ? 'Ajustes de soporte (IA, tiempos, reportes)' : 'Support settings (AI, times, reports)'}
        <span style={{ transform: cfgOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s', display: 'inline-flex' }}><Icon name="chevronDown" size={15} /></span>
      </button>

      <div className={'wa-cfg' + (cfgOpen ? ' wa-cfg-open' : '')}>
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
        <Switch on={!!aiOn} onClick={toggleAi} disabled={aiOn === null} />
      </div>

      {/* SLA de soporte: tiempos de recordatorio/cierre al cliente y de aviso/vencido al equipo. */}
      <div className="card" style={{ padding: '10px 14px', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ width: 30, height: 30, borderRadius: 9, flex: 'none', background: 'linear-gradient(135deg,#f7b955,#ef5a5a)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0b0d17' }}><Icon name="clock" size={17} /></span>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{es ? 'Tiempos de respuesta (SLA)' : 'Response times (SLA)'}</div>
            <div className="muted" style={{ fontSize: 12 }}>{es ? 'Recuerda y cierra al cliente inactivo; avisa y marca vencido si el equipo tarda.' : 'Reminds/closes idle customers; alerts and flags overdue when the team is slow.'}</div>
          </div>
          {sla && <Switch on={!!sla.on} onClick={() => { const n = { ...sla, on: !sla.on }; setSla(n); fetch('/api/admin/support/sla', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(n) }).catch(() => {}); }} />}
          <button className="wa-hb" onClick={() => setSlaOpen((v) => !v)} title={es ? 'Ajustar tiempos' : 'Tune times'} style={{ transform: slaOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}><Icon name="chevronDown" size={16} /></button>
        </div>
        {slaOpen && sla && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--mut)' }}>{es ? 'Cliente que no responde' : 'Customer not replying'}</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
              <label style={{ fontSize: 12 }}>{es ? 'Recordatorio (horas)' : 'Reminder (hours)'}<input type="number" min={1} value={sla.reminderH} onChange={(e) => setSla({ ...sla, reminderH: Number(e.target.value) })} style={{ display: 'block', width: 90, marginTop: 3 }} /></label>
              <label style={{ fontSize: 12 }}>{es ? 'Cierre (horas)' : 'Close (hours)'}<input type="number" min={2} value={sla.closeH} onChange={(e) => setSla({ ...sla, closeH: Number(e.target.value) })} style={{ display: 'block', width: 90, marginTop: 3 }} /></label>
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--mut)' }}>{es ? 'Equipo que tarda' : 'Team too slow'}</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
              <label style={{ fontSize: 12 }}>{es ? 'Aviso (min)' : 'Alert (min)'}<input type="number" min={5} value={sla.ackMin} onChange={(e) => setSla({ ...sla, ackMin: Number(e.target.value) })} style={{ display: 'block', width: 90, marginTop: 3 }} /></label>
              <label style={{ fontSize: 12 }}>{es ? 'Vencido (min)' : 'Overdue (min)'}<input type="number" min={10} value={sla.overdueMin} onChange={(e) => setSla({ ...sla, overdueMin: Number(e.target.value) })} style={{ display: 'block', width: 90, marginTop: 3 }} /></label>
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--mut)', display: 'flex', alignItems: 'center', gap: 8 }}>
              {es ? 'Horario de silencio (no te avisa de noche)' : 'Quiet hours (no night alerts)'}
              <Switch on={!!sla.quietOn} onClick={() => setSla({ ...sla, quietOn: !sla.quietOn })} />
            </div>
            {sla.quietOn && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12, alignItems: 'flex-end' }}>
                <label style={{ fontSize: 12 }}>{es ? 'Desde (hora)' : 'From (hour)'}<input type="number" min={0} max={23} value={sla.quietStart} onChange={(e) => setSla({ ...sla, quietStart: Number(e.target.value) })} style={{ display: 'block', width: 80, marginTop: 3 }} /></label>
                <label style={{ fontSize: 12 }}>{es ? 'Hasta (hora)' : 'To (hour)'}<input type="number" min={0} max={23} value={sla.quietEnd} onChange={(e) => setSla({ ...sla, quietEnd: Number(e.target.value) })} style={{ display: 'block', width: 80, marginTop: 3 }} /></label>
                <span className="muted" style={{ fontSize: 11, maxWidth: 220 }}>{es ? 'Los correos al cliente siguen; solo se callan los avisos a ti. Usa tu zona horaria.' : 'Customer emails still go out; only your alerts go quiet. Uses your timezone.'}</span>
              </div>
            )}
            <button className="btn btn-primary" onClick={saveSla}>{es ? 'Guardar tiempos' : 'Save times'}</button>
          </div>
        )}
      </div>
      </div>{/* /wa-cfg */}

      <div className="row" style={{ gap: 7, marginBottom: 12, flexWrap: 'wrap' }}>
        {([['mine', l.fMine, mineCount], ['unassigned', l.fUnassigned, unassignedCount], ['open', t.s_open, counts.open], ['in_progress', t.s_inprogress, counts.in_progress], ['resolved', t.s_resolved, counts.resolved], ['all', t.s_all, null]] as any).map(([k, lab, c]: any) => (
          <button key={k} className={'wa-fil' + (filter === k ? ' on' : '')} onClick={() => setFilter(k)}>{lab}{c != null ? ` ${c}` : ''}</button>
        ))}
        <div className="wa-search"><Icon name="search" size={15} /><input placeholder={t.s_search} value={q} onChange={(e) => setQ(e.target.value)} style={{ margin: 0, border: 'none', background: 'transparent', padding: 0, fontSize: 13, width: '100%', color: 'var(--tx)' }} /></div>
      </div>

      {/* Filtro por ROL de quien escribe (mentor / embajador / Bot Lab / cliente). Solo muestra los que existen. */}
      {(roleCounts.mentor || roleCounts.ambassador || roleCounts.botlab || roleCounts.paid) ? (
        <div className="row" style={{ gap: 7, marginBottom: 12, flexWrap: 'wrap' }}>
          <button className={'wa-fil' + (roleFilter === 'all' ? ' on' : '')} onClick={() => setRoleFilter('all')}>{es ? 'Todos' : 'All'}</button>
          {(['mentor', 'ambassador', 'botlab', 'paid'] as const).map((r) => roleCounts[r] ? (
            <button key={r} className={'wa-fil' + (roleFilter === r ? ' on' : '')} onClick={() => setRoleFilter(roleFilter === r ? 'all' : r)}>
              {ROLE_META[r].ic} {es ? ROLE_META[r].es : ROLE_META[r].en} {roleCounts[r]}
            </button>
          ) : null)}
        </div>
      ) : null}

      <div className="wa2" ref={wrapRef}>
        {/* Lista de conversaciones estilo WhatsApp */}
        <div className={'wa-list rowlist' + (mobileOpen ? ' wa-hide-m' : '')} style={{ height: paneH }}>
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
                    {ROLE_META[it.role] && <span className="pill" style={{ fontSize: 10.5, background: ROLE_META[it.role].bg, color: ROLE_META[it.role].fg, fontWeight: 700 }}>{ROLE_META[it.role].ic} {es ? ROLE_META[it.role].es : ROLE_META[it.role].en}</span>}
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
        <div className={'wa-chat' + (mobileOpen ? ' wa-fs-m' : ' wa-hide-m')}
          style={(smallScreen && mobileOpen && vv) ? ({ ['--wa-h' as any]: vv.h + 'px', ['--wa-top' as any]: vv.top + 'px' } as any) : { height: paneH }}>
          {!tk && <div className="muted" style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', fontSize: 14, textAlign: 'center', padding: 20 }}>{t.s_pickOne}</div>}
          {tk && (() => {
            const tm = msgs.filter((m) => m.ticket_id === tk.id);
            const firstUser = tm.find((m) => m.sender === 'user')?.body || tk.subject;
            const parts = participants.filter((p) => p.ticket_id === tk.id);
            const cannedForLang = canned.filter((c) => c.lang === lang);
            const cannedList = cannedForLang.length ? cannedForLang : canned;
            // Respuesta guardada SUGERIDA: la más parecida al ticket por palabras en
            // común (instantáneo, sin IA). Se resalta para usarla de un clic.
            const norm = (s: string) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
            const qWords = new Set(norm(`${tk.subject || ''} ${firstUser || ''}`).split(/[^a-z0-9]+/).filter((w) => w.length > 3));
            let suggestedCanned: any = null; let bestScore = 0;
            if (qWords.size) for (const c of cannedList) {
              const cw = norm(`${c.title} ${c.body}`).split(/[^a-z0-9]+/).filter((w) => w.length > 3);
              let s = 0; for (const w of cw) if (qWords.has(w)) s++;
              if (s > bestScore) { bestScore = s; suggestedCanned = c; }
            }
            if (bestScore < 2) suggestedCanned = null;   // exige coincidencia real
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
                  <button className="wa-hb wa-back" onClick={() => setMobileOpen(false)} title={es ? 'Volver a la lista' : 'Back to list'}><Icon name="back" size={18} /> {es ? 'Volver' : 'Back'}</button>
                  <span className="wa-av" style={{ background: avatarOf(tk.email).bg, color: avatarOf(tk.email).fg }}>{initials(tk.email || '?')}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tk.email || t.s_visitor}</div>
                    <div className="muted" style={{ fontSize: 11.5 }}>
                      {/* Triage automático: categoría (coloreada si es prioridad alta) + canal. */}
                      <span title={l.triageAuto} style={tk.priority === 'high' ? { color: 'var(--red)', fontWeight: 700 } : undefined}>{CATS[tk.category] || tk.category}</span>
                      {' · '}{CH[tk.channel] || tk.channel}{tk.is_lead ? ' · Lead' : ''}
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
                    typingLabel={traderTyping ? `${t.sender_trader} ${l.typing}` : ''}
                    height={(smallScreen && mobileOpen) ? Math.max(160, (vv?.h ?? (typeof window !== 'undefined' ? window.innerHeight : 640)) - 220) : Math.max(220, paneH - 196)} />
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
                        {/* Respuesta guardada sugerida (coincide con el ticket): un clic la usa. */}
                        {suggestedCanned && !text.trim() && (
                          <button className="wa-chip" title={suggestedCanned.title} onClick={() => setText(suggestedCanned.body)}
                            style={{ borderColor: 'var(--green)', color: 'var(--green)', background: 'rgba(52,226,160,.10)', maxWidth: 230 }}>
                            <Icon name="bulb" size={14} /> <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.suggested}: {suggestedCanned.title}</span>
                          </button>
                        )}
                        <button className="wa-chip" onClick={() => setShowCanned((v) => !v)}><Icon name="plus" size={14} /> {l.canned}</button>
                        <button className="wa-chip" onClick={() => draft(tk.id)} disabled={busy === 'ai' + tk.id}><Icon name="sparkles" size={14} /> {busy === 'ai' + tk.id ? '…' : t.s_aiDraft}</button>
                        {/* Retocar el borrador YA escrito en un clic. */}
                        {text.trim() && (
                          <>
                            <button className="wa-chip" onClick={() => refine('shorten')} disabled={!!refining}><Icon name="resize" size={14} /> {refining === 'shorten' ? l.rBusy : l.rShorten}</button>
                            <button className="wa-chip" onClick={() => refine('formal')} disabled={!!refining}><Icon name="shield" size={14} /> {refining === 'formal' ? l.rBusy : l.rFormal}</button>
                            <button className="wa-chip" onClick={() => refine('translate')} disabled={!!refining}><Icon name="message" size={14} /> {refining === 'translate' ? l.rBusy : l.rTranslate}</button>
                          </>
                        )}
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
                    <div style={{ position: 'absolute', bottom: '100%', left: 12, marginBottom: 8, zIndex: 20, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, padding: 8, boxShadow: '0 12px 30px rgba(0,0,0,.3)', display: 'grid', gridTemplateColumns: 'repeat(10,1fr)', gap: 3, width: 320, maxHeight: 240, overflowY: 'auto' }}>
                      {EMO.map((e) => <button key={e} onClick={() => { setText((v) => v + e); setShowEmoji(false); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 18, padding: 3 }}>{e}</button>)}
                    </div>
                  )}

                  {/* Fila de entrada estilo WhatsApp */}
                  <div className="row" style={{ gap: 8, alignItems: 'flex-end' }}>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 2, background: mode === 'note' ? 'rgba(255,192,77,.14)' : '#fff', border: '1px solid ' + (mode === 'note' ? 'rgba(255,192,77,.4)' : 'var(--line)'), borderRadius: 16, padding: '3px 4px' }}>
                      {mode === 'reply' && <>
                        <button className="ci-btn" title={l.emoji} onClick={() => setShowEmoji((v) => !v)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '8px 6px', display: 'flex' }}><Icon name="smile" size={19} /></button>
                        <label className="ci-btn" title={l.attach} style={{ cursor: 'pointer', color: '#6b7280', padding: '8px 6px', display: 'flex' }}><Icon name="paperclip" size={18} />
                          <input type="file" multiple accept="image/*,application/pdf,.doc,.docx,.csv,.xlsx,.txt" style={{ display: 'none' }} onChange={(e) => { if (e.target.files) uploadAtt(e.target.files); e.currentTarget.value = ''; }} />
                        </label>
                      </>}
                      <textarea ref={taRef} value={text} onChange={(e) => { setText(e.target.value); if (mode === 'reply') sendTyping(); }}
                        onKeyDown={(e) => {
                          // "/" en el compositor vacío abre las respuestas guardadas.
                          if (e.key === '/' && mode === 'reply' && !text) { e.preventDefault(); setShowCanned(true); return; }
                          // Enter (o Cmd/Ctrl+Enter) envía; Shift+Enter hace salto de línea.
                          if (e.key === 'Enter' && (!e.shiftKey || e.metaKey || e.ctrlKey)) { e.preventDefault(); if (mode === 'reply') { if (text.trim() || atts.length) act(tk.id, { body: text, attachments: atts }); } else if (text.trim()) act(tk.id, { note: text }); } }}
                        rows={1} placeholder={mode === 'note' ? t.s_notePh : `${t.s_replyPh} · ${l.slashHint}`} style={{ flex: 1, margin: 0, resize: 'none', minHeight: 36, maxHeight: 132, overflowY: 'auto', padding: '9px 6px', border: 'none', background: 'transparent', fontSize: 14, color: mode === 'note' ? 'var(--tx)' : '#15181f' }} />
                    </div>
                    <button onClick={() => mode === 'reply' ? act(tk.id, { body: text, attachments: atts }) : act(tk.id, { note: text })}
                      disabled={busy === tk.id || (mode === 'reply' ? (!text.trim() && !atts.length) : !text.trim())} title={mode === 'reply' ? t.s_sendReply : t.s_saveNote}
                      style={{ width: 46, height: 46, flex: 'none', borderRadius: '50%', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: mode === 'note' ? '#241002' : '#fff', cursor: 'pointer', background: mode === 'note' ? 'linear-gradient(135deg,#ffc04d,#ff9f45)' : '#00a884', boxShadow: 'none' }}>
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
