'use client';
import { toast, confirmDialog } from '@/lib/toast';
import { mkL } from '@/lib/i18n';
// ============================================================
// ChatThread — motor de chat estilo WhatsApp compartido por:
//   · Centro de soporte del trader (cliente ↔ equipo)
//   · Bandeja de soporte del admin (equipo ↔ cliente)
//   · Chat en vivo de empleados (equipo ↔ equipo)
// Burbujas izq/der, avatar, separadores por día, palomitas de leído,
// "escribiendo…", adjuntos (foto/documento), emojis y @menciones.
// Es solo presentación + composer: quien lo usa le pasa los mensajes ya
// normalizados y una función onSend.
// ============================================================
import { useEffect, useRef, useState } from 'react';

export type Att = { name: string; url: string; type: string; size?: number };
export type MentionItem = { type: 'user' | 'client' | 'ticket'; id: string; label: string; sub?: string };

export type ChatMsg = {
  id: string;
  mine: boolean;
  authorName?: string;
  authorKind?: 'user' | 'admin' | 'ai' | 'note' | 'system';
  body: string;
  attachments?: Att[];
  createdAt: string;
  readAt?: string | null;
  pending?: boolean;
};

const EMOJIS = ['👍', '🙏', '✅', '🔥', '🎉', '😀', '😂', '😅', '😎', '🤝', '👌', '💪', '🚀', '⚡', '💰', '📈', '📉', '🛡️', '🤖', '❤️', '👀', '⏳', '⚠️', '❓'];

const initials = (name?: string) => (name || '?').trim().split(/\s+/).slice(0, 2).map((s) => s[0]).join('').toUpperCase() || '?';

function dayLabel(iso: string, lang: 'es' | 'en') {
  const d = new Date(iso); const now = new Date();
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  if (same(d, now)) return lang === 'en' ? 'Today' : 'Hoy';
  if (same(d, yest)) return lang === 'en' ? 'Yesterday' : 'Ayer';
  return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES', { day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
}
const hm = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const kb = (n?: number) => (!n ? '' : n < 1024 ? `${n} B` : n < 1048576 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(1)} MB`);

export default function ChatThread({
  messages, lang, onSend, onTyping, canReply = true, placeholder, typingLabel,
  mentionSource, showAuthors = false, height = 380, emptyText,
}: {
  messages: ChatMsg[];
  lang: 'es' | 'en';
  onSend: (text: string, attachments: Att[]) => Promise<void> | void;
  onTyping?: () => void;
  canReply?: boolean;
  placeholder?: string;
  typingLabel?: string;
  mentionSource?: (q: string) => Promise<MentionItem[]>;
  showAuthors?: boolean;
  height?: number;
  emptyText?: string;
}) {
  const L = mkL(lang);
  const [text, setText] = useState('');
  const [atts, setAtts] = useState<Att[]>([]);
  const [busy, setBusy] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [mentions, setMentions] = useState<MentionItem[]>([]);
  const [mQuery, setMQuery] = useState<string | null>(null);
  const [picked, setPicked] = useState<MentionItem[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length, typingLabel]);

  // @menciones: al escribir "@algo" buscamos con la fuente que nos pasen.
  useEffect(() => {
    if (mQuery === null || !mentionSource) { setMentions([]); return; }
    let live = true;
    mentionSource(mQuery).then((r) => { if (live) setMentions(r.slice(0, 6)); }).catch(() => {});
    return () => { live = false; };
  }, [mQuery, mentionSource]);

  function onChange(v: string) {
    setText(v);
    onTyping?.();
    const m = /(?:^|\s)@([\p{L}0-9_]*)$/u.exec(v);
    setMQuery(mentionSource && m ? m[1] : null);
  }
  function chooseMention(it: MentionItem) {
    setText((v) => v.replace(/(^|\s)@([\p{L}0-9_]*)$/u, `$1@${it.label} `));
    setPicked((p) => (p.some((x) => x.type === it.type && x.id === it.id) ? p : [...p, it]));
    setMQuery(null);
    setTimeout(() => taRef.current?.focus(), 0);
  }

  async function uploadFiles(files: FileList) {
    for (const f of Array.from(files).slice(0, 5)) {
      if (f.size > 8 * 1024 * 1024) { toast(L('Máximo 8 MB por archivo.', 'Max 8 MB per file.')); continue; }
      const b64: string = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(f); });
      try {
        const r = await fetch('/api/chat/upload', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: f.name, type: f.type, data: b64 }) });
        const j = await r.json();
        if (j.url) setAtts((a) => [...a, { name: f.name, url: j.url, type: f.type, size: f.size }]);
        else toast(j.error || L('No se pudo subir el archivo.', 'Upload failed.'));
      } catch { toast(L('No se pudo subir el archivo.', 'Upload failed.')); }
    }
  }

  async function submit() {
    const body = text.trim();
    if ((!body && !atts.length) || busy) return;
    setBusy(true);
    try {
      await onSend(body, atts);
      setText(''); setAtts([]); setPicked([]); setShowEmoji(false); setMQuery(null);
    } finally { setBusy(false); }
  }

  // Marca de leído para MIS mensajes (palomitas).
  const tick = (m: ChatMsg) => {
    if (!m.mine) return null;
    if (m.pending) return <i style={{ fontSize: 11, opacity: .7 }}>🕓</i>;
    return <span style={{ fontSize: 12, color: m.readAt ? 'var(--soft-green, #34e2a0)' : 'rgba(255,255,255,.6)', letterSpacing: -3 }}>✓✓</span>;
  };

  let lastDay = '';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* En móvil los campos deben ser ≥16px o iOS hace zoom al enfocarlos. */}
      <style>{`@media(max-width:600px){.ct-input{font-size:16px !important}}`}</style>
      {/* Alto MÁXIMO con scroll: si no, en un contenedor flex el hilo crecería sin
          fin con conversaciones largas (usar height+flex se anulan entre sí). */}
      <div style={{ overflowY: 'auto', maxHeight: height, minHeight: 60, padding: '4px 2px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {!messages.length && <div className="muted" style={{ fontSize: 13, textAlign: 'center', margin: 'auto' }}>{emptyText || L('Aún no hay mensajes.', 'No messages yet.')}</div>}
        {messages.map((m) => {
          const dl = dayLabel(m.createdAt, lang);
          const showDay = dl !== lastDay; lastDay = dl;
          const note = m.authorKind === 'note';
          const ai = m.authorKind === 'ai';
          return (
            <div key={m.id}>
              {showDay && <div style={{ textAlign: 'center', margin: '10px 0 6px' }}><span className="muted" style={{ fontSize: 11, background: 'var(--bg2)', padding: '3px 10px', borderRadius: 10 }}>{dl}</span></div>}
              <div style={{ display: 'flex', gap: 7, alignItems: 'flex-end', flexDirection: m.mine ? 'row-reverse' : 'row', margin: '2px 0' }}>
                {!m.mine && (
                  <div style={{ width: 26, height: 26, borderRadius: '50%', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, background: ai ? 'rgba(124,140,255,.2)' : 'var(--bg2)', color: ai ? 'var(--soft-brand, #7c8cff)' : 'var(--mut)' }}>{ai ? '🤖' : initials(m.authorName)}</div>
                )}
                <div style={{
                  maxWidth: '76%', padding: '7px 10px', fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  borderRadius: m.mine ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                  background: note ? 'rgba(255,192,77,.12)' : m.mine ? 'var(--grad, #6b74e8)' : ai ? 'rgba(124,140,255,.1)' : 'var(--bg2)',
                  color: m.mine ? '#fff' : 'var(--tx)',
                  border: m.mine ? 'none' : note ? '1px solid rgba(255,192,77,.4)' : '1px solid var(--line)',
                }}>
                  {(showAuthors && !m.mine || ai || note) && (
                    <div style={{ fontSize: 10.5, fontWeight: 600, marginBottom: 2, color: ai ? 'var(--soft-brand, #7c8cff)' : note ? 'var(--amber, #ffc04d)' : 'var(--mut)' }}>
                      {ai ? 'Onyx AI' : note ? L('Nota interna', 'Internal note') : m.authorName}
                    </div>
                  )}
                  {renderBody(m.body)}
                  {!!m.attachments?.length && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: m.body ? 6 : 0 }}>
                      {m.attachments.map((a, i) => <Attachment key={i} a={a} mine={m.mine} />)}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'flex-end', marginTop: 2 }}>
                    <span style={{ fontSize: 10, opacity: m.mine ? .8 : .6, color: m.mine ? '#fff' : 'var(--mut)' }}>{hm(m.createdAt)}</span>
                    {tick(m)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {typingLabel && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', margin: '4px 0 2px 33px' }}>
            <span className="onyx-typing" style={{ display: 'inline-flex', gap: 3 }}>
              <b style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--mut)' }} />
              <b style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--mut)', opacity: .6 }} />
              <b style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--mut)', opacity: .3 }} />
            </span>
            <span className="muted" style={{ fontSize: 11 }}>{typingLabel}</span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {canReply && (
        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 8, marginTop: 6, position: 'relative' }}>
          {/* @-picker */}
          {mQuery !== null && mentions.length > 0 && (
            <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: 6, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, boxShadow: '0 12px 30px rgba(0,0,0,.3)', overflow: 'hidden', zIndex: 20 }}>
              {mentions.map((it) => (
                <button key={it.type + it.id} onClick={() => chooseMention(it)} style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', borderBottom: '1px solid var(--line)', padding: '8px 11px', cursor: 'pointer', color: 'var(--tx)' }}>
                  <span style={{ fontSize: 13 }}>{it.type === 'client' ? '👤' : it.type === 'ticket' ? '🎫' : '🛡️'}</span>
                  <span style={{ fontSize: 13, flex: 1 }}>{it.label}{it.sub && <span className="muted" style={{ fontSize: 11 }}> · {it.sub}</span>}</span>
                </button>
              ))}
            </div>
          )}
          {/* Emojis */}
          {showEmoji && (
            <div style={{ position: 'absolute', bottom: '100%', left: 0, marginBottom: 6, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, boxShadow: '0 12px 30px rgba(0,0,0,.3)', padding: 8, display: 'grid', gridTemplateColumns: 'repeat(8,1fr)', gap: 3, zIndex: 20, width: 260 }}>
              {EMOJIS.map((e) => <button key={e} onClick={() => { setText((v) => v + e); setShowEmoji(false); taRef.current?.focus(); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 18, padding: 3, borderRadius: 6 }}>{e}</button>)}
            </div>
          )}
          {/* Chips de adjuntos por enviar */}
          {!!atts.length && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
              {atts.map((a, i) => (
                <span key={i} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 8, padding: '4px 8px', fontSize: 12 }}>
                  {a.type.startsWith('image/') ? '🖼️' : '📄'} {a.name.slice(0, 22)}
                  <button onClick={() => setAtts((x) => x.filter((_, j) => j !== i))} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--mut)' }}>✕</button>
                </span>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
            <button title={L('Emojis', 'Emojis')} onClick={() => { setShowEmoji((s) => !s); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 19, padding: '6px 2px' }}>😊</button>
            <button title={L('Adjuntar', 'Attach')} onClick={() => fileRef.current?.click()} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 18, padding: '6px 2px' }}>📎</button>
            <input ref={fileRef} type="file" multiple accept="image/*,application/pdf,.doc,.docx,.csv,.xlsx,.txt" style={{ display: 'none' }} onChange={(e) => { if (e.target.files) uploadFiles(e.target.files); e.currentTarget.value = ''; }} />
            <textarea ref={taRef} className="ct-input" value={text} onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
              rows={1} placeholder={placeholder || L('Escribe un mensaje…', 'Type a message…')} enterKeyHint="send"
              style={{ flex: 1, margin: 0, resize: 'none', maxHeight: 110, minHeight: 38, padding: '9px 12px', borderRadius: 18, fontSize: 14 }} />
            <button className="btn btn-primary" onClick={submit} disabled={busy || (!text.trim() && !atts.length)} style={{ borderRadius: 20, padding: '9px 14px' }}>{busy ? '…' : L('Enviar', 'Send')}</button>
          </div>
          {mentionSource && <div className="muted" style={{ fontSize: 10.5, marginTop: 4 }}>{L('Usa @ para etiquetar un compañero, cliente o ticket', 'Use @ to tag a teammate, client or ticket')}</div>}
        </div>
      )}
    </div>
  );
}

// Resalta @menciones dentro del texto.
function renderBody(body: string) {
  if (!body) return null;
  const parts = body.split(/(@[\p{L}0-9_.\- ]{1,40})/u);
  return <span>{parts.map((p, i) => (p.startsWith('@') ? <span key={i} style={{ color: 'var(--soft-brand, #7c8cff)', fontWeight: 600 }}>{p}</span> : <span key={i}>{p}</span>))}</span>;
}

function Attachment({ a, mine }: { a: Att; mine: boolean }) {
  const isImg = a.type?.startsWith('image/');
  if (isImg) return (
    <a href={a.url} target="_blank" rel="noreferrer" style={{ display: 'block' }}>
      <img src={a.url} alt={a.name} style={{ maxWidth: 220, maxHeight: 200, borderRadius: 8, display: 'block' }} />
    </a>
  );
  return (
    <a href={a.url} target="_blank" rel="noreferrer" style={{ display: 'flex', gap: 8, alignItems: 'center', textDecoration: 'none', background: mine ? 'rgba(255,255,255,.15)' : 'var(--card)', border: mine ? 'none' : '1px solid var(--line)', borderRadius: 8, padding: '7px 9px', color: mine ? '#fff' : 'var(--tx)' }}>
      <span style={{ fontSize: 20 }}>📄</span>
      <span><span style={{ fontSize: 12, display: 'block' }}>{a.name}</span><span style={{ fontSize: 10, opacity: .7 }}>{kb(a.size)}</span></span>
    </a>
  );
}
