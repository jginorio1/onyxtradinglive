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
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));

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

  // ---- LISTA ----
  if (!f) {
    return (
      <div>
        <div className="row between" style={{ alignItems: 'center', marginBottom: 6 }}>
          <div>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>📝 Blog</h3>
            <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>{es ? 'Artículos públicos indexables por Google. Genera con Onyx AI (ES/EN) y programa la publicación.' : 'Public, Google-indexable articles. Generate with Onyx AI (ES/EN) and schedule publishing.'}</p>
          </div>
          <button className="btn btn-primary" onClick={() => { setTitles([]); setTopic(''); setF({ ...blank }); }}>＋ {es ? 'Nuevo artículo' : 'New article'}</button>
        </div>
        {posts.length === 0 && <div className="card muted" style={{ marginTop: 12 }}>{es ? 'Aún no hay artículos.' : 'No articles yet.'}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
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
