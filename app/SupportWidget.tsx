'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/lib/lang';

const T: any = {
  es: {
    help: '¿Necesitas ayuda?', title: 'Onyx AI', online: 'En línea · responde al instante', offline: 'Te respondemos por correo',
    humanTitle: 'Equipo Onyx', humanOnline: 'En línea · una persona te atiende', aiName: 'Onyx AI',
    hi: '¡Hola! ¿Sobre qué te ayudo?', topicsT: 'Temas frecuentes',
    ph: 'Escribe tu pregunta…', seeArt: 'Ver', center: 'Centro de soporte', openTicket: 'Abrir un ticket',
    emailT: 'Déjanos tu correo y te respondemos aunque cierres:', emailPh: 'tucorreo@email.com', send: 'Enviar',
    sentT: '¡Recibido!', sentD: 'Te responderemos a tu correo muy pronto.', createAcc: 'Crear cuenta gratis',
    errMail: 'Escribe un correo válido.',
    topicsA: [['¿Cuáles son los precios y planes?', '💳 Precios'], ['¿Cómo me hago embajador?', '🎁 Embajador'], ['¿Cómo conecto mi cuenta de MetaTrader?', '🔌 Conectar'], ['¿Qué hace Onyx Guardian?', '🛡️ Guardian'], ['¿Sirve para cuentas de fondeo?', '🏆 Fondeo']],
    topicsU: [['¿Cómo conecto mi cuenta de MetaTrader?', '🔌 Conectar'], ['¿Qué hace Onyx Guardian?', '🛡️ Guardian'], ['¿Sirve para cuentas de fondeo?', '🏆 Fondeo'], ['¿Cómo cambio de plan?', '💳 Mi plan']],
    human: '🙋 Hablar con una persona',
  },
  en: {
    help: 'Need help?', title: 'Onyx AI', online: 'Online · instant answers', offline: 'We reply by email',
    humanTitle: 'Onyx team', humanOnline: 'Online · a person is here', aiName: 'Onyx AI',
    hi: 'Hi! How can I help?', topicsT: 'Popular topics',
    ph: 'Type your question…', seeArt: 'Open', center: 'Support center', openTicket: 'Open a ticket',
    emailT: 'Leave your email and we will reply even if you close this:', emailPh: 'you@email.com', send: 'Send',
    sentT: 'Got it!', sentD: 'We will reply to your email very soon.', createAcc: 'Create free account',
    errMail: 'Enter a valid email.',
    topicsA: [['What are the prices and plans?', '💳 Pricing'], ['How do I become an ambassador?', '🎁 Ambassador'], ['How do I connect my MetaTrader account?', '🔌 Connect'], ['What does Onyx Guardian do?', '🛡️ Guardian'], ['Does it work for funded accounts?', '🏆 Funded']],
    topicsU: [['How do I connect my MetaTrader account?', '🔌 Connect'], ['What does Onyx Guardian do?', '🛡️ Guardian'], ['Does it work for funded accounts?', '🏆 Funded'], ['How do I change my plan?', '💳 My plan']],
    human: '🙋 Talk to a person',
  },
};

export default function SupportWidget({ loggedIn = false }: { loggedIn?: boolean }) {
  const { lang } = useLang();
  const t = T[lang];
  const [open, setOpen] = useState(false);
  const [human, setHuman] = useState(false); // ¿hay una persona del equipo disponible? (la IA siempre está)
  const [chat, setChat] = useState<any[]>([]);
  const [ask, setAsk] = useState('');
  const [busy, setBusy] = useState(false);
  const [refs, setRefs] = useState<any[]>([]);
  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');
  const end = useRef<HTMLDivElement>(null);
  const started = chat.length > 0;

  useEffect(() => { fetch('/api/support/availability').then((r) => r.json()).then((j) => setHuman(!!j.online)).catch(() => {}); }, [open]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [chat, busy, showEmail, sent]);

  async function sendAI(q?: string) {
    const question = (q ?? ask).trim(); if (!question || busy) return;
    const next = [...chat, { role: 'user', content: question }];
    setChat(next); setAsk(''); setBusy(true); setRefs([]);
    try {
      const r = await fetch('/api/support/ai', { method: 'POST', body: JSON.stringify({ question, history: chat, lang }) });
      const j = await r.json();
      setChat([...next, { role: 'assistant', content: j.answer || '…' }]);
      setRefs(j.articles || []);
      if (!loggedIn && j.escalate) setShowEmail(true);
    } catch { setChat([...next, { role: 'assistant', content: '…' }]); }
    setBusy(false);
  }

  async function sendLead() {
    const e = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) { setErr(t.errMail); return; }
    setErr(''); setBusy(true);
    const lastQ = [...chat].reverse().find((m) => m.role === 'user')?.content || '';
    await fetch('/api/support/lead', { method: 'POST', body: JSON.stringify({ email: e, message: lastQ, lang }) });
    setBusy(false); setSent(true); setShowEmail(false);
  }

  const bubble = (role: string) => role === 'user'
    ? { alignSelf: 'flex-end', background: 'var(--grad)', color: '#fff', borderRadius: '12px 12px 2px 12px' }
    : { alignSelf: 'flex-start', background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: '12px 12px 12px 2px' };
  const topics = loggedIn ? t.topicsU : t.topicsA;

  return (
    <>
      <style>{`
        @keyframes onyxPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.7)}}
        @keyframes onyxType{0%,80%,100%{opacity:.3}40%{opacity:1}}
        .onyx-pulse{animation:onyxPulse 1.4s ease-in-out infinite}
        .onyx-d1{animation:onyxType 1.2s infinite}.onyx-d2{animation:onyxType 1.2s .2s infinite}.onyx-d3{animation:onyxType 1.2s .4s infinite}
        @media(max-width:520px){.onyx-panel{right:0!important;left:0!important;bottom:0!important;width:100%!important;max-width:100%!important;height:100%!important;max-height:100%!important;border-radius:0!important}}
      `}</style>

      {!open && (
        <button onClick={() => setOpen(true)} aria-label={t.help}
          style={{ position: 'fixed', right: 18, bottom: 18, zIndex: 60, display: 'flex', alignItems: 'center', gap: 8, border: 'none', background: 'none', cursor: 'pointer' }}>
          <span style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 20, padding: '7px 13px', fontSize: 13, color: 'var(--tx)', boxShadow: '0 6px 18px rgba(0,0,0,.3)' }}>{t.help}</span>
          <span style={{ position: 'relative', width: 54, height: 54, borderRadius: '50%', background: 'var(--grad)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, boxShadow: '0 8px 22px rgba(0,0,0,.35)' }}>💬
            <span className="onyx-pulse" style={{ position: 'absolute', top: 2, right: 2, width: 13, height: 13, borderRadius: '50%', background: '#34e2a0', border: '2px solid var(--bg)' }} />
          </span>
        </button>
      )}

      {open && (
        <div className="onyx-panel" style={{ position: 'fixed', right: 18, bottom: 18, zIndex: 61, width: 344, maxWidth: 'calc(100vw - 24px)', background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16, boxShadow: '0 14px 40px rgba(0,0,0,.45)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 40px)' }}>
          <div style={{ background: 'var(--grad)', color: '#fff', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', fontSize: 16 }}>{human ? '🙋' : '🤖'}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{human ? t.humanTitle : t.title}</div>
              <div style={{ fontSize: 11, opacity: .9, display: 'flex', alignItems: 'center', gap: 5 }}>
                <span className="onyx-pulse" style={{ width: 8, height: 8, borderRadius: '50%', background: '#34e2a0' }} />
                {human ? t.humanOnline : t.online}
              </div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="close" style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 12, background: 'var(--bg2)', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 200 }}>
            <div style={{ maxWidth: '86%', padding: '8px 11px', fontSize: 13, lineHeight: 1.5, ...bubble('assistant') }}>{t.hi}</div>
            {!started && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--mut)', margin: '2px 0 6px' }}>{t.topicsT}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {topics.map(([q, label]: any) => (
                    <button key={label} className="btn btn-ghost" style={{ padding: '8px 10px', fontSize: 12, textAlign: 'left' }} onClick={() => sendAI(q)}>{label}</button>
                  ))}
                  {!loggedIn && <button className="btn btn-ghost" style={{ padding: '8px 10px', fontSize: 12, textAlign: 'left', gridColumn: '1 / -1' }} onClick={() => setShowEmail(true)}>{t.human}</button>}
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
                {refs.map((a) => <Link key={a.slug} href={`/guia/${a.slug}`} className="pill" style={{ color: 'var(--brand)', background: 'rgba(124,140,255,.12)' }}>{t.seeArt}: {a.title}</Link>)}
              </div>
            )}
            {showEmail && !sent && (
              <div style={{ background: 'rgba(124,140,255,.10)', border: '1px solid var(--brand)', borderRadius: 10, padding: 10, marginTop: 4 }}>
                <div style={{ fontSize: 12, color: 'var(--tx)', marginBottom: 6 }}>📧 {t.emailT}</div>
                <div className="row" style={{ gap: 6 }}>
                  <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.emailPh} style={{ flex: 1, margin: 0, fontSize: 13 }} />
                  <button className="btn btn-primary" style={{ padding: '8px 12px', fontSize: 13 }} onClick={sendLead} disabled={busy}>{t.send}</button>
                </div>
                {err && <div style={{ color: 'var(--amber)', fontSize: 12, marginTop: 6 }}>{err}</div>}
              </div>
            )}
            {sent && (
              <div style={{ background: 'rgba(52,226,160,.10)', border: '1px solid var(--green)', borderRadius: 10, padding: 12, marginTop: 4, textAlign: 'center' }}>
                <div style={{ fontWeight: 700, color: 'var(--green)' }}>✓ {t.sentT}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>{t.sentD}</div>
                {!loggedIn && <Link href="/login?mode=signup" className="btn btn-ghost" style={{ marginTop: 10, fontSize: 13 }}>{t.createAcc}</Link>}
              </div>
            )}
            <div ref={end} />
          </div>

          {!sent && (
            <div style={{ padding: 10, borderTop: '1px solid var(--line)', background: 'var(--card)' }}>
              {loggedIn && (
                <div className="row" style={{ gap: 6, marginBottom: 8 }}>
                  <Link href="/dashboard/soporte" className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }}>{t.openTicket}</Link>
                  <Link href="/dashboard/soporte" className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }}>{t.center}</Link>
                </div>
              )}
              <div className="row" style={{ gap: 6 }}>
                <input value={ask} onChange={(e) => setAsk(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') sendAI(); }} placeholder={t.ph} style={{ flex: 1, margin: 0, fontSize: 13 }} />
                <button className="btn btn-primary" style={{ padding: '9px 13px' }} onClick={() => sendAI()} disabled={busy || !ask.trim()}>➤</button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
