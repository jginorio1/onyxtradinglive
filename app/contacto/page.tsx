'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/lib/lang';

type Lang = 'es' | 'en';

const T: any = {
  es: {
    h1: 'Contáctanos', sub: 'Escríbenos y te respondemos rápido. Onyx AI resuelve la mayoría de las dudas al instante; si hace falta, te contesta una persona por correo.',
    aiT: 'Respuesta instantánea', aiD: 'Usa el chat de Onyx AI (abajo a la derecha) para una respuesta inmediata sobre conexión, Guardian, planes o fondeo.',
    formT: 'O déjanos un mensaje', name: 'Tu nombre (opcional)', email: 'Tu correo', emailPh: 'tucorreo@email.com',
    msg: '¿En qué te ayudamos?', msgPh: 'Cuéntanos tu duda o problema…', send: 'Enviar', sending: 'Enviando…',
    errMail: 'Escribe un correo válido.', errMsg: 'Escribe tu mensaje.',
    okT: '¡Recibido!', okAi: 'Onyx AI ya te respondió a tu correo. Si no resuelve tu duda, una persona te contactará.',
    okHuman: 'Tu mensaje llegó a nuestro equipo. Te responderemos a tu correo muy pronto.',
    faqT: '¿Prefieres resolverlo tú?', faqD: 'Mira la Guía — está todo explicado paso a paso.', faqBtn: 'Ver la Guía →',
    createAcc: 'Crear cuenta gratis',
  },
  en: {
    h1: 'Contact us', sub: 'Write to us and we reply fast. Onyx AI solves most questions instantly; if needed, a person answers you by email.',
    aiT: 'Instant answer', aiD: 'Use the Onyx AI chat (bottom right) for an immediate answer about connection, Guardian, plans or funding.',
    formT: 'Or leave us a message', name: 'Your name (optional)', email: 'Your email', emailPh: 'you@email.com',
    msg: 'How can we help?', msgPh: 'Tell us your question or problem…', send: 'Send', sending: 'Sending…',
    errMail: 'Enter a valid email.', errMsg: 'Type your message.',
    okT: 'Got it!', okAi: 'Onyx AI already replied to your email. If it does not solve it, a person will reach out.',
    okHuman: 'Your message reached our team. We will reply to your email very soon.',
    faqT: 'Prefer to solve it yourself?', faqD: 'Check the Guide — everything is explained step by step.', faqBtn: 'Open the Guide →',
    createAcc: 'Create free account',
  },
};

export default function Contacto() {
  const { lang } = useLang() as { lang: Lang };
  const t = T[lang] || T.en;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState<null | { answered: boolean }>(null);

  async function send() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) { setErr(t.errMail); return; }
    if (!msg.trim()) { setErr(t.errMsg); return; }
    setErr(''); setBusy(true);
    try {
      const body = name.trim() ? `${name.trim()}: ${msg.trim()}` : msg.trim();
      const r = await fetch('/api/support/lead', { method: 'POST', body: JSON.stringify({ email: email.trim(), message: body, lang }) });
      const j = await r.json().catch(() => ({}));
      setDone({ answered: !!j.answered });
    } catch { setDone({ answered: false }); }
    setBusy(false);
  }

  const lbl = { fontSize: 12, color: 'var(--mut)', marginTop: 12, display: 'block' } as any;

  return (
    <div className="wrap" style={{ padding: '52px 22px 80px', maxWidth: 620 }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <h1 style={{ fontSize: 34, letterSpacing: '-1px' }}>{t.h1}</h1>
        <p className="muted" style={{ margin: '12px auto 0', maxWidth: 560, fontSize: 16 }}>{t.sub}</p>
      </div>

      <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 24 }}>🤖</span>
        <div>
          <div style={{ fontWeight: 700 }}>{t.aiT}</div>
          <p className="muted" style={{ fontSize: 14, marginTop: 4 }}>{t.aiD}</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        {!done && (
          <>
            <h3 style={{ marginBottom: 4 }}>{t.formT}</h3>
            <span style={lbl}>{t.name}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} style={{ margin: '4px 0 0' }} />
            <span style={lbl}>{t.email}</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.emailPh} style={{ margin: '4px 0 0' }} />
            <span style={lbl}>{t.msg}</span>
            <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={5} placeholder={t.msgPh}
              style={{ width: '100%', marginTop: 4, padding: '10px 12px', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--tx)', fontSize: 14, fontFamily: 'inherit' }} />
            {err && <div style={{ color: 'var(--amber)', fontSize: 13, marginTop: 10 }}>{err}</div>}
            <button className="btn btn-primary" style={{ width: '100%', marginTop: 16 }} onClick={send} disabled={busy}>{busy ? t.sending : t.send}</button>
          </>
        )}
        {done && (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div style={{ fontSize: 34, marginBottom: 8 }}>{done.answered ? '🤖' : '✅'}</div>
            <h3 style={{ marginBottom: 8 }}>{t.okT}</h3>
            <p className="muted" style={{ fontSize: 14, marginBottom: 14 }}>{done.answered ? t.okAi : t.okHuman}</p>
            <Link className="btn btn-ghost" href="/login?mode=signup" style={{ fontSize: 13 }}>{t.createAcc}</Link>
          </div>
        )}
      </div>

      <div className="card" style={{ textAlign: 'center' }}>
        <div style={{ fontWeight: 700 }}>{t.faqT}</div>
        <p className="muted" style={{ fontSize: 14, margin: '6px 0 12px' }}>{t.faqD}</p>
        <Link className="btn btn-ghost" href="/guia" style={{ fontSize: 13 }}>{t.faqBtn}</Link>
      </div>
    </div>
  );
}
