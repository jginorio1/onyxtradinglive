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
  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [leadMsg, setLeadMsg] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');
  const [device, setDevice] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');
  const [tease, setTease] = useState(false);
  const [roleInfo, setRoleInfo] = useState<any>(null);   // { name, roles } del usuario logueado
  const end = useRef<HTMLDivElement>(null);
  const started = chat.length > 0;

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
    setChat(next); setAsk(''); setBusy(true); setRefs([]);
    try {
      const r = await fetch('/api/support/ai', { method: 'POST', body: JSON.stringify({ question, history: chat, lang }) });
      const j = await r.json();
      setChat([...next, { role: 'assistant', content: j.answer || '…' }]);
      setRefs(j.articles || []);
      if (!loggedIn && j.escalate) openEmail();
    } catch { setChat([...next, { role: 'assistant', content: '…' }]); }
    setBusy(false);
  }

  async function sendLead() {
    const e = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) { setErr(t.errMail); return; }
    const msg = leadMsg.trim();
    if (!msg) { setErr(t.errMsg); return; }
    setErr(''); setBusy(true);
    const history = chat.filter((m) => m.role === 'user' || m.role === 'assistant').map((m) => ({ role: m.role, content: m.content }));
    await fetch('/api/support/lead', { method: 'POST', body: JSON.stringify({ email: e, message: msg, history, lang }) });
    setBusy(false); setSent(true); setShowEmail(false);
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
  // Saludo personalizado por nombre si hay sesión.
  const greet = roleInfo?.name ? `${es ? '¡Hola' : 'Hi'} ${roleInfo.name}! ${x.hi}` : x.hi;

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
  const ox = Math.max(0, cfg.offsetX ?? 18), oy = Math.max(0, cfg.offsetY ?? 18);
  const lsz = Math.min(80, Math.max(40, cfg.launcherSize ?? 54));

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
        @media(max-width:520px){.onyx-panel{right:0!important;left:0!important;top:0!important;bottom:0!important;width:100%!important;max-width:100%!important;height:100dvh!important;max-height:100dvh!important;border-radius:0!important}
        .onyx-panel input,.onyx-panel textarea{font-size:16px!important}}
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
        <div className="onyx-panel" style={{ position: 'fixed', [side]: ox, bottom: oy, zIndex: 61, width: 344, maxWidth: 'calc(100vw - 24px)', background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16, boxShadow: '0 14px 40px rgba(0,0,0,.45)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 40px)' }}>
          <div style={{ background: 'var(--grad)', color: cfg.fg || '#fff', padding: 'calc(12px + env(safe-area-inset-top)) 14px 12px', display: 'flex', alignItems: 'center', gap: 10, flex: 'none' }}>
            {avatar(30)}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{human ? x.humanTitle : x.title}</div>
              <div style={{ fontSize: 11, opacity: .9, display: 'flex', alignItems: 'center', gap: 5 }}>
                {cfg.showPulse && <span className="onyx-pulse" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)' }} />}
                {x.online}
              </div>
            </div>
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
            {refs.length > 0 && (
              <div style={{ alignSelf: 'flex-start', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {refs.map((a) => <Link key={a.slug} href={`/guia/${a.slug}`} onClick={() => setOpen(false)} className="pill" style={{ color: 'var(--brand)', background: 'rgba(124,140,255,.12)' }}>{t.seeArt}: {a.title}</Link>)}
              </div>
            )}
            {showEmail && !sent && (
              <div style={{ background: 'rgba(124,140,255,.10)', border: '1px solid var(--brand)', borderRadius: 10, padding: 10, marginTop: 4 }}>
                <div style={{ fontSize: 12, color: 'var(--tx)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}><OnyxIcon emoji="💬" size={14} glow={false} /> {t.msgT}</div>
                <textarea value={leadMsg} onChange={(e) => setLeadMsg(e.target.value)} placeholder={t.msgPh} rows={3} style={{ width: '100%', margin: '0 0 8px', fontSize: 13, resize: 'vertical' }} />
                <div style={{ fontSize: 12, color: 'var(--tx)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}><OnyxIcon emoji="📧" size={14} glow={false} /> {t.emailT}</div>
                <div className="row" style={{ gap: 6 }}>
                  <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.emailPh} style={{ flex: 1, margin: 0, fontSize: 13 }} />
                  <button className="btn btn-primary" style={{ padding: '8px 12px', fontSize: 13 }} onClick={sendLead} disabled={busy}>{t.send}</button>
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
