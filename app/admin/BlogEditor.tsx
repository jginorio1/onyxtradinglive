'use client';
import { useEffect, useState } from 'react';
import { toast } from '@/lib/toast';
import { useLang } from '@/lib/lang';

// Calendario de un solo día, mismo estilo que el de la academia (mes grande,
// día sombreado, navegación de mes, días pasados deshabilitados).
function DayCalendar({ value, onChange, es }: { value: string; onChange: (d: string) => void; es: boolean }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const init = value ? new Date(value + 'T00:00') : new Date();
  const [view, setView] = useState({ y: init.getFullYear(), m: init.getMonth() });
  const key = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const first = new Date(view.y, view.m, 1);
  const startDow = (first.getDay() + 6) % 7;
  const days = new Date(view.y, view.m + 1, 0).getDate();
  const monthName = new Date(view.y, view.m, 1).toLocaleDateString(es ? 'es-ES' : 'en-US', { month: 'long', year: 'numeric' });
  const dows = es ? ['L', 'M', 'X', 'J', 'V', 'S', 'D'] : ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const cells: any[] = [];
  for (let i = 0; i < startDow; i++) cells.push(<div key={'e' + i} />);
  for (let d = 1; d <= days; d++) {
    const k = key(view.y, view.m, d);
    const past = new Date(view.y, view.m, d) < today;
    const on = k === value;
    cells.push(
      <button type="button" key={k} disabled={past} onClick={() => !past && onChange(k)}
        style={{ height: 40, borderRadius: 9, border: '1px solid ' + (on ? 'var(--brand)' : 'var(--line)'),
          background: on ? 'color-mix(in srgb,var(--brand) 28%,transparent)' : 'var(--card)',
          color: past ? 'var(--mut)' : 'var(--tx)', opacity: past ? 0.35 : 1, cursor: past ? 'default' : 'pointer',
          fontSize: 13.5, fontWeight: on ? 700 : 500 }}>{d}</button>
    );
  }
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 14, padding: '12px 13px', maxWidth: 340 }}>
      <div className="row between" style={{ alignItems: 'center', marginBottom: 10 }}>
        <button type="button" className="btn btn-ghost" style={{ padding: '4px 12px', fontSize: 18, lineHeight: 1 }} onClick={() => setView((v) => { const m = v.m - 1; return m < 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m }; })}>‹</button>
        <b style={{ fontSize: 14, textTransform: 'capitalize' }}>{monthName}</b>
        <button type="button" className="btn btn-ghost" style={{ padding: '4px 12px', fontSize: 18, lineHeight: 1 }} onClick={() => setView((v) => { const m = v.m + 1; return m > 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m }; })}>›</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 5, marginBottom: 5 }}>
        {dows.map((w, i) => <span key={i} style={{ textAlign: 'center', fontSize: 10.5, color: 'var(--mut)', fontWeight: 600 }}>{w}</span>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 5 }}>{cells}</div>
    </div>
  );
}

const TIMES = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);
const blank = { id: '', slug: '', title_es: '', title_en: '', excerpt_es: '', excerpt_en: '', body_es: '', body_en: '', cover_url: '', tags: '', status: 'draft', pubDate: '', pubTime: '09:00' };

export default function BlogEditor() {
  const { lang } = useLang() as { lang: 'es' | 'en' };
  const es = lang !== 'en';
  const [posts, setPosts] = useState<any[]>([]);
  const [f, setF] = useState<any>(null);       // artículo en edición (null = lista)
  const [busy, setBusy] = useState(false);
  const [ai, setAi] = useState(false);
  const [topic, setTopic] = useState('');
  const [titles, setTitles] = useState<string[]>([]);
  const [view, setView] = useState<'cal' | 'list'>('cal');   // vista del blog: calendario o lista
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [dragId, setDragId] = useState('');                  // id del artículo que se arrastra
  const [overDay, setOverDay] = useState('');                // día resaltado al arrastrar encima
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));

  const pad2 = (n: number) => String(n).padStart(2, '0');
  const dayKey = (y: number, m: number, d: number) => `${y}-${pad2(m + 1)}-${pad2(d)}`;
  // Fecha (clave YYYY-MM-DD) en la que vive un artículo en el calendario.
  function dateKeyOf(p: any): string | null {
    const iso = p.status === 'scheduled' ? p.publish_at : p.status === 'published' ? (p.published_at || p.created_at) : null;
    if (!iso) return null;
    const d = new Date(iso); return dayKey(d.getFullYear(), d.getMonth(), d.getDate());
  }
  // Clic en un día vacío → nuevo artículo programado ese día.
  function newOn(k: string) { setTitles([]); setTopic(''); setF({ ...blank, status: 'scheduled', pubDate: k, pubTime: '09:00' }); }
  // Arrastrar un chip a otro día → reprograma (guarda el nuevo publish_at).
  async function reschedule(p: any, k: string) {
    const prev = p.publish_at ? new Date(p.publish_at) : null;
    const time = prev ? `${pad2(prev.getHours())}:${pad2(prev.getMinutes())}` : '09:00';
    const iso = new Date(`${k}T${time}`).toISOString();
    setPosts((ps) => ps.map((x) => (x.id === p.id ? { ...x, status: 'scheduled', publish_at: iso } : x))); // optimista
    try { await fetch('/api/admin/blog', { method: 'POST', body: JSON.stringify({ ...p, status: 'scheduled', publish_at: iso }) }); } catch {}
    await load();
  }

  async function load() { try { const r = await fetch('/api/admin/blog'); const j = await r.json(); setPosts(j.posts || []); } catch {} }
  useEffect(() => { load(); }, []);

  function edit(p: any) {
    const d = p.publish_at ? new Date(p.publish_at) : null;
    const pad = (n: number) => String(n).padStart(2, '0');
    setTitles([]); setTopic('');
    setF({
      ...blank, ...p,
      cover_url: p.cover_url || '',
      pubDate: d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : '',
      pubTime: d ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : '09:00',
    });
  }

  async function suggestTitles() {
    const t = topic || f?.title_es || f?.title_en;
    if (!t) { toast(es ? 'Escribe un tema o título primero.' : 'Type a topic or title first.'); return; }
    setAi(true);
    try {
      const r = await fetch('/api/admin/blog/ai', { method: 'POST', body: JSON.stringify({ mode: 'titles', topic: t, lang }) });
      const j = await r.json();
      if (r.ok && j.titles) setTitles(j.titles);
      else toast(j.code === 'no_key' ? (es ? 'IA no configurada (falta ANTHROPIC_API_KEY).' : 'AI not configured (missing ANTHROPIC_API_KEY).') : (es ? 'La IA no pudo sugerir.' : 'AI could not suggest.'));
    } finally { setAi(false); }
  }

  async function generate() {
    const t = f?.title_es || f?.title_en || topic;
    if (!t) { toast(es ? 'Pon un título primero (o genera uno).' : 'Set a title first (or generate one).'); return; }
    if (!confirm(es ? 'Onyx AI escribirá el artículo en español e inglés a partir del título. ¿Continuar?' : 'Onyx AI will write the article in Spanish and English from the title. Continue?')) return;
    setAi(true);
    try {
      const r = await fetch('/api/admin/blog/ai', { method: 'POST', body: JSON.stringify({ mode: 'generate', title: t }) });
      const j = await r.json();
      if (r.ok && j.article) { setF((s: any) => ({ ...s, ...j.article })); toast(es ? 'Artículo generado. Revísalo antes de publicar.' : 'Article generated. Review before publishing.'); }
      else toast(j.code === 'no_key' ? (es ? 'IA no configurada (falta ANTHROPIC_API_KEY).' : 'AI not configured (missing ANTHROPIC_API_KEY).') : (es ? 'La IA no pudo generar.' : 'AI could not generate.'));
    } finally { setAi(false); }
  }

  async function save() {
    if (!f.title_es && !f.title_en) { toast(es ? 'Falta el título.' : 'Missing title.'); return; }
    const body: any = { ...f };
    if (f.status === 'scheduled') {
      if (!f.pubDate) { toast(es ? 'Elige la fecha de publicación.' : 'Pick a publish date.'); return; }
      body.publish_at = new Date(`${f.pubDate}T${f.pubTime || '09:00'}`).toISOString();
    }
    setBusy(true);
    try {
      const r = await fetch('/api/admin/blog', { method: 'POST', body: JSON.stringify(body) });
      const j = await r.json();
      if (r.ok) { toast(es ? 'Guardado.' : 'Saved.'); setF(null); await load(); }
      else toast((es ? 'No se pudo guardar: ' : 'Could not save: ') + (j.error || ''));
    } finally { setBusy(false); }
  }

  async function del(id: string) {
    if (!confirm(es ? '¿Borrar este artículo?' : 'Delete this article?')) return;
    await fetch('/api/admin/blog', { method: 'DELETE', body: JSON.stringify({ id }) }); await load();
  }

  const statusChip = (s: string) => {
    const map: any = { draft: ['var(--mut)', es ? 'Borrador' : 'Draft'], scheduled: ['var(--amber)', es ? 'Programado' : 'Scheduled'], published: ['var(--green)', es ? 'Publicado' : 'Published'] };
    const [c, l] = map[s] || map.draft;
    return <span className="sk-chip" style={{ color: c, border: `1px solid color-mix(in srgb,${c} 45%,transparent)`, background: `color-mix(in srgb,${c} 12%,transparent)`, fontWeight: 700 }}>{l}</span>;
  };

  // ---- LISTA / CALENDARIO ----
  if (!f) {
    // Datos derivados para el calendario del mes en curso.
    const first = new Date(cursor.y, cursor.m, 1);
    const startDow = (first.getDay() + 6) % 7;
    const daysIn = new Date(cursor.y, cursor.m + 1, 0).getDate();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const monthName = new Date(cursor.y, cursor.m, 1).toLocaleDateString(es ? 'es-ES' : 'en-US', { month: 'long', year: 'numeric' });
    const dows = es ? ['L', 'M', 'X', 'J', 'V', 'S', 'D'] : ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const monthPrefix = `${cursor.y}-${pad2(cursor.m + 1)}`;

    const byDay: Record<string, any[]> = {};
    for (const p of posts) { const k = dateKeyOf(p); if (k) (byDay[k] = byDay[k] || []).push(p); }
    const backlog = posts.filter((p) => p.status === 'draft' && !dateKeyOf(p));
    const cPub = posts.filter((p) => p.status === 'published' && (dateKeyOf(p) || '').startsWith(monthPrefix)).length;
    const cSch = posts.filter((p) => p.status === 'scheduled' && (dateKeyOf(p) || '').startsWith(monthPrefix)).length;

    const chipCol: any = {
      published: ['color-mix(in srgb,var(--green) 16%,transparent)', 'var(--green)'],
      scheduled: ['color-mix(in srgb,var(--amber) 16%,transparent)', 'var(--amber)'],
      draft: ['var(--card2)', 'var(--mut)'],
    };
    const Chip = (p: any, drag: boolean) => (
      <div key={p.id} draggable={drag}
        onDragStart={drag ? (e) => { setDragId(p.id); e.dataTransfer.effectAllowed = 'move'; } : undefined}
        onDragEnd={() => { setDragId(''); setOverDay(''); }}
        onClick={(e) => { e.stopPropagation(); edit(p); }}
        title={p.title_es || p.title_en}
        style={{ fontSize: 10.5, lineHeight: 1.3, background: chipCol[p.status][0], color: chipCol[p.status][1], borderRadius: 5, padding: '2px 5px', marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: drag ? 'grab' : 'pointer', border: '1px solid color-mix(in srgb,' + chipCol[p.status][1] + ' 30%,transparent)' }}>
        {p.status === 'scheduled' && p.publish_at ? `${pad2(new Date(p.publish_at).getHours())}:${pad2(new Date(p.publish_at).getMinutes())} ` : ''}{p.title_es || p.title_en}
      </div>
    );

    const cells: any[] = [];
    for (let i = 0; i < startDow; i++) cells.push(<div key={'e' + i} />);
    for (let d = 1; d <= daysIn; d++) {
      const k = dayKey(cursor.y, cursor.m, d);
      const cellDate = new Date(cursor.y, cursor.m, d);
      const past = cellDate < today;
      const isToday = cellDate.getTime() === today.getTime();
      const list = byDay[k] || [];
      const canDrop = !past && !!dragId;
      cells.push(
        <div key={k}
          onDragOver={canDrop ? (e) => { e.preventDefault(); setOverDay(k); } : undefined}
          onDragLeave={() => setOverDay((o) => (o === k ? '' : o))}
          onDrop={canDrop ? (e) => { e.preventDefault(); const p = posts.find((x) => x.id === dragId); if (p) reschedule(p, k); setOverDay(''); setDragId(''); } : undefined}
          onClick={() => !past && newOn(k)}
          style={{ border: '1px solid ' + (overDay === k ? 'var(--brand)' : 'var(--line)'), outline: isToday ? '1.5px solid var(--brand)' : 'none', borderRadius: 10, padding: '5px 6px', minHeight: 92, background: overDay === k ? 'color-mix(in srgb,var(--brand) 12%,transparent)' : (past ? 'transparent' : 'var(--card)'), opacity: past ? 0.5 : 1, cursor: past ? 'default' : 'pointer', overflow: 'hidden' }}>
          <div style={{ fontSize: 11, color: isToday ? 'var(--brand)' : 'var(--mut)', fontWeight: isToday ? 700 : 500, marginBottom: 3 }}>{d}</div>
          {list.slice(0, 3).map((p) => Chip(p, p.status !== 'published' && !past))}
          {list.length > 3 && <div style={{ fontSize: 10, color: 'var(--mut)' }}>+{list.length - 3}</div>}
        </div>
      );
    }

    return (
      <div>
        <div className="row between" style={{ alignItems: 'flex-start', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>📝 Blog</h3>
            <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>{es ? 'Artículos públicos indexables por Google. Genera con Onyx AI (ES/EN) y programa la publicación.' : 'Public, Google-indexable articles. Generate with Onyx AI (ES/EN) and schedule publishing.'}</p>
          </div>
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <div style={{ display: 'inline-flex', gap: 3, background: 'var(--card2)', borderRadius: 18, padding: 3 }}>
              {([['cal', es ? '📅 Calendario' : '📅 Calendar'], ['list', es ? '☰ Lista' : '☰ List']] as const).map(([v, l]) => (
                <button key={v} type="button" onClick={() => setView(v)} className="btn" style={{ padding: '4px 12px', fontSize: 12.5, border: 'none', borderRadius: 15, background: view === v ? 'var(--brand)' : 'transparent', color: view === v ? '#0a0d14' : 'var(--mut)' }}>{l}</button>
              ))}
            </div>
            <button className="btn btn-primary" onClick={() => { setTitles([]); setTopic(''); setF({ ...blank }); }}>＋ {es ? 'Nuevo' : 'New'}</button>
          </div>
        </div>

        {posts.length === 0 && <div className="card muted">{es ? 'Aún no hay artículos.' : 'No articles yet.'}</div>}

        {/* -------- CALENDARIO -------- */}
        {view === 'cal' && (
          <>
            <div className="row between" style={{ alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
              <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                <button type="button" className="btn btn-ghost" style={{ padding: '3px 11px', fontSize: 17, lineHeight: 1 }} onClick={() => setCursor((v) => { const m = v.m - 1; return m < 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m }; })}>‹</button>
                <b style={{ fontSize: 14, textTransform: 'capitalize', minWidth: 130, textAlign: 'center' }}>{monthName}</b>
                <button type="button" className="btn btn-ghost" style={{ padding: '3px 11px', fontSize: 17, lineHeight: 1 }} onClick={() => setCursor((v) => { const m = v.m + 1; return m > 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m }; })}>›</button>
                <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => { const d = new Date(); setCursor({ y: d.getFullYear(), m: d.getMonth() }); }}>{es ? 'Hoy' : 'Today'}</button>
              </div>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                <span className="sk-chip" style={{ color: 'var(--green)', background: 'color-mix(in srgb,var(--green) 12%,transparent)', border: '1px solid color-mix(in srgb,var(--green) 40%,transparent)' }}>● {cPub} {es ? 'publicados' : 'published'}</span>
                <span className="sk-chip" style={{ color: 'var(--amber)', background: 'color-mix(in srgb,var(--amber) 12%,transparent)', border: '1px solid color-mix(in srgb,var(--amber) 40%,transparent)' }}>● {cSch} {es ? 'programados' : 'scheduled'}</span>
                <span className="sk-chip" style={{ color: 'var(--mut)', background: 'var(--card2)', border: '1px solid var(--line)' }}>● {backlog.length} {es ? 'borradores' : 'drafts'}</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 200px', gap: 14, alignItems: 'start' }}>
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6, marginBottom: 6 }}>
                  {dows.map((w, i) => <span key={i} style={{ textAlign: 'center', fontSize: 10.5, color: 'var(--mut)', fontWeight: 600 }}>{w}</span>)}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6 }}>{cells}</div>
                <p className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>{es ? 'Clic en un día → nuevo artículo con esa fecha · clic en un chip → editar · arrastra un chip a otro día → reprogramar.' : 'Click a day → new article on that date · click a chip → edit · drag a chip to another day → reschedule.'}</p>
              </div>

              {/* Bandeja de borradores sin fecha */}
              <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 11 }}>
                <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--mut)', marginBottom: 9 }}>{es ? 'Sin programar' : 'Unscheduled'}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {backlog.length === 0 && <div className="muted" style={{ fontSize: 12 }}>{es ? 'Nada pendiente.' : 'Nothing pending.'}</div>}
                  {backlog.map((p) => (
                    <div key={p.id} draggable onDragStart={(e) => { setDragId(p.id); e.dataTransfer.effectAllowed = 'move'; }} onDragEnd={() => { setDragId(''); setOverDay(''); }}
                      onClick={() => edit(p)} title={p.title_es || p.title_en}
                      style={{ fontSize: 11.5, background: 'var(--card2)', color: 'var(--tx)', borderRadius: 7, padding: '7px 9px', cursor: 'grab', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', border: '1px solid var(--line)' }}>✍️ {p.title_es || p.title_en || (es ? '(sin título)' : '(untitled)')}</div>
                  ))}
                </div>
                {backlog.length > 0 && <div style={{ borderTop: '1px dashed var(--line)', marginTop: 11, paddingTop: 9, fontSize: 11, color: 'var(--mut)' }}>{es ? 'Arrastra al calendario para ponerle fecha.' : 'Drag onto the calendar to schedule.'}</div>}
              </div>
            </div>
          </>
        )}

        {/* -------- LISTA -------- */}
        {view === 'list' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {posts.map((p) => (
              <div key={p.id} className="card" style={{ margin: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><b>{p.title_es || p.title_en}</b> {statusChip(p.status)}</div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>/blog/{p.slug}{p.status === 'scheduled' && p.publish_at ? ` · ${new Date(p.publish_at).toLocaleString(es ? 'es-ES' : 'en-US')}` : ''}</div>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  {p.status === 'published' && <a className="btn btn-ghost" style={{ fontSize: 12 }} href={`/blog/${p.slug}`} target="_blank" rel="noreferrer">{es ? 'Ver' : 'View'}</a>}
                  <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => edit(p)}>✎ {es ? 'Editar' : 'Edit'}</button>
                  <button className="btn btn-ghost" style={{ fontSize: 12, color: 'var(--red)' }} onClick={() => del(p.id)}>✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ---- EDITOR ----
  return (
    <div>
      <div className="row between" style={{ alignItems: 'center', marginBottom: 12 }}>
        <h3>{f.id ? (es ? 'Editar artículo' : 'Edit article') : (es ? 'Nuevo artículo' : 'New article')}</h3>
        <button className="btn btn-ghost" onClick={() => setF(null)}>← {es ? 'Volver' : 'Back'}</button>
      </div>

      {/* IA: sugerir títulos */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{es ? '1) Escribe un tema o un título y deja que Onyx AI te sugiera títulos SEO.' : '1) Type a topic or a title and let Onyx AI suggest SEO titles.'}</div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={es ? 'Ej: gestión de riesgo en cuentas de fondeo' : 'e.g. risk management on funded accounts'} style={{ flex: '1 1 320px', margin: 0 }} />
          <button className="btn btn-ghost" onClick={suggestTitles} disabled={ai}>{ai ? '…' : (es ? '✨ Sugerir títulos' : '✨ Suggest titles')}</button>
        </div>
        {titles.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
            {titles.map((t, i) => (
              <button key={i} type="button" onClick={() => set(es ? 'title_es' : 'title_en', t)} style={{ textAlign: 'left', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--tx)', cursor: 'pointer', fontSize: 13.5 }}>{t}</button>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 320px' }}><span className="muted" style={{ fontSize: 12 }}>Título (ES)</span><input value={f.title_es} onChange={(e) => set('title_es', e.target.value)} style={{ margin: '4px 0 0' }} /></div>
          <div style={{ flex: '1 1 320px' }}><span className="muted" style={{ fontSize: 12 }}>Title (EN)</span><input value={f.title_en} onChange={(e) => set('title_en', e.target.value)} style={{ margin: '4px 0 0' }} /></div>
        </div>

        {/* IA: generar artículo completo */}
        <div className="card" style={{ background: 'color-mix(in srgb,var(--brand) 6%, var(--card))' }}>
          <div className="row between" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div className="muted" style={{ fontSize: 12.5 }}>{es ? '2) Onyx AI escribe el artículo completo en español e inglés a partir del título.' : '2) Onyx AI writes the full article in Spanish and English from the title.'}</div>
            <button className="btn btn-primary" onClick={generate} disabled={ai}>{ai ? '…' : (es ? '✨ Generar artículo (ES/EN)' : '✨ Generate article (ES/EN)')}</button>
          </div>
        </div>

        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 320px' }}><span className="muted" style={{ fontSize: 12 }}>{es ? 'Resumen (ES)' : 'Excerpt (ES)'}</span><textarea value={f.excerpt_es} onChange={(e) => set('excerpt_es', e.target.value)} rows={2} style={{ width: '100%', margin: '4px 0 0' }} /></div>
          <div style={{ flex: '1 1 320px' }}><span className="muted" style={{ fontSize: 12 }}>{es ? 'Resumen (EN)' : 'Excerpt (EN)'}</span><textarea value={f.excerpt_en} onChange={(e) => set('excerpt_en', e.target.value)} rows={2} style={{ width: '100%', margin: '4px 0 0' }} /></div>
        </div>
        <div><span className="muted" style={{ fontSize: 12 }}>Cuerpo (ES) · markdown</span><textarea value={f.body_es} onChange={(e) => set('body_es', e.target.value)} rows={10} style={{ width: '100%', margin: '4px 0 0', fontFamily: 'ui-monospace,monospace', fontSize: 13 }} /></div>
        <div><span className="muted" style={{ fontSize: 12 }}>Body (EN) · markdown</span><textarea value={f.body_en} onChange={(e) => set('body_en', e.target.value)} rows={10} style={{ width: '100%', margin: '4px 0 0', fontFamily: 'ui-monospace,monospace', fontSize: 13 }} /></div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 320px' }}><span className="muted" style={{ fontSize: 12 }}>{es ? 'Etiquetas (coma)' : 'Tags (comma)'}</span><input value={f.tags} onChange={(e) => set('tags', e.target.value)} style={{ margin: '4px 0 0' }} /></div>
          <div style={{ flex: '1 1 320px' }}><span className="muted" style={{ fontSize: 12 }}>{es ? 'Imagen de portada (URL) — opcional' : 'Cover image (URL) — optional'}</span><input value={f.cover_url} onChange={(e) => set('cover_url', e.target.value)} style={{ margin: '4px 0 0' }} /></div>
        </div>

        {/* Estado + programación */}
        <div className="card">
          <span className="muted" style={{ fontSize: 12 }}>{es ? 'Publicación' : 'Publishing'}</span>
          <div className="row" style={{ gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
            {[['draft', es ? 'Borrador' : 'Draft'], ['scheduled', es ? 'Programar' : 'Schedule'], ['published', es ? 'Publicar ahora' : 'Publish now']].map(([v, l]) => (
              <button key={v} type="button" onClick={() => set('status', v)} className="btn btn-ghost" style={{ fontSize: 12.5, border: '1px solid ' + (f.status === v ? 'var(--brand)' : 'var(--line)'), background: f.status === v ? 'color-mix(in srgb,var(--brand) 18%,transparent)' : 'transparent' }}>{l}</button>
            ))}
          </div>
          {f.status === 'scheduled' && (
            <div style={{ marginTop: 12 }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{es ? 'Elige el día y la hora (tu hora local). Se publicará solo.' : 'Pick the day and time (your local time). It will publish automatically.'}</div>
              <div className="row" style={{ gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <DayCalendar value={f.pubDate} onChange={(d) => set('pubDate', d)} es={es} />
                <div><span className="muted" style={{ fontSize: 12 }}>{es ? 'Hora' : 'Time'}</span>
                  <select value={f.pubTime} onChange={(e) => set('pubTime', e.target.value)} style={{ margin: '4px 0 0', display: 'block' }}>
                    {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {f.pubDate && <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>{new Date(`${f.pubDate}T${f.pubTime}`).toLocaleString(es ? 'es-ES' : 'en-US')}</div>}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="row" style={{ gap: 8, marginTop: 4 }}>
          <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? '…' : (es ? 'Guardar' : 'Save')}</button>
          <button className="btn btn-ghost" onClick={() => setF(null)}>{es ? 'Cancelar' : 'Cancel'}</button>
        </div>
      </div>
    </div>
  );
}
