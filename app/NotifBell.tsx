'use client';
import { useEffect, useRef, useState } from 'react';
import { useLang } from '@/lib/lang';

// Campana de mensajes del trader: badge con no leídas + nota sticky con pin.
const ICON: Record<string, string> = { support: '💬', funding: '⚠️', manager: '🛡️', goal: '🎯', offline: '🔌', info: '🔔' };

export default function NotifBell() {
  const { lang } = useLang();
  const L = (es: string, en: string) => (lang === 'en' ? en : es);
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  async function load() {
    try { const r = await fetch('/api/notifications'); const j = await r.json(); setItems(j.items || []); setUnread(j.unread || 0); } catch {}
  }
  useEffect(() => {
    try { setPinned(localStorage.getItem('onyx_notif_pin') === '1'); } catch {}
    load(); const iv = setInterval(load, 30000); return () => clearInterval(iv);
  }, []);
  // Cerrar al hacer clic fuera (salvo que esté fijada).
  useEffect(() => {
    function onDoc(e: MouseEvent) { if (open && !pinned && box.current && !box.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('mousedown', onDoc); return () => document.removeEventListener('mousedown', onDoc);
  }, [open, pinned]);

  function togglePin() { const v = !pinned; setPinned(v); try { localStorage.setItem('onyx_notif_pin', v ? '1' : '0'); } catch {} }
  async function markAll() { await fetch('/api/notifications', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ all: true }) }); load(); }
  async function openOne(n: any) {
    if (!n.read_at) { await fetch('/api/notifications', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: n.id }) }); }
    if (n.url) window.location.href = n.url; else load();
  }
  const ago = (iso: string) => { const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000); if (s < 60) return L('ahora', 'now'); const m = Math.floor(s / 60); if (m < 60) return `${m} min`; const h = Math.floor(m / 60); if (h < 24) return `${h} h`; return `${Math.floor(h / 24)} d`; };

  return (
    <div ref={box} style={{ position: 'relative' }}>
      <button onClick={() => { const n = !open; setOpen(n); if (n && unread) markAll(); }} title={L('Mensajes', 'Messages')}
        style={{ position: 'relative', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 19, lineHeight: 1, padding: 4, color: 'var(--tx)' }}>
        🔔
        {unread > 0 && <span style={{ position: 'absolute', top: -2, right: -2, background: 'var(--red)', color: '#fff', fontSize: 10, fontWeight: 700, minWidth: 16, height: 16, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 10px)', right: 0, width: 340, maxWidth: '90vw', background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, boxShadow: '0 12px 34px rgba(0,0,0,.35)', zIndex: 1000, overflow: 'hidden' }}>
          <div className="row between" style={{ padding: '11px 14px', borderBottom: '1px solid var(--line)' }}>
            <b style={{ fontSize: 14 }}>🔔 {L('Mensajes', 'Messages')}</b>
            <span className="row" style={{ gap: 10 }}>
              <button onClick={togglePin} title={L('Fijar', 'Pin')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 15, color: pinned ? 'var(--soft-brand)' : 'var(--mut)' }}>📌</button>
              <button onClick={() => setOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 15, color: 'var(--mut)' }}>✕</button>
            </span>
          </div>
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {!items.length && <div className="muted" style={{ fontSize: 13, padding: '18px 14px', textAlign: 'center' }}>{L('No tienes mensajes.', 'No messages yet.')}</div>}
            {items.map((n) => (
              <div key={n.id} onClick={() => openOne(n)} style={{ display: 'flex', gap: 10, padding: '11px 14px', borderBottom: '1px solid var(--line)', cursor: n.url ? 'pointer' : 'default', background: n.read_at ? 'transparent' : 'rgba(124,140,255,.07)' }}>
                <span style={{ fontSize: 17, flex: 'none' }}>{ICON[n.kind] || ICON.info}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{n.title}</div>
                  {n.body && <div className="muted" style={{ fontSize: 12 }}>{n.body}</div>}
                  <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{ago(n.created_at)}</div>
                </div>
                {!n.read_at && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--soft-brand)', flex: 'none', marginTop: 5 }} />}
              </div>
            ))}
          </div>
          {!!items.length && (
            <div className="row between" style={{ padding: '9px 14px' }}>
              <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={markAll}>{L('Marcar todo leído', 'Mark all read')}</button>
              {pinned && <span className="muted" style={{ fontSize: 11 }}>📌 {L('Fijado', 'Pinned')}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
