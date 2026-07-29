'use client';
import { useEffect, useState } from 'react';
import { toast } from '@/lib/toast';
import { useT } from '@/lib/adminText';
import { useLang } from '@/lib/lang';
import { fmtDate, fmtDateTime } from '@/lib/fmtDate';
import RangeBar, { type Range, defaultRange } from './RangeBar';
import UserDrawer from './UserDrawer';

const stColor: any = { open: 'var(--brand)', in_progress: 'var(--amber)', resolved: 'var(--green)' };
const stBg: any = { open: 'rgba(124,140,255,.15)', in_progress: 'rgba(255,192,77,.15)', resolved: 'rgba(52,226,160,.15)' };
const prioColor: any = { high: 'var(--red)', normal: 'var(--mut)', low: 'var(--line)' };
const initials = (email: string) => (email || '?').replace(/@.*/, '').slice(0, 2).toUpperCase();

// Tiempo relativo corto: "hace 5m", "hace 2h", "ayer"…
function ago(ts: any, es: boolean): string {
  if (!ts) return '';
  const s = (Date.now() - new Date(ts).getTime()) / 1000;
  if (s < 60) return es ? 'ahora' : 'now';
  const m = Math.floor(s / 60); if (m < 60) return es ? `hace ${m}m` : `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return es ? `hace ${h}h` : `${h}h ago`;
  const d = Math.floor(h / 24); if (d === 1) return es ? 'ayer' : 'yesterday';
  return es ? `hace ${d}d` : `${d}d ago`;
}

// Textos nuevos del helpdesk (los ya existentes siguen viniendo de useT())
const L: any = {
  es: {
    fMine: 'Mías', fUnassigned: 'Sin asignar', needsReply: 'Espera respuesta',
    ctxTitle: 'Ficha del trader', ctxLead: 'Visitante sin cuenta (lead)', ctxNoUser: 'No tiene cuenta en Onyx todavía.',
    plan: 'Plan', member: 'Miembro desde', accounts: 'Cuentas MT', funded: 'de fondeo', prior: 'Tickets antes',
    langF: 'Idioma', country: 'País', firm: 'Prop firm', firstSeen: 'Primer contacto', none: '—',
    canned: 'Respuesta guardada', cannedNew: 'Nueva respuesta guardada', cTitle: 'Título corto',
    cBody: 'Texto de la respuesta', cSave: 'Guardar', cManage: 'Guardadas', cEmpty: 'Aún no tienes respuestas guardadas.',
    cDel: 'Borrar', prio: 'Prioridad', pHigh: 'Alta', pNormal: 'Normal', pLow: 'Baja', insert: 'Usar',
    aiAuto: 'Auto-respuesta IA', aiAutoOn: 'La IA responde sola los tickets fáciles (nunca temas de dinero).', aiAutoOff: 'Apagada: todos los tickets esperan a una persona.',
    invTitle: 'Invitar a un compañero', online: 'En línea', lastSeen: 'Última vez', never: 'Sin actividad aún', allIn: 'Todo el equipo ya está en esta conversación.',
    saveKb: 'Guardar como conocimiento', saveKbOk: 'Guardado en la Base IA. La IA lo reutilizará.', saveKbNone: 'No hay una respuesta que guardar todavía.',
  },
  en: {
    fMine: 'Mine', fUnassigned: 'Unassigned', needsReply: 'Awaiting reply',
    ctxTitle: 'Trader profile', ctxLead: 'Visitor without account (lead)', ctxNoUser: 'No Onyx account yet.',
    plan: 'Plan', member: 'Member since', accounts: 'MT accounts', funded: 'funded', prior: 'Prior tickets',
    langF: 'Language', country: 'Country', firm: 'Prop firm', firstSeen: 'First contact', none: '—',
    canned: 'Saved reply', cannedNew: 'New saved reply', cTitle: 'Short title',
    cBody: 'Reply text', cSave: 'Save', cManage: 'Saved replies', cEmpty: 'No saved replies yet.',
    cDel: 'Delete', prio: 'Priority', pHigh: 'High', pNormal: 'Normal', pLow: 'Low', insert: 'Use',
    aiAuto: 'AI auto-reply', aiAutoOn: 'AI answers easy tickets on its own (never money topics).', aiAutoOff: 'Off: every ticket waits for a person.',
    invTitle: 'Invite a teammate', online: 'Online', lastSeen: 'Last seen', never: 'No activity yet', allIn: 'The whole team is already in this conversation.',
    saveKb: 'Save as knowledge', saveKbOk: 'Saved to the Knowledge Base. The AI will reuse it.', saveKbNone: 'There is no answer to save yet.',
  },
};

export default function SupportInbox() {
  const t = useT();
  const { lang } = useLang();
  const l = L[lang] || L.es;
  const es = lang !== 'en';
  const [drawerUser, setDrawerUser] = useState<{ id: string; email: string } | null>(null);
  const [range, setRange] = useState<Range>(() => defaultRange('month'));
  const ST: any = { open: t.st_open, in_progress: t.st_inprogress, resolved: t.st_resolved };
  const CATS: any = { general: t.cat_general, conexion: t.cat_conexion, instalacion: t.cat_instalacion, guardian: t.cat_guardian, facturacion: t.cat_facturacion };
  const CH: any = { ticket: t.ch_ticket, chat: t.ch_chat, lead: t.ch_lead, email: t.ch_email };
  const [tickets, setTickets] = useState<any[]>([]);
  const [msgs, setMsgs] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [team, setTeam] = useState<any[]>([]);
  const [counts, setCounts] = useState<any>({});
  const [me, setMe] = useState<string>('');
  const [filter, setFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved' | 'mine' | 'unassigned'>('open');
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState('');
  const [text, setText] = useState('');
  const [mode, setMode] = useState<'reply' | 'note'>('reply');
  const [busy, setBusy] = useState('');
  // Ficha del trader
  const [ctx, setCtx] = useState<any>(null);
  const [ctxLoading, setCtxLoading] = useState(false);
  // Respuestas guardadas
  const [canned, setCanned] = useState<any[]>([]);
  const [showCanned, setShowCanned] = useState(false);
  const [newC, setNewC] = useState<{ title: string; body: string } | null>(null);
  // Auto-respuesta IA
  const [aiOn, setAiOn] = useState<boolean | null>(null);
  async function loadAi() { try { const r = await fetch('/api/admin/support/settings'); const j = await r.json(); setAiOn(!!j.enabled); } catch {} }
  async function toggleAi() { const next = !aiOn; setAiOn(next); try { await fetch('/api/admin/support/settings', { method: 'POST', body: JSON.stringify({ enabled: next }) }); } catch {} }

  async function load() {
    try {
      const r = await fetch('/api/admin/support'); const j = await r.json();
      setTickets(j.tickets || []); setMsgs(j.messages || []); setParticipants(j.participants || []);
      setTeam(j.team || []); setCounts(j.counts || {}); setMe(j.me || '');
    } catch {}
  }
  async function loadCanned() { try { const r = await fetch('/api/admin/support/canned'); const j = await r.json(); setCanned(j.canned || []); } catch {} }
  useEffect(() => { load(); loadCanned(); loadAi(); const iv = setInterval(load, 8000); return () => clearInterval(iv); }, []);
  // Si llega con ?ticket=ID (desde el aviso sticky), abre esa conversación.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('ticket');
    if (id) { setFilter('all'); setOpenId(id); }
  }, []);

  // Al abrir un ticket, traer la ficha del trader
  useEffect(() => {
    if (!openId) { setCtx(null); return; }
    setCtxLoading(true); setCtx(null);
    fetch('/api/admin/support/context?ticket_id=' + openId)
      .then((r) => r.json()).then((j) => setCtx(j)).catch(() => setCtx(null))
      .finally(() => setCtxLoading(false));
  }, [openId]);

  const emailOf = (id: string) => (team.find((tm) => tm.id === id) || {}).email || '—';

  // ¿el último mensaje del ticket es del trader? → espera respuesta del equipo
  const lastSender: Record<string, string> = {};
  for (const m of msgs) lastSender[m.ticket_id] = m.sender;
  const needsReply = (id: string) => lastSender[id] === 'user';

  async function act(id: string, patch: any) {
    setBusy(id);
    await fetch('/api/admin/support', { method: 'PATCH', body: JSON.stringify({ ticket_id: id, ...patch }) });
    if (patch.body !== undefined || patch.note !== undefined) setText('');
    setBusy(''); await load();
  }
  async function draft(id: string, firstUserMsg: string) {
    setBusy('ai' + id);
    try { const r = await fetch('/api/support/ai', { method: 'POST', body: JSON.stringify({ question: firstUserMsg, lang }) }); const j = await r.json(); setText(j.answer || ''); setMode('reply'); } catch {}
    setBusy('');
  }
  async function saveCanned() {
    if (!newC || !newC.title.trim() || !newC.body.trim()) return;
    await fetch('/api/admin/support/canned', { method: 'POST', body: JSON.stringify({ ...newC, lang }) });
    setNewC(null); await loadCanned();
  }
  async function delCanned(id: string) { await fetch('/api/admin/support/canned?id=' + id, { method: 'DELETE' }); await loadCanned(); }

  // Guarda la mejor respuesta del ticket en la Base IA, para que la IA la
  // reutilice en futuros tickets parecidos (aprende del uso real).
  async function saveKnowledge(subject: string, tm: any[]) {
    const best = [...tm].reverse().find((m) => m.sender === 'admin' || m.sender === 'ai');
    if (!best || !String(best.body || '').trim()) { toast(l.saveKbNone); return; }
    try {
      await fetch('/api/admin/kb', { method: 'POST', body: JSON.stringify({ title: String(subject || 'Onyx').slice(0, 120), body: best.body, tags: 'soporte', published: true }) });
      toast(l.saveKbOk);
    } catch { }
  }

  let list = tickets.filter((it) => {
    if (filter === 'mine') return it.assignee_id === me;
    if (filter === 'unassigned') return !it.assignee_id;
    if (filter === 'all') return true;
    return it.status === filter;
  });
  if (q.trim()) { const s = q.toLowerCase(); list = list.filter((it) => (it.email || '').toLowerCase().includes(s) || (it.subject || '').toLowerCase().includes(s)); }

  const mineCount = tickets.filter((it) => it.assignee_id === me && it.status !== 'resolved').length;
  const unassignedCount = tickets.filter((it) => !it.assignee_id && it.status !== 'resolved').length;
  const tk = tickets.find((it) => it.id === openId);

  return (
    <div>
      <style>{`
        .hd3{display:grid;grid-template-columns:236px minmax(0,1fr) 224px;gap:12px;align-items:start}
        @media(max-width:1100px){.hd3{grid-template-columns:210px minmax(0,1fr)}.hd-ctx{display:none}}
        @media(max-width:720px){.hd3{grid-template-columns:1fr}}
        .hd-panel{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px}
        .hd-tk{border:1px solid transparent;border-radius:12px;padding:9px 11px;cursor:pointer;margin-bottom:4px;transition:background .12s,border-color .12s}
        .hd-tk:hover{background:var(--bg2)}
        .hd-tk.on{background:var(--bg2);border-color:var(--line)}
        .hd-fil{font-size:12.5px;padding:6px 13px;border-radius:20px;border:1px solid var(--line);background:var(--card2);color:var(--mut);cursor:pointer;transition:all .12s}
        .hd-fil:hover{color:var(--tx)}
        .hd-fil.on{background:var(--brand);border-color:var(--brand);color:#fff}
        .hd-bub{border-radius:12px;padding:9px 12px;font-size:13px;line-height:1.55;white-space:pre-wrap}
        .hd-chip{display:inline-flex;align-items:center;gap:5px;font-size:12px;padding:6px 11px;border-radius:20px;border:1px solid var(--line);background:var(--card2);color:var(--tx);cursor:pointer}
        .hd-chip:hover{border-color:var(--brand)}
        .hd-av{width:40px;height:40px;border-radius:50%;background:rgba(124,140,255,.18);color:var(--brand);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600;flex:none}
        .hd-row{display:flex;justify-content:space-between;gap:8px;font-size:12.5px}
      `}</style>
      <div className="tabhead"><div className="th-row"><span className="th-ic">🎫</span><span className="th-t">{t.h_soporte_t}</span></div><div className="th-s">{t.h_soporte_s}</div></div>
      <RangeBar value={range} onChange={setRange}
        pdfUrl={(f, tt) => `/api/admin/support/report?from=${f}&to=${tt}&lang=${lang}`}
        csvUrl={(f, tt) => `/api/admin/support/report?export=csv&from=${f}&to=${tt}&lang=${lang}`} />

      {/* Interruptor de auto-respuesta IA */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 18 }}>🤖</span>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{l.aiAuto}</div>
          <div className="muted" style={{ fontSize: 12 }}>{aiOn === false ? l.aiAutoOff : l.aiAutoOn}</div>
        </div>
        <button className={'btn ' + (aiOn ? 'btn-primary' : 'btn-ghost')} style={{ fontSize: 13, minWidth: 64 }} onClick={toggleAi} disabled={aiOn === null}>
          {aiOn === null ? '…' : aiOn ? 'ON' : 'OFF'}
        </button>
      </div>

      <div className="row" style={{ gap: 7, marginBottom: 12, flexWrap: 'wrap' }}>
        {([['mine', l.fMine, mineCount], ['unassigned', l.fUnassigned, unassignedCount], ['open', t.s_open, counts.open], ['in_progress', t.s_inprogress, counts.in_progress], ['resolved', t.s_resolved, counts.resolved], ['all', t.s_all, null]] as any).map(([k, lab, c]: any) => (
          <button key={k} className={'hd-fil' + (filter === k ? ' on' : '')} onClick={() => setFilter(k)}>
            {lab}{c != null ? ` ${c}` : ''}
          </button>
        ))}
        <input placeholder={t.s_search} value={q} onChange={(e) => setQ(e.target.value)} style={{ margin: 0, maxWidth: 240, marginLeft: 'auto' }} />
      </div>

      <div className="hd3">
        {/* Cola de conversaciones */}
        <div className="hd-panel">
          {!list.length && <p className="muted" style={{ fontSize: 13, padding: '8px 4px' }}>{t.s_empty}</p>}
          {list.map((it) => {
            const parts = participants.filter((p) => p.ticket_id === it.id);
            const nr = needsReply(it.id);
            const who = (it.email || '—').split('@')[0];
            return (
              <div key={it.id} className={'hd-tk' + (openId === it.id ? ' on' : '')} onClick={() => { setOpenId(it.id); setText(''); setShowCanned(false); }}>
                <div className="row between" style={{ gap: 8 }}>
                  <div className="row" style={{ gap: 6, minWidth: 0 }}>
                    {it.priority && it.priority !== 'normal' && <span title={it.priority} style={{ width: 7, height: 7, borderRadius: '50%', background: prioColor[it.priority], flex: 'none', marginTop: 5 }} />}
                    <b style={{ fontSize: 13, fontWeight: nr ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.subject}</b>
                  </div>
                  <span className="pill" style={{ color: stColor[it.status], background: stBg[it.status], flex: 'none' }}>● {ST[it.status]}</span>
                </div>
                <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>{who} · {it.assignee_id ? emailOf(it.assignee_id).split('@')[0] : t.s_unassigned} · {ago(it.updated_at, es)}</div>
                <div className="row" style={{ gap: 5, marginTop: 6, flexWrap: 'wrap' }}>
                  {nr && <span className="pill" style={{ color: 'var(--amber)', background: 'rgba(255,192,77,.15)' }}>↩ {l.needsReply}</span>}
                  {it.is_lead && <span className="pill brand">Lead</span>}
                  <span className="pill gray">{CH[it.channel] || it.channel}</span>
                  {parts.length > 0 && <span className="pill gray">👥 {parts.length}</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Conversación abierta */}
        <div className="hd-panel" style={{ minHeight: 260 }}>
          {!tk && <div className="muted" style={{ display: 'flex', height: 220, alignItems: 'center', justifyContent: 'center', fontSize: 14, textAlign: 'center' }}>{t.s_pickOne}</div>}
          {tk && (() => {
            const tm = msgs.filter((m) => m.ticket_id === tk.id);
            const firstUser = tm.find((m) => m.sender === 'user')?.body || tk.subject;
            const parts = participants.filter((p) => p.ticket_id === tk.id);
            const cannedForLang = canned.filter((c) => c.lang === lang);
            const cannedList = cannedForLang.length ? cannedForLang : canned;
            return (
              <>
                {/* Cabecera: trader + estado + prioridad */}
                <div className="row between" style={{ flexWrap: 'wrap', gap: 8, paddingBottom: 12, borderBottom: '1px solid var(--line)' }}>
                  <div className="row" style={{ gap: 10 }}>
                    <span className="hd-av">{initials(tk.email || '?')}</span>
                    <div>
                      <div style={{ fontWeight: 600 }}>{tk.email || t.s_visitor}</div>
                      <div className="muted" style={{ fontSize: 11.5 }}>{CATS[tk.category] || tk.category} · {CH[tk.channel] || tk.channel}{tk.is_lead ? ' · Lead' : ''}</div>
                    </div>
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    <select value={tk.priority || 'normal'} onChange={(e) => act(tk.id, { priority: e.target.value })} style={{ margin: 0, fontSize: 12, padding: '5px 8px' }} title={l.prio}>
                      <option value="high">🔴 {l.pHigh}</option>
                      <option value="normal">⚪ {l.pNormal}</option>
                      <option value="low">⚫ {l.pLow}</option>
                    </select>
                    <span className="pill" style={{ color: stColor[tk.status], background: stBg[tk.status] }}>● {ST[tk.status]}</span>
                  </div>
                </div>

                {/* Hilo */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '12px 0' }}>
                  {tm.map((m) => {
                    const note = m.sender === 'note';
                    const style = note
                      ? { background: 'rgba(255,192,77,.10)', border: '1px dashed var(--amber)' }
                      : m.sender === 'user' ? { background: 'var(--bg2)', border: '1px solid var(--line)' }
                        : { background: 'rgba(124,140,255,.12)', border: '1px solid rgba(124,140,255,.35)' };
                    const label = m.sender === 'user' ? t.sender_trader : m.sender === 'ai' ? '🤖 Onyx AI' : note ? '🔒 ' + t.sender_note : t.sender_support;
                    return (
                      <div key={m.id} className="hd-bub" style={style}>
                        <div style={{ fontSize: 11, opacity: .85, marginBottom: 3, color: note ? 'var(--amber)' : m.sender === 'user' ? 'var(--mut)' : 'var(--brand)', fontWeight: 500 }}>{label} · {fmtDateTime(m.created_at, lang)}</div>
                        {m.body}
                      </div>
                    );
                  })}
                </div>

                {parts.length > 0 && <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>👥 {t.s_inConvo}{parts.map((p) => emailOf(p.user_id).split('@')[0]).join(', ')}</div>}

                {/* Redactar */}
                <div className="row between" style={{ gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                  <div className="seg">
                    <button className={'segbtn' + (mode === 'reply' ? ' on-view' : '')} onClick={() => setMode('reply')}>{t.s_reply}</button>
                    <button className={'segbtn' + (mode === 'note' ? ' on-view' : '')} onClick={() => setMode('note')}>🔒 {t.s_note}</button>
                  </div>
                  {mode === 'reply' && (
                    <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                      <button className="hd-chip" onClick={() => setShowCanned((v) => !v)}>＋ {l.canned}</button>
                      <button className="hd-chip" onClick={() => draft(tk.id, firstUser)} disabled={busy === 'ai' + tk.id}>🤖 {busy === 'ai' + tk.id ? '…' : t.s_aiDraft}</button>
                    </div>
                  )}
                </div>

                {/* Panel de respuestas guardadas */}
                {showCanned && mode === 'reply' && (
                  <div style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: 10, marginBottom: 8 }}>
                    {!newC && (
                      <>
                        {!cannedList.length && <div className="muted" style={{ fontSize: 12.5, marginBottom: 8 }}>{l.cEmpty}</div>}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                          {cannedList.map((c) => (
                            <div key={c.id} className="row between" style={{ gap: 8, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 8, padding: '7px 9px' }}>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 12.5, fontWeight: 600 }}>{c.title}</div>
                                <div className="muted" style={{ fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.body}</div>
                              </div>
                              <div className="row" style={{ gap: 4, flex: 'none' }}>
                                <button className="btn btn-primary" style={{ fontSize: 11.5, padding: '4px 10px' }} onClick={() => { setText(c.body); setShowCanned(false); }}>{l.insert}</button>
                                <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 8px', color: 'var(--red)' }} title={l.cDel} onClick={() => delCanned(c.id)}>🗑</button>
                              </div>
                            </div>
                          ))}
                        </div>
                        <button className="btn btn-ghost" style={{ fontSize: 12, marginTop: 8 }} onClick={() => setNewC({ title: '', body: '' })}>＋ {l.cannedNew}</button>
                      </>
                    )}
                    {newC && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <input placeholder={l.cTitle} value={newC.title} onChange={(e) => setNewC({ ...newC, title: e.target.value })} style={{ margin: 0, fontSize: 13 }} />
                        <textarea placeholder={l.cBody} value={newC.body} onChange={(e) => setNewC({ ...newC, body: e.target.value })} rows={3} style={{ width: '100%', margin: 0 }} />
                        <div className="row" style={{ gap: 6 }}>
                          <button className="btn btn-primary" style={{ fontSize: 12.5 }} onClick={saveCanned} disabled={!newC.title.trim() || !newC.body.trim()}>{l.cSave}</button>
                          <button className="btn btn-ghost" style={{ fontSize: 12.5 }} onClick={() => setNewC(null)}>✕</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder={mode === 'note' ? t.s_notePh : t.s_replyPh} style={{ width: '100%', margin: '0 0 8px' }} />

                <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  {mode === 'reply'
                    ? <button className="btn btn-primary" onClick={() => act(tk.id, { body: text })} disabled={busy === tk.id || !text.trim()}>{t.s_sendReply}</button>
                    : <button className="btn btn-primary" onClick={() => act(tk.id, { note: text })} disabled={busy === tk.id || !text.trim()}>{t.s_saveNote}</button>}
                  {!tk.assignee_id && <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => act(tk.id, { take: true })}>{t.s_take}</button>}
                  <button className="btn btn-ghost" style={{ fontSize: 13 }} title={l.saveKb} onClick={() => saveKnowledge(tk.subject, tm)}>💡 {l.saveKb}</button>
                  <span style={{ flex: 1 }} />
                  {tk.status !== 'resolved' && <button className="btn btn-ghost" style={{ fontSize: 13, color: 'var(--green)' }} onClick={() => act(tk.id, { status: 'resolved' })}>{t.s_resolve}</button>}
                  {tk.status === 'resolved' && <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => act(tk.id, { status: 'open' })}>{t.s_reopen}</button>}
                </div>

                {/* Invitar a un compañero: lista del equipo con estado en línea + última vez */}
                <div style={{ marginTop: 12, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{l.invTitle}</div>
                  {(() => {
                    const inConvo = new Set([tk.assignee_id, me, ...parts.map((p) => p.user_id)].filter(Boolean));
                    const cands = team.filter((tm) => !inConvo.has(tm.id));
                    if (!cands.length) return <div className="muted" style={{ fontSize: 12 }}>{l.allIn}</div>;
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {cands.map((tm) => {
                          // En línea = activo en los últimos 5 minutos (automático, no depende del interruptor).
                          const online = tm.last_active && (Date.now() - new Date(tm.last_active).getTime()) < 5 * 60 * 1000;
                          return (
                            <div key={tm.id} className="row between" style={{ gap: 8, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 8, padding: '6px 9px' }}>
                              <div className="row" style={{ gap: 8, minWidth: 0 }}>
                                <span title={online ? l.online : l.lastSeen} style={{ width: 8, height: 8, borderRadius: '50%', background: online ? 'var(--green)' : 'var(--mut)', flex: 'none' }} />
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tm.email}</div>
                                  <div className="muted" style={{ fontSize: 11 }}>{online ? '🟢 ' + l.online : (tm.last_active ? l.lastSeen + ' ' + fmtDateTime(tm.last_active, lang) : l.never)}</div>
                                </div>
                              </div>
                              <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px', flex: 'none' }} onClick={() => act(tk.id, { invite_email: tm.email })} disabled={busy === tk.id}>{t.s_inviteBtn}</button>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </>
            );
          })()}
        </div>

        {/* Ficha del trader */}
        <div className="hd-ctx">
          {tk && (
            <div className="hd-panel">
              <div style={{ fontSize: 12, color: 'var(--mut)', marginBottom: 10 }}>{l.ctxTitle}</div>
              {ctxLoading && <div className="muted" style={{ fontSize: 13 }}>…</div>}
              {!ctxLoading && ctx && (
                <>
                  <div className="row" style={{ gap: 10, marginBottom: 12 }}>
                    <span className="hd-av">{initials(ctx.email || tk.email || '?')}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13.5 }}>{ctx.name || (tk.email || '').split('@')[0] || t.s_visitor}</div>
                      <div className="muted" style={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis' }}>{ctx.email || '—'}</div>
                    </div>
                  </div>
                  {ctx.is_lead && <div className="pill brand" style={{ marginBottom: 10 }}>{l.ctxLead}</div>}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 9, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
                    {ctx.plan && <Row k={l.plan} v={String(ctx.plan).toUpperCase()} />}
                    {ctx.member_since && <Row k={l.member} v={fmtDate(ctx.member_since, lang)} />}
                    {ctx.plan != null && <Row k={l.accounts} v={`${ctx.accounts || 0}${ctx.funded ? ` · ${ctx.funded} ${l.funded}` : ''}`} />}
                    <Row k={l.prior} v={String(ctx.prior_tickets || 0)} />
                    {ctx.firm && <Row k={l.firm} v={ctx.firm} />}
                    {ctx.country && <Row k={l.country} v={ctx.country} />}
                    {ctx.lang && <Row k={l.langF} v={String(ctx.lang).toUpperCase()} />}
                    {ctx.first_seen && <Row k={l.firstSeen} v={fmtDate(ctx.first_seen, lang)} />}
                    {!ctx.plan && !ctx.is_lead && <div className="muted" style={{ fontSize: 12 }}>{l.ctxNoUser}</div>}
                  </div>
                  {ctx.user_id && (
                    <button className="btn btn-ghost" style={{ width: '100%', marginTop: 12, fontSize: 12.5 }}
                      onClick={() => setDrawerUser({ id: ctx.user_id, email: ctx.email || tk.email || '' })}>
                      {es ? 'Abrir ficha completa' : 'Open full profile'}
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {drawerUser && <UserDrawer userId={drawerUser.id} email={drawerUser.email} onClose={() => setDrawerUser(null)} />}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="row between" style={{ gap: 8 }}>
      <span className="muted">{k}</span>
      <span style={{ textAlign: 'right' }}>{v}</span>
    </div>
  );
}
