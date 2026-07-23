'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/lib/lang';

const T: any = {
  es: {
    help: '¿Necesitas ayuda?', title: 'Onyx AI', subA: 'Pregunta lo que quieras · sin cuenta', subU: 'Soporte · responde al instante',
    hiA: '¡Hola! ¿En qué te ayudo? Puedo contarte del Guardian, los planes, el fondeo o cómo conectar.',
    hiU: '¡Hola! ¿En qué te ayudo? La conexión, el Guardian, tu plan…',
    ph: 'Escribe tu pregunta…', seeArt: 'Ver', plans: 'Ver planes', connect: 'Cómo conectar', human: 'Hablar con una persona',
    center: 'Centro de soporte', openTicket: 'Abrir un ticket',
    emailT: 'Déjanos tu correo y te respondemos aunque cierres:', emailPh: 'tucorreo@email.com', send: 'Enviar',
    sentT: '¡Recibido!', sentD: 'Te responderemos a tu correo muy pronto.', createAcc: 'Crear cuenta gratis',
    connectQ: '¿Cómo conecto mi cuenta de MetaTrader?', errMail: 'Escribe un correo válido.',
  },
  en: {
    help: 'Need help?', title: 'Onyx AI', subA: 'Ask anything · no account', subU: 'Support · instant answers',
    hiA: 'Hi! How can I help? I can tell you about Guardian, plans, funding or how to connect.',
    hiU: 'Hi! How can I help? Connection, Guardian, your plan…',
    ph: 'Type your question…', seeArt: 'Open', plans: 'See plans', connect: 'How to connect', human: 'Talk to a person',
    center: 'Support center', openTicket: 'Open a ticket',
    emailT: 'Leave your email and we will reply even if you close this:', emailPh: 'you@email.com', send: 'Send',
    sentT: 'Got it!', sentD: 'We will reply to your email very soon.', createAcc: 'Create free account',
    connectQ: 'How do I connect my MetaTrader account?', errMail: 'Enter a valid email.',
  },
};

export default function SupportWidget({ loggedIn = false }: { loggedIn?: boolean }) {
  const { lang } = useLang();
  const t = T[lang];
  const [open, setOpen] = useState(false);
  const [chat, setChat] = useState<any[]>([]);
  const [ask, setAsk] = useState('');
  const [busy, setBusy] = useState(false);
  const [refs, setRefs] = useState<any[]>([]);
  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { if (open && !chat.length) setChat([{ role: 'assistant', content: loggedIn ? t.hiU : t.hiA }]); }, [open]);
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

  return (
    <>
      {/* Burbuja */}
      {!open && (
        <button onClick={() => setOpen(true)} aria-label={t.help}
          style={{ position: 'fixed', right: 18, bottom: 18, zIndex: 60, display: 'flex', alignItems: 'center', gap: 8, border: 'none', background: 'none', cursor: 'pointer' }}>
          <span className="onyx-hint" style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 20, padding: '7px 13px', fontSize: 13, color: 'var(--tx)', boxShadow: '0 6px 18px rgba(0,0,0,.3)' }}>{t.help}</span>
          <span style={{ width: 54, height: 54, borderRadius: '50%', background: 'var(--grad)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, boxShadow: '0 8px 22px rgba(0,0,0,.35)' }}>💬</span>
        </button>
      )}

      {/* Panel */}
      {open && (
        <div style={{ position: 'fixed', right: 18, bottom: 18, zIndex: 61, width: 344, maxWidth: 'calc(100vw - 24px)', background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16, boxShadow: '0 14px 40px rgba(0,0,0,.45)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 40px)' }}>
          <div style={{ background: 'var(--grad)', color: '#fff', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', fontSize: 16 }}>🤖</span>
            <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 14 }}>{t.title}</div><div style={{ fontSize: 11, opacity: .85 }}>{loggedIn ? t.subU : t.subA}</div></div>
            <button onClick={() => setOpen(false)} aria-label="close" style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 12, background: 'var(--bg2)', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 180 }}>
            {chat.map((m, i) => (
              <div key={i} style={{ maxWidth: '86%', padding: '8px 11px', fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap', ...bubble(m.role) }}>{m.content}</div>
            ))}
            {busy && <div style={{ alignSelf: 'flex-start', fontSize: 13, color: 'var(--mut)' }}>…</div>}
            {refs.length > 0 && (
              <div style={{ alignSelf: 'flex-start', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {refs.map((a) => <Link key={a.slug} href={`/guia/${a.slug}`} className="pill" style={{ color: 'var(--brand)', background: 'rgba(124,140,255,.12)' }}>{t.seeArt}: {a.title}</Link>)}
              </div>
            )}

            {/* Captura de correo (visitante) */}
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

          {/* Chips + input */}
          {!sent && (
            <div style={{ padding: 10, borderTop: '1px solid var(--line)', background: 'var(--card)' }}>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                {loggedIn ? (
                  <>
                    <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => sendAI(t.connectQ)}>{t.connect}</button>
                    <Link href="/dashboard/soporte" className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }}>{t.openTicket}</Link>
                  </>
                ) : (
                  <>
                    <Link href="/pricing" className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }}>{t.plans}</Link>
                    <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => sendAI(t.connectQ)}>{t.connect}</button>
                    <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setShowEmail(true)}>{t.human}</button>
                  </>
                )}
              </div>
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
