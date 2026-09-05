'use client';
import { dictFor } from '@/lib/i18n';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useLang } from '@/lib/lang';
import OnyxIcon from '@/app/components/OnyxIcon';
import type { ChatWidget } from '@/lib/settings';

// Textos fijos del flujo (captura de correo/ticket). El resto (marca, saludo,
// temas, colores, pestañas, por dispositivo) llega de la configuración editable.
const T: any = {
  es: {
    seeArt: 'Ver', center: 'Centro de soporte', openTicket: 'Abrir un ticket',
    emailT: 'Déjanos tu correo y te respondemos aunque cierres:', emailPh: 'tucorreo@email.com', send: 'Enviar',
    msgT: 'Cuéntanos en qué te ayudamos:', msgPh: 'Escribe tu mensaje…',
    sentT: '¡Recibido!', sentD: 'Te responderemos a tu correo muy pronto.', createAcc: 'Crear cuenta gratis',
    errMail: 'Escribe un correo válido.', errMsg: 'Escribe tu mensaje.',
  },
  en: {
    seeArt: 'Open', center: 'Support center', openTicket: 'Open a ticket',
    emailT: 'Leave your email and we will reply even if you close this:', emailPh: 'you@email.com', send: 'Send',
    msgT: 'Tell us how we can help:', msgPh: 'Type your message…',
    sentT: 'Got it!', sentD: 'We will reply to your email very soon.', createAcc: 'Create free account',
    errMail: 'Enter a valid email.', errMsg: 'Type your message.',
  },
};

export default function SupportWidget({ loggedIn = false, cfg }: { loggedIn?: boolean; cfg?: ChatWidget }) {
  const { lang } = useLang();
  const t = dictFor(T, lang);
  const es = lang === 'es';
  const pathname = usePathname() || '';
  const inAdmin = pathname === '/admin' || pathname.startsWith('/admin/') || pathname === '/en/admin' || pathname.startsWith('/en/admin/');
  const inAcademy = pathname.startsWith('/dashboard/academy') || pathname.startsWith('/en/dashboard/academy') || pathname.startsWith('/academia/') || pathname.startsWith('/en/academia/');

  const [open, setOpen] = useState(false);
  const [human, setHuman] = useState(false);
  const [chat, setChat] = useState<any[]>([]);
  const [ask, setAsk] = useState('');
  const [busy, setBusy] = useState(false);
  const [refs, setRefs] = useState<any[]>([]);
  const [actions, setActions] = useState<Array<{ label: string; url: string }>>([]);
  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [leadMsg, setLeadMsg] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');
  const [attach, setAttach] = useState<{ data: string; name: string; type: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [device, setDevice] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');
  const [tease, setTease] = useState(false);
  const [roleInfo, setRoleInfo] = useState<any>(null);   // { name, roles } del usuario logueado
  // Preferencias de ventana (escritorio/tablet): tamaño, expandido y lado. Se recuerdan.
  const [big, setBig] = useState(false);
  const [sideOv, setSideOv] = useState<'left' | 'right' | null>(null);
  const [dim, setDim] = useState<{ w: number; h: number } | null>(null);
  const [menu, setMenu] = useState(false);   // menú "⋯" de la cabecera
  const end = useRef<HTMLDivElement>(null);
  const started = chat.length > 0;

  // Cargar preferencias guardadas una vez.
  useEffect(() => {
    try { const s = JSON.parse(localStorage.getItem('onyx_chat_ui') || 'null'); if (s) { if (s.big) setBig(true); if (s.side) setSideOv(s.side); if (s.w && s.h) setDim({ w: s.w, h: s.h }); } } catch {}
  }, []);
  const persistUi = (patch: any) => { try { const cur = JSON.parse(localStorage.getItem('onyx_chat_ui') || '{}'); localStorage.setItem('onyx_chat_ui', JSON.stringify({ ...cur, ...patch })); } catch {} };

  // Memoria de la conversación entre sesiones (7 días). Solo en este navegador.
  const CHAT_TTL = 7 * 864e5;
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem('onyx_chat_log') || 'null');
      if (s && Array.isArray(s.msgs) && s.t && (Date.now() - s.t) < CHAT_TTL) setChat(s.msgs.slice(-30));
      else localStorage.removeItem('onyx_chat_log');
    } catch {}
  }, []);
  useEffect(() => {
    try {
      if (chat.length) localStorage.setItem('onyx_chat_log', JSON.stringify({ t: Date.now(), msgs: chat.slice(-30) }));
      else localStorage.removeItem('onyx_chat_log');
    } catch {}
  }, [chat]);
  function clearChat() { setChat([]); setRefs([]); setActions([]); setShowEmail(false); setSent(false); setAttach(null); try { localStorage.removeItem('onyx_chat_log'); } catch {} }
  // Cerrar el menú "⋯" al hacer clic fuera (se engancha tras el clic que lo abrió).
  useEffect(() => {
    if (!menu) return;
    const h = () => setMenu(false);
    const id = setTimeout(() => window.addEventListener('click', h), 0);
    return () => { clearTimeout(id); window.removeEventListener('click', h); };
  }, [menu]);

  // Dispositivo actual (para ocultar/posicionar según la pantalla).
  useEffect(() => {
    const calc = () => { const w = window.innerWidth; setDevice(w <= 520 ? 'mobile' : w <= 1024 ? 'tablet' : 'desktop'); };
    calc(); window.addEventListener('resize', calc); return () => window.removeEventListener('resize', calc);
  }, []);

  useEffect(() => { fetch('/api/support/availability').then((r) => r.json()).then((j) => setHuman(!!j.online)).catch(() => {}); }, [open]);
  // Al abrir con sesión: trae rol + nombre para personalizar saludo y temas rápidos.
  useEffect(() => {
    if (!open || !loggedIn) return;
    fetch('/api/support/ai').then((r) => r.json()).then((j) => { if (j?.loggedIn) setRoleInfo(j); }).catch(() => {});
  }, [open, loggedIn]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [chat, busy, showEmail, sent]);

  // Mensaje proactivo: globo sobre el botón tras unos segundos (una vez por sesión).
  const proactiveOn = cfg?.proactiveOn && !open;
  useEffect(() => {
    if (!proactiveOn) return;
    try { if (sessionStorage.getItem('onyx_chat_tease') === '1') return; } catch {}
    const id = setTimeout(() => setTease(true), Math.max(2, cfg?.proactiveDelay || 12) * 1000);
    return () => clearTimeout(id);
  }, [proactiveOn, cfg?.proactiveDelay]);

  function openEmail() {
    const lastQ = [...chat].reverse().find((m) => m.role === 'user')?.content || '';
    setLeadMsg((prev) => prev || lastQ);
    setErr(''); setShowEmail(true);
  }
  function dismissTease() { setTease(false); try { sessionStorage.setItem('onyx_chat_tease', '1'); } catch {} }
  function launch() { setOpen(true); dismissTease(); }

  async function sendAI(q?: string) {
    const question = (q ?? ask).trim(); if (!question || busy) return;
    const next = [...chat, { role: 'user', content: question }];
    setChat(next); setAsk(''); setBusy(true); setRefs([]); setActions([]);
    try {
      const r = await fetch('/api/support/ai', { method: 'POST', body: JSON.stringify({ question, history: chat, lang }) });
      const j = await r.json();
      setChat([...next, { role: 'assistant', content: j.answer || '…' }]);
      setRefs(j.articles || []);
      setActions(Array.isArray(j.actions) ? j.actions : []);
      if (!loggedIn && j.escalate) openEmail();
    } catch { setChat([...next, { role: 'assistant', content: '…' }]); }
    setBusy(false);
  }

  // Elegir una captura (imagen) para adjuntar al ticket. Abre el panel de contacto.
  function pickFile() { fileRef.current?.click(); }
  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    if (!/^image\//.test(f.type)) { setErr(es ? 'Solo imágenes.' : 'Images only.'); setShowEmail(true); return; }
    if (f.size > 6 * 1024 * 1024) { setErr(es ? 'La imagen supera 6 MB.' : 'Image over 6 MB.'); setShowEmail(true); return; }
    const rd = new FileReader();
    rd.onload = () => { setAttach({ data: String(rd.result), name: f.name, type: f.type }); setErr(''); setShowEmail(true); };
    rd.readAsDataURL(f);
  }

  // Enviar a soporte. Con sesión → crea un ticket (con la captura si hay). Sin
  // sesión → deja un lead con su correo (la captura se sube en el servidor).
  async function sendContact() {
    const msg = leadMsg.trim();
    if (loggedIn) {
      if (!msg && !attach) { setErr(t.errMsg); return; }
      setErr(''); setBusy(true);
      try {
        let atts: any[] = [];
        if (attach) {
          const up = await fetch('/api/chat/upload', { method: 'POST', body: JSON.stringify({ data: attach.data, name: attach.name, type: attach.type }) });
          const uj = await up.json().catch(() => ({}));
          if (up.ok && uj.url) atts = [{ url: uj.url, name: uj.name, type: uj.type }];
        }
        const lastQ = [...chat].reverse().find((m) => m.role === 'user')?.content || msg;
        const subject = (lastQ || msg || (es ? 'Consulta desde el chat' : 'Chat question')).slice(0, 120);
        await fetch('/api/support/tickets', { method: 'POST', body: JSON.stringify({ subject, body: msg, category: 'general', attachments: atts }) });
      } catch {}
      setBusy(false); setSent(true); setShowEmail(false); setAttach(null);
      return;
    }
    const e = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) { setErr(t.errMail); return; }
    if (!msg && !attach) { setErr(t.errMsg); return; }
    setErr(''); setBusy(true);
    const history = chat.filter((m) => m.role === 'user' || m.role === 'assistant').map((m) => ({ role: m.role, content: m.content }));
    await fetch('/api/support/lead', { method: 'POST', body: JSON.stringify({ email: e, message: msg, history, lang, attachment: attach ? { data: attach.data, name: attach.name, type: attach.type } : null }) });
    setBusy(false); setSent(true); setShowEmail(false); setAttach(null);
  }

  const bubble = (role: string) => role === 'user'
    ? { alignSelf: 'flex-end', background: 'var(--grad)', color: '#fff', borderRadius: '12px 12px 2px 12px' }
    : { alignSelf: 'flex-start', background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: '12px 12px 12px 2px' };

  if (inAdmin || inAcademy) return null;
  if (!cfg || cfg.enabled === false) return null;
  // Ocultar en el dispositivo elegido desde Admin.
  if ((device === 'mobile' && cfg.hideMobile) || (device === 'tablet' && cfg.hideTablet) || (device === 'desktop' && cfg.hideDesktop)) return null;

  // Textos según idioma (con respaldo).
  const p = (a?: string, b?: string) => (es ? a : b) || a || b || '';
  const x = {
    help: p(cfg.helpLabel_es, cfg.helpLabel_en),
    title: p(cfg.name_es, cfg.name_en), humanTitle: p(cfg.humanName_es, cfg.humanName_en),
    online: p(cfg.subOn_es, cfg.subOn_en),
    hi: p(cfg.greeting_es, cfg.greeting_en), topicsT: p(cfg.topicsTitle_es, cfg.topicsTitle_en),
    ph: p(cfg.placeholder_es, cfg.placeholder_en), human: p(cfg.humanLabel_es, cfg.humanLabel_en),
    proactive: p(cfg.proactive_es, cfg.proactive_en),
  };
  const baseTopics = (loggedIn ? cfg.topicsUser : cfg.topicsGuest).map((tp) => [es ? tp.q_es : tp.q_en, es ? tp.label_es : tp.label_en] as [string, string]).filter(([, l]) => l);
  // Temas rápidos POR ROL (solo con sesión y según roleInfo del usuario).
  const roleTopics: [string, string][] = [];
  const rr = roleInfo?.roles;
  if (rr?.ambassador && rr.ambassador !== 'none') roleTopics.push([es ? '¿Cómo veo mi enlace y comisión de embajador?' : 'How do I see my ambassador link and commission?', es ? '🎯 Mi enlace y comisión' : '🎯 My link & commission']);
  if (rr?.mentor) roleTopics.push([es ? '¿Cómo cobro como mentor y conecto mi Stripe?' : 'How do I get paid as a mentor and connect Stripe?', es ? '🎓 Cobros de mentor' : '🎓 Mentor payouts']);
  const topics = [...roleTopics, ...baseTopics];
  // Saludo personalizado por nombre si hay sesión. Evita "¡Hola! ¡Hola!" quitando
  // el saludo inicial que ya trae el texto configurado antes de anteponer el nombre.
  const greet = roleInfo?.name
    ? `${es ? '¡Hola' : 'Hi'} ${roleInfo.name}! ` + x.hi.replace(/^\s*(¡?\s*hola\s*!?|hi\s*!?|hello\s*!?|hey\s*!?)[,\s]*/i, '')
    : x.hi;

  // Separa un emoji inicial de la etiqueta y lo pinta como icono de línea.
  const iconLabel = (label: string, size = 14) => {
    const m = (label || '').match(/^([\p{Extended_Pictographic}\uFE0F\u200D]+)\s*([\s\S]*)$/u);
    const ic = m ? m[1] : ''; const tx = m ? m[2] : (label || '');
    return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>{ic && <OnyxIcon emoji={ic} size={size} glow={false} />}{tx}</span>;
  };

  // Colores del tema del chat (variables locales que heredan los hijos fijos).
  const grad = cfg.gradient ? `linear-gradient(135deg, ${cfg.c1}, ${cfg.c2})` : cfg.c1;
  const themeVars: any = { ['--grad']: grad, ['--brand']: cfg.accent };
  const side = cfg.side === 'left' ? 'left' : 'right';
  const sideC: 'left' | 'right' = sideOv || side;   // lado efectivo del panel (con override)
  const ox = Math.max(0, cfg.offsetX ?? 18), oy = Math.max(0, cfg.offsetY ?? 18);
  const lsz = Math.min(80, Math.max(40, cfg.launcherSize ?? 54));
  const isMobile = device === 'mobile';

  // Redimensionar (solo escritorio/tablet, no expandido). Ancla abajo-lado, así que
  // el tirador vive en la esquina superior interior y crece hacia el centro.
  function onResizeDown(e: React.PointerEvent) {
    if (isMobile || big) return;
    e.preventDefault(); e.stopPropagation();
    const startX = e.clientX, startY = e.clientY;
    const startW = dim?.w ?? 344;
    const startH = dim?.h ?? Math.min((typeof window !== 'undefined' ? window.innerHeight : 800) - 40, 560);
    const move = (ev: PointerEvent) => {
      const dw = sideC === 'right' ? (startX - ev.clientX) : (ev.clientX - startX);
      const dh = startY - ev.clientY;
      const vw = window.innerWidth, vh = window.innerHeight;
      const w = Math.round(Math.min(Math.min(560, vw - 24), Math.max(320, startW + dw)));
      const h = Math.round(Math.min(vh - 40, Math.max(400, startH + dh)));
      setDim({ w, h });
    };
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      setDim((d) => { if (d) persistUi({ w: d.w, h: d.h }); return d; });
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  }
  const toggleBig = () => setBig((b) => { const n = !b; persistUi({ big: n }); return n; });
  const toggleSide = () => { const n: 'left' | 'right' = sideC === 'right' ? 'left' : 'right'; setSideOv(n); persistUi({ side: n }); };
  // Hay tirador de tamaño (esquina superior interior) solo en escritorio/tablet sin expandir.
  const gripOn = !isMobile && !big;
  const headPadL = gripOn && sideC === 'right' ? 30 : 14;
  const headPadR = gripOn && sideC === 'left' ? 30 : 14;

  // Estilo del panel según dispositivo / expandido / tamaño recordado.
  const panelBase: any = { zIndex: 61, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16, boxShadow: '0 14px 40px rgba(0,0,0,.45)', overflow: 'hidden', display: 'flex', flexDirection: 'column' };
  const panelStyle: any = big && !isMobile
    ? { ...panelBase, position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(640px, 94vw)', height: 'min(88vh, 900px)', maxHeight: '88vh' }
    : { ...panelBase, position: 'fixed', [sideC]: ox, bottom: oy, width: dim?.w ?? 344, maxWidth: 'calc(100vw - 24px)', ...(dim?.h ? { height: dim.h } : { maxHeight: 'calc(100vh - 40px)' }) };

  // Botón de icono en la cabecera (expandir / anclar), en línea moderna.
  const HBtn = ({ onClick, label, children }: any) => (
    <button onClick={onClick} aria-label={label} title={label} style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: cfg.fg || '#fff', cursor: 'pointer', width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{children}</button>
  );

  const avatar = (sz: number) => cfg.avatarUrl
    ? <img src={cfg.avatarUrl} alt="" style={{ width: sz, height: sz, borderRadius: 8, objectFit: 'cover', flex: 'none' }} />
    : <span style={{ width: sz, height: sz, borderRadius: 8, background: 'rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', color: '#fff' }}><OnyxIcon emoji={human ? '🙋' : (cfg.headerEmoji || '🤖')} size={Math.round(sz * 0.6)} glow={false} /></span>;

  return (
    <div style={themeVars}>
      <style>{`
        @keyframes onyxPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.7)}}
        @keyframes onyxType{0%,80%,100%{opacity:.3}40%{opacity:1}}
        @keyframes onyxTease{0%{opacity:0;transform:translateY(6px)}100%{opacity:1;transform:translateY(0)}}
        .onyx-pulse{animation:onyxPulse 1.4s ease-in-out infinite}
        .onyx-d1{animation:onyxType 1.2s infinite}.onyx-d2{animation:onyxType 1.2s .2s infinite}.onyx-d3{animation:onyxType 1.2s .4s infinite}
        @media(max-width:520px){.onyx-panel{right:0!important;left:0!important;top:0!important;bottom:0!important;transform:none!important;width:100%!important;max-width:100%!important;height:100dvh!important;max-height:100dvh!important;border-radius:0!important}
        .onyx-panel input,.onyx-panel textarea{font-size:16px!important}
        .onyx-resize{display:none!important}}
      `}</style>

      {!open && (
        <div style={{ position: 'fixed', [side]: ox, bottom: `calc(${oy}px + env(safe-area-inset-bottom))`, zIndex: 60, display: 'flex', flexDirection: 'column', alignItems: side === 'left' ? 'flex-start' : 'flex-end', gap: 8 }}>
          {/* Globo proactivo */}
          {tease && x.proactive && (
            <div onClick={launch} style={{ cursor: 'pointer', maxWidth: 230, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, padding: '9px 12px', fontSize: 13, color: 'var(--tx)', boxShadow: '0 8px 22px rgba(0,0,0,.32)', animation: 'onyxTease .3s ease', position: 'relative' }}>
              {x.proactive}
              <button onClick={(e) => { e.stopPropagation(); dismissTease(); }} aria-label="close" style={{ position: 'absolute', top: 2, right: 5, background: 'none', border: 'none', color: 'var(--mut)', fontSize: 14, cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>
          )}
          <button onClick={launch} aria-label={x.help}
            style={{ display: 'flex', alignItems: 'center', gap: 8, border: 'none', background: 'none', cursor: 'pointer', flexDirection: side === 'left' ? 'row-reverse' : 'row' }}>
            {x.help && <span style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 20, padding: '7px 13px', fontSize: 13, color: 'var(--tx)', boxShadow: '0 6px 18px rgba(0,0,0,.3)' }}>{x.help}</span>}
            <span style={{ position: 'relative', width: lsz, height: lsz, borderRadius: '50%', background: 'var(--grad)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 22px rgba(0,0,0,.35)' }}><OnyxIcon emoji={cfg.launcher || '💬'} size={Math.round(lsz * 0.5)} glow={false} />
              {cfg.showPulse && <span className="onyx-pulse" style={{ position: 'absolute', top: 2, right: 2, width: 13, height: 13, borderRadius: '50%', background: 'var(--green)', border: '2px solid var(--bg)' }} />}
            </span>
          </button>
        </div>
      )}

      {open && (
        <div className="onyx-panel" style={panelStyle}>
          {/* Tirador para redimensionar (escritorio/tablet, no expandido) — chip visible en la esquina interior */}
          {gripOn && (
            <div className="onyx-resize" onPointerDown={onResizeDown}
              style={{ position: 'absolute', top: 8, [sideC === 'right' ? 'left' : 'right']: 8, width: 20, height: 20, borderRadius: 6, background: 'rgba(255,255,255,.16)', border: '0.5px solid rgba(255,255,255,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: sideC === 'right' ? 'nwse-resize' : 'nesw-resize', zIndex: 6, color: '#fff', touchAction: 'none' }} aria-label={es ? 'Estirar el chat' : 'Resize'} title={es ? 'Arrastra para estirar el chat' : 'Drag to resize'}>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ transform: sideC === 'right' ? 'none' : 'scaleX(-1)' }}>
                <path d="M13 3 L3 13 M13 7 L7 13 M13 11 L11 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
          )}
          <div style={{ background: 'var(--grad)', color: cfg.fg || '#fff', padding: `calc(12px + env(safe-area-inset-top)) ${headPadR}px 12px ${headPadL}px`, display: 'flex', alignItems: 'center', gap: 9, flex: 'none' }}>
            {avatar(30)}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{human ? x.humanTitle : x.title}</div>
              <div style={{ fontSize: 11, opacity: .9, display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap', overflow: 'hidden' }}>
                {cfg.showPulse && <span className="onyx-pulse" style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)', flex: 'none' }} />}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.online}</span>
              </div>
            </div>
            {(!isMobile || started) && (
              <div style={{ position: 'relative', flex: 'none' }}>
                <HBtn onClick={() => setMenu((m) => !m)} label={es ? 'Más opciones' : 'More options'}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="3" r="1.4" /><circle cx="8" cy="8" r="1.4" /><circle cx="8" cy="13" r="1.4" /></svg>
                </HBtn>
                {menu && (
                  <div style={{ position: 'absolute', top: 36, [sideC === 'right' ? 'right' : 'left']: 0, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10, boxShadow: '0 10px 26px rgba(0,0,0,.4)', padding: 6, zIndex: 20, minWidth: 196 }}>
                    {!isMobile && (
                    <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, padding: '8px 10px' }} onClick={() => { toggleSide(); setMenu(false); }}>
                      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ transform: sideC === 'right' ? 'none' : 'scaleX(-1)' }}><path d="M10 3 L5 8 L10 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      {sideC === 'right' ? (es ? 'Mover a la izquierda' : 'Move to the left') : (es ? 'Mover a la derecha' : 'Move to the right')}
                    </button>
                    )}
                    {started && (
                      <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, padding: '8px 10px' }} onClick={() => { clearChat(); setMenu(false); }}>
                        <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M3 6h10M6.5 6V4.5h3V6M5 6l.6 7h4.8L11 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        {es ? 'Nueva conversación' : 'New conversation'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
            {!isMobile && (
              <button onClick={toggleBig} aria-label={big ? (es ? 'Reducir' : 'Shrink') : (es ? 'Ampliar' : 'Expand')} title={big ? (es ? 'Reducir el chat' : 'Shrink the chat') : (es ? 'Ampliar el chat a pantalla completa' : 'Expand the chat to full screen')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 28, padding: '0 11px', border: 'none', borderRadius: 8, background: '#fff', color: cfg.c2 || cfg.c1 || 'var(--brand)', fontSize: 12, fontWeight: 600, cursor: 'pointer', flex: 'none' }}>
                {big
                  ? <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M9 3 L9 7 L13 7 M7 13 L7 9 L3 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  : <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M9 3 L13 3 L13 7 M7 13 L3 13 L3 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                {big ? (es ? 'Reducir' : 'Shrink') : (es ? 'Ampliar' : 'Expand')}
              </button>
            )}
            {!isMobile && <span style={{ width: 1, height: 20, background: 'rgba(255,255,255,.28)', flex: 'none' }} />}
            <button onClick={() => setOpen(false)} aria-label="close" style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: cfg.fg || '#fff', fontSize: 20, cursor: 'pointer', lineHeight: 1, width: 34, height: 34, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>×</button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 12, background: 'var(--bg2)', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 200 }}>
            <div style={{ maxWidth: '86%', padding: '8px 11px', fontSize: 13, lineHeight: 1.5, ...bubble('assistant') }}>{greet}</div>
            {!started && cfg.showTopics && topics.length > 0 && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--mut)', margin: '2px 0 6px' }}>{x.topicsT}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {topics.map(([q, label]) => (
                    <button key={label} className="btn btn-ghost" style={{ padding: '8px 10px', fontSize: 12 }} onClick={() => sendAI(q)}>{iconLabel(label)}</button>
                  ))}
                  {!loggedIn && cfg.showHuman && <button className="btn btn-ghost" style={{ padding: '8px 10px', fontSize: 12, gridColumn: '1 / -1' }} onClick={openEmail}>{iconLabel(x.human)}</button>}
                </div>
              </div>
            )}
            {chat.map((m, i) => (
              <div key={i} style={{ maxWidth: '86%', padding: '8px 11px', fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap', ...bubble(m.role) }}>{m.content}</div>
            ))}
            {busy && (
              <div style={{ padding: '9px 12px', ...bubble('assistant') }}>
                <span className="onyx-d1" style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--mut)', margin: '0 2px' }} />
                <span className="onyx-d2" style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--mut)', margin: '0 2px' }} />
                <span className="onyx-d3" style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--mut)', margin: '0 2px' }} />
              </div>
            )}
            {actions.length > 0 && (
              <div style={{ alignSelf: 'flex-start', display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                {actions.map((a) => (
                  <Link key={a.url} href={a.url} onClick={() => setOpen(false)} className="btn btn-primary" style={{ padding: '7px 12px', fontSize: 12.5, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {a.label} <OnyxIcon name="send" size={13} glow={false} />
                  </Link>
                ))}
              </div>
            )}
            {refs.length > 0 && (
              <div style={{ alignSelf: 'flex-start', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {refs.map((a) => <Link key={a.slug} href={`/guia/${a.slug}`} onClick={() => setOpen(false)} className="pill" style={{ color: 'var(--brand)', background: 'rgba(124,140,255,.12)' }}>{t.seeArt}: {a.title}</Link>)}
              </div>
            )}
            {showEmail && !sent && (
              <div style={{ background: 'rgba(124,140,255,.10)', border: '1px solid var(--brand)', borderRadius: 10, padding: 10, marginTop: 4 }}>
                <div style={{ fontSize: 12, color: 'var(--tx)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}><OnyxIcon emoji="💬" size={14} glow={false} /> {t.msgT}</div>
                <textarea value={leadMsg} onChange={(e) => setLeadMsg(e.target.value)} placeholder={t.msgPh} rows={3} style={{ width: '100%', margin: '0 0 8px', fontSize: 13, resize: 'vertical' }} />

                {/* Captura adjunta: previsualización + quitar */}
                {attach && (
                  <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 8, background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 8, padding: 6 }}>
                    <img src={attach.data} alt="" style={{ width: 42, height: 42, borderRadius: 6, objectFit: 'cover', flex: 'none' }} />
                    <span style={{ fontSize: 12, color: 'var(--tx)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attach.name}</span>
                    <button onClick={() => setAttach(null)} aria-label="remove" style={{ background: 'none', border: 'none', color: 'var(--mut)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
                  </div>
                )}
                {/* Botón adjuntar captura */}
                <button className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: 12, marginBottom: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={pickFile} type="button">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M12 7l-4.5 4.5a2.5 2.5 0 0 1-3.5-3.5L8.5 3.5a1.6 1.6 0 0 1 2.3 2.3L6.3 10.3a.8.8 0 0 1-1.1-1.1L9 5.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  {attach ? (es ? 'Cambiar captura' : 'Change screenshot') : (es ? 'Adjuntar captura' : 'Attach screenshot')}
                </button>

                {!loggedIn && <>
                  <div style={{ fontSize: 12, color: 'var(--tx)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}><OnyxIcon emoji="📧" size={14} glow={false} /> {t.emailT}</div>
                  <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.emailPh} style={{ width: '100%', margin: '0 0 8px', fontSize: 13 }} />
                </>}
                <div className="row" style={{ gap: 6 }}>
                  <span style={{ flex: 1, fontSize: 11, color: 'var(--mut)' }}>{es ? 'No incluyas contraseñas ni números de tarjeta en la captura.' : 'Don\'t include passwords or card numbers in the screenshot.'}</span>
                  <button className="btn btn-primary" style={{ padding: '8px 12px', fontSize: 13 }} onClick={sendContact} disabled={busy}>{busy ? '…' : t.send}</button>
                </div>
                {err && <div style={{ color: 'var(--amber)', fontSize: 12, marginTop: 6 }}>{err}</div>}
              </div>
            )}
            {sent && (
              <div style={{ background: 'rgba(52,226,160,.10)', border: '1px solid var(--green)', borderRadius: 10, padding: 12, marginTop: 4, textAlign: 'center' }}>
                <div style={{ fontWeight: 700, color: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><OnyxIcon name="check" size={16} glow={false} /> {t.sentT}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>{t.sentD}</div>
                {!loggedIn && <Link href="/login?mode=signup" onClick={() => setOpen(false)} className="btn btn-ghost" style={{ marginTop: 10, fontSize: 13 }}>{t.createAcc}</Link>}
              </div>
            )}
            <div ref={end} />
          </div>

          {!sent && (
            <div style={{ padding: '10px 10px calc(10px + env(safe-area-inset-bottom))', borderTop: '1px solid var(--line)', background: 'var(--card)' }}>
              {loggedIn && cfg.showTicket && (
                <div className="row" style={{ gap: 6, marginBottom: 8 }}>
                  <Link href="/dashboard/soporte" onClick={() => setOpen(false)} className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }}>{t.openTicket}</Link>
                  <Link href="/dashboard/soporte" onClick={() => setOpen(false)} className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }}>{t.center}</Link>
                </div>
              )}
              <div className="row" style={{ gap: 6 }}>
                <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: 'none' }} />
                <button className="btn btn-ghost" style={{ padding: '9px 11px', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }} onClick={() => { openEmail(); pickFile(); }} disabled={busy} aria-label={es ? 'Adjuntar captura' : 'Attach screenshot'} title={es ? 'Adjuntar captura' : 'Attach screenshot'} type="button">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 7l-4.5 4.5a2.5 2.5 0 0 1-3.5-3.5L8.5 3.5a1.6 1.6 0 0 1 2.3 2.3L6.3 10.3a.8.8 0 0 1-1.1-1.1L9 5.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
                <input value={ask} onChange={(e) => setAsk(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') sendAI(); }} placeholder={x.ph} style={{ flex: 1, margin: 0, fontSize: 13 }} />
                <button className="btn btn-primary" style={{ padding: '9px 13px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => sendAI()} disabled={busy || !ask.trim()} aria-label={t.send}><OnyxIcon name="send" size={16} glow={false} /></button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
