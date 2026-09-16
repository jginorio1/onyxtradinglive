'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { useLang } from '@/lib/lang';

// ── Onyx Command Center ──────────────────────────────────────────────────────
// Monitoreo en tiempo real. Dos capas:
//   · Presencia EN VIVO (canal Realtime "onyx-live"): quién está conectado ahora
//     y en qué pantalla. Efímero, no se guarda.
//   · Historial (activity_events vía /api/admin/monitor): flujo, filtros y
//     "rebobinar sesión" de un usuario.
type Ev = { id: number; actor_id?: string; actor_email?: string; actor_name?: string; actor_role?: string; kind: string; path?: string; label?: string; country?: string; created_at: string };
type Pres = { id: string; email: string; name?: string; path?: string; ts?: number };

const KIND_COL: Record<string, string> = {
  page: '#3ad0ff', login: '#8f9dff', connect: '#34e2a0', purchase: '#b27dff',
  ticket: '#ffc04d', ea_down: '#ff6b7d', sale: '#34e2a0', checkin: '#34e2a0', event: '#8ea0c4',
};
const col = (k: string) => KIND_COL[k] || '#8ea0c4';
const initials = (s: string) => (s || '?').trim().split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?';
const ago = (iso: string) => { const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000); if (s < 60) return `${s | 0}s`; if (s < 3600) return `${s / 60 | 0}m`; if (s < 86400) return `${s / 3600 | 0}h`; return `${s / 86400 | 0}d`; };
const nicePath = (p?: string) => { if (!p) return '—'; const map: [RegExp, string][] = [[/^\/dashboard\/academy/, 'Academia'], [/^\/dashboard\/bot-lab/, 'Bot Lab'], [/^\/dashboard\/onyx-copy/, 'Onyx Copy'], [/^\/dashboard/, 'Dashboard'], [/^\/admin/, 'Panel admin'], [/^\/login/, 'Login'], [/^\/pricing/, 'Precios'], [/^\/checkout|stripe/, 'Checkout'], [/^\/account/, 'Mi cuenta'], [/^\/academia/, 'Academia'], [/^\/bot-lab/, 'Bot Lab'], [/^\/$/, 'Inicio']]; for (const [re, name] of map) if (re.test(p)) return name; return p; };

export default function Monitor() {
  const { lang } = useLang();
  const es = lang !== 'en';
  const [live, setLive] = useState<Pres[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [feed, setFeed] = useState<Ev[]>([]);
  const [view, setView] = useState<'live' | 'history'>('live');
  // historial
  const [hActor, setHActor] = useState(''); const [hKind, setHKind] = useState(''); const [hRole, setHRole] = useState(''); const [hHours, setHHours] = useState(24);
  const [hist, setHist] = useState<Ev[]>([]); const [hLoad, setHLoad] = useState(false);
  // rebobinar
  const [who, setWho] = useState<{ name: string; key: string } | null>(null);
  const [timeline, setTimeline] = useState<Ev[]>([]); const [tLoad, setTLoad] = useState(false);
  const chan = useRef<any>(null);

  // Presencia en vivo.
  useEffect(() => {
    let ch: any;
    try {
      const sb = supabaseBrowser();
      ch = sb.channel('onyx-live');
      const sync = () => { const st = ch.presenceState() as Record<string, Pres[]>; const arr: Pres[] = []; Object.values(st).forEach((list) => { if (list && list[0]) arr.push(list[0]); }); arr.sort((a, b) => (b.ts || 0) - (a.ts || 0)); setLive(arr); };
      ch.on('presence', { event: 'sync' }, sync).on('presence', { event: 'join' }, sync).on('presence', { event: 'leave' }, sync).subscribe();
      chan.current = ch;
    } catch {}
    return () => { try { ch?.unsubscribe(); } catch {} };
  }, []);

  // Feed + stats (poll cada 4s mientras estás en "live").
  useEffect(() => {
    let t: any; let alive = true;
    const pull = async () => { try { const r = await fetch('/api/admin/monitor?mode=feed', { cache: 'no-store' }).then((x) => x.json()); if (!alive) return; if (r.stats) setStats(r.stats); if (r.feed) setFeed(r.feed); } catch {} };
    pull(); if (view === 'live') t = setInterval(pull, 4000);
    return () => { alive = false; if (t) clearInterval(t); };
  }, [view]);

  async function loadHistory() {
    setHLoad(true);
    try { const q = new URLSearchParams({ mode: 'history', hours: String(hHours), actor: hActor, kind: hKind, role: hRole }); const r = await fetch('/api/admin/monitor?' + q, { cache: 'no-store' }).then((x) => x.json()); setHist(r.events || []); } catch {}
    setHLoad(false);
  }
  async function openTimeline(key: string, name: string) {
    setWho({ key, name }); setTLoad(true); setTimeline([]);
    try { const r = await fetch('/api/admin/monitor?mode=timeline&who=' + encodeURIComponent(key), { cache: 'no-store' }).then((x) => x.json()); setTimeline(r.timeline || []); } catch {}
    setTLoad(false);
  }

  const employees = live.filter((p) => /admin|onyx|staff/i.test(p.email || '') );  // heurística visual; el rol real está en el historial
  const online = live.length;

  const T = es
    ? { title: 'Command Center', sub: 'Monitoreo en tiempo real de usuarios y empleados', online: 'En línea ahora', empl: 'Empleados activos hoy', permin: 'Eventos por minuto', today: 'Eventos hoy', tabLive: 'En vivo', tabHist: 'Historial', who: 'Quién está haciendo qué', feed: 'Flujo de actividad', nobody: 'Nadie conectado ahora mismo.', rewind: 'Rebobinar sesión', filt: 'Filtrar', actor: 'Usuario o email', all: 'Todos', role: 'Rol', trader: 'Traders', empRole: 'Empleados', hours: 'Últimas horas', search: 'Buscar', empty: 'Sin eventos en el rango.', close: 'Cerrar', tl: 'Línea de tiempo' }
    : { title: 'Command Center', sub: 'Real-time monitoring of users and employees', online: 'Online now', empl: 'Employees active today', permin: 'Events per minute', today: 'Events today', tabLive: 'Live', tabHist: 'History', who: 'Who is doing what', feed: 'Activity stream', nobody: 'Nobody connected right now.', rewind: 'Rewind session', filt: 'Filter', actor: 'User or email', all: 'All', role: 'Role', trader: 'Traders', empRole: 'Employees', hours: 'Last hours', search: 'Search', empty: 'No events in range.', close: 'Close', tl: 'Timeline' };

  const kindLabel = (k: string) => ({ page: es ? 'navegó' : 'browsed', login: es ? 'inició sesión' : 'signed in', connect: es ? 'conectó cuenta' : 'connected account', purchase: es ? 'compró' : 'purchased', ticket: es ? 'abrió ticket' : 'opened ticket', ea_down: 'EA ' + (es ? 'caído' : 'down'), sale: es ? 'venta' : 'sale', checkin: 'check-in' } as any)[k] || k;

  const kpi = (n: any, l: string, warn?: boolean) => (
    <div style={{ background: 'var(--card)', border: '1px solid ' + (warn ? 'color-mix(in srgb,var(--amber) 55%,var(--line))' : 'var(--line)'), borderRadius: 12, padding: '10px 13px', minWidth: 0 }}>
      <div style={{ fontSize: 24, fontWeight: 800, color: warn ? 'var(--amber)' : 'var(--tx)' }}>{n}</div>
      <div style={{ fontSize: 11, color: 'var(--mut)' }}>{l}</div>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 0 4px color-mix(in srgb,var(--green) 25%,transparent)' }} />
        <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800 }}>🛰️ {T.title}</h2>
      </div>
      <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>{T.sub}</div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10, marginBottom: 12 }}>
        {kpi(online, T.online)}
        {kpi(stats?.empActive ?? '—', T.empl)}
        {kpi(stats?.perMin ?? '—', T.permin)}
        {kpi(stats?.eventsToday ?? '—', T.today)}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button className={'btn ' + (view === 'live' ? 'btn-primary' : 'btn-ghost')} style={{ fontSize: 12.5 }} onClick={() => setView('live')}>🟢 {T.tabLive}</button>
        <button className={'btn ' + (view === 'history' ? 'btn-primary' : 'btn-ghost')} style={{ fontSize: 12.5 }} onClick={() => { setView('history'); loadHistory(); }}>🗂️ {T.tabHist}</button>
      </div>

      {view === 'live' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 12 }}>
          {/* Presencia */}
          <section style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, padding: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--mut)', marginBottom: 9 }}>👁️ {T.who}</div>
            {online === 0 && <div className="muted" style={{ fontSize: 12.5, padding: '10px 2px' }}>{T.nobody}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, maxHeight: 420, overflow: 'auto' }}>
              {live.map((p) => (
                <button key={p.id} onClick={() => openTimeline(p.email || p.id, p.name || p.email || '')} title={T.rewind}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 10, padding: '7px 10px', cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--grad)', color: '#0b1020', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 12, flex: 'none' }}>{initials(p.name || p.email || '')}</span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name || p.email}</div>
                    <div className="muted" style={{ fontSize: 11 }}>{nicePath(p.path)}</div>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 'none' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)' }} />
                    <span className="muted" style={{ fontSize: 10 }}>{p.ts ? ago(new Date(p.ts).toISOString()) : ''}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* Flujo en vivo */}
          <section style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, padding: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--mut)', marginBottom: 9 }}>📡 {T.feed}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 420, overflow: 'auto' }}>
              {feed.map((e) => (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 8, padding: '6px 9px', fontSize: 12 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: col(e.kind), flex: 'none' }} />
                  <span style={{ fontWeight: 700 }}>{e.actor_name || e.actor_email || (es ? 'anónimo' : 'anon')}</span>
                  <span className="muted"> {kindLabel(e.kind)}{e.kind === 'page' ? ' · ' + nicePath(e.path) : (e.label ? ' · ' + e.label : '')}</span>
                  <span className="muted" style={{ marginLeft: 'auto', fontSize: 10 }}>{ago(e.created_at)}</span>
                </div>
              ))}
              {feed.length === 0 && <div className="muted" style={{ fontSize: 12.5, padding: '10px 2px' }}>{T.empty}</div>}
            </div>
          </section>
        </div>
      )}

      {view === 'history' && (
        <section style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, padding: 12 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10, alignItems: 'center' }}>
            <input value={hActor} onChange={(e) => setHActor(e.target.value)} placeholder={T.actor} style={{ fontSize: 12.5, minWidth: 160 }} />
            <select value={hRole} onChange={(e) => setHRole(e.target.value)} style={{ fontSize: 12.5 }}><option value="">{T.role}: {T.all}</option><option value="trader">{T.trader}</option><option value="employee">{T.empRole}</option></select>
            <select value={hKind} onChange={(e) => setHKind(e.target.value)} style={{ fontSize: 12.5 }}><option value="">{T.all}</option><option value="page">page</option><option value="login">login</option><option value="purchase">purchase</option><option value="ticket">ticket</option><option value="connect">connect</option><option value="ea_down">ea_down</option></select>
            <select value={hHours} onChange={(e) => setHHours(Number(e.target.value))} style={{ fontSize: 12.5 }}><option value={6}>6h</option><option value={24}>24h</option><option value={72}>72h</option><option value={168}>7d</option></select>
            <button className="btn btn-primary" style={{ fontSize: 12.5 }} onClick={loadHistory} disabled={hLoad}>{hLoad ? '…' : T.search}</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 520, overflow: 'auto' }}>
            {hist.map((e) => (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 8, padding: '6px 9px', fontSize: 12 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: col(e.kind), flex: 'none' }} />
                <button onClick={() => openTimeline(e.actor_email || e.actor_id || '', e.actor_name || e.actor_email || '')} style={{ fontWeight: 700, background: 'none', border: 'none', color: 'var(--brand)', cursor: 'pointer', padding: 0 }}>{e.actor_name || e.actor_email || 'anon'}</button>
                {e.actor_role === 'employee' && <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--amber)', border: '1px solid var(--amber)', borderRadius: 4, padding: '0 4px' }}>{es ? 'EMP' : 'STAFF'}</span>}
                <span className="muted"> {kindLabel(e.kind)}{e.kind === 'page' ? ' · ' + nicePath(e.path) : (e.label ? ' · ' + e.label : '')}</span>
                {e.country && <span className="muted" style={{ fontSize: 10 }}>· {e.country}</span>}
                <span className="muted" style={{ marginLeft: 'auto', fontSize: 10 }}>{new Date(e.created_at).toLocaleString()}</span>
              </div>
            ))}
            {!hLoad && hist.length === 0 && <div className="muted" style={{ fontSize: 12.5, padding: '10px 2px' }}>{T.empty}</div>}
          </div>
        </section>
      )}

      {/* Rebobinar sesión (modal) */}
      {who && (
        <div onClick={() => setWho(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(4,8,18,.6)', zIndex: 80, display: 'grid', placeItems: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, width: 'min(560px,96vw)', maxHeight: '86vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '12px 14px', borderBottom: '1px solid var(--line)' }}>
              <span style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--grad)', color: '#0b1020', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 12 }}>{initials(who.name)}</span>
              <div style={{ minWidth: 0 }}><div style={{ fontWeight: 800, fontSize: 14 }}>{who.name}</div><div className="muted" style={{ fontSize: 11 }}>⏪ {T.tl}</div></div>
              <button className="btn btn-ghost" style={{ marginLeft: 'auto', fontSize: 12 }} onClick={() => setWho(null)}>{T.close}</button>
            </div>
            <div style={{ padding: 12, overflow: 'auto' }}>
              {tLoad && <div className="muted" style={{ fontSize: 12.5 }}>…</div>}
              {!tLoad && timeline.length === 0 && <div className="muted" style={{ fontSize: 12.5 }}>{T.empty}</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {timeline.map((e, i) => (
                  <div key={e.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 'none' }}>
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: col(e.kind), marginTop: 5 }} />
                      {i < timeline.length - 1 && <span style={{ width: 2, flex: 1, minHeight: 18, background: 'var(--line)' }} />}
                    </div>
                    <div style={{ paddingBottom: 12 }}>
                      <div style={{ fontSize: 12.5 }}><b>{kindLabel(e.kind)}</b>{e.kind === 'page' ? ' · ' + nicePath(e.path) : (e.label ? ' · ' + e.label : '')}</div>
                      <div className="muted" style={{ fontSize: 10.5 }}>{new Date(e.created_at).toLocaleString()} · hace {ago(e.created_at)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
