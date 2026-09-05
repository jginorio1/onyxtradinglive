'use client';
import { toast, confirmDialog } from '@/lib/toast';
import { useEffect, useMemo, useRef, useState } from 'react';
import GuideBody from '../guia/GuideBody';

// Editor de guías (solo dueño): IA para redactar, subir imágenes con visor/zoom,
// SEO (meta título/descr + keywords), y lista agrupada por categoría.

type Blk = any;
type Seo = { title: { es: string; en: string }; desc: { es: string; en: string }; keywords: { es: string[]; en: string[] } };
type Art = {
  slug: string; cat: string; icon: string; cover?: string; updated?: boolean;
  title: { es: string; en: string }; summary: { es: string; en: string };
  body: { es: Blk[]; en: Blk[] }; cta?: { href: string; label: { es: string; en: string } }; seo?: Seo;
};

const T: any = {
  es: {
    title: 'Guías', sub: 'IA, imágenes con zoom y SEO. Se publican al guardar, sin desplegar.',
    nueva: '+ Nueva guía', buscar: 'Buscar…', base: 'código', mine: 'tuya', edited: 'editada',
    aiT: 'Redactar con IA', aiTopic: 'Tema de la guía…', aiKw: 'keyword', gen: 'Generar', gening: 'Redactando…',
    slug: 'Slug (URL)', cat: 'Categoría', icon: 'Icono', cover: 'Portada (ruta o sube)', up: 'Subir', nuevo: 'Marcar "Nuevo"',
    titulo: 'Título', resumen: 'Resumen', cuerpo: 'Cuerpo', ctah: 'Botón: enlace', ctal: 'Botón: texto',
    addBlock: 'Añadir bloque', save: 'Guardar guía', del: 'Borrar', saved: 'Guardado ✓', preview: 'Ver ↗',
    rm: 'Quitar', adv: 'Bloque avanzado (recorrido) — se conserva', altAI: 'Alt IA',
    bt: { p: 'Párrafo', h: 'Subtítulo', tip: 'Consejo', note: 'Nota', warn: 'Aviso', list: 'Lista', steps: 'Pasos', img: 'Imagen' },
    itemsHint: 'Un elemento por línea', imgUrl: 'Ruta de la imagen', imgAlt: 'Texto alternativo', imgCap: 'Pie de foto',
    seoT: 'SEO', metaT: 'Meta título', metaD: 'Meta descripción', kws: 'Keywords (coma)', check: 'Chequeo SEO',
    ck_h1: 'Keyword en el título', ck_p1: 'Keyword en el primer párrafo', ck_h2: 'Keyword en un subtítulo', ck_alt: 'Todas las imágenes con alt', ck_len: 'Longitud adecuada (300+)',
    confirmDel: '¿Borrar esta guía? Si venía del código, vuelve la original.',
  },
  en: {
    title: 'Guides', sub: 'AI, zoomable images and SEO. Published on save, no deploy.',
    nueva: '+ New guide', buscar: 'Search…', base: 'code', mine: 'yours', edited: 'edited',
    aiT: 'Write with AI', aiTopic: 'Guide topic…', aiKw: 'keyword', gen: 'Generate', gening: 'Writing…',
    slug: 'Slug (URL)', cat: 'Category', icon: 'Icon', cover: 'Cover (path or upload)', up: 'Upload', nuevo: 'Mark "New"',
    titulo: 'Title', resumen: 'Summary', cuerpo: 'Body', ctah: 'Button: link', ctal: 'Button: text',
    addBlock: 'Add block', save: 'Save guide', del: 'Delete', saved: 'Saved ✓', preview: 'Open ↗',
    rm: 'Remove', adv: 'Advanced block (walk) — kept', altAI: 'Alt AI',
    bt: { p: 'Paragraph', h: 'Heading', tip: 'Tip', note: 'Note', warn: 'Warning', list: 'List', steps: 'Steps', img: 'Image' },
    itemsHint: 'One item per line', imgUrl: 'Image path', imgAlt: 'Alt text', imgCap: 'Caption',
    seoT: 'SEO', metaT: 'Meta title', metaD: 'Meta description', kws: 'Keywords (comma)', check: 'SEO check',
    ck_h1: 'Keyword in title', ck_p1: 'Keyword in first paragraph', ck_h2: 'Keyword in a heading', ck_alt: 'All images have alt', ck_len: 'Good length (300+)',
    confirmDel: 'Delete this guide? If it came from code, the original returns.',
  },
};

const emptySeo = (): Seo => ({ title: { es: '', en: '' }, desc: { es: '', en: '' }, keywords: { es: [], en: [] } });
function blankArt(cats: any[]): Art {
  return { slug: '', cat: cats[0]?.id || 'start', icon: '📖', title: { es: '', en: '' }, summary: { es: '', en: '' }, body: { es: [{ p: '' }], en: [{ p: '' }] }, seo: emptySeo() };
}

export default function GuideEditor({ lang }: { lang: 'es' | 'en' }) {
  const t = T[lang];
  const [arts, setArts] = useState<Art[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [customSlugs, setCustom] = useState<string[]>([]);
  const [codeSlugs, setCode] = useState<string[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [form, setForm] = useState<Art | null>(null);
  const [ed, setEd] = useState<'es' | 'en'>(lang);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [aiKw, setAiKw] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [view, setView] = useState<'both' | 'edit' | 'preview'>('both');
  const fileRef = useRef<HTMLInputElement>(null);
  const cbRef = useRef<((url: string) => void) | null>(null);

  async function load() {
    const r = await fetch('/api/guide'); const j = await r.json();
    setArts(j.articles || []); setCats(j.categories || []); setCustom(j.customSlugs || []); setCode(j.codeSlugs || []);
  }
  useEffect(() => { load(); }, []);

  function withSeo(a: Art): Art { return { ...a, seo: a.seo || emptySeo() }; }
  function pick(a: Art) { setForm(withSeo(JSON.parse(JSON.stringify(a)))); setSel(a.slug); setSaved(false); }
  function nuevo() { const a = blankArt(cats); setForm(a); setSel('__new__'); setSaved(false); }

  // Lista agrupada por categoría (respetando el orden de las categorías).
  const grouped = useMemo(() => {
    const n = q.trim().toLowerCase();
    const match = (a: Art) => !n || a.slug.includes(n) || (a.title?.[lang] || '').toLowerCase().includes(n);
    return cats.map((c) => ({ cat: c, items: arts.filter((a) => a.cat === c.id && match(a)) })).filter((g) => g.items.length);
  }, [arts, cats, q, lang]);

  async function save() {
    if (!form) return; setBusy(true);
    try {
      const r = await fetch('/api/guide', { method: 'POST', body: JSON.stringify({ article: form }) });
      const j = await r.json();
      if (j.ok) { await load(); setSel(j.slug); setSaved(true); setTimeout(() => setSaved(false), 1600); }
    } catch {} finally { setBusy(false); }
  }
  async function del() {
    if (!form || !window.confirm(t.confirmDel)) return; setBusy(true);
    try { await fetch('/api/guide?slug=' + encodeURIComponent(form.slug), { method: 'DELETE' }); await load(); setForm(null); setSel(null); } catch {} finally { setBusy(false); }
  }

  // ---- IA: generar guía completa ----
  async function genAI() {
    if (!aiTopic.trim() || !form) return; setAiBusy(true);
    try {
      const r = await fetch('/api/guide/ai', { method: 'POST', body: JSON.stringify({ mode: 'generate', topic: aiTopic, keyword: aiKw || undefined }) });
      const j = await r.json();
      if (j.ok && j.article) {
        const a = j.article;
        setForm({
          ...form,
          title: a.title || form.title, summary: a.summary || form.summary,
          body: { es: Array.isArray(a.body?.es) ? a.body.es : form.body.es, en: Array.isArray(a.body?.en) ? a.body.en : form.body.en },
          seo: a.seo ? { title: a.seo.title || { es: '', en: '' }, desc: a.seo.desc || { es: '', en: '' }, keywords: a.seo.keywords || { es: [], en: [] } } : form.seo,
        });
      } else { toast(j.reason || (lang === 'en' ? 'AI unavailable' : 'IA no disponible')); }
    } catch {} finally { setAiBusy(false); }
  }

  // ---- Subir imagen: abre el diálogo y llama al callback con la URL pública ----
  function upload(cb: (url: string) => void) { cbRef.current = cb; fileRef.current?.click(); }
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
    const data: string = await new Promise((res) => { const rd = new FileReader(); rd.onload = () => res(String(rd.result)); rd.readAsDataURL(f); });
    try {
      const r = await fetch('/api/admin/blog/upload', { method: 'POST', body: JSON.stringify({ name: f.name, data }) });
      const j = await r.json();
      if (j.url) cbRef.current?.(j.url); else toast(j.message || j.error || 'error');
    } catch {}
  }
  async function altAI(context: string, i: number) {
    const r = await fetch('/api/guide/ai', { method: 'POST', body: JSON.stringify({ mode: 'alt', context }) });
    const j = await r.json(); if (j.es || j.en) setBlk(i, { ...blocks[i], alt: ed === 'en' ? j.en : j.es });
  }

  // ---- bloques del idioma activo ----
  const blocks: Blk[] = form ? (form.body[ed] || []) : [];
  const setBlocks = (bl: Blk[]) => setForm({ ...form!, body: { ...form!.body, [ed]: bl } });
  const setBlk = (i: number, v: Blk) => { const c = [...blocks]; c[i] = v; setBlocks(c); };
  const move = (i: number, d: number) => { const c = [...blocks]; const j = i + d; if (j < 0 || j >= c.length) return; [c[i], c[j]] = [c[j], c[i]]; setBlocks(c); };
  const rm = (i: number) => setBlocks(blocks.filter((_, k) => k !== i));
  const add = (type: string) => setBlocks([...blocks, type === 'list' || type === 'steps' ? { [type]: [''] } : type === 'img' ? { img: '', alt: '' } : { [type]: '' }]);
  const blkType = (b: Blk) => ['p', 'h', 'tip', 'note', 'warn', 'list', 'steps', 'img'].find((k) => b[k] !== undefined) || (b.walk ? 'walk' : 'adv');

  // ---- SEO helpers ----
  const setSeo = (path: 'title' | 'desc', v: string) => setForm({ ...form!, seo: { ...(form!.seo || emptySeo()), [path]: { ...(form!.seo || emptySeo())[path], [ed]: v } } });
  const setKw = (v: string) => setForm({ ...form!, seo: { ...(form!.seo || emptySeo()), keywords: { ...(form!.seo || emptySeo()).keywords, [ed]: v.split(',').map((x) => x.trim()).filter(Boolean) } } });
  const seoCheck = () => {
    if (!form) return [];
    const kw = (form.seo?.keywords?.[ed]?.[0] || '').toLowerCase();
    const bl = form.body[ed] || [];
    const txt = (o: any) => (o.p || o.h || o.tip || o.note || o.warn || (o.list || o.steps || []).join(' ') || '').toLowerCase();
    const firstP = bl.find((b: any) => b.p);
    const words = bl.map(txt).join(' ').split(/\s+/).filter(Boolean).length;
    const imgs = bl.filter((b: any) => b.img !== undefined);
    return [
      { k: t.ck_h1, ok: !!kw && (form.title[ed] || '').toLowerCase().includes(kw) },
      { k: t.ck_p1, ok: !!kw && !!firstP && txt(firstP).includes(kw) },
      { k: t.ck_h2, ok: !!kw && bl.some((b: any) => b.h && txt(b).includes(kw)) },
      { k: t.ck_alt, ok: imgs.every((b: any) => (b.alt || '').trim()) },
      { k: t.ck_len, ok: words >= 300 },
    ];
  };

  const inp: React.CSSProperties = { width: '100%', margin: 0, fontSize: 13 };

  return (
    <div>
      <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: 'none' }} />
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800 }}>📚 {t.title}</div>
        <div className="muted" style={{ fontSize: 13 }}>{t.sub}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px,300px) 1fr', gap: 14, alignItems: 'start' }}>
        {/* Lista agrupada por categoría */}
        <div className="card" style={{ padding: 12 }}>
          <button className="btn btn-primary" style={{ width: '100%', marginBottom: 8, fontSize: 13 }} onClick={nuevo}>{t.nueva}</button>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.buscar} style={{ ...inp, marginBottom: 8 }} />
          <div style={{ maxHeight: 560, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {grouped.map((g) => (
              <div key={g.cat.id}>
                <div className="muted" style={{ fontSize: 11, letterSpacing: '.04em', textTransform: 'uppercase', margin: '2px 0 5px' }}>{g.cat.icon} {(g.cat.name?.[lang] || g.cat.id)} · {g.items.length}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {g.items.map((a) => {
                    const isMine = customSlugs.includes(a.slug); const isCode = codeSlugs.includes(a.slug);
                    const tag = isMine && isCode ? t.edited : isMine ? t.mine : t.base;
                    return (
                      <button key={a.slug} onClick={() => pick(a)} style={{ textAlign: 'left', padding: '7px 9px', borderRadius: 8, cursor: 'pointer', border: '1px solid ' + (sel === a.slug ? 'var(--brand)' : 'var(--line)'), background: sel === a.slug ? 'rgba(124,140,255,.12)' : 'var(--bg2)', color: 'var(--tx)' }}>
                        <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                          <span>{a.icon}</span>
                          <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title?.[lang] || a.slug}</span>
                          <span className="pill" style={{ fontSize: 9, background: 'var(--card2)', color: 'var(--mut)' }}>{tag}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Editor */}
        {!form ? (
          <div className="card muted" style={{ fontSize: 13 }}>{lang === 'en' ? 'Pick a guide or create a new one.' : 'Elige una guía o crea una nueva.'}</div>
        ) : (
        <div>
          {/* Barra: editar / vista previa / ambos */}
          <div className="row between" style={{ marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'inline-flex', border: '1px solid var(--line)', borderRadius: 9, overflow: 'hidden' }}>
              {([['edit', lang === 'en' ? 'Editor' : 'Editor'], ['both', lang === 'en' ? 'Split' : 'Dividir'], ['preview', lang === 'en' ? 'Preview' : 'Vista previa']] as const).map(([v, l]) => (
                <button key={v} onClick={() => setView(v as any)} style={{ fontSize: 12.5, padding: '5px 13px', border: 'none', cursor: 'pointer', background: view === v ? 'var(--grad)' : 'transparent', color: view === v ? '#fff' : 'var(--mut)' }}>{l}</button>
              ))}
            </div>
            <span className="muted" style={{ fontSize: 11.5 }}>{lang === 'en' ? 'The preview is exactly what the trader sees.' : 'La vista previa es exactamente lo que ve el trader.'}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: view === 'both' ? 'repeat(auto-fit,minmax(320px,1fr))' : '1fr', gap: 14, alignItems: 'start' }}>
          {view !== 'preview' && (
          <div className="card">
            {/* Barra IA */}
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--brand)', borderRadius: 10, padding: 10, marginBottom: 12 }}>
              <div className="row" style={{ gap: 7, marginBottom: 7, alignItems: 'center' }}><span style={{ color: 'var(--brand)' }}>✨</span><b style={{ fontSize: 13 }}>{t.aiT}</b></div>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                <input value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} placeholder={t.aiTopic} style={{ ...inp, flex: 2, minWidth: 160 }} />
                <input value={aiKw} onChange={(e) => setAiKw(e.target.value)} placeholder={t.aiKw} style={{ ...inp, flex: 1, minWidth: 110 }} />
                <button className="btn btn-primary" style={{ fontSize: 12.5 }} onClick={genAI} disabled={aiBusy || !aiTopic.trim()}>{aiBusy ? t.gening : t.gen}</button>
              </div>
            </div>

            {/* Meta */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginBottom: 10 }}>
              <label style={{ fontSize: 12 }} className="muted">{t.slug}<input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} style={inp} /></label>
              <label style={{ fontSize: 12 }} className="muted">{t.cat}
                <select value={form.cat} onChange={(e) => setForm({ ...form, cat: e.target.value })} style={inp}>{cats.map((c) => <option key={c.id} value={c.id}>{c.name?.[lang] || c.id}</option>)}</select>
              </label>
              <label style={{ fontSize: 12 }} className="muted">{t.icon}<input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} style={inp} /></label>
            </div>
            <label style={{ fontSize: 12 }} className="muted">{t.cover}
              <div className="row" style={{ gap: 6 }}>
                <input value={form.cover || ''} onChange={(e) => setForm({ ...form, cover: e.target.value })} placeholder="/guia/…" style={inp} />
                <button className="btn btn-ghost" style={{ fontSize: 12, whiteSpace: 'nowrap' }} onClick={() => upload((url) => setForm((f) => ({ ...f!, cover: url })))}>⬆ {t.up}</button>
              </div>
            </label>
            <label className="row" style={{ gap: 7, fontSize: 13, cursor: 'pointer', margin: '10px 0 12px' }}><input type="checkbox" checked={!!form.updated} onChange={(e) => setForm({ ...form, updated: e.target.checked })} style={{ width: 'auto', margin: 0 }} /> {t.nuevo}</label>

            {/* Idioma */}
            <div className="row" style={{ gap: 6, marginBottom: 10 }}>{(['es', 'en'] as const).map((l) => (<button key={l} onClick={() => setEd(l)} className={'btn ' + (ed === l ? 'btn-primary' : 'btn-ghost')} style={{ fontSize: 12, padding: '4px 12px' }}>{l.toUpperCase()}</button>))}</div>

            <label style={{ fontSize: 12 }} className="muted">{t.titulo} ({ed})<input value={form.title[ed]} onChange={(e) => setForm({ ...form, title: { ...form.title, [ed]: e.target.value } })} style={{ ...inp, marginBottom: 8 }} /></label>
            <label style={{ fontSize: 12 }} className="muted">{t.resumen} ({ed})<textarea value={form.summary[ed]} onChange={(e) => setForm({ ...form, summary: { ...form.summary, [ed]: e.target.value } })} rows={2} style={{ ...inp, marginBottom: 12 }} /></label>

            {/* Bloques */}
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{t.cuerpo} ({ed})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {blocks.map((b, i) => {
                const type = blkType(b);
                return (
                  <div key={i} style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: 10 }}>
                    <div className="row between" style={{ marginBottom: 6 }}>
                      <span className="pill" style={{ fontSize: 10, background: 'var(--card2)', color: 'var(--soft-brand)' }}>{(t.bt as any)[type] || type}</span>
                      <span className="row" style={{ gap: 4 }}>
                        <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => move(i, -1)}>↑</button>
                        <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => move(i, 1)}>↓</button>
                        <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 12, color: 'var(--red)' }} onClick={() => rm(i)}>{t.rm}</button>
                      </span>
                    </div>
                    {type === 'walk' || type === 'adv' ? (
                      <div className="muted" style={{ fontSize: 12 }}>{t.adv}</div>
                    ) : type === 'img' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div className="row" style={{ gap: 6 }}>
                          <input value={b.img || ''} onChange={(e) => setBlk(i, { ...b, img: e.target.value })} placeholder={t.imgUrl} style={inp} />
                          <button className="btn btn-ghost" style={{ fontSize: 12, whiteSpace: 'nowrap' }} onClick={() => upload((url) => setBlk(i, { ...blocks[i], img: url }))}>⬆ {t.up}</button>
                        </div>
                        {b.img && <img src={b.img} alt="" style={{ maxWidth: 220, borderRadius: 8, border: '1px solid var(--line)' }} />}
                        <div className="row" style={{ gap: 6 }}>
                          <input value={b.alt || ''} onChange={(e) => setBlk(i, { ...b, alt: e.target.value })} placeholder={t.imgAlt} style={inp} />
                          <button className="btn btn-ghost" style={{ fontSize: 12, whiteSpace: 'nowrap' }} onClick={() => altAI((form.title[ed] || '') + ' — ' + (b.caption || b.img || ''), i)}>✨ {t.altAI}</button>
                        </div>
                        <input value={b.caption || ''} onChange={(e) => setBlk(i, { ...b, caption: e.target.value })} placeholder={t.imgCap} style={inp} />
                      </div>
                    ) : type === 'list' || type === 'steps' ? (
                      <><textarea value={(b[type] || []).join('\n')} onChange={(e) => setBlk(i, { [type]: e.target.value.split('\n').filter((x) => x.trim()) })} rows={Math.max(3, (b[type] || []).length + 1)} style={inp} /><div className="muted" style={{ fontSize: 11, marginTop: 3 }}>{t.itemsHint}</div></>
                    ) : type === 'h' ? (
                      <input value={b.h || ''} onChange={(e) => setBlk(i, { h: e.target.value })} style={inp} />
                    ) : (
                      <>
                        <textarea value={b[type] || ''} onChange={(e) => setBlk(i, { ...b, [type]: e.target.value })} rows={3} style={inp} />
                        {(type === 'tip' || type === 'note' || type === 'warn') && (<input value={b.title || ''} onChange={(e) => setBlk(i, { ...b, title: e.target.value })} placeholder="Título (opcional)" style={{ ...inp, marginTop: 6 }} />)}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              <span className="muted" style={{ fontSize: 12, alignSelf: 'center' }}>{t.addBlock}:</span>
              {(['p', 'h', 'tip', 'note', 'warn', 'list', 'steps', 'img'] as const).map((k) => (<button key={k} className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => add(k)}>{(t.bt as any)[k]}</button>))}
            </div>

            {/* SEO */}
            <div style={{ marginTop: 16, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>🔎 {t.seoT} ({ed})</div>
              <label style={{ fontSize: 12 }} className="muted">{t.metaT}<input value={form.seo?.title?.[ed] || ''} onChange={(e) => setSeo('title', e.target.value)} style={{ ...inp, marginBottom: 8 }} /></label>
              <label style={{ fontSize: 12 }} className="muted">{t.metaD}<input value={form.seo?.desc?.[ed] || ''} onChange={(e) => setSeo('desc', e.target.value)} style={{ ...inp, marginBottom: 8 }} /></label>
              <label style={{ fontSize: 12 }} className="muted">{t.kws}<input value={(form.seo?.keywords?.[ed] || []).join(', ')} onChange={(e) => setKw(e.target.value)} placeholder="vps forex, vps metatrader" style={{ ...inp, marginBottom: 10 }} /></label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {seoCheck().map((c, k) => (<span key={k} style={{ fontSize: 12.5, color: c.ok ? 'var(--green)' : 'var(--amber)' }}>{c.ok ? '✓' : '⚠'} {c.k}</span>))}
              </div>
            </div>

            {/* CTA */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
              <label style={{ fontSize: 12 }} className="muted">{t.ctah}<input value={form.cta?.href || ''} onChange={(e) => setForm({ ...form, cta: { href: e.target.value, label: form.cta?.label || { es: '', en: '' } } })} placeholder="/dashboard" style={inp} /></label>
              <label style={{ fontSize: 12 }} className="muted">{t.ctal} ({ed})<input value={form.cta?.label?.[ed] || ''} onChange={(e) => setForm({ ...form, cta: { href: form.cta?.href || '', label: { es: form.cta?.label?.es || '', en: form.cta?.label?.en || '', [ed]: e.target.value } as any } })} style={inp} /></label>
            </div>

            {/* Acciones */}
            <div className="row between" style={{ marginTop: 16, flexWrap: 'wrap', gap: 8 }}>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn btn-primary" onClick={save} disabled={busy || !form.slug}>{saved ? t.saved : t.save}</button>
                {customSlugs.includes(form.slug) && <button className="btn btn-ghost" style={{ color: 'var(--red)' }} onClick={del} disabled={busy}>{t.del}</button>}
              </div>
              {form.slug && <a className="btn btn-ghost" href={`/guia/${form.slug}`} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>{t.preview}</a>}
            </div>
          </div>
          )}

          {/* Vista previa en vivo (render exacto de la guía) */}
          {view !== 'edit' && (
            <div className="card" style={{ maxWidth: view === 'preview' ? 700 : 'none', margin: view === 'preview' ? '0 auto' : 0 }}>
              <div className="muted" style={{ fontSize: 11.5, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.04em' }}>👁️ {lang === 'en' ? 'Live preview' : 'Vista previa'}</div>
              <GuideBody article={form} lang={ed} />
            </div>
          )}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
