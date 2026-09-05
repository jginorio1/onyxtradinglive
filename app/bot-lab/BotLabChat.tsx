'use client';
import { useEffect, useRef, useState } from 'react';
import { useLang } from '@/lib/lang';

// Chat flotante de Onyx Bot Lab. El cliente escribe en su idioma; el equipo lo
// ve en español y responde en español; el cliente recibe la respuesta en su idioma.
const GOLD = 'var(--gold, #ffd45e)';
type Msg = { sender: 'user' | 'admin'; body: string; at: string };

export default function BotLabChat() {
  const { lang } = useLang();
  const es = lang === 'es';
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const tid = useRef<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => { try { tid.current = localStorage.getItem('botlab_tid'); } catch {} }, []);

  async function load() {
    try {
      const q = tid.current ? `?tid=${tid.current}` : '';
      const r = await fetch('/api/botlab/chat' + q);
      const j = await r.json();
      if (j.threadId) { tid.current = j.threadId; try { localStorage.setItem('botlab_tid', j.threadId); } catch {} }
      setMsgs(j.messages || []);
    } catch {}
  }
  useEffect(() => {
    if (!open) return;
    load();
    const iv = setInterval(load, 8000);
    return () => clearInterval(iv);
  }, [open]); // eslint-disable-line
  useEffect(() => { if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight; }, [msgs, open]);

  async function send() {
    const t = text.trim(); if (!t) return;
    setText(''); setSending(true);
    setMsgs((m) => [...m, { sender: 'user', body: t, at: new Date().toISOString() }]);
    try {
      const r = await fetch('/api/botlab/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tid: tid.current, text: t }) });
      const j = await r.json();
      if (j.threadId) { tid.current = j.threadId; try { localStorage.setItem('botlab_tid', j.threadId); } catch {} }
      if (j.messages) setMsgs(j.messages);
    } catch {} finally { setSending(false); }
  }

  return (
    <>
      {!open && (
        <button onClick={() => setOpen(true)} aria-label="Chat" style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 95, width: 56, height: 56, borderRadius: '50%', border: 'none', cursor: 'pointer', background: `linear-gradient(120deg,${GOLD},#ffb020)`, color: '#3a2a06', boxShadow: '0 10px 30px -6px rgba(255,180,32,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </button>
      )}
      {open && (
        <div style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 96, width: 'min(360px, calc(100vw - 32px))', height: 'min(520px, calc(100vh - 40px))', display: 'flex', flexDirection: 'column', background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 18, overflow: 'hidden', boxShadow: '0 24px 60px -20px rgba(0,0,0,.7)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 15px', borderBottom: '1px solid var(--line)', background: 'var(--bg2)' }}>
            <span style={{ width: 30, height: 30, borderRadius: 8, background: `linear-gradient(120deg,${GOLD},#ffb020)`, color: '#3a2a06', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>◆</span>
            <div style={{ flex: 1 }}><div style={{ fontWeight: 800, fontSize: 14 }}>Onyx Bot Lab</div><div className="muted" style={{ fontSize: 11 }}>{es ? 'Escríbenos en tu idioma' : 'Write in your language'}</div></div>
            <button onClick={() => setOpen(false)} aria-label="Cerrar" style={{ background: 'transparent', border: 'none', color: 'var(--mut)', cursor: 'pointer', fontSize: 20 }}>×</button>
          </div>
          <div ref={scroller} style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {!msgs.length && <div className="muted" style={{ fontSize: 13, textAlign: 'center', margin: 'auto 0' }}>{es ? '¿Dudas sobre un robot o un servicio? Escríbenos.' : 'Questions about a robot or service? Message us.'}</div>}
            {msgs.map((m, i) => (
              <div key={i} style={{ maxWidth: '86%', padding: '9px 12px', borderRadius: 13, fontSize: 13.5, alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start', background: m.sender === 'user' ? `linear-gradient(120deg,${GOLD},#ffb020)` : 'var(--bg2)', color: m.sender === 'user' ? '#3a2a06' : 'var(--tx)', border: m.sender === 'user' ? 'none' : '1px solid var(--line)', borderBottomRightRadius: m.sender === 'user' ? 4 : 13, borderBottomLeftRadius: m.sender === 'user' ? 13 : 4 }}>{m.body}</div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, padding: 10, borderTop: '1px solid var(--line)' }}>
            <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send(); }} placeholder={es ? 'Escribe un mensaje…' : 'Type a message…'} style={{ flex: 1, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: '9px 12px', color: 'var(--tx)', fontSize: 13.5, outline: 'none' }} />
            <button onClick={send} disabled={sending} aria-label="Enviar" style={{ width: 40, height: 40, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'var(--brand)', color: '#0b1020', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/></svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
