'use client';
import { useEffect, useState, type ChangeEvent } from 'react';
import { toast, confirmDialog } from '@/lib/toast';
import { useLang } from '@/lib/lang';
import BlogKeywords from './BlogKeywords';
import BlogAutopilot from './BlogAutopilot';
import BlogAudit from './BlogAudit';
import BlogPreview from './previews/BlogPreview';
import SocialShare from './SocialShare';

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

// Slug corto en el navegador (para la sugerencia del editor). El servidor lo
// vuelve a normalizar y garantiza que sea único al guardar.
const STOP_W = new Set('a al ante bajo con de del desde el en entre hacia hasta la las lo los mas o para por que se sin sobre un una unos y the a an of to for and or in on how what why your you is are'.split(' '));
function clientShortSlug(title: string, keyword = '', words = 6): string {
  const base = `${keyword} ${title}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const parts = base.split('-').filter((w) => w && !STOP_W.has(w));
  const seen = new Set<string>(); const out: string[] = [];
  for (const w of parts) { if (seen.has(w)) continue; seen.add(w); out.push(w); if (out.length >= words) break; }
  return out.join('-').slice(0, 70).replace(/-+$/, '');
}

const TIMES = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);
const blank = { id: '', slug: '', slug_en: '', author_id: '', title_es: '', title_en: '', excerpt_es: '', excerpt_en: '', body_es: '', body_en: '', cover_url: '', cover_alt_es: '', cover_alt_en: '', tags: '', status: 'draft', pubDate: '', pubTime: '09:00' };

// Lee un File como data URL base64 (para subir la imagen al Storage).
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ''));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// Plantilla de gráfica ilustrativa que el editor puede insertar en el cuerpo.
const CHART_TPL = [
  ':::chart',
  'type: line',
  'title: Título de la gráfica',
  'alt: Describe qué muestra la gráfica',
  'source: Datos de ejemplo · Onyx Trading Live',
  'x: [Ene, Feb, Mar, Abr, May]',
  'y: [2, 4, 3, 6, 5]',
  ':::',
].join('\n');

// Cronómetro en vivo hasta la publicación. Se ve tranquilo si falta mucho y
// urgente (MM:SS, rojo) en la última hora. Al llegar a 0 marca "vencido".
function Countdown({ iso, es, compact = false }: { iso: string; es: boolean; compact?: boolean }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);
  const ms = new Date(iso).getTime() - now;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (ms <= 0) return <span style={{ color: 'var(--red)', fontWeight: 700, whiteSpace: 'nowrap' }}>⚠ {es ? 'vencido' : 'overdue'}</span>;
  const d = Math.floor(ms / 864e5), h = Math.floor((ms % 864e5) / 36e5), m = Math.floor((ms % 36e5) / 6e4), s = Math.floor((ms % 6e4) / 1e3);
  const txt = ms > 864e5 ? `${d}d ${h}h ${m}m` : ms > 36e5 ? `${h}h ${pad(m)}m` : `${pad(m)}:${pad(s)}`;
  const urgent = ms <= 6e5; // últimos 10 min
  return <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', fontWeight: urgent ? 800 : 600, ...(urgent ? { color: 'var(--red)' } : {}) }}>⏳ {compact ? '' : (es ? 'en ' : '')}{txt}</span>;
}

// Plantel de AUTORES del blog (varios). Cada uno con perfil: nombre, tipo de trader,
// tiempo/experiencia, bio y foto. Alimenta la firma del artículo y el schema Person.
function BlogAuthorCard({ es, roster, reload }: { es: boolean; roster: any; reload: () => void }) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<any[]>([]);
  const [defaultId, setDefaultId] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (roster) { setList(roster.list || []); setDefaultId(roster.defaultId || ''); } }, [roster]);
  const rid = () => 'a' + Math.random().toString(36).slice(2, 8);
  const setA = (id: string, k: string, v: string) => setList((L) => L.map((a) => (a.id === id ? { ...a, [k]: v } : a)));
  const addA = () => setList((L) => [...L, { id: rid(), name: es ? 'Nuevo autor' : 'New author', trader_es: '', trader_en: '', experience_es: '', experience_en: '', bio_es: '', bio_en: '', avatar_url: '', url: '' }]);
  const delA = (id: string) => { if (list.length <= 1) { toast(es ? 'Debe quedar al menos un autor.' : 'At least one author required.'); return; } setList((L) => L.filter((a) => a.id !== id)); if (defaultId === id) setDefaultId(list.find((a) => a.id !== id)?.id || ''); };
  async function save() {
    setBusy(true);
    try {
      const r = await fetch('/api/admin/blog/author', { method: 'PATCH', body: JSON.stringify({ list, defaultId }) });
      if (r.ok) { toast(es ? 'Autores guardados.' : 'Authors saved.', 'ok'); reload(); } else toast(es ? 'No se pudo guardar.' : 'Could not save.');
    } finally { setBusy(false); }
  }
  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="row between" style={{ alignItems: 'center', cursor: 'pointer' }} onClick={() => setOpen((o) => !o)}>
        <div>
          <b style={{ fontSize: 14 }}>✍️ {es ? 'Autores del blog (E-E-A-T)' : 'Blog authors (E-E-A-T)'}</b>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{es ? 'Varios autores con perfil (tipo de trader, experiencia, bio, foto). Cada artículo guarda su autor.' : 'Multiple authors with profile (trader type, experience, bio, photo). Each article keeps its author.'} · {list.length} {es ? 'autores' : 'authors'}</div>
        </div>
        <span className="btn btn-ghost" style={{ fontSize: 12 }}>{open ? (es ? 'Ocultar' : 'Hide') : (es ? 'Gestionar' : 'Manage')}</span>
      </div>
      {open && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {list.map((a) => (
            <div key={a.id} style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 12, background: 'var(--bg2)' }}>
              <div className="row between" style={{ alignItems: 'center', marginBottom: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <input type="radio" name="defAuthor" checked={defaultId === a.id} onChange={() => setDefaultId(a.id)} /> {es ? 'Por defecto' : 'Default'}
                </label>
                <button className="btn btn-ghost" style={{ fontSize: 12, color: 'var(--red)' }} onClick={() => delA(a.id)}>✕</button>
              </div>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 200px' }}><span className="muted" style={{ fontSize: 12 }}>{es ? 'Nombre' : 'Name'}</span><input value={a.name} onChange={(e) => setA(a.id, 'name', e.target.value)} style={{ margin: '4px 0 0' }} /></div>
                <div style={{ flex: '1 1 200px' }}><span className="muted" style={{ fontSize: 12 }}>{es ? 'Foto (URL)' : 'Photo (URL)'}</span><input value={a.avatar_url} onChange={(e) => setA(a.id, 'avatar_url', e.target.value)} placeholder="https://…" style={{ margin: '4px 0 0' }} /></div>
              </div>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                <div style={{ flex: '1 1 160px' }}><span className="muted" style={{ fontSize: 12 }}>{es ? 'Tipo de trader (ES)' : 'Trader type (ES)'}</span><input value={a.trader_es} onChange={(e) => setA(a.id, 'trader_es', e.target.value)} placeholder={es ? 'Day trader, analista…' : ''} style={{ margin: '4px 0 0' }} /></div>
                <div style={{ flex: '1 1 160px' }}><span className="muted" style={{ fontSize: 12 }}>{es ? 'Tipo de trader (EN)' : 'Trader type (EN)'}</span><input value={a.trader_en} onChange={(e) => setA(a.id, 'trader_en', e.target.value)} placeholder="Day trader, analyst…" style={{ margin: '4px 0 0' }} /></div>
              </div>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                <div style={{ flex: '1 1 160px' }}><span className="muted" style={{ fontSize: 12 }}>{es ? 'Experiencia/tiempo (ES)' : 'Experience/time (ES)'}</span><input value={a.experience_es} onChange={(e) => setA(a.id, 'experience_es', e.target.value)} placeholder={es ? '8 años en forex' : ''} style={{ margin: '4px 0 0' }} /></div>
                <div style={{ flex: '1 1 160px' }}><span className="muted" style={{ fontSize: 12 }}>{es ? 'Experiencia/tiempo (EN)' : 'Experience/time (EN)'}</span><input value={a.experience_en} onChange={(e) => setA(a.id, 'experience_en', e.target.value)} placeholder="8 years in forex" style={{ margin: '4px 0 0' }} /></div>
              </div>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                <div style={{ flex: '1 1 260px' }}><span className="muted" style={{ fontSize: 12 }}>{es ? 'Bio (ES)' : 'Bio (ES)'}</span><textarea value={a.bio_es} onChange={(e) => setA(a.id, 'bio_es', e.target.value)} rows={2} style={{ width: '100%', margin: '4px 0 0' }} /></div>
                <div style={{ flex: '1 1 260px' }}><span className="muted" style={{ fontSize: 12 }}>{es ? 'Bio (EN)' : 'Bio (EN)'}</span><textarea value={a.bio_en} onChange={(e) => setA(a.id, 'bio_en', e.target.value)} rows={2} style={{ width: '100%', margin: '4px 0 0' }} /></div>
              </div>
              <div style={{ marginTop: 6 }}><span className="muted" style={{ fontSize: 12 }}>{es ? 'Enlace (opcional, LinkedIn…)' : 'Link (optional, LinkedIn…)'}</span><input value={a.url} onChange={(e) => setA(a.id, 'url', e.target.value)} placeholder="https://…" style={{ margin: '4px 0 0' }} /></div>
            </div>
          ))}
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-ghost" onClick={addA} style={{ fontSize: 13 }}>＋ {es ? 'Añadir autor' : 'Add author'}</button>
            <button className="btn btn-primary" onClick={save} disabled={busy} style={{ fontSize: 13 }}>{busy ? '…' : (es ? 'Guardar autores' : 'Save authors')}</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BlogEditor() {
  const { lang } = useLang() as { lang: 'es' | 'en' };
  const es = lang !== 'en';
  const [posts, setPosts] = useState<any[]>([]);
  const [f, setF] = useState<any>(null);       // artículo en edición (null = lista)
  const [busy, setBusy] = useState(false);
  const [ai, setAi] = useState(false);
  const [topic, setTopic] = useState('');
  const [titles, setTitles] = useState<string[]>([]);
  const [kind, setKind] = useState<'guide' | 'comparison' | 'list' | 'mistakes'>('guide');
  const [view, setView] = useState<'cal' | 'list'>('cal');   // vista del blog: calendario o lista
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [dragId, setDragId] = useState('');                  // id del artículo que se arrastra
  const [overDay, setOverDay] = useState('');                // día resaltado al arrastrar encima
  const [origin, setOrigin] = useState('');                  // origen absoluto (para abrir enlaces desde la app instalada)
  const [authors, setAuthors] = useState<any>(null);         // plantel de autores
  const loadAuthors = () => { fetch('/api/admin/blog/author').then((r) => r.json()).then(setAuthors).catch(() => {}); };
  useEffect(() => { try { setOrigin(window.location.origin); } catch {} loadAuthors(); }, []);
  // URL pública absoluta de un artículo. Absoluta = evita el error "dirección no válida"
  // al abrir target=_blank dentro de la app instalada (Safari standalone).
  const postUrl = (p: any) => es ? `${origin}/blog/${p.slug || ''}` : `${origin}/en/blog/${p.slug_en || p.slug || ''}`;
  // Abre un enlace sin romper en la app instalada: si es PWA standalone (Safari no
  // sabe abrir target=_blank y muestra "dirección no válida"), navega en la misma
  // ventana; en navegador normal abre pestaña nueva.
  function openPost(url: string) {
    if (!url) return;
    try {
      const standalone = (navigator as any).standalone === true || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
      if (standalone) { window.location.assign(url); return; }
      const w = window.open(url, '_blank', 'noopener');
      if (!w) window.location.assign(url);
    } catch { try { window.location.assign(url); } catch {} }
  }
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));

  // Acción rápida "＋ Post" del panel admin (botón contextual de la barra lateral).
  useEffect(() => {
    const onNew = (e: any) => { if (e?.detail === 'blog') { setTitles([]); setTopic(''); setF({ ...blank }); } };
    window.addEventListener('admin-quick-create', onNew as any);
    return () => window.removeEventListener('admin-quick-create', onNew as any);
  }, []);

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

  const isOverdue = (p: any) => p.status === 'scheduled' && p.publish_at && new Date(p.publish_at).getTime() <= Date.now();

  async function load(safety = true) {
    try {
      const r = await fetch('/api/admin/blog'); const j = await r.json();
      const list = j.posts || [];
      setPosts(list);
      // Red de seguridad: si algún programado ya venció, lo publicamos al instante
      // (sin esperar al cron). Evita que se quede colgado en "programado".
      if (safety) {
        const due = list.filter(isOverdue);
        if (due.length) {
          await Promise.all(due.map((p: any) => fetch('/api/admin/blog', { method: 'POST', body: JSON.stringify({ ...p, status: 'published', published_at: new Date().toISOString() }) }).catch(() => {})));
          const r2 = await fetch('/api/admin/blog'); const j2 = await r2.json(); setPosts(j2.posts || []);
          toast(es ? `${due.length} artículo(s) vencido(s) publicado(s).` : `${due.length} overdue article(s) published.`);
        }
      }
    } catch {}
  }
  useEffect(() => { load(); }, []);

  // ¿Le falta contenido en algún idioma? Devuelve la lista de lo que falta.
  // Un artículo publicado sin ES (o sin EN) hace que esa URL caiga al otro idioma.
  const missingLangs = (p: any) => {
    const m: string[] = [];
    if (!(p.title_es || '').trim()) m.push(es ? 'Título ES' : 'Title ES');
    if (!(p.title_en || '').trim()) m.push(es ? 'Título EN' : 'Title EN');
    if (!(p.body_es || '').trim()) m.push(es ? 'Cuerpo ES' : 'Body ES');
    if (!(p.body_en || '').trim()) m.push(es ? 'Cuerpo EN' : 'Body EN');
    return m;
  };

  // Publicar un programado ahora mismo (manual, adelantándose a su hora).
  async function publishNow(p: any) {
    if (!(await confirmDialog(es ? '¿Publicar ahora este artículo?' : 'Publish this article now?'))) return;
    const iso = new Date().toISOString();
    setPosts((ps) => ps.map((x) => (x.id === p.id ? { ...x, status: 'published', published_at: iso } : x)));
    try { await fetch('/api/admin/blog', { method: 'POST', body: JSON.stringify({ ...p, status: 'published', published_at: iso }) }); } catch {}
    await load(false);
  }

  function edit(p: any) {
    const d = p.publish_at ? new Date(p.publish_at) : null;
    const pad = (n: number) => String(n).padStart(2, '0');
    setTitles([]); setTopic('');
    setF({
      ...blank, ...p, _origSlug: p.slug || '',
      cover_url: p.cover_url || '',
      cover_alt_es: p.cover_alt_es || '', cover_alt_en: p.cover_alt_en || '',
      pubDate: d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : '',
      pubTime: d ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : '09:00',
    });
  }

  async function suggestTitles() {
    const t = topic || f?.title_es || f?.title_en;
    if (!t) { toast(es ? 'Escribe un tema o título primero.' : 'Type a topic or title first.'); return; }
    setAi(true);
    try {
      const r = await fetch('/api/admin/blog/ai', { method: 'POST', body: JSON.stringify({ mode: 'titles', topic: t, lang, kind }) });
      const j = await r.json();
      if (r.ok && j.titles) setTitles(j.titles);
      else toast(j.code === 'no_key' ? (es ? 'IA no configurada (falta ANTHROPIC_API_KEY).' : 'AI not configured (missing ANTHROPIC_API_KEY).') : ((es ? 'La IA no pudo sugerir.' : 'AI could not suggest.') + (j.detail ? ` · ${j.detail}` : '')));
    } finally { setAi(false); }
  }

  async function generate() {
    const t = f?.title_es || f?.title_en || topic;
    if (!t) { toast(es ? 'Pon un título primero (o genera uno).' : 'Set a title first (or generate one).'); return; }
    if (!(await confirmDialog(es ? 'Onyx AI escribirá el artículo en español e inglés a partir del título. ¿Continuar?' : 'Onyx AI will write the article in Spanish and English from the title. Continue?'))) return;
    setAi(true);
    try {
      const r = await fetch('/api/admin/blog/ai', { method: 'POST', body: JSON.stringify({ mode: 'generate', title: t, kind }) });
      const j = await r.json();
      if (r.ok && j.article) {
        setF((s: any) => ({ ...s, ...j.article }));
        const tgt = j.target ? (es ? j.target.es : j.target.en) : '';
        toast((es ? 'Artículo generado. Revísalo antes de publicar.' : 'Article generated. Review before publishing.') + (tgt ? (es ? ` Keyword objetivo: “${tgt}”.` : ` Target keyword: “${tgt}”.`) : ''), 'ok');
      }
      else toast(j.code === 'no_key' ? (es ? 'IA no configurada (falta ANTHROPIC_API_KEY).' : 'AI not configured (missing ANTHROPIC_API_KEY).') : ((es ? 'La IA no pudo generar.' : 'AI could not generate.') + (j.detail ? ` · ${j.detail}` : '')));
    } finally { setAi(false); }
  }

  // Mejora TODOS los publicados de una vez: enlaces internos + FAQ + imagen + slug
  // corto ES/EN. Procesa uno a uno (sin timeout) con barra de progreso.
  const [bulk, setBulk] = useState<{ running: boolean; done: number; total: number }>({ running: false, done: 0, total: 0 });
  async function bulkEnhance() {
    // Publicados Y programados (los borradores se dejan fuera).
    const list = posts.filter((p) => p.status === 'published' || p.status === 'scheduled');
    if (!list.length) { toast(es ? 'No hay artículos publicados ni programados.' : 'No published or scheduled articles.'); return; }
    if (!await confirmDialog(es
      ? `Onyx AI mejorará el SEO de ${list.length} artículo(s) (publicados y programados): enlaces internos a otros posts, FAQ, imagen de contenido y slug corto en español e inglés. NO reescribe tu texto. Conserva el estado y la fecha de cada uno. Los cambios de URL en los ya publicados crean redirección 301. ¿Continuar?`
      : `Onyx AI will improve SEO of ${list.length} article(s) (published and scheduled): internal links, FAQ, content image and short slug in Spanish and English. It won't rewrite your text. It keeps each one's status and date. URL changes on already-published ones create a 301 redirect. Continue?`)) return;
    setBulk({ running: true, done: 0, total: list.length });
    let ok = 0, aiOk = 0, noKey = false;
    for (const p of list) {
      try {
        let bodyEs = p.body_es, bodyEn = p.body_en, suggested = '', changed = false;
        try {
          const r = await fetch('/api/admin/blog/ai', { method: 'POST', body: JSON.stringify({ mode: 'enhance', id: p.id }) });
          const j = await r.json();
          if (j?.code === 'no_key') noKey = true;
          if (r.ok && (j.body_es || j.body_en)) {
            if ((j.body_es && j.body_es !== p.body_es) || (j.body_en && j.body_en !== p.body_en)) changed = true;
            bodyEs = j.body_es || bodyEs; bodyEn = j.body_en || bodyEn; suggested = j.suggestedSlug || '';
          }
        } catch {}
        if (changed) aiOk++;
        const kw = (p.tags || '').split(',')[0] || '';
        const slug = suggested || clientShortSlug(p.title_es || p.title_en || '', kw) || p.slug;
        const slug_en = clientShortSlug(p.title_en || p.title_es || '', kw) || '';
        // Conserva estado y fecha propios de cada post (no publica los programados).
        await fetch('/api/admin/blog', { method: 'POST', body: JSON.stringify({ ...p, body_es: bodyEs, body_en: bodyEn, slug, slug_en }) });
        ok++;
      } catch {}
      setBulk((b) => ({ ...b, done: b.done + 1 }));
    }
    setBulk({ running: false, done: 0, total: 0 });
    if (noKey || aiOk === 0) {
      toast(es
        ? `Slug ES/EN aplicado a ${ok}/${list.length}. Pero la IA no añadió enlaces/FAQ/imagen (0 mejorados). Revisa que ANTHROPIC_API_KEY esté configurada.`
        : `ES/EN slug applied to ${ok}/${list.length}. But AI did not add links/FAQ/image (0 enhanced). Check that ANTHROPIC_API_KEY is set.`, 'warn');
    } else {
      toast(es
        ? `✓ Listo: ${aiOk}/${list.length} mejorados con IA (enlaces, FAQ, imagen) · slug ES/EN en ${ok}.`
        : `✓ Done: ${aiOk}/${list.length} enhanced by AI (links, FAQ, image) · ES/EN slug on ${ok}.`, 'ok');
    }
    await load();
  }

  // Completa el idioma que falte en TODOS los artículos: si a un post le falta el
  // cuerpo en ES o EN, lo traduce del que sí tiene (evita mezclar idiomas).
  async function bulkComplete() {
    // Incompletos = falta un idioma O uno está mucho más corto que el otro (stub/mezclado).
    const gap = posts.filter((p) => {
      const lenEs = String(p.body_es || '').trim().length, lenEn = String(p.body_en || '').trim().length;
      const max = Math.max(lenEs, lenEn), min = Math.min(lenEs, lenEn);
      if (max === 0) return false;
      return min === 0 || min < max * 0.6;
    });
    if (!gap.length) { toast(es ? 'Todos los artículos ya están completos en ambos idiomas. ✓' : 'All articles already complete in both languages. ✓', 'ok'); return; }
    if (!await confirmDialog(es
      ? `${gap.length} artículo(s) tienen un idioma incompleto o desbalanceado. Onyx AI lo traducirá/regenerará (ES↔EN) a partir del idioma más completo, conservando estructura, enlaces, FAQ e imágenes. ¿Continuar?`
      : `${gap.length} article(s) have an incomplete or unbalanced language. Onyx AI will translate/regenerate it (ES↔EN) from the more complete language, keeping structure, links, FAQ and images. Continue?`)) return;
    setBulk({ running: true, done: 0, total: gap.length });
    let ok = 0, noKey = false;
    for (const p of gap) {
      try {
        const r = await fetch('/api/admin/blog/ai', { method: 'POST', body: JSON.stringify({ mode: 'complete', id: p.id, force: true }) });
        const j = await r.json();
        if (j?.code === 'no_key') noKey = true;
        if (r.ok && j.patch && Object.keys(j.patch).length) {
          await fetch('/api/admin/blog', { method: 'POST', body: JSON.stringify({ ...p, ...j.patch }) });
          ok++;
        }
      } catch {}
      setBulk((b) => ({ ...b, done: b.done + 1 }));
    }
    setBulk({ running: false, done: 0, total: 0 });
    toast(noKey && ok === 0
      ? (es ? 'La IA no está configurada (ANTHROPIC_API_KEY).' : 'AI is not configured (ANTHROPIC_API_KEY).')
      : (es ? `✓ Idiomas completados en ${ok}/${gap.length} artículos.` : `✓ Languages completed on ${ok}/${gap.length} articles.`), (noKey && ok === 0) ? 'error' : 'ok');
    await load();
  }

  // Mejora un post EXISTENTE sin reescribirlo: enlaces internos + FAQ + imagen.
  // Abre el editor con el resultado para revisar antes de guardar.
  async function enhanceSeo(p: any) {
    if (!await confirmDialog(es
      ? 'Onyx AI añadirá enlaces internos a otros posts, una imagen de contenido y una sección de preguntas frecuentes, SIN reescribir tu texto. Revisa el resultado antes de guardar. ¿Continuar?'
      : 'Onyx AI will add internal links to other posts, a content image and an FAQ section WITHOUT rewriting your text. Review before saving. Continue?')) return;
    setAi(true);
    try {
      const r = await fetch('/api/admin/blog/ai', { method: 'POST', body: JSON.stringify({ mode: 'enhance', id: p.id }) });
      const j = await r.json();
      if (r.ok && (j.body_es || j.body_en)) {
        edit(p);
        setF((s: any) => ({ ...s, body_es: j.body_es || s.body_es, body_en: j.body_en || s.body_en, _suggestedSlug: j.suggestedSlug || '' }));
        toast(es ? '✨ Mejorado. Revisa el texto y guarda.' : '✨ Enhanced. Review and save.', 'ok');
      } else toast(j.code === 'no_key' ? (es ? 'IA no configurada.' : 'AI not configured.') : (es ? 'La IA no pudo mejorar.' : 'AI could not enhance.'));
    } finally { setAi(false); }
  }

  // Completa/traduce el idioma que falte de UN post. Si ya tiene ambos, pregunta y
  // fuerza (regenera el idioma más corto a partir del más largo).
  async function completeOne(p: any) {
    const lenEs = String(p.body_es || '').trim().length, lenEn = String(p.body_en || '').trim().length;
    const both = lenEs > 0 && lenEn > 0;
    if (both && !await confirmDialog(es ? 'Este artículo ya tiene texto en los dos idiomas. ¿Volver a traducir el idioma más corto a partir del más completo?' : 'This article already has text in both languages. Re-translate the shorter one from the more complete one?')) return;
    setAi(true);
    try {
      const r = await fetch('/api/admin/blog/ai', { method: 'POST', body: JSON.stringify({ mode: 'complete', id: p.id, force: both }) });
      const j = await r.json();
      if (r.ok && j.patch && Object.keys(j.patch).length) {
        await fetch('/api/admin/blog', { method: 'POST', body: JSON.stringify({ ...p, ...j.patch }) });
        toast(es ? '🌐 Idioma completado.' : '🌐 Language completed.', 'ok'); await load();
      } else toast(j.code === 'no_key' ? (es ? 'IA no configurada.' : 'AI not configured.') : j.code === 'empty' ? (es ? 'El artículo está vacío.' : 'The article is empty.') : (es ? 'No se pudo completar.' : 'Could not complete.'));
    } finally { setAi(false); }
  }

  // Sube una imagen al Storage y devuelve su URL pública (o '' si falla).
  const [imgBusy, setImgBusy] = useState<'' | 'cover' | 'body'>('');
  const [showPrev, setShowPrev] = useState(true);   // vista previa del artículo en vivo
  async function uploadImage(file: File): Promise<string> {
    if (file.size > 6 * 1024 * 1024) { toast(es ? 'Imagen muy grande (máx 6 MB).' : 'Image too large (max 6 MB).'); return ''; }
    const data = await fileToDataUrl(file);
    const r = await fetch('/api/admin/blog/upload', { method: 'POST', body: JSON.stringify({ name: file.name, data }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.url) { toast((es ? 'No se pudo subir: ' : 'Upload failed: ') + (j.message || j.error || '')); return ''; }
    return j.url as string;
  }

  // Portada: subir imagen.
  async function onCoverFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
    setImgBusy('cover');
    try { const url = await uploadImage(file); if (url) set('cover_url', url); } finally { setImgBusy(''); }
  }

  // Genera el alt (ES/EN) con la IA a partir del tema del artículo. Para portada o para una pista.
  async function genAlt(target: 'cover') {
    const context = f?.title_es || f?.title_en || topic;
    if (!context) { toast(es ? 'Pon un título o tema primero.' : 'Set a title or topic first.'); return; }
    setAi(true);
    try {
      const r = await fetch('/api/admin/blog/ai', { method: 'POST', body: JSON.stringify({ mode: 'alt', context, hint: f?.cover_url || '' }) });
      const j = await r.json();
      if (r.ok && (j.alt_es || j.alt_en)) {
        if (target === 'cover') setF((s: any) => ({ ...s, cover_alt_es: j.alt_es || s.cover_alt_es, cover_alt_en: j.alt_en || s.cover_alt_en }));
      } else toast(j.code === 'no_key' ? (es ? 'IA no configurada.' : 'AI not configured.') : (es ? 'La IA no pudo generar el alt.' : 'AI could not generate alt.'));
    } finally { setAi(false); }
  }

  // Inserta una imagen en el cuerpo (sube + añade ![alt](url) con alt IA) en ambos idiomas.
  async function insertBodyImage(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
    setImgBusy('body');
    try {
      const url = await uploadImage(file); if (!url) return;
      let altEs = '', altEn = '';
      const context = f?.title_es || f?.title_en || topic;
      if (context) {
        try {
          const r = await fetch('/api/admin/blog/ai', { method: 'POST', body: JSON.stringify({ mode: 'alt', context, hint: file.name }) });
          const j = await r.json(); if (r.ok) { altEs = j.alt_es || ''; altEn = j.alt_en || ''; }
        } catch {}
      }
      setF((s: any) => ({
        ...s,
        body_es: (s.body_es ? s.body_es.replace(/\s*$/, '') + '\n\n' : '') + `![${altEs || altEn}](${url})\n`,
        body_en: (s.body_en ? s.body_en.replace(/\s*$/, '') + '\n\n' : '') + `![${altEn || altEs}](${url})\n`,
      }));
      toast(es ? 'Imagen insertada en el cuerpo (ES y EN).' : 'Image inserted in the body (ES and EN).', 'ok');
    } finally { setImgBusy(''); }
  }

  // Inserta una plantilla de gráfica al final del cuerpo (ambos idiomas).
  function insertChart() {
    setF((s: any) => ({
      ...s,
      body_es: (s.body_es ? s.body_es.replace(/\s*$/, '') + '\n\n' : '') + CHART_TPL + '\n',
      body_en: (s.body_en ? s.body_en.replace(/\s*$/, '') + '\n\n' : '') + CHART_TPL + '\n',
    }));
    toast(es ? 'Plantilla de gráfica añadida. Edita los datos.' : 'Chart template added. Edit the data.', 'ok');
  }

  async function save() {
    if (!f.title_es && !f.title_en) { toast(es ? 'Falta el título.' : 'Missing title.'); return; }
    // Avisar si se va a publicar/programar sin contenido en algún idioma.
    const gaps = missingLangs(f);
    if (gaps.length && f.status !== 'draft') {
      const ok = await confirmDialog(es
        ? `Le falta contenido en un idioma: ${gaps.join(', ')}.\nSi publicas así, esa URL mostrará el otro idioma. ¿Publicar de todos modos?`
        : `Missing content in a language: ${gaps.join(', ')}.\nIf you publish like this, that URL will show the other language. Publish anyway?`);
      if (!ok) return;
    }
    const body: any = { ...f };
    if (f.status === 'scheduled') {
      if (!f.pubDate) { toast(es ? 'Elige la fecha de publicación.' : 'Pick a publish date.'); return; }
      body.publish_at = new Date(`${f.pubDate}T${f.pubTime || '09:00'}`).toISOString();
    }
    setBusy(true);
    try {
      const r = await fetch('/api/admin/blog', { method: 'POST', body: JSON.stringify(body) });
      const j = await r.json();
      if (r.ok) { toast(es ? 'Guardado.' : 'Saved.', 'ok'); setF(null); await load(); }
      else toast((es ? 'No se pudo guardar: ' : 'Could not save: ') + (j.error || ''));
    } finally { setBusy(false); }
  }

  async function del(id: string) {
    if (!(await confirmDialog(es ? '¿Borrar este artículo?' : 'Delete this article?'))) return;
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
    const Chip = (p: any, drag: boolean) => {
      const sched = p.status === 'scheduled' && p.publish_at;
      const timeLbl = sched ? `${pad2(new Date(p.publish_at).getHours())}:${pad2(new Date(p.publish_at).getMinutes())} ` : '';
      return (
        <div key={p.id} draggable={drag}
          onDragStart={drag ? (e) => { setDragId(p.id); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', p.id); } catch {} } : undefined}
          onDragEnd={() => { setDragId(''); setOverDay(''); }}
          onClick={(e) => { e.stopPropagation(); edit(p); }}
          title={p.title_es || p.title_en}
          style={{ fontSize: 10.5, lineHeight: 1.3, background: chipCol[p.status][0], color: chipCol[p.status][1], borderRadius: 5, padding: '2px 5px', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4, cursor: drag ? 'grab' : 'pointer', border: '1px solid color-mix(in srgb,' + chipCol[p.status][1] + ' 30%,transparent)' }}>
          {missingLangs(p).length > 0 && <span style={{ flex: 'none', color: 'var(--amber)' }} title={(es ? 'Falta: ' : 'Missing: ') + missingLangs(p).join(', ')}>⚠</span>}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: '1 1 auto', minWidth: 0 }}>{timeLbl}{p.title_es || p.title_en}</span>
          {sched && <span style={{ flex: 'none', fontSize: 9.5 }}><Countdown iso={p.publish_at} es={es} compact /></span>}
          {p.status === 'published' && p.slug && origin && (
            <a href={postUrl(p)} onClick={(e) => { e.preventDefault(); e.stopPropagation(); openPost(postUrl(p)); }} title={es ? 'Ver en la web' : 'View on the web'} style={{ flex: 'none', textDecoration: 'none', color: 'inherit', opacity: .8, cursor: 'pointer' }}>👁</a>
          )}
        </div>
      );
    };

    const cells: any[] = [];
    for (let i = 0; i < startDow; i++) cells.push(<div key={'e' + i} />);
    for (let d = 1; d <= daysIn; d++) {
      const k = dayKey(cursor.y, cursor.m, d);
      const cellDate = new Date(cursor.y, cursor.m, d);
      const past = cellDate < today;
      const isToday = cellDate.getTime() === today.getTime();
      const list = byDay[k] || [];
      // Los manejadores van SIEMPRE puestos (solo se bloquean en días pasados). Si se condicionan a
      // `dragId`, el estado de React aún no está listo en el primer `dragover` y la celda no deja soltar.
      cells.push(
        <div key={k}
          onDragOver={past ? undefined : (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setOverDay(k); }}
          onDragLeave={() => setOverDay((o) => (o === k ? '' : o))}
          onDrop={past ? undefined : (e) => { e.preventDefault(); const id = dragId || e.dataTransfer.getData('text/plain'); const pp = posts.find((x) => x.id === id); if (pp) reschedule(pp, k); setOverDay(''); setDragId(''); }}
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
            <a className="btn btn-ghost" href={`${origin}${es ? '/blog' : '/en/blog'}`} onClick={(e) => { e.preventDefault(); openPost(`${origin}${es ? '/blog' : '/en/blog'}`); }} title={es ? 'Abrir el blog público en la web' : 'Open the public blog on the web'}>👁 {es ? 'Ver blog' : 'View blog'}</a>
            <button className="btn btn-ghost" style={{ color: 'var(--brand)' }} onClick={bulkComplete} disabled={bulk.running} title={es ? 'Completa el idioma que falte (traduce ES↔EN) en los artículos incompletos' : 'Fill the missing language (translate ES↔EN) on incomplete articles'}>{bulk.running ? `⏳ ${bulk.done}/${bulk.total}` : (es ? '🌐 Completar idiomas' : '🌐 Complete languages')}</button>
            <button className="btn btn-ghost" style={{ color: 'var(--brand)' }} onClick={bulkEnhance} disabled={bulk.running} title={es ? 'Mejora SEO de todos los publicados: enlaces internos, FAQ, imagen y slug corto ES/EN' : 'Improve SEO of all published: internal links, FAQ, image and short ES/EN slug'}>{bulk.running ? `⏳ ${bulk.done}/${bulk.total}` : (es ? '✨ Mejorar SEO de todos' : '✨ Improve SEO of all')}</button>
            <button className="btn btn-primary" onClick={() => { setTitles([]); setTopic(''); setF({ ...blank }); }}>＋ {es ? 'Nuevo' : 'New'}</button>
          </div>
        </div>

        <BlogKeywords />
        <BlogAutopilot es={es} onChanged={load} />
        <BlogAudit es={es} onChanged={load} />
        <BlogAuthorCard es={es} roster={authors} reload={loadAuthors} />

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
                    <div key={p.id} draggable onDragStart={(e) => { setDragId(p.id); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', p.id); } catch {} }} onDragEnd={() => { setDragId(''); setOverDay(''); }}
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
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <b>{p.title_es || p.title_en}</b> {statusChip(p.status)}
                    {missingLangs(p).length > 0 && <span className="sk-chip" style={{ color: 'var(--amber)', background: 'color-mix(in srgb,var(--amber) 12%,transparent)', border: '1px solid color-mix(in srgb,var(--amber) 45%,transparent)', fontWeight: 700 }} title={missingLangs(p).join(', ')}>⚠ {es ? 'Falta ' : 'Missing ' }{missingLangs(p).join(', ')}</span>}
                    {p.status === 'scheduled' && p.publish_at && (
                      <span className="sk-chip" style={{ color: 'var(--amber)', background: 'color-mix(in srgb,var(--amber) 12%,transparent)', border: '1px solid color-mix(in srgb,var(--amber) 40%,transparent)', fontWeight: 700 }}><Countdown iso={p.publish_at} es={es} /></span>
                    )}
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>/blog/{p.slug}{p.status === 'scheduled' && p.publish_at ? ` · ${new Date(p.publish_at).toLocaleString(es ? 'es-ES' : 'en-US')}` : ''}</div>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  {p.status === 'scheduled' && <button className="btn btn-ghost" style={{ fontSize: 12, color: 'var(--green)' }} onClick={() => publishNow(p)}>⚡ {es ? 'Publicar ahora' : 'Publish now'}</button>}
                  {(p.status === 'published' || p.status === 'scheduled') && <button className="btn btn-ghost" style={{ fontSize: 12, color: 'var(--brand)' }} onClick={() => enhanceSeo(p)} disabled={ai} title={es ? 'Añadir enlaces internos, FAQ e imagen sin reescribir el texto' : 'Add internal links, FAQ and image without rewriting'}>✨ {es ? 'Mejorar SEO' : 'Improve SEO'}</button>}
                  {(() => { const miss = (!!(p.body_es && String(p.body_es).trim())) !== (!!(p.body_en && String(p.body_en).trim())); return <button className="btn btn-ghost" style={{ fontSize: 12, color: miss ? 'var(--amber)' : 'var(--mut)' }} onClick={() => completeOne(p)} disabled={ai} title={es ? 'Traducir/completar ES y EN' : 'Translate/complete ES and EN'}>🌐 {miss ? (es ? 'Completar idioma' : 'Complete language') : (es ? 'Idiomas' : 'Languages')}</button>; })()}
                  {p.status === 'published' && <a className="btn btn-ghost" style={{ fontSize: 12 }} href={postUrl(p)} onClick={(e) => { e.preventDefault(); openPost(postUrl(p)); }}>{es ? 'Ver' : 'View'}</a>}
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

      {/* Aviso: falta contenido en algún idioma (evita URLs que caen al otro idioma). */}
      {missingLangs(f).length > 0 && (
        <div style={{ border: '1px solid var(--amber)', background: 'color-mix(in srgb,var(--amber) 10%,transparent)', borderRadius: 10, padding: '10px 12px', marginBottom: 12, fontSize: 13 }}>
          <b style={{ color: 'var(--amber)' }}>⚠ {es ? 'Falta contenido en un idioma:' : 'Missing content in a language:'}</b> {missingLangs(f).join(' · ')}.
          <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>{es ? 'Si publicas así, esa URL mostrará el otro idioma. Rellénalo o genera con la IA (rellena ES y EN).' : 'If you publish like this, that URL will show the other language. Fill it in or generate with AI (fills ES and EN).'}</div>
        </div>
      )}

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
          <div className="muted" style={{ fontSize: 12.5, marginBottom: 8 }}>{es ? '2) Elige el tipo de post y Onyx AI escribe el artículo completo (ES/EN) con enlaces internos a tus posts, FAQ e imagen de contenido.' : '2) Pick the post type and Onyx AI writes the full article (ES/EN) with internal links to your posts, FAQ and a content image.'}</div>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {([
              ['guide', es ? '📘 Guía' : '📘 Guide'],
              ['comparison', es ? '⚖ Comparativa' : '⚖ Comparison'],
              ['list', es ? '🔟 Lista/Ranking' : '🔟 List/Ranking'],
              ['mistakes', es ? '⚠ Errores' : '⚠ Mistakes'],
            ] as const).map(([v, l]) => (
              <button key={v} type="button" onClick={() => setKind(v)} className="btn btn-ghost" style={{ fontSize: 12.5, border: '1px solid ' + (kind === v ? 'var(--brand)' : 'var(--line)'), background: kind === v ? 'color-mix(in srgb,var(--brand) 18%,transparent)' : 'transparent' }}>{l}</button>
            ))}
          </div>
          <div className="row between" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <span className="muted" style={{ fontSize: 11.5 }}>{kind === 'comparison' ? (es ? 'Comparará opciones con pros/contras y veredicto.' : 'Compares options with pros/cons and a verdict.') : kind === 'list' ? (es ? 'Título con número; un punto por elemento.' : 'Numbered title; one point per item.') : kind === 'mistakes' ? (es ? 'Errores frecuentes + cómo evitarlos.' : 'Common mistakes + how to avoid them.') : (es ? 'Guía práctica por secciones.' : 'Practical how-to guide.')}</span>
            <button className="btn btn-primary" onClick={generate} disabled={ai}>{ai ? '…' : (es ? '✨ Generar artículo (ES/EN)' : '✨ Generate article (ES/EN)')}</button>
          </div>
        </div>

        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 320px' }}><span className="muted" style={{ fontSize: 12 }}>{es ? 'Resumen (ES)' : 'Excerpt (ES)'}</span><textarea value={f.excerpt_es} onChange={(e) => set('excerpt_es', e.target.value)} rows={2} style={{ width: '100%', margin: '4px 0 0' }} /></div>
          <div style={{ flex: '1 1 320px' }}><span className="muted" style={{ fontSize: 12 }}>{es ? 'Resumen (EN)' : 'Excerpt (EN)'}</span><textarea value={f.excerpt_en} onChange={(e) => set('excerpt_en', e.target.value)} rows={2} style={{ width: '100%', margin: '4px 0 0' }} /></div>
        </div>
        {/* Insertar imagen (con alt IA) o gráfica ilustrativa en el cuerpo (ambos idiomas) */}
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <label className="btn btn-ghost" style={{ fontSize: 12.5, cursor: 'pointer', margin: 0 }}>
            {imgBusy === 'body' ? '…' : (es ? '🖼 Insertar imagen' : '🖼 Insert image')}
            <input type="file" accept="image/*" onChange={insertBodyImage} style={{ display: 'none' }} />
          </label>
          <button type="button" className="btn btn-ghost" onClick={insertChart} style={{ fontSize: 12.5 }}>{es ? '📈 Insertar gráfica' : '📈 Insert chart'}</button>
          <span className="muted" style={{ fontSize: 11.5 }}>{es ? 'La imagen sube al almacenamiento y añade su alt; la gráfica usa datos de ejemplo.' : 'Image uploads to storage with its alt; the chart uses example data.'}</span>
        </div>
        <div><span className="muted" style={{ fontSize: 12 }}>Cuerpo (ES) · markdown</span><textarea value={f.body_es} onChange={(e) => set('body_es', e.target.value)} rows={10} style={{ width: '100%', margin: '4px 0 0', fontFamily: 'ui-monospace,monospace', fontSize: 13 }} /></div>
        <div><span className="muted" style={{ fontSize: 12 }}>Body (EN) · markdown</span><textarea value={f.body_en} onChange={(e) => set('body_en', e.target.value)} rows={10} style={{ width: '100%', margin: '4px 0 0', fontFamily: 'ui-monospace,monospace', fontSize: 13 }} /></div>

        {/* Vista previa en vivo del artículo, tal como se publica (mismo render que /blog). */}
        <div className="card">
          <div className="row between" style={{ alignItems: 'center', marginBottom: showPrev ? 8 : 0 }}>
            <span className="muted" style={{ fontSize: 12.5 }}>{es ? '👁 Vista previa (así se publica)' : '👁 Preview (as published)'}</span>
            <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setShowPrev((v) => !v)}>{showPrev ? (es ? 'Ocultar' : 'Hide') : (es ? 'Mostrar' : 'Show')}</button>
          </div>
          {showPrev && (
            <BlogPreview
              title={es ? f.title_es : f.title_en}
              cover={f.cover_url}
              coverAlt={es ? f.cover_alt_es : f.cover_alt_en}
              body={es ? f.body_es : f.body_en}
              es={es}
            />
          )}
        </div>

        <div><span className="muted" style={{ fontSize: 12 }}>{es ? 'Etiquetas (coma)' : 'Tags (comma)'}</span><input value={f.tags} onChange={(e) => set('tags', e.target.value)} style={{ margin: '4px 0 0' }} /></div>

        {/* URL / slug — corto con keyword. Cambiarlo en un post publicado crea una redirección 301. */}
        <div>
          <div className="row between" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
            <span className="muted" style={{ fontSize: 12 }}>{es ? 'URL del artículo (slug)' : 'Article URL (slug)'}</span>
            <button type="button" className="btn btn-ghost" style={{ fontSize: 11.5, padding: '3px 8px' }}
              onClick={() => { const sug = f._suggestedSlug || clientShortSlug(f.title_es || f.title_en || '', (f.tags || '').split(',')[0] || ''); if (sug) set('slug', sug); }}>
              {es ? '✨ Sugerir corto' : '✨ Suggest short'}
            </button>
          </div>
          <div className="row" style={{ gap: 6, alignItems: 'center', marginTop: 4 }}>
            <span className="muted" style={{ fontSize: 12.5 }}>/blog/</span>
            <input value={f.slug || ''} onChange={(e) => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-'))} placeholder="mi-articulo" style={{ margin: 0, flex: '1 1 240px' }} />
          </div>
          {f.id && f.status === 'published' && f._origSlug && f.slug !== f._origSlug && (
            <div className="muted" style={{ fontSize: 11.5, marginTop: 4, color: 'var(--amber)' }}>
              ⚠ {es ? `Se creará una redirección 301 de /blog/${f._origSlug} a la nueva URL.` : `A 301 redirect will be created from /blog/${f._origSlug} to the new URL.`}
            </div>
          )}
          {/* Slug propio para inglés → /en/blog/… en inglés */}
          <div className="row between" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            <span className="muted" style={{ fontSize: 12 }}>{es ? 'URL en inglés (slug EN)' : 'English URL (EN slug)'}</span>
            <button type="button" className="btn btn-ghost" style={{ fontSize: 11.5, padding: '3px 8px' }}
              onClick={() => { const sug = clientShortSlug(f.title_en || f.title_es || '', (f.tags || '').split(',')[0] || ''); if (sug) set('slug_en', sug); }}>
              {es ? '✨ Sugerir corto (EN)' : '✨ Suggest short (EN)'}
            </button>
          </div>
          <div className="row" style={{ gap: 6, alignItems: 'center', marginTop: 4 }}>
            <span className="muted" style={{ fontSize: 12.5 }}>/en/blog/</span>
            <input value={f.slug_en || ''} onChange={(e) => set('slug_en', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-'))} placeholder={es ? 'my-article (si vacío, usa el slug español)' : 'my-article (empty = uses Spanish slug)'} style={{ margin: 0, flex: '1 1 240px' }} />
          </div>
        </div>

        {/* Portada: subir imagen o URL + texto alternativo (alt) bilingüe con IA */}
        <div className="card">
          <div className="row between" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
            <span className="muted" style={{ fontSize: 12.5 }}>{es ? 'Imagen de portada — opcional' : 'Cover image — optional'}</span>
            <label className="btn btn-ghost" style={{ fontSize: 12.5, cursor: 'pointer', margin: 0 }}>
              {imgBusy === 'cover' ? '…' : (es ? '⬆ Subir imagen' : '⬆ Upload image')}
              <input type="file" accept="image/*" onChange={onCoverFile} style={{ display: 'none' }} />
            </label>
          </div>
          <div className="row" style={{ gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {f.cover_url
              ? <img src={f.cover_url} alt="" style={{ width: 150, height: 96, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--line)', flex: 'none' }} />
              : <div style={{ width: 150, height: 96, borderRadius: 8, border: '1px dashed var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mut)', fontSize: 12, flex: 'none' }}>{es ? 'Sin imagen' : 'No image'}</div>}
            <div style={{ flex: '1 1 260px', minWidth: 220, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <input value={f.cover_url} onChange={(e) => set('cover_url', e.target.value)} placeholder={es ? '…o pega una URL' : '…or paste a URL'} style={{ margin: 0 }} />
              <div className="row between" style={{ alignItems: 'center' }}>
                <span className="muted" style={{ fontSize: 11.5 }}>{es ? 'Texto alternativo (alt) — lo lee Google y los lectores de pantalla' : 'Alt text — read by Google and screen readers'}</span>
                <button type="button" className="btn btn-ghost" onClick={() => genAlt('cover')} disabled={ai} style={{ fontSize: 11.5, padding: '3px 8px' }}>{ai ? '…' : (es ? '✨ Generar alt con IA' : '✨ Generate alt with AI')}</button>
              </div>
              <input value={f.cover_alt_es} onChange={(e) => set('cover_alt_es', e.target.value)} placeholder={es ? 'Alt (ES)' : 'Alt (ES)'} style={{ margin: 0 }} />
              <input value={f.cover_alt_en} onChange={(e) => set('cover_alt_en', e.target.value)} placeholder="Alt (EN)" style={{ margin: 0 }} />
            </div>
          </div>
        </div>

        {/* Compartir en redes (solo con el artículo ya guardado) */}
        {f.id ? <SocialShare post={{ id: f.id, slug: f.slug, title_es: f.title_es, title_en: f.title_en }} es={es} />
          : <div className="muted" style={{ fontSize: 12.5, border: '1px dashed var(--line)', borderRadius: 12, padding: '12px 14px' }}>🔗 {es ? 'Guarda el artículo para compartirlo en redes con copy por red y programación.' : 'Save the article to share it on social with per-network copy and scheduling.'}</div>}

        {/* Autor del artículo */}
        <div className="card">
          <div className="row between" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <span className="muted" style={{ fontSize: 12.5 }}>{es ? '✍️ Autor de este artículo' : '✍️ Author of this article'}</span>
            <select value={f.author_id || ''} onChange={(e) => set('author_id', e.target.value)} style={{ margin: 0, width: 'auto', minWidth: 200 }}>
              <option value="">{es ? 'Por defecto' : 'Default'}{authors?.list?.length ? ` (${authors.list.find((a: any) => a.id === authors.defaultId)?.name || ''})` : ''}</option>
              {(authors?.list || []).map((a: any) => <option key={a.id} value={a.id}>{a.name}{(es ? a.trader_es : a.trader_en) ? ` · ${es ? a.trader_es : a.trader_en}` : ''}</option>)}
            </select>
          </div>
          <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>{es ? 'Se guarda con el artículo. Cambiar el autor por defecto no afecta a los ya asignados. Gestiona el plantel en “Autores del blog”.' : 'Saved with the article. Changing the default author does not affect assigned ones. Manage the roster in “Blog authors”.'}</div>
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
