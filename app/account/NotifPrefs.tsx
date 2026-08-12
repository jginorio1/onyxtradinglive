'use client';
import { useEffect, useState } from 'react';

// Panel del trader: qué avisos quiere en la campana (dentro de la app) y en el
// push del móvil. Telegram se controla aparte en la tarjeta de Telegram.
function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return <span className="toggle" onClick={onClick} style={{ background: on ? 'var(--green)' : '#556080', boxShadow: on ? 'none' : 'inset 0 0 0 1px rgba(255,255,255,.12)' }}><span className="knob" style={{ left: on ? 21 : 3 }} /></span>;
}

export default function NotifPrefs({ lang }: { lang: 'es' | 'en' }) {
  const es = lang === 'es';
  const [items, setItems] = useState<any[] | null>(null);
  const [saved, setSaved] = useState(false);

  async function load() {
    try { const r = await fetch('/api/account/notif-prefs'); const j = await r.json(); setItems(j.items || []); } catch { setItems([]); }
  }
  useEffect(() => { load(); }, []);

  async function save(next: any[]) {
    const prefs: any = {};
    next.forEach((it) => { prefs[it.key] = { bell: !!it.bell, push: !!it.push }; });
    try { await fetch('/api/account/notif-prefs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prefs }) }); setSaved(true); setTimeout(() => setSaved(false), 1400); } catch {}
  }
  function toggle(key: string, ch: 'bell' | 'push') {
    if (!items) return;
    const next = items.map((it) => it.key === key ? { ...it, [ch]: !it[ch] } : it);
    setItems(next); save(next);
  }

  if (!items) return <div className="muted" style={{ fontSize: 13 }}>…</div>;
  if (!items.length) return null;

  return (
    <>
      <div className="row" style={{ gap: 8, marginBottom: 6 }}>
        <h3 style={{ fontSize: 16 }}>🔔 {es ? 'Avisos en la app y el móvil' : 'App and mobile alerts'}</h3>
        {saved && <span style={{ color: 'var(--green)', fontSize: 12 }}>{es ? 'Guardado' : 'Saved'}</span>}
      </div>
      <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>{es ? 'Elige qué recibir en la campana (dentro de la app) y en el push del móvil.' : 'Choose what to get in the bell (in-app) and mobile push.'}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="row between" style={{ fontSize: 11, color: 'var(--mut)', textTransform: 'uppercase', letterSpacing: '.04em', padding: '0 2px' }}>
          <span>{es ? 'Aviso' : 'Alert'}</span>
          <span className="row" style={{ gap: 22 }}><span style={{ width: 46, textAlign: 'center' }}>{es ? 'Campana' : 'Bell'}</span><span style={{ width: 46, textAlign: 'center' }}>Push</span></span>
        </div>
        {items.map((it) => (
          <div key={it.key} className="row between" style={{ background: 'var(--bg2)', borderRadius: 10, padding: '9px 12px', gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{it.title}</div>
              <div className="muted" style={{ fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.body}</div>
            </div>
            <span className="row" style={{ gap: 22, flex: 'none' }}>
              <span style={{ width: 46, display: 'flex', justifyContent: 'center' }}>{it.bellAvail ? <Toggle on={!!it.bell} onClick={() => toggle(it.key, 'bell')} /> : <span className="muted" style={{ fontSize: 11 }}>—</span>}</span>
              <span style={{ width: 46, display: 'flex', justifyContent: 'center' }}>{it.pushAvail ? <Toggle on={!!it.push} onClick={() => toggle(it.key, 'push')} /> : <span className="muted" style={{ fontSize: 11 }}>—</span>}</span>
            </span>
          </div>
        ))}
      </div>
      <p className="muted" style={{ fontSize: 11.5, marginTop: 10 }}>{es ? 'El push necesita que actives las notificaciones del móvil. Los avisos de Telegram se ajustan en la tarjeta de arriba.' : 'Push needs mobile notifications enabled. Telegram alerts are set in the card above.'}</p>
    </>
  );
}
