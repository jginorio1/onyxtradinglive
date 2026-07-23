'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/lib/lang';

type Lang = 'es' | 'en';

const T: any = {
  es: {
    title: 'Centro de soporte', sub: 'Pregúntale a Onyx AI o abre un ticket. Te ayudamos con la conexión, el Guardian, tu plan y más.',
    aiT: 'Onyx AI', aiD: 'Responde con la Guía. Si no resuelve, abre un ticket.', online: 'En línea',
    aiPh: 'Escribe tu pregunta…', send: 'Enviar', aiHi: '¡Hola! ¿En qué te ayudo? Puedo explicarte la conexión, el Guardian, los planes o el fondeo.',
    seeArt: 'Ver artículo', openTicket: 'Abrir un ticket con esto',
    ticketsT: 'Mis tickets', newT: 'Nuevo ticket', none: 'Todavía no tienes tickets.',
    subject: 'Asunto', category: 'Categoría', message: 'Cuéntanos qué pasa', create: 'Crear ticket', cancel: 'Cancelar',
    reply: 'Responder', replyPh: 'Escribe tu respuesta…', markDone: 'Marcar resuelto', send2: 'Enviar',
    quickT: 'Ayuda rápida', me: 'Tú', ai: 'Onyx AI', team: 'Soporte',
    st: { open: 'Abierto', in_progress: 'En curso', resolved: 'Resuelto' },
    cats: [['general', 'General'], ['conexion', 'Conexión'], ['instalacion', 'Instalación'], ['guardian', 'Onyx Guardian'], ['facturacion', 'Facturación']],
    quick: [
      ['instalar-ea', '🔌 Instalar y conectar el EA'],
      ['que-hace-onyx', '🛡️ Qué hace Onyx Guardian'],
      ['conectar-cuenta', '🔑 Conectar tu cuenta'],
      ['profit-factor', '📊 Entender tus números'],
    ],
    seeGuide: 'Ver toda la guía →', missing: 'Escribe un asunto y un mensaje.',
  },
  en: {
    title: 'Support center', sub: 'Ask Onyx AI or open a ticket. We help with connection, Guardian, your plan and more.',
    aiT: 'Onyx AI', aiD: 'Answers from the Guide. If it does not solve it, open a ticket.', online: 'Online',
    aiPh: 'Type your question…', send: 'Send', aiHi: 'Hi! How can I help? I can explain the connection, Guardian, plans or funding.',
    seeArt: 'Open article', openTicket: 'Open a ticket about this',
    ticketsT: 'My tickets', newT: 'New ticket', none: 'You have no tickets yet.',
    subject: 'Subject', category: 'Category', message: 'Tell us what happens', create: 'Create ticket', cancel: 'Cancel',
    reply: 'Reply', replyPh: 'Write your reply…', markDone: 'Mark resolved', send2: 'Send',
    quickT: 'Quick help', me: 'You', ai: 'Onyx AI', team: 'Support',
    st: { open: 'Open', in_progress: 'In progress', resolved: 'Resolved' },
    cats: [['general', 'General'], ['conexion', 'Connection'], ['instalacion', 'Install'], ['guardian', 'Onyx Guardian'], ['facturacion', 'Billing']],
    quick: [
      ['instalar-ea', '🔌 Install and connect the EA'],
      ['que-hace-onyx', '🛡️ What Onyx Guardian does'],
      ['conectar-cuenta', '🔑 Connect your account'],
      ['profit-factor', '📊 Understand your numbers'],
    ],
    seeGuide: 'See the whole guide →', missing: 'Write a subject and a message.',
  },
};

const stColor: any = { open: 'var(--brand)', in_progress: 'var(--amber)', resolved: 'var(--green)' };
const stBg: any = { open: 'rgba(124,140,255,.15)', in_progress: 'rgba(255,192,77,.15)', resolved: 'rgba(52,226,160,.15)' };

export default function SupportClient() {
  const { lang } = useLang();
  const t = T[lang];

  // --- Onyx AI ---
  const [chat, setChat] = useState<any[]>([{ role: 'assistant', content: t.aiHi }]);
  const [ask, setAsk] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiRefs, setAiRefs] = useState<any[]>([]);
  const chatEnd = useRef<HTMLDivElement>(null);
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [chat, aiBusy]);

  // --- Tickets ---
  const [tickets, setTickets] = useState<any[]>([]);
  const [msgs, setMsgs] = useState<any[]>([]);
  const [openId, setOpenId] = useState('');
  const [replyTxt, setReplyTxt] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [nf, setNf] = useState({ subject: '', category: 'general', body: '' });
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  async function loadTickets() {
    try { const r = await fetch('/api/support/tickets'); const j = await r.json(); setTickets(j.tickets || []); setMsgs(j.messages || []); } catch {}
  }
  useEffect(() => { loadTickets(); }, []);

  async function sendAI() {
    const q = ask.trim(); if (!q || aiBusy) return;
    const next = [...chat, { role: 'user', content: q }];
    setChat(next); setAsk(''); setAiBusy(true); setAiRefs([]);
    try {
      const r = await fetch('/api/support/ai', { method: 'POST', body: JSON.stringify({ question: q, history: chat, lang }) });
      const j = await r.json();
      setChat([...next, { role: 'assistant', content: j.answer || '…', escalate: j.escalate }]);
      setAiRefs(j.articles || []);
    } catch { setChat([...next, { role: 'assistant', content: '…' }]); }
    setAiBusy(false);
  }

  async function createTicket(prefill?: string) {
    const subject = (showNew ? nf.subject : (prefill || '')).trim();
    const body = (showNew ? nf.body : (prefill || '')).trim();
    if (!subject || !body) { setErr(t.missing); return; }
    setErr(''); setBusy('new');
    await fetch('/api/support/tickets', { method: 'POST', body: JSON.stringify({ subject, category: showNew ? nf.category : 'general', body }) });
    setNf({ subject: '', category: 'general', body: '' }); setShowNew(false); setBusy(''); await loadTickets();
  }

  async function reply(id: string) {
    const body = replyTxt.trim(); if (!body) return;
    setBusy('r' + id);
    await fetch('/api/support/tickets', { method: 'PATCH', body: JSON.stringify({ ticket_id: id, body }) });
    setReplyTxt(''); setBusy(''); await loadTickets();
  }
  async function closeTicket(id: string) {
    setBusy('c' + id);
    await fetch('/api/support/tickets', { method: 'PATCH', body: JSON.stringify({ ticket_id: id, close: true }) });
    setBusy(''); await loadTickets();
  }

  // Convierte el último intercambio en un ticket rápido desde la IA
  function escalateToTicket() {
    const lastUser = [...chat].reverse().find((m) => m.role === 'user');
    setShowNew(true); setNf({ subject: lastUser?.content?.slice(0, 120) || '', category: 'general', body: lastUser?.content || '' });
    document.getElementById('onyx-tickets')?.scrollIntoView({ behavior: 'smooth' });
  }

  const bubble = (role: string) => role === 'user'
    ? { alignSelf: 'flex-end', background: 'var(--grad)', color: '#fff', borderRadius: '12px 12px 2px 12px' }
    : { alignSelf: 'flex-start', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: '12px 12px 12px 2px' };

  return (
    <div className="wrap" style={{ padding: '26px 22px 60px', maxWidth: 820 }}>
      <h1 style={{ fontSize: 26 }}>{t.title}</h1>
      <p className="muted" style={{ margin: '8px 0 20px' }}>{t.sub}</p>

      {/* Onyx AI */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ gap: 10, alignItems: 'center', marginBottom: 12 }}>
          <span style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(124,140,255,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', fontSize: 18 }}>🤖</span>
          <div style={{ flex: 1 }}><div style={{ fontWeight: 700 }}>{t.aiT}</div><div className="muted" style={{ fontSize: 12 }}>{t.aiD}</div></div>
          <span className="pill" style={{ color: 'var(--green)', background: 'rgba(52,226,160,.15)' }}>{t.online}</span>
        </div>
        <div style={{ border: '1px solid var(--line)', borderRadius: 12, background: 'var(--bg2)', padding: 12, maxHeight: 340, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {chat.map((m, i) => (
            <div key={i} style={{ maxWidth: '85%', padding: '8px 11px', fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap', ...bubble(m.role) }}>{m.content}</div>
          ))}
          {aiBusy && <div style={{ alignSelf: 'flex-start', fontSize: 13, color: 'var(--mut)' }}>…</div>}
          {aiRefs.length > 0 && (
            <div style={{ alignSelf: 'flex-start', display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
              {aiRefs.map((a) => <Link key={a.slug} href={`/guia/${a.slug}`} className="pill" style={{ color: 'var(--brand)', background: 'rgba(124,140,255,.12)' }}>{t.seeArt}: {a.title}</Link>)}
            </div>
          )}
          <div ref={chatEnd} />
        </div>
        <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <input value={ask} onChange={(e) => setAsk(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') sendAI(); }} placeholder={t.aiPh} style={{ flex: 1, minWidth: 180, margin: 0 }} />
          <button className="btn btn-primary" onClick={sendAI} disabled={aiBusy || !ask.trim()}>{t.send}</button>
        </div>
        <button className="btn btn-ghost" style={{ marginTop: 10, fontSize: 13 }} onClick={escalateToTicket}>💬 {t.openTicket}</button>
      </div>

      {/* Ayuda rápida */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 12 }}>📚 {t.quickT}</h3>
        <div className="grid g2" style={{ gap: 8 }}>
          {t.quick.map(([slug, label]: any) => (
            <Link key={slug} href={`/guia/${slug}`} className="card" style={{ padding: '11px 13px', fontSize: 14 }}>{label}</Link>
          ))}
        </div>
        <Link href="/guia" style={{ color: 'var(--brand)', fontSize: 13, display: 'inline-block', marginTop: 12 }}>{t.seeGuide}</Link>
      </div>

      {/* Tickets */}
      <div className="card" id="onyx-tickets">
        <div className="row between" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <h3>🎫 {t.ticketsT}</h3>
          <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => setShowNew(!showNew)}>+ {t.newT}</button>
        </div>

        {showNew && (
          <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <span className="muted" style={{ fontSize: 12 }}>{t.subject}</span>
            <input value={nf.subject} onChange={(e) => setNf({ ...nf, subject: e.target.value })} placeholder={lang === 'en' ? 'Ej: MT5 does not sync' : 'Ej: No sincroniza mi MT5'} style={{ margin: '4px 0 10px' }} />
            <span className="muted" style={{ fontSize: 12 }}>{t.category}</span>
            <select value={nf.category} onChange={(e) => setNf({ ...nf, category: e.target.value })} style={{ margin: '4px 0 10px' }}>
              {t.cats.map(([v, l]: any) => <option key={v} value={v}>{l}</option>)}
            </select>
            <span className="muted" style={{ fontSize: 12 }}>{t.message}</span>
            <textarea value={nf.body} onChange={(e) => setNf({ ...nf, body: e.target.value })} rows={4} style={{ margin: '4px 0 0', width: '100%' }} />
            {err && <div style={{ color: 'var(--amber)', fontSize: 13, marginTop: 8 }}>{err}</div>}
            <div className="row" style={{ gap: 8, marginTop: 12 }}>
              <button className="btn btn-primary" onClick={() => createTicket()} disabled={busy === 'new'}>{busy === 'new' ? '...' : t.create}</button>
              <button className="btn btn-ghost" onClick={() => { setShowNew(false); setErr(''); }}>{t.cancel}</button>
            </div>
          </div>
        )}

        {!tickets.length && !showNew && <p className="muted" style={{ fontSize: 14 }}>{t.none}</p>}

        {tickets.map((tk) => {
          const tm = msgs.filter((m) => m.ticket_id === tk.id);
          const open = openId === tk.id;
          return (
            <div key={tk.id} style={{ borderTop: '1px solid var(--line)', padding: '12px 0' }}>
              <div className="row between" style={{ gap: 8, flexWrap: 'wrap', cursor: 'pointer' }} onClick={() => setOpenId(open ? '' : tk.id)}>
                <div>
                  <div style={{ fontWeight: 600 }}>{tk.subject}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{(t.cats.find((c: any) => c[0] === tk.category) || [])[1] || tk.category} · {new Date(tk.updated_at).toLocaleString()}</div>
                </div>
                <span className="pill" style={{ color: stColor[tk.status], background: stBg[tk.status] }}>{t.st[tk.status]}</span>
              </div>

              {open && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                    {tm.map((m) => (
                      <div key={m.id} style={{ maxWidth: '85%', padding: '8px 11px', fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap', ...bubble(m.sender === 'user' ? 'user' : 'assistant') }}>
                        <div style={{ fontSize: 11, opacity: .7, marginBottom: 2 }}>{m.sender === 'user' ? t.me : m.sender === 'ai' ? t.ai : t.team}</div>
                        {m.body}
                      </div>
                    ))}
                  </div>
                  {tk.status !== 'resolved' && (
                    <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                      <input value={openId === tk.id ? replyTxt : ''} onChange={(e) => setReplyTxt(e.target.value)} placeholder={t.replyPh} style={{ flex: 1, minWidth: 160, margin: 0 }} />
                      <button className="btn btn-primary" onClick={() => reply(tk.id)} disabled={busy === 'r' + tk.id || !replyTxt.trim()}>{t.send2}</button>
                      <button className="btn btn-ghost" onClick={() => closeTicket(tk.id)} disabled={busy === 'c' + tk.id}>{t.markDone}</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
