'use client';
import { dictFor } from '@/lib/i18n';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useLang } from '@/lib/lang';
import OnyxIcon from '@/app/components/OnyxIcon';
import GooglePlayBadge from '@/app/components/GooglePlayBadge';
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

export default function SupportWidget({ loggedIn = false, cfg, variant = 'onyx' }: { loggedIn?: boolean; cfg?: ChatWidget; variant?: 'onyx' | 'botlab' }) {
  const { lang } = useLang();
  const t = dictFor(T, lang);
  const es = lang === 'es';
  const pathname = usePathname() || '';
  const inAdmin = pathname === '/admin' || pathname.startsWith('/admin/') || pathname === '/en/admin' || pathname.startsWith('/en/admin/');
  const inAcademy = pathname.startsWith('/dashboard/academy') || pathname.startsWith('/en/dashboard/academy') || pathname.startsWith('/academia/') || pathname.startsWith('/en/academia/');
  // En las pantallas de acceso (entrar/crear cuenta, recuperar y restablecer) la
  // burbuja no tiene sentido y tapaba contenido del formulario: la ocultamos.
  const inAuth = /^(\/en)?\/(login|reset-password|confirmado)(\/|$)/.test(pathname);

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

  // En móvil, cuando se abre el teclado, el "visual viewport" se encoge. Seguimos
  // su alto y su desplazamiento para que el panel quede FIJO justo encima del
  // teclado (sin que el chat se mueva ni se esconda el campo de escribir).
  const [vv, setVv] = useState<{ h: number; top: number } | null>(null);
  useEffect(() => {
    if (!open || device !== 'mobile') { setVv(null); return; }
    const vp: any = (typeof window !== 'undefined') ? (window as any).visualViewport : null;
    if (!vp) return;
    const on = () => setVv({ h: Math.round(vp.height), top: Math.round(vp.offsetTop) });
    on();
    // iOS Safari reporta el alto del teclado con retraso: re-medimos varias veces
    // tras enfocar y al enfocar/desenfocar cualquier campo del panel.
    const bump = () => { on(); [120, 320, 600].forEach((ms) => setTimeout(on, ms)); };
    vp.addEventListener('resize', on);
    vp.addEventListener('scroll', on);
    window.addEventListener('focusin', bump);
    window.addEventListener('focusout', bump);
    window.addEventListener('orientationchange', bump);
    return () => {
      vp.removeEventListener('resize', on); vp.removeEventListener('scroll', on);
      window.removeEventListener('focusin', bump); window.removeEventListener('focusout', bump);
      window.removeEventListener('orientationchange', bump);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, device]);

  // Con el panel abierto en móvil, bloquear el scroll del fondo para que la
  // página de atrás no se mueva mientras escribes en el chat.
  useEffect(() => {
    if (!open || device !== 'mobile') return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open, device]);

  // Auto-esconder el botón al bajar (deja ver todo el contenido); reaparece al
  // subir o al parar de hacer scroll. Solo cuando el panel está cerrado.
  const [hideLauncher, setHideLauncher] = useState(false);
  useEffect(() => {
    if (open) { setHideLauncher(false); return; }
    let lastY = -1;
    let lastTarget: any = null;
    let stopTimer: any;
    // Lee la posición de scroll del elemento que realmente se desplazó. En la app
    // scrollea el <body>/ventana, pero en el navegador móvil suele scrollear un
    // CONTENEDOR interno (overflow:auto); por eso antes el botón no se escondía.
    const onScroll = (e: Event) => {
      const tgt: any = e && e.target;
      let el: any;
      if (tgt && tgt !== document && tgt !== window && typeof tgt.scrollTop === 'number') el = tgt;
      else el = document.scrollingElement || document.documentElement;
      const y = (el && typeof el.scrollTop === 'number' ? el.scrollTop : (window.scrollY || 0)) || 0;
      // ¿Está el usuario pegado al fondo de la página? Ahí suelen vivir los botones
      // de acción (guardar, enviar…) que la burbuja tapaba. Si es así, la dejamos
      // escondida para no cubrir esos controles (hallazgo #2 de QA).
      const sh = (el && el.scrollHeight) || 0, ch = (el && el.clientHeight) || window.innerHeight || 0;
      const nearBottom = sh > 0 && (sh - y - ch) < 140;
      // Si cambió el contenedor que scrollea, no comparamos entre distintos: solo
      // guardamos la referencia nueva y esperamos al próximo evento.
      if (el !== lastTarget) { lastTarget = el; lastY = y; if (nearBottom) setHideLauncher(true); return; }
      if (lastY < 0) { lastY = y; return; }
      const dy = y - lastY;
      if (nearBottom) setHideLauncher(true);               // al fondo → esconder (deja ver los botones)
      else if (y > 140 && dy > 4) setHideLauncher(true);   // bajando → esconder
      else if (dy < -4) setHideLauncher(false);            // subiendo → mostrar
      lastY = y;
      clearTimeout(stopTimer);
      // Al parar reaparece, SALVO que esté pegado al fondo (ahí seguiría tapando).
      stopTimer = setTimeout(() => { if (!nearBottom) setHideLauncher(false); }, 650);
    };
    // capture:true → atrapa el scroll de CUALQUIER contenedor (el evento scroll no
    // burbujea, pero sí llega al document en fase de captura). Cubre app y web.
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('scroll', onScroll, { passive: true, capture: true } as any);
    return () => {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('scroll', onScroll, { capture: true } as any);
      clearTimeout(stopTimer);
    };
  }, [open]);

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
    // Variante Bot Lab: "hablar con una persona" cae en el relé/CRM de Bot Lab
    // (con traducción automática al equipo), no en tickets de soporte.
    if (variant === 'botlab') {
      if (!msg && !attach) { setErr(t.errMsg); return; }
      if (!loggedIn) { const e = email.trim(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) { setErr(t.errMail); return; } }
      setErr(''); setBusy(true);
      try {
        let tid: string | null = null; try { tid = localStorage.getItem('botlab_tid'); } catch {}
        const lastQ = [...chat].reverse().find((m) => m.role === 'user')?.content || '';
        const body = [lastQ && `(${es ? 'sobre' : 'about'}: ${lastQ})`, msg].filter(Boolean).join('\n');
        const r = await fetch('/api/botlab/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tid, text: body || msg, email: loggedIn ? undefined : email.trim() }) });
        const j = await r.json().catch(() => ({}));
        if (j.threadId) { try { localStorage.setItem('botlab_tid', j.threadId); } catch {} }
      } catch {}
      setBusy(false); setSent(true); setShowEmail(false); setAttach(null);
      return;
    }
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
    ? { alignSelf: 'flex-end', background: 'var(--grad)', color: '#241002', borderRadius: '12px 12px 2px 12px' }
    : { alignSelf: 'flex-start', background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: '12px 12px 12px 2px' };

  if (inAdmin || inAcademy || inAuth) return null;
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

  // Convierte enlaces dentro de una respuesta de la IA en BOTONES clickeables.
  // Reconoce markdown [texto](url), URLs http(s) y rutas internas conocidas (/bot-builder,
  // /pricing, /bot-lab, …). Los internos abren dentro de la app; los externos en otra pestaña.
  const LINKABLE = '(?:bot-builder|bot-lab|pricing|copy|dashboard|guia|guide|embajadores|ambassadors|academia|academy|login|contacto|contact|analiza|unete-ventas|carreras|blog)';
  // Rutas REALES de la app (slugs en español). Algunos slugs en inglés que la IA
  // suele inventar NO existen como página → los mapeamos a la ruta real.
  const ROUTE_ALIAS: Record<string, string> = {
    '/ambassadors': '/embajadores', '/guide': '/guia', '/academy': '/academia', '/contact': '/contacto',
  };
  // Normaliza CUALQUIER href a la ruta canónica real, a prueba de fallos:
  // 1) quita el dominio propio (URL completa → ruta), 2) quita el prefijo de idioma
  // (/en /es /pt /zh /ja /vi) porque la página correcta vive sin prefijo y el idioma
  // lo decide la cookie, 3) mapea alias de slug inglés al real. Deja intactas las
  // URLs externas y las rutas no reconocidas (no inventa destinos).
  const canonHref = (href: string): string => {
    let h = (href || '').trim().replace(/^https?:\/\/(www\.)?onyxtradinglive\.com/i, '');
    if (!h.startsWith('/')) return href;                 // externo: tal cual
    h = h.replace(/^\/(en|es|pt|zh|ja|vi)(?=\/|$)/i, ''); // quita idioma
    if (!h || h === '') h = '/';
    const m = h.match(/^([^?#]*)([?#].*)?$/);
    const base = (m?.[1] || '/').replace(/\/+$/, '') || '/';
    const rest = m?.[2] || '';
    return (ROUTE_ALIAS[base] || base) + rest;
  };
  // Detecta si un texto está en español (para que las etiquetas de botón sigan
  // el idioma de LA RESPUESTA, no el del sitio: la IA contesta en el idioma del usuario).
  const looksSpanish = (text: string): boolean => {
    const s = (text || '').toLowerCase();
    if (/[¿¡ñ]|ción\b|á|é|í|ó|ú/.test(s)) return true;
    return /\b(el|la|los|las|tu|tus|qué|cómo|para|robot|cuenta|planes|gratis|puedes|crear)\b/.test(s);
  };
  const linkLabel = (href: string, esArg = es): string => {
    const base = canonHref(href).split(/[?#]/)[0].replace(/\/+$/, '');
    const M: Record<string, [string, string]> = {
      '/bot-builder': ['Crea tu bot', 'Build a bot'], '/bot-lab': ['Bot Lab', 'Bot Lab'],
      '/pricing': ['Ver precios', 'See pricing'], '/copy': ['Copy trading', 'Copy trading'],
      '/guia': ['Abrir la Guía', 'Open the Guide'], '/guide': ['Abrir la Guía', 'Open the Guide'],
      '/embajadores': ['Embajadores', 'Ambassadors'], '/ambassadors': ['Embajadores', 'Ambassadors'],
      '/academia': ['Academia', 'Academy'], '/academy': ['Academia', 'Academy'],
      '/login': ['Crear cuenta', 'Create account'], '/contacto': ['Contacto', 'Contact'], '/contact': ['Contacto', 'Contact'],
      '/analiza': ['Analiza tu reporte', 'Analyze your report'], '/dashboard': ['Mi panel', 'My dashboard'],
    };
    const hit = M[base]; if (hit) return esArg ? hit[0] : hit[1];
    try { if (href.startsWith('http')) return new URL(href).hostname.replace(/^www\./, ''); } catch {}
    return esArg ? 'Abrir enlace' : 'Open link';
  };
  const linkBtn = (href: string, label: string, k: number) => {
    // Si el enlace es la app en Google Play, mostramos el badge OFICIAL clicable
    // (congruente con la guía, el landing y los banners), no una píldora genérica.
    if (/^https?:\/\/play\.google\.com\//i.test(href)) {
      return <span key={'gp' + k} style={{ display: 'inline-flex', verticalAlign: 'middle', margin: '4px 4px 0 0' }}><GooglePlayBadge size="xs" /></span>;
    }
    const st: any = { display: 'inline-flex', alignItems: 'center', gap: 5, verticalAlign: 'middle', background: 'linear-gradient(100deg,#22d3ee,#2dd4bf 60%,#06b6d4)', color: '#042f2e', fontWeight: 700, fontSize: 13, padding: '3px 10px', borderRadius: 8, textDecoration: 'none', margin: '3px 3px 0 0', whiteSpace: 'nowrap' };
    const inner = <>{label} <span aria-hidden>→</span></>;
    const dest = canonHref(href);   // ruta real, sin dominio, sin idioma, con alias resuelto
    if (dest.startsWith('/')) return <Link key={'lk' + k} href={dest} onClick={() => setOpen(false)} style={st}>{inner}</Link>;
    return <a key={'lk' + k} href={dest} target="_blank" rel="noopener noreferrer" style={st}>{inner}</a>;
  };
  const linkify = (text: string): any[] => {
    if (!text) return [text];
    // El idioma de las etiquetas de botón sigue al TEXTO (la IA responde en el idioma del usuario).
    const esTxt = looksSpanish(text) || es;
    // La IA suele poner la ruta entre paréntesis: "el Guardian (/dashboard)". Como la ruta
    // se vuelve botón, quitamos los paréntesis que solo envuelven un enlace para que no queden sueltos.
    text = text
      .replace(/\(\s*(\[[^\]]+\]\((?:https?:\/\/|\/)[^)]+\))\s*\)/g, '$1')
      .replace(new RegExp('(?<!\\])\\(\\s*((?:\\/(?:en|es|pt|zh|ja|vi))?\\/' + LINKABLE + '[\\w\\-\\/?=&#.]*)\\s*\\)', 'g'), '$1');
    // Capturamos también rutas con prefijo de idioma (/en/embajadores) para normalizarlas.
    const re = new RegExp('\\[([^\\]]+)\\]\\(((?:https?:\\/\\/|\\/)[^)]+)\\)|(https?:\\/\\/[^\\s<>()]+)|((?:\\/(?:en|es|pt|zh|ja|vi))?\\/' + LINKABLE + '[\\w\\-\\/?=&#.]*)', 'g');
    const out: any[] = []; let last = 0; let m: RegExpExecArray | null; let k = 0;
    while ((m = re.exec(text))) {
      if (m.index > last) out.push(text.slice(last, m.index));
      if (m[1] && m[2]) out.push(linkBtn(m[2].replace(/[.,;:]+$/, ''), m[1], k++));
      else { const href = (m[3] || m[4] || '').replace(/[.,;:]+$/, ''); out.push(linkBtn(href, linkLabel(href, esTxt), k++)); }
      last = m.index + m[0].length;
    }
    if (last < text.length) out.push(text.slice(last));
    return out;
  };

  // Texto enriquecido en línea: **negrita** + enlaces→botón.
  const inlineRich = (text: string, kb: string): any[] => {
    const out: any[] = []; let i = 0; let k = 0;
    const re = /\*\*([^*]+)\*\*/g; let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      if (m.index > i) out.push(...linkify(text.slice(i, m.index)));
      out.push(<strong key={kb + 'b' + k++}>{m[1]}</strong>);
      i = m.index + m[0].length;
    }
    if (i < text.length) out.push(...linkify(text.slice(i)));
    return out;
  };

  // Renderiza la respuesta: convierte tablas markdown en tarjetas apiladas (el chat
  // es angosto y las tablas se ven mal), y respeta negritas, viñetas y enlaces.
  const renderRich = (text: string): any[] => {
    if (!text || (!text.includes('|') && !text.includes('**'))) return linkify(text);
    const lines = text.split('\n');
    const blocks: any[] = []; let i = 0; let bk = 0;
    const isSep = (l: string) => /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(l) && l.includes('-');
    const cells = (l: string) => l.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());
    while (i < lines.length) {
      const l = lines[i];
      // ¿Inicio de tabla? fila con | seguida de separador ---.
      if (l.includes('|') && i + 1 < lines.length && isSep(lines[i + 1])) {
        const header = cells(l); i += 2; const rows: string[][] = [];
        while (i < lines.length && lines[i].includes('|')) { rows.push(cells(lines[i])); i++; }
        blocks.push(
          <div key={'tb' + bk++} style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '6px 0' }}>
            {rows.map((r, ri) => (
              <div key={ri} style={{ border: '1px solid var(--line,rgba(255,255,255,.1))', borderRadius: 10, padding: '8px 10px', background: 'rgba(34,211,238,.06)' }}>
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>{inlineRich(r[0] || '', 'tt' + ri)}</div>
                {r.slice(1).map((c, ci) => (c ? (
                  <div key={ci} style={{ fontSize: 12.5, lineHeight: 1.5, display: 'flex', gap: 6 }}>
                    <span style={{ opacity: .6, minWidth: 54, flex: 'none' }}>{header[ci + 1] || ''}</span>
                    <span>{inlineRich(c, 't' + ri + '_' + ci)}</span>
                  </div>
                ) : null))}
              </div>
            ))}
          </div>
        );
        continue;
      }
      // Línea normal (incluye viñetas y párrafos).
      blocks.push(<div key={'ln' + bk++} style={{ minHeight: l.trim() ? undefined : 6 }}>{inlineRich(l, 'l' + bk)}</div>);
      i++;
    }
    return blocks;
  };

  // Separa un emoji inicial de la etiqueta y lo pinta como icono de línea.
  const iconLabel = (label: string, size = 14) => {
    const m = (label || '').match(/^([\p{Extended_Pictographic}\uFE0F\u200D]+)\s*([\s\S]*)$/u);
    const ic = m ? m[1] : ''; const tx = m ? m[2] : (label || '');
    return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>{ic && <OnyxIcon emoji={ic} size={size} glow={false} />}{tx}</span>;
  };

  // Colores del tema del chat: TODO en tono china (naranja), texto oscuro encima.
  const CHINA = 'linear-gradient(100deg,#ffcf5c,#ff9d3d 55%,#ff6a2b)';
  const CHINK = '#241002'; // texto/icono oscuro para contraste sobre naranja
  const grad = CHINA;
  const themeVars: any = { ['--grad']: CHINA, ['--brand']: '#ff6a2b' };
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
  // Tamaño FIJO mediano en escritorio (sin estirar ni expandir). En móvil, la
  // media query de abajo lo lleva a pantalla completa.
  const panelStyle: any = { ...panelBase, position: 'fixed', [sideC]: ox, bottom: oy, width: 380, maxWidth: 'calc(100vw - 24px)', height: 600, maxHeight: 'calc(100vh - 40px)' };
  // Móvil con teclado abierto: alto y desplazamiento reales del viewport visible.
  // La media query de abajo lee estas variables (con respaldo a 100dvh).
  // kbOpen = el viewport visible se encogió bastante → el teclado está arriba.
  const kbOpen = !!(isMobile && vv && typeof window !== 'undefined' && (window.innerHeight - vv.h) > 120);
  if (isMobile && vv) { panelStyle['--onyx-h'] = vv.h + 'px'; panelStyle['--onyx-top'] = vv.top + 'px'; }

  // Botón de icono en la cabecera (expandir / anclar), en línea moderna.
  const HBtn = ({ onClick, label, children }: any) => (
    <button onClick={onClick} aria-label={label} title={label} style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: cfg.fg || '#fff', cursor: 'pointer', width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{children}</button>
  );

  const avatar = (sz: number) => cfg.avatarUrl
    ? <img src={cfg.avatarUrl} alt="" style={{ width: sz, height: sz, borderRadius: 8, objectFit: 'cover', flex: 'none' }} />
    : <span style={{ width: sz, height: sz, borderRadius: 8, background: 'rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', color: '#fff' }}><OnyxIcon emoji={human ? '🙋' : (cfg.headerEmoji || '🤖')} size={Math.round(sz * 0.6)} glow={false} /></span>;

  return (
    <div className="onyx-support-root" style={themeVars}>
      <style>{`
        @keyframes onyxPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.7)}}
        @keyframes onyxType{0%,80%,100%{opacity:.3}40%{opacity:1}}
        @keyframes onyxTease{0%{opacity:0;transform:translateY(6px)}100%{opacity:1;transform:translateY(0)}}
        .onyx-pulse{animation:onyxPulse 1.4s ease-in-out infinite}
        .onyx-d1{animation:onyxType 1.2s infinite}.onyx-d2{animation:onyxType 1.2s .2s infinite}.onyx-d3{animation:onyxType 1.2s .4s infinite}
        @media(max-width:520px){.onyx-panel{right:0!important;left:0!important;top:0!important;bottom:auto!important;transform:translateY(var(--onyx-top,0px))!important;width:100%!important;max-width:100%!important;height:var(--onyx-h,100dvh)!important;max-height:var(--onyx-h,100dvh)!important;border-radius:0!important;z-index:2147483000!important}
        .onyx-panel input,.onyx-panel textarea{font-size:16px!important}
        .onyx-resize{display:none!important}}
      `}</style>

      {!open && (
        <div style={{ position: 'fixed', [side]: ox, bottom: `calc(${oy}px + env(safe-area-inset-bottom))`, zIndex: 60, display: 'flex', flexDirection: 'column', alignItems: side === 'left' ? 'flex-start' : 'flex-end', gap: 8, transition: 'transform .28s ease, opacity .28s ease', transform: (hideLauncher && !tease) ? `translateY(${lsz + oy + 28}px)` : 'translateY(0)', opacity: (hideLauncher && !tease) ? 0 : 1, pointerEvents: (hideLauncher && !tease) ? 'none' : 'auto' }}>
          {/* Globo proactivo */}
          {tease && x.proactive && (
            <div onClick={launch} style={{ cursor: 'pointer', maxWidth: 250, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, padding: '10px 34px 10px 12px', fontSize: 13, color: 'var(--tx)', boxShadow: '0 8px 22px rgba(0,0,0,.32)', animation: 'onyxTease .3s ease', position: 'relative' }}>
              {x.proactive}
              <button onClick={(e) => { e.stopPropagation(); dismissTease(); }} aria-label={es ? 'Cerrar' : 'Close'} title={es ? 'Cerrar' : 'Close'} style={{ position: 'absolute', top: 4, right: 4, width: 28, height: 28, borderRadius: 8, background: 'var(--bg2)', border: '1px solid var(--line)', color: 'var(--tx)', fontSize: 16, cursor: 'pointer', lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
          )}
          <button onClick={launch} aria-label={x.help || (es ? 'Abrir el chat de ayuda' : 'Open help chat')}
            style={{ display: 'flex', alignItems: 'center', gap: 8, border: 'none', background: 'none', cursor: 'pointer', flexDirection: side === 'left' ? 'row-reverse' : 'row' }}>
            {x.help && <span style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 20, padding: '7px 13px', fontSize: 13, color: 'var(--tx)', boxShadow: '0 6px 18px rgba(0,0,0,.3)' }}>{x.help}</span>}
            <span style={{ position: 'relative', width: lsz, height: lsz, borderRadius: '50%', background: 'var(--grad)', color: '#241002', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 22px rgba(0,0,0,.35)' }}>{(cfg.launcher && cfg.launcher !== '💬')
                ? <OnyxIcon emoji={cfg.launcher} size={Math.round(lsz * 0.5)} glow={false} />
                : (() => { const s = Math.round(lsz * 0.52); return (
                  <svg width={s} height={s} viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M4 3.5h16a2.5 2.5 0 0 1 2.5 2.5v9A2.5 2.5 0 0 1 20 17.5H9.6L4.4 21.6A.7.7 0 0 1 3.3 21v-3.5H4A2.5 2.5 0 0 1 1.5 15V6A2.5 2.5 0 0 1 4 3.5z" transform="translate(0.5 0)"/><circle cx="8" cy="10.5" r="1.5" fill="#ff7a1a"/><circle cx="12.5" cy="10.5" r="1.5" fill="#ff7a1a"/><circle cx="17" cy="10.5" r="1.5" fill="#ff7a1a"/></svg>
                ); })()}
              {cfg.showPulse && <span className="onyx-pulse" style={{ position: 'absolute', top: 2, right: 2, width: 13, height: 13, borderRadius: '50%', background: 'var(--green)', border: '2px solid var(--bg)' }} />}
            </span>
          </button>
        </div>
      )}

      {open && (
        <div className="onyx-panel" style={panelStyle}>
          <div style={{ background: 'var(--grad)', color: CHINK, padding: `calc(12px + env(safe-area-inset-top)) 14px 12px 14px`, display: 'flex', alignItems: 'center', gap: 9, flex: 'none' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 16, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{human ? x.humanTitle : x.title}</div>
              <div style={{ fontSize: 12, opacity: .85, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap', overflow: 'hidden' }}>
                {cfg.showPulse && <span className="onyx-pulse" style={{ width: 7, height: 7, borderRadius: '50%', background: '#128a4f', flex: 'none' }} />}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.online}</span>
              </div>
            </div>
            {/* Solo el botón de cerrar en la cabecera (sin Expand ni menú de 3 puntos). */}
            <button onClick={() => setOpen(false)} aria-label="close" style={{ background: 'rgba(0,0,0,.14)', border: 'none', color: CHINK, fontSize: 20, cursor: 'pointer', lineHeight: 1, width: 34, height: 34, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>×</button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 12, background: 'var(--bg2)', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 200 }}>
            <div style={{ maxWidth: '86%', padding: '9px 12px', fontSize: 14, lineHeight: 1.6, ...bubble('assistant') }}>{linkify(greet)}</div>
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
              <div key={i} style={{ maxWidth: '86%', padding: '9px 12px', fontSize: 14, lineHeight: 1.6, whiteSpace: m.role === 'assistant' ? 'normal' : 'pre-wrap', ...bubble(m.role) }}>{m.role === 'assistant' ? renderRich(m.content) : m.content}</div>
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
                  <Link key={a.url} href={canonHref(a.url)} onClick={() => setOpen(false)} className="btn btn-primary" style={{ padding: '7px 12px', fontSize: 12.5, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {a.label} <OnyxIcon name="send" size={13} glow={false} />
                  </Link>
                ))}
              </div>
            )}
            {refs.length > 0 && (
              <div style={{ alignSelf: 'flex-start', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {refs.map((a) => <Link key={a.slug} href={canonHref(`/guia/${a.slug}`)} onClick={() => setOpen(false)} className="pill" style={{ color: 'var(--brand)', background: 'rgba(124,140,255,.12)' }}>{t.seeArt}: {a.title}</Link>)}
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
                {/* Botón adjuntar captura: solo para usuarios logueados. */}
                {loggedIn && (
                  <button className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: 12, marginBottom: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={pickFile} type="button">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M12 7l-4.5 4.5a2.5 2.5 0 0 1-3.5-3.5L8.5 3.5a1.6 1.6 0 0 1 2.3 2.3L6.3 10.3a.8.8 0 0 1-1.1-1.1L9 5.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    {attach ? (es ? 'Cambiar captura' : 'Change screenshot') : (es ? 'Adjuntar captura' : 'Attach screenshot')}
                  </button>
                )}

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
            <div style={{ padding: kbOpen ? '10px' : '10px 10px calc(10px + env(safe-area-inset-bottom))', borderTop: '1px solid var(--line)', background: 'var(--card)' }}>
              {/* Nueva conversación: botón fijo arriba del campo (reemplaza al menú). Siempre visible. */}
              {(
                <button onClick={() => clearChat()} style={{ width: '100%', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '9px', borderRadius: 10, border: '1px solid rgba(255,157,61,.5)', background: 'rgba(255,122,26,.08)', color: '#ffb15e', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M3 6h10M6.5 6V4.5h3V6M5 6l.6 7h4.8L11 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  {es ? 'Nueva conversación' : 'New conversation'}
                </button>
              )}
              {loggedIn && cfg.showTicket && (
                <div className="row" style={{ gap: 6, marginBottom: 8 }}>
                  <Link href="/dashboard/soporte" onClick={() => setOpen(false)} className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }}>{t.openTicket}</Link>
                  <Link href="/dashboard/soporte" onClick={() => setOpen(false)} className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }}>{t.center}</Link>
                </div>
              )}
              <div className="row" style={{ gap: 6 }}>
                {/* Adjuntar captura: solo para usuarios logueados (en visitante/lead no aplica). */}
                {loggedIn && <>
                  <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: 'none' }} />
                  <button className="btn btn-ghost" style={{ padding: '9px 11px', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }} onClick={() => { openEmail(); pickFile(); }} disabled={busy} aria-label={es ? 'Adjuntar captura' : 'Attach screenshot'} title={es ? 'Adjuntar captura' : 'Attach screenshot'} type="button">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 7l-4.5 4.5a2.5 2.5 0 0 1-3.5-3.5L8.5 3.5a1.6 1.6 0 0 1 2.3 2.3L6.3 10.3a.8.8 0 0 1-1.1-1.1L9 5.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </button>
                </>}
                <input value={ask} onChange={(e) => setAsk(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') sendAI(); }} placeholder={x.ph} style={{ flex: 1, margin: 0, fontSize: 13 }} />
                <button className="btn btn-primary" style={{ padding: '9px 13px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(100deg,#ffcf5c,#ff9d3d 55%,#ff6a2b)', color: '#241002', border: 'none' }} onClick={() => sendAI()} disabled={busy || !ask.trim()} aria-label={t.send}><OnyxIcon name="send" size={16} glow={false} /></button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
