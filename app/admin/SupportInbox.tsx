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
import SupportInsights from './SupportInsights';
import { flagEmoji } from '@/lib/geo';
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
    fMine: 'Mías', fInvited: 'Me invitaron', fUnassigned: 'Sin asignar', needsReply: 'Espera respuesta',
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
    fMine: 'Mine', fInvited: 'Invited to me', fUnassigned: 'Unassigned', needsReply: 'Awaiting reply',
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
  const [filter, setFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved' | 'mine' | 'invited' | 'unassigned'>('open');
  const [roleFilter, setRoleFilter] = useState<'all' | 'mentor' | 'ambassador' | 'botlab' | 'paid' | 'lead'>('all');
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false); // en móvil: chat a pantalla completa
  const [cfgOpen, setCfgOpen] = useState(false);        // en móvil: panel de ajustes plegable
  const [smallScreen, setSmallScreen] = useState(false);
  const [helpKey, setHelpKey] = useState('');           // qué ayuda "?" está abierta
  const [agentLang, setAgentLang] = useState('es');     // idioma principal del empleado (traductor)
  const [filterOpen, setFilterOpen] = useState(false);  // desplegable de filtros
  const [moreOpen, setMoreOpen] = useState(false);      // menú "+" del compositor (estilo WhatsApp)
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
  // Avisar al cliente que el agente está escribiendo (throttle ~2.5s). Barato: el
  // widget lo lee en su sondeo. Marca un sello de tiempo en el ticket.
  const typePingRef = useRef(0);
  const pingAgentTyping = (id: string) => {
    const now = Date.now();
    if (now - typePingRef.current < 2500) return;
    typePingRef.current = now;
    fetch('/api/admin/support/typing', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ticket_id: id }) }).catch(() => {});
  };
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
  async function loadSla() { try { const r = await fetch('/api/admin/support/sla'); const j = await r.json(); setSla(j); if (j && j.agentLang) setAgentLang(j.agentLang); } catch {} }
  async function saveSla() { try { const r = await fetch('/api/admin/support/sla', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...sla, agentLang }) }); const j = await r.json(); setSla(j); if (j && j.agentLang) setAgentLang(j.agentLang); } catch {} }

  async function load() {
    try {
      const r = await fetch('/api/admin/support'); const j = await r.json();
      setTickets(j.tickets || []); setMsgs(j.messages || []); setParticipants(j.participants || []);
      setTeam(j.team || []); setCounts(j.counts || {}); setMe(j.me || '');
    } catch {}
  }
  async function loadCanned() { try { const r = await fetch('/api/admin/support/canned'); const j = await r.json(); setCanned(j.canned || []); } catch {} }
  useEffect(() => { load(); loadCanned(); loadAi(); loadSla(); const iv = setInterval(load, 8000); return () => clearInterval(iv); }, []);
  // Si llega con ?ticket=ID (desde el aviso sticky / pastilla), abre ESA conversación.
  // En móvil la abrimos a PANTALLA COMPLETA directamente, no en la lista.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('ticket');
    if (id) {
      setFilter('all'); setOpenId(id);
      if (typeof window !== 'undefined' && window.innerWidth <= 860) setMobileOpen(true);
    }
  }, []);

  // Auto-recuperación móvil: si quedó abierta la vista a pantalla completa pero el
  // ticket ya no existe (se resolvió, se filtró, o el deep-link apuntó a uno que no
  // cargó), cerramos solos para no quedar atascados en "Elige una conversación".
  useEffect(() => {
    if (mobileOpen && openId && tickets.length && !tickets.find((it) => it.id === openId)) { setMobileOpen(false); setOpenId(''); }
  }, [tickets, mobileOpen, openId]);

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

  // Candado síncrono contra DOBLE ENVÍO: si tocas el botón varias veces rápido,
  // solo el primer toque manda; los demás se ignoran hasta que termina.
  const sending = useRef(false);
  async function act(id: string, patch: any) {
    const isSend = patch.body !== undefined || patch.note !== undefined;
    if (isSend && sending.current) return;   // ya se está enviando: ignorar toque extra
    if (isSend) sending.current = true;
    setBusy(id);
    try {
      await fetch('/api/admin/support', { method: 'PATCH', body: JSON.stringify({ ticket_id: id, ...patch }) });
      if (isSend) setText('');
      await load();
      if (patch.body !== undefined) { setAtts([]); ping(); }
    } finally {
      setBusy(''); if (isSend) sending.current = false;
    }
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
    if (filter === 'invited') return participants.some((p) => p.ticket_id === it.id && p.user_id === me) && it.assignee_id !== me;
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
  const invitedCount = tickets.filter((it) => it.status !== 'resolved' && it.assignee_id !== me && participants.some((p) => p.ticket_id === it.id && p.user_id === me)).length;
  const unassignedCount = tickets.filter((it) => !it.assignee_id && it.status !== 'resolved').length;
  const tk = tickets.find((it) => it.id === openId);

  // ¿el trader está en línea? (usamos su presencia en el canal de tiempo real)
  const traderTyping = typing.length > 0;

  return (
    <div style={{ width: '100%' }}>
      <style>{`
        .wa-fil{font-size:12.5px;padding:6px 13px;border-radius:20px;border:1px solid var(--line);background:var(--card2);color:var(--mut);cursor:pointer;transition:all .12s}
        .wa-fil:hover{color:var(--tx)} .wa-fil.on{background:var(--brand);border-color:var(--brand);color:#fff}
        .wa-help{width:20px;height:20px;border-radius:50%;border:1px solid var(--line);background:var(--card2);color:var(--mut);cursor:pointer;font-size:12px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;line-height:1}
        .wa-help:hover{color:var(--brand);border-color:var(--brand)}
        /* Globo de ayuda: fijo y centrado abajo para que NUNCA se corte en móvil. */
        .wa-tip{position:fixed;left:12px;right:12px;top:calc(env(safe-area-inset-top) + 64px);bottom:auto;margin:0 auto;z-index:2147483600;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 14px;font-size:12.5px;line-height:1.7;width:auto;max-width:360px;box-shadow:0 16px 40px rgba(0,0,0,.4);color:var(--tx);cursor:pointer}
        /* Capa invisible a pantalla completa: tocar FUERA de un popup lo cierra. */
        .wa-ov{position:fixed;inset:0;z-index:2147483590;background:transparent}
        .wa-nav{display:inline-flex;align-items:center;gap:2px;border:1px solid var(--line);border-radius:999px;padding:2px;background:var(--card2)}
        .wa-nav button{width:26px;height:26px;border-radius:50%;border:none;background:transparent;color:var(--brand);cursor:pointer;display:inline-flex;align-items:center;justify-content:center}
        .wa-nav button:disabled{color:var(--mut);opacity:.4;cursor:default}
        .wa-navn{font-size:11px;font-weight:600;color:var(--mut);padding:0 2px;min-width:30px;text-align:center}
        .wa2{display:grid;grid-template-columns:320px minmax(0,1fr);gap:14px;align-items:stretch}
        .wa-search{display:flex;align-items:center;gap:8px;background:var(--bg2);border:1px solid var(--line);border-radius:999px;padding:6px 12px;margin-left:auto;max-width:260px;flex:1;color:var(--mut)}
        .wa-back{display:none}
        /* Ajustes de soporte (rango, Insights, IA, SLA, bilingüe) COLAPSADOS tras una
           sola línea también en PC, para que la lista de conversaciones no baje tanto. */
        .wa-cfg-btn{display:flex}
        .wa-cfg{display:none}
        .wa-cfg.wa-cfg-open{display:block}
        /* Botón de emoji en el selector (PC): aro al pasar / al elegir, para que
           se note cuál se selecciona (antes no sombreaba ni reaccionaba). */
        .wa-emo{border-radius:8px;line-height:1;transition:background .1s,transform .06s}
        .wa-emo:hover{background:var(--bg2)}
        .wa-emo:active{transform:scale(.82);background:color-mix(in srgb,var(--brand) 22%,transparent)}
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
          /* En móvil ocultamos del todo los ajustes de IA/SLA/reportes: se gestionan
             desde la computadora para no saturar el teléfono (lo pidió el dueño). */
          .wa-cfg{display:none !important}
          .wa-cfg-btn{display:none !important}
          /* Filtros más compactos y deslizables en una sola fila. */
          .wa-filrow{flex-wrap:nowrap !important;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:2px}
          .wa-filrow::-webkit-scrollbar{display:none}
          .wa-fil{white-space:nowrap;padding:6px 11px;font-size:12px}
          .wa-search{max-width:none}
          .wa-head{padding:12px 12px;position:sticky;top:0;z-index:5}
          .wa-comp{padding-bottom:calc(16px + env(safe-area-inset-bottom)) !important}
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
        /* Botón "+" estilo WhatsApp y su menú desplegable. */
        .wa-plus{width:34px;height:34px;border-radius:50%;border:1px solid var(--line);background:var(--card2);color:var(--brand);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:transform .06s ease,background .12s;-webkit-tap-highlight-color:transparent}
        .wa-plus:hover{background:var(--card)} .wa-plus:active{transform:scale(.9)}
        .wa-menu{display:flex;align-items:center;gap:9px;width:100%;text-align:left;padding:9px 11px;border-radius:9px;border:none;background:transparent;color:var(--tx);cursor:pointer;font-size:13.5px}
        .wa-menu:hover{background:var(--card2)} .wa-menu:disabled{opacity:.5;cursor:default}
        .wa-av{width:40px;height:40px;border-radius:12px;background:rgba(124,140,255,.18);color:var(--brand);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600;flex:none}
        .wa-avs{width:40px;height:40px;border-radius:12px;background:rgba(124,140,255,.18);color:var(--brand);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;flex:none}
        .wa-hb{background:var(--card2);border:1px solid var(--line);cursor:pointer;color:var(--mut);display:inline-flex;align-items:center;justify-content:center;padding:8px;border-radius:10px;transition:transform .06s ease, background .12s, border-color .12s;-webkit-tap-highlight-color:transparent}
        .wa-hb:hover{color:var(--tx);border-color:var(--brand)}
        /* Reacción táctil: todos los botones del chat "se hunden" al oprimirlos. */
        .wa-hb:active,.wa-chip:active,.wa-fil:active,.wa-help:active,.wa-filbtn:active,.wa-send:active,.wa-back:active{transform:scale(.9);filter:brightness(.92)}
        .wa-chip,.wa-fil,.wa-help,.wa-filbtn,.wa-back,.wa-send{transition:transform .06s ease, filter .12s, background .12s, border-color .12s;-webkit-tap-highlight-color:transparent}
        .wa-send:active{transform:scale(.88)}
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

      {/* Onyx AI · Insights de soporte: KPIs + temas + dónde mejorar + qué añadir. */}
      <SupportInsights lang={lang} />

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

      {/* Soporte bilingüe: idioma principal del empleado. El sistema detecta el
          idioma del cliente y traduce en ambos sentidos automáticamente. */}
      <div className="card" style={{ padding: '10px 14px', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ width: 30, height: 30, borderRadius: 9, flex: 'none', background: 'linear-gradient(135deg,#7c8cff,#34e2a0)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0b0d17' }}><Icon name="message" size={16} /></span>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{es ? 'Soporte bilingüe (traductor automático)' : 'Bilingual support (auto-translate)'}</div>
            <div className="muted" style={{ fontSize: 12 }}>{es ? 'Tú escribes en tu idioma; el cliente recibe el suyo. Detecta el idioma del cliente solo.' : 'You type in your language; the customer gets theirs. It detects the customer language on its own.'}</div>
          </div>
          <label style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {es ? 'Tu idioma' : 'Your language'}
            <select value={agentLang} onChange={(e) => setAgentLang(e.target.value)} onBlur={saveSla} style={{ margin: 0, fontSize: 13, padding: '6px 8px' }}>
              <option value="es">Español</option>
              <option value="en">English</option>
              <option value="pt">Português</option>
              <option value="fr">Français</option>
              <option value="it">Italiano</option>
              <option value="de">Deutsch</option>
            </select>
          </label>
        </div>
      </div>
      </div>{/* /wa-cfg */}

      {/* Filtros en UN SOLO desplegable (igual en PC y móvil): no se amontonan ni se
          "pillan". El botón muestra el filtro activo; al abrirlo eliges Estado,
          Míos/Sin asignar, o Rol. Un "?" explica qué significa cada estado. */}
      {(() => {
        const stLabel: any = { open: t.s_open, in_progress: t.s_inprogress, resolved: t.s_resolved, mine: l.fMine, invited: l.fInvited, unassigned: l.fUnassigned, all: t.s_all };
        const roleActive = roleFilter !== 'all' && ROLE_META[roleFilter] ? ` · ${es ? ROLE_META[roleFilter].es : ROLE_META[roleFilter].en}` : '';
        const Row = ({ active, onClick, label, count, ic }: any) => (
          <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 7, width: '100%', textAlign: 'left', padding: '9px 11px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 14, background: active ? 'var(--brand)' : 'transparent', color: active ? '#fff' : 'var(--tx)' }}>
            {ic && <span style={{ display: 'inline-flex' }}>{ic}</span>}<span style={{ flex: 1 }}>{label}</span>{count != null && <span style={{ fontSize: 12, color: active ? 'rgba(255,255,255,.85)' : 'var(--mut)' }}>{count}</span>}
          </button>
        );
        return (
          <div className="row" style={{ gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ position: 'relative', flex: 'none' }}>
              <button onClick={() => setFilterOpen((v) => !v)} className="wa-filbtn" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 10, padding: '9px 13px', fontSize: 14, fontWeight: 600, color: 'var(--tx)', cursor: 'pointer' }}>
                <Icon name="ticket" size={16} /> {stLabel[filter] || t.s_all}{roleActive}
                <span style={{ transform: filterOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s', display: 'inline-flex', color: 'var(--mut)' }}><Icon name="chevronDown" size={15} /></span>
              </button>
              {filterOpen && (
                <>
                  <div onClick={() => setFilterOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                  <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 41, width: 240, maxWidth: '86vw', background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, boxShadow: '0 14px 34px rgba(0,0,0,.35)', padding: 5 }}>
                    <div style={{ fontSize: 11, color: 'var(--mut)', padding: '6px 10px 2px' }}>{es ? 'Estado' : 'Status'}</div>
                    <Row active={filter === 'open'} onClick={() => { setFilter('open'); setFilterOpen(false); }} label={t.s_open} count={counts.open} />
                    <Row active={filter === 'in_progress'} onClick={() => { setFilter('in_progress'); setFilterOpen(false); }} label={t.s_inprogress} count={counts.in_progress} />
                    <Row active={filter === 'resolved'} onClick={() => { setFilter('resolved'); setFilterOpen(false); }} label={t.s_resolved} count={counts.resolved} />
                    <div style={{ height: 1, background: 'var(--line)', margin: '4px 8px' }} />
                    <Row active={filter === 'mine'} onClick={() => { setFilter('mine'); setFilterOpen(false); }} label={l.fMine} count={mineCount} />
                    <Row active={filter === 'invited'} onClick={() => { setFilter('invited'); setFilterOpen(false); }} label={l.fInvited} count={invitedCount} />
                    <Row active={filter === 'unassigned'} onClick={() => { setFilter('unassigned'); setFilterOpen(false); }} label={l.fUnassigned} count={unassignedCount} />
                    <Row active={filter === 'all'} onClick={() => { setFilter('all'); setFilterOpen(false); }} label={t.s_all} count={null} />
                    {(roleCounts.mentor || roleCounts.ambassador || roleCounts.botlab || roleCounts.paid) ? (
                      <>
                        <div style={{ fontSize: 11, color: 'var(--mut)', padding: '8px 10px 2px' }}>{es ? 'Quién escribe' : 'Who writes'}</div>
                        <Row active={roleFilter === 'all'} onClick={() => setRoleFilter('all')} label={es ? 'Todos' : 'All'} count={null} />
                        {(['mentor', 'ambassador', 'botlab', 'paid'] as const).map((r) => roleCounts[r] ? (
                          <Row key={r} active={roleFilter === r} onClick={() => setRoleFilter(roleFilter === r ? 'all' : r)} label={es ? ROLE_META[r].es : ROLE_META[r].en} count={roleCounts[r]} ic={<span>{ROLE_META[r].ic}</span>} />
                        ) : null)}
                      </>
                    ) : null}
                  </div>
                </>
              )}
            </span>
            <span style={{ position: 'relative', flex: 'none' }}>
              <button className="wa-help" onClick={() => setHelpKey(helpKey === 'filters' ? '' : 'filters')} title={es ? '¿Qué significan?' : 'What do these mean?'} aria-label="?">?</button>
              {helpKey === 'filters' && (<>
                <div className="wa-ov" onClick={() => setHelpKey('')} />
                <div className="wa-tip" onClick={() => setHelpKey('')}>
                  <b>{t.s_open}</b> — {es ? 'conversaciones nuevas sin atender.' : 'new, unattended conversations.'}<br />
                  <b>{t.s_inprogress}</b> — {es ? 'ya les respondiste; esperan seguimiento.' : "you've replied; awaiting follow-up."}<br />
                  <b>{t.s_resolved}</b> — {es ? 'cerradas.' : 'closed.'}<br />
                  <b>{l.fMine}</b> — {es ? 'las que tomaste tú.' : 'the ones you took.'}<br />
                  <b>{l.fUnassigned}</b> — {es ? 'sin dueño: ¡tómalas!' : 'no owner yet: grab them!'}
                </div>
              </>)}
            </span>
            <div className="wa-search"><Icon name="search" size={15} /><input placeholder={t.s_search} value={q} onChange={(e) => setQ(e.target.value)} style={{ margin: 0, border: 'none', background: 'transparent', padding: 0, fontSize: 13, width: '100%', color: 'var(--tx)' }} /></div>
          </div>
        );
      })()}

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
                    <b style={{ fontSize: 13, fontWeight: nr ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.ticket_no ? <span className="muted" style={{ fontWeight: 600 }}>#{it.ticket_no} </span> : null}{it.subject || who}</b>
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
          {!tk && (
            <div style={{ display: 'flex', flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 20, paddingTop: 'calc(20px + env(safe-area-inset-top))' }}>
              {/* Botón Volver también aquí: si en móvil se abrió la vista sin una
                  conversación cargada, SIEMPRE hay cómo salir (no se traba). */}
              <button className="wa-back wa-hb" onClick={() => { setMobileOpen(false); setOpenId(''); }}><Icon name="back" size={18} /> {es ? 'Volver' : 'Back'}</button>
              <div className="muted" style={{ fontSize: 14, textAlign: 'center' }}>{t.s_pickOne}</div>
            </div>
          )}
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
            const chatMsgs: ChatMsg[] = tm.map((m) => {
              // Invitación a un compañero: nota INTERNA (el cliente no la ve) que
              // se pinta como una línea centrada y destacada en el hilo, para que
              // quede claro quién invitó a quién.
              if (m.sender === 'note' && typeof m.body === 'string' && m.body.startsWith('[[invite]]')) {
                return { id: m.id, mine: false, authorKind: 'system' as any, body: '🔒 ' + m.body.replace('[[invite]]', ''), attachments: [], createdAt: m.created_at } as ChatMsg;
              }
              // Notas AUTOMÁTICAS del sistema (SLA): no ensucian el chat. El cierre por
              // inactividad se muestra como una línea fina de "sistema"; el resto
              // (recordatorio/aviso/vencido) se oculta por completo.
              if (m.sender === 'note' && typeof m.body === 'string' && m.body.includes('[[sla:')) {
                if (m.body.includes('[[sla:closed]]')) {
                  return { id: m.id, mine: false, authorKind: 'system' as any, body: es ? 'Cerrado por inactividad · sin respuesta del cliente' : 'Closed for inactivity · no customer reply', attachments: [], createdAt: m.created_at } as ChatMsg;
                }
                return null as any; // ocultar recordatorio/aviso/vencido
              }
              // Soporte bilingüe: muestra, bajo el original, la versión traducida.
              // En mensajes del cliente, la traducción está en TU idioma (para leerla);
              // en tus respuestas, es lo que RECIBIÓ el cliente (lo enviado).
              const meta: any = m.meta || null;
              let trBody = ''; let trLabel = '';
              if (meta && meta.alt && meta.alt !== m.body) {
                trBody = meta.alt;
                const lc = String(meta.altLang || '').toUpperCase();
                trLabel = (m.sender === 'admin' || m.sender === 'ai') ? `${lc} · ${es ? 'enviado' : 'sent'}` : lc;
              }
              // Línea de sistema visible (p. ej. "se sumó otra persona de soporte"):
              // se muestra centrada tanto al equipo como al cliente.
              if (m.sender === 'system') {
                return { id: m.id, mine: false, authorKind: 'system' as any, body: m.body, attachments: [], createdAt: m.created_at } as ChatMsg;
              }
              return {
                id: m.id,
                mine: m.sender === 'admin' || m.sender === 'ai',
                authorName: m.sender === 'user' ? (tk.email || t.s_visitor).split('@')[0] : m.sender === 'ai' ? 'Onyx AI' : t.sender_support,
                authorKind: m.sender === 'ai' ? 'ai' : m.sender === 'note' ? 'note' : m.sender === 'admin' ? 'admin' : 'user',
                body: m.body, trBody, trLabel, attachments: m.attachments || [], createdAt: m.created_at, readAt: m.read_at,
              };
            }).filter(Boolean) as ChatMsg[];
            const inConvo = new Set([tk.assignee_id, me, ...parts.map((p) => p.user_id)].filter(Boolean));
            // Candado: si a MÍ me invitó alguien a este ticket, no puedo invitarlo de
            // vuelta (se saca de la lista de candidatos).
            const myInviter = (parts.find((p) => p.user_id === me) || {}).invited_by || '';
            const cands = team.filter((tm2) => !inConvo.has(tm2.id) && tm2.id !== myInviter);
            // Roster "ya en la conversación": a cargo (asignado) + invitados, con correo
            // y quién los invitó. Se muestra arriba de la lista para que quede claro.
            const emailById: Record<string, string> = {};
            team.forEach((tm2: any) => { emailById[tm2.id] = tm2.email; });
            const roster: { id: string; email: string; role: 'assignee' | 'invited'; by?: string }[] = [];
            if (tk.assignee_id) roster.push({ id: tk.assignee_id, email: emailById[tk.assignee_id] || tk.assignee_id, role: 'assignee' });
            parts.forEach((p) => { if (p.user_id !== tk.assignee_id) roster.push({ id: p.user_id, email: emailById[p.user_id] || p.user_id, role: 'invited', by: p.invited_by ? (emailById[p.invited_by] || '') : '' }); });
            return (
              <>
                {/* Cabecera WhatsApp */}
                <div className="wa-head">
                  <button className="wa-hb wa-back" onClick={() => setMobileOpen(false)} title={es ? 'Volver a la lista' : 'Back to list'}><Icon name="back" size={18} /> {es ? 'Volver' : 'Back'}</button>
                  {/* Navegación entre conversaciones (anterior / siguiente) sin volver
                      a la lista. Útil cuando hay varios mensajes pendientes. */}
                  {(() => {
                    const idx = list.findIndex((x) => x.id === tk.id);
                    if (idx < 0 || list.length < 2) return null;
                    const go = (d: number) => { const n = list[idx + d]; if (n) setOpenId(n.id); };
                    return (
                      <span className="wa-nav" title={es ? 'Entre conversaciones' : 'Between conversations'}>
                        <button disabled={idx <= 0} onClick={() => go(-1)} aria-label={es ? 'Anterior' : 'Previous'}><Icon name="chevronLeft" size={16} /></button>
                        <span className="wa-navn">{idx + 1}/{list.length}</span>
                        <button disabled={idx >= list.length - 1} onClick={() => go(1)} aria-label={es ? 'Siguiente' : 'Next'}><Icon name="chevronRight" size={16} /></button>
                      </span>
                    );
                  })()}
                  <span className="wa-av" style={{ background: avatarOf(tk.email).bg, color: avatarOf(tk.email).fg }}>{initials(tk.email || '?')}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tk.email || t.s_visitor}</div>
                    <div className="muted" style={{ fontSize: 11.5 }}>
                      {/* Triage automático: categoría (coloreada si es prioridad alta) + canal. */}
                      <span title={l.triageAuto} style={tk.priority === 'high' ? { color: 'var(--red)', fontWeight: 700 } : undefined}>{CATS[tk.category] || tk.category}</span>
                      {' · '}{CH[tk.channel] || tk.channel}{tk.is_lead ? ' · Lead' : ''}
                      {tk.country && <span title={l.country} style={{ fontWeight: 600 }}> · {flagEmoji(tk.country)} {[tk.city, tk.country].filter(Boolean).join(', ')}</span>}
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
                  {/* Ayuda "?" de las acciones del chat */}
                  <span style={{ position: 'relative', flex: 'none' }}>
                    <button className="wa-help" onClick={() => setHelpKey(helpKey === 'actions' ? '' : 'actions')} aria-label="?" title={es ? '¿Qué hace cada botón?' : 'What does each button do?'}>?</button>
                    {helpKey === 'actions' && (<>
                      <div className="wa-ov" onClick={() => setHelpKey('')} />
                      <div className="wa-tip" onClick={() => setHelpKey('')}>
                        <b>{es ? 'Prioridad' : 'Priority'}</b> — {es ? 'marca urgencia (alta sube el ticket).' : 'sets urgency (high bumps the ticket).'}<br />
                        <b><Icon name="hand" size={13} style={{ display: 'inline', verticalAlign: '-2px' }} /> {es ? 'Tomar' : 'Take'}</b> — {es ? 'te asignas el ticket.' : 'assign it to yourself.'}<br />
                        <b><Icon name="userPlus" size={13} style={{ display: 'inline', verticalAlign: '-2px' }} /> {es ? 'Invitar' : 'Invite'}</b> — {es ? 'sumas a un compañero.' : 'bring in a teammate.'}<br />
                        <b><Icon name="info" size={13} style={{ display: 'inline', verticalAlign: '-2px' }} /> {es ? 'Ficha' : 'Profile'}</b> — {es ? 'expediente del cliente.' : 'customer record.'}<br />
                        <b><Icon name="check" size={13} style={{ display: 'inline', verticalAlign: '-2px' }} /> {es ? 'Resolver' : 'Resolve'}</b> — {es ? 'cierra y avisa al cliente.' : 'close and notify the customer.'}<br />
                        <b><Icon name="refresh" size={13} style={{ display: 'inline', verticalAlign: '-2px' }} /> {es ? 'Reabrir' : 'Reopen'}</b> — {es ? 'vuelve a abrir un ticket resuelto.' : 'reopen a resolved ticket.'}
                      </div>
                    </>)}
                  </span>
                </div>

                {/* Invitar (desplegable) */}
                {showInvite && (
                  <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--line)', background: 'var(--bg2)' }}>
                    {/* Ya en la conversación: deja claro quién está (a cargo / invitado). */}
                    {roster.length > 0 && (
                      <div style={{ marginBottom: 10 }}>
                        <div className="muted" style={{ fontSize: 11, marginBottom: 5, textTransform: 'uppercase', letterSpacing: .3 }}>{es ? 'En esta conversación' : 'In this conversation'}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          {roster.map((r) => (
                            <div key={r.id} className="row between" style={{ gap: 8, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 8, padding: '6px 9px' }}>
                              <div className="row" style={{ gap: 8, minWidth: 0 }}>
                                <span style={{ width: 20, height: 20, borderRadius: '50%', flex: 'none', display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 700, background: avatarOf(r.email).bg, color: avatarOf(r.email).fg }}>{initials(r.email)}</span>
                                <span style={{ fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {r.email}{r.id === me ? (es ? ' (tú)' : ' (you)') : ''}
                                  {r.role === 'invited' && r.by ? <span className="muted" style={{ fontSize: 11 }}> · {es ? 'invitó: ' : 'invited by: '}{r.by}</span> : null}
                                </span>
                              </div>
                              <span style={{ fontSize: 10.5, fontWeight: 700, flex: 'none', padding: '2px 8px', borderRadius: 999, background: r.role === 'assignee' ? 'color-mix(in srgb,var(--brand) 18%,transparent)' : 'color-mix(in srgb,var(--green) 16%,transparent)', color: r.role === 'assignee' ? 'var(--brand)' : 'var(--soft-green)' }}>
                                {r.role === 'assignee' ? (es ? 'A cargo' : 'Owner') : (es ? 'Invitado' : 'Invited')}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
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
                      <div className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        {/* Respuesta guardada sugerida (coincide con el ticket): un clic la usa. Siempre visible, es lo más útil. */}
                        {suggestedCanned && !text.trim() && (
                          <button className="wa-chip" title={suggestedCanned.title} onClick={() => setText(suggestedCanned.body)}
                            style={{ borderColor: 'var(--green)', color: 'var(--green)', background: 'rgba(52,226,160,.10)', maxWidth: 200 }}>
                            <Icon name="bulb" size={14} /> <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.suggested}: {suggestedCanned.title}</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Respuestas guardadas */}
                  {showCanned && mode === 'reply' && (<>
                    <div className="wa-ov" onClick={() => setShowCanned(false)} />
                    <div style={{ position: 'absolute', bottom: '100%', left: 12, right: 12, marginBottom: 8, zIndex: 2147483595, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, padding: 10, boxShadow: '0 12px 30px rgba(0,0,0,.3)' }}>
                      {/* Respuestas guardadas: aquí SOLO se usan (insertar). Crear/borrar se
                          gestiona desde Admin → Base de respuestas, no desde el chat. */}
                      {!cannedList.length && <div className="muted" style={{ fontSize: 12.5, marginBottom: 2 }}>{l.cEmpty}</div>}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
                        {cannedList.map((c) => (
                          <button key={c.id} onClick={() => { setText(c.body); setShowCanned(false); }}
                            style={{ textAlign: 'left', gap: 8, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', cursor: 'pointer', color: 'var(--tx)' }}>
                            <div style={{ fontSize: 12.5, fontWeight: 600 }}>{c.title}</div>
                            <div className="muted" style={{ fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.body}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>)}

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

                  {/* Emojis — solo en PC. En móvil el teclado del teléfono ya trae
                      emojis, así que ocultamos el selector (evita el recuadro incómodo). */}
                  {showEmoji && mode === 'reply' && !smallScreen && (
                    <div style={{ position: 'absolute', bottom: '100%', left: 12, marginBottom: 8, zIndex: 20, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, padding: 8, boxShadow: '0 12px 30px rgba(0,0,0,.3)', display: 'grid', gridTemplateColumns: 'repeat(10,1fr)', gap: 3, width: 320, maxHeight: 240, overflowY: 'auto' }}>
                      {EMO.map((e) => <button key={e} className="wa-emo" onClick={() => { setText((v) => v + e); setShowEmoji(false); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 18, padding: 3 }}>{e}</button>)}
                    </div>
                  )}

                  {/* Fila de entrada estilo WhatsApp */}
                  <div className="row" style={{ gap: 8, alignItems: 'flex-end' }}>
                    {/* Menú "+" estilo WhatsApp: a la IZQUIERDA del campo. El popover abre
                        hacia la derecha desde aquí, así nunca se corta contra el borde. */}
                    {mode === 'reply' && (
                      <span style={{ position: 'relative', flex: 'none' }}>
                        <button className="wa-plus" onClick={() => setMoreOpen((v) => !v)} title={es ? 'Más acciones' : 'More actions'} aria-label="+"><Icon name="plus" size={18} /></button>
                        {moreOpen && (
                          <>
                            <div onClick={() => setMoreOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 25 }} />
                            <div style={{ position: 'absolute', bottom: 'calc(100% + 8px)', left: 0, zIndex: 26, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, boxShadow: '0 12px 30px rgba(0,0,0,.35)', padding: 5, width: 215, maxWidth: 'calc(100vw - 32px)' }}>
                              <button className="wa-menu" onClick={() => { setShowCanned(true); setMoreOpen(false); }}><Icon name="message" size={16} /> {l.canned}</button>
                              <button className="wa-menu" onClick={() => { draft(tk.id); setMoreOpen(false); }} disabled={busy === 'ai' + tk.id}><Icon name="sparkles" size={16} /> {busy === 'ai' + tk.id ? '…' : t.s_aiDraft}</button>
                              {text.trim() && <>
                                <div style={{ height: 1, background: 'var(--line)', margin: '4px 8px' }} />
                                <button className="wa-menu" onClick={() => { refine('shorten'); setMoreOpen(false); }} disabled={!!refining}><Icon name="resize" size={16} /> {l.rShorten}</button>
                                <button className="wa-menu" onClick={() => { refine('formal'); setMoreOpen(false); }} disabled={!!refining}><Icon name="shield" size={16} /> {l.rFormal}</button>
                                <button className="wa-menu" onClick={() => { refine('translate'); setMoreOpen(false); }} disabled={!!refining}><Icon name="message" size={16} /> {l.rTranslate}</button>
                              </>}
                              <div style={{ height: 1, background: 'var(--line)', margin: '4px 8px' }} />
                              <button className="wa-menu" onClick={() => { saveKnowledge(tk.subject, tm); setMoreOpen(false); }}><Icon name="bulb" size={16} /> {l.saveKb}</button>
                            </div>
                          </>
                        )}
                      </span>
                    )}
                    <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 2, background: mode === 'note' ? 'rgba(255,192,77,.14)' : '#fff', border: '1px solid ' + (mode === 'note' ? 'rgba(255,192,77,.4)' : 'var(--line)'), borderRadius: 16, padding: '3px 4px' }}>
                      {mode === 'reply' && <>
                        {!smallScreen && <button className="ci-btn" title={l.emoji} onClick={() => setShowEmoji((v) => !v)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '8px 6px', display: 'flex' }}><Icon name="smile" size={19} /></button>}
                        <label className="ci-btn" title={l.attach} style={{ cursor: 'pointer', color: '#6b7280', padding: '8px 6px', display: 'flex' }}><Icon name="paperclip" size={18} />
                          <input type="file" multiple accept="image/*,application/pdf,.doc,.docx,.csv,.xlsx,.txt" style={{ display: 'none' }} onChange={(e) => { if (e.target.files) uploadAtt(e.target.files); e.currentTarget.value = ''; }} />
                        </label>
                      </>}
                      <textarea ref={taRef} value={text} onChange={(e) => { setText(e.target.value); if (mode === 'reply') { sendTyping(); pingAgentTyping(tk.id); } }}
                        onKeyDown={(e) => {
                          // "/" en el compositor vacío abre las respuestas guardadas.
                          if (e.key === '/' && mode === 'reply' && !text) { e.preventDefault(); setShowCanned(true); return; }
                          // Enter (o Cmd/Ctrl+Enter) envía; Shift+Enter hace salto de línea.
                          if (e.key === 'Enter' && (!e.shiftKey || e.metaKey || e.ctrlKey)) { e.preventDefault(); if (mode === 'reply') { if (text.trim() || atts.length) act(tk.id, { body: text, attachments: atts }); } else if (text.trim()) act(tk.id, { note: text }); } }}
                        rows={1} placeholder={mode === 'note' ? t.s_notePh : `${t.s_replyPh} · ${l.slashHint}`} style={{ flex: 1, margin: 0, resize: 'none', minHeight: 36, maxHeight: 132, overflowY: 'auto', padding: '9px 6px', border: 'none', background: 'transparent', fontSize: 14, color: mode === 'note' ? 'var(--tx)' : '#15181f' }} />
                    </div>
                    <button className="wa-send" onClick={() => mode === 'reply' ? act(tk.id, { body: text, attachments: atts }) : act(tk.id, { note: text })}
                      disabled={busy === tk.id || (mode === 'reply' ? (!text.trim() && !atts.length) : !text.trim())} title={mode === 'reply' ? t.s_sendReply : t.s_saveNote}
                      style={{ width: 46, height: 46, flex: 'none', borderRadius: '50%', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: mode === 'note' ? '#241002' : '#fff', cursor: 'pointer', background: mode === 'note' ? 'linear-gradient(135deg,#ffc04d,#ff9f45)' : '#00a884', boxShadow: 'none', opacity: busy === tk.id ? .6 : 1 }}>
                      {mode === 'note' ? <Icon name="lock" size={18} /> : (busy === tk.id ? <Icon name="dots" size={19} /> : <Icon name="send" size={19} />)}
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
