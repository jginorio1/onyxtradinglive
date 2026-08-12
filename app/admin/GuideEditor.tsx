'use client';
import { useEffect, useMemo, useState } from 'react';

// Editor de guías (solo dueño): editar las del código (crea un override),
// crear nuevas y borrar las propias. Cada guía es bilingüe (ES/EN) y su cuerpo
// son bloques. Los bloques avanzados (recorrido "walk") se conservan tal cual.

type Blk = any;
type Art = {
  slug: string; cat: string; icon: string; cover?: string; updated?: boolean;
  title: { es: string; en: string }; summary: { es: string; en: string };
  body: { es: Blk[]; en: Blk[] }; cta?: { href: string; label: { es: string; en: string } };
};

const T: any = {
  es: {
    title: 'Guías', sub: 'Edita las guías, crea nuevas o bórralas. Se publican al guardar, sin desplegar.',
    nueva: '+ Nueva guía', buscar: 'Buscar guía…', base: 'del código', mine: 'tuya', edited: 'editada',
    slug: 'Slug (URL)', cat: 'Categoría', icon: 'Icono (emoji)', cover: 'Imagen de portada (ruta)', nuevo: 'Marcar como "Nuevo"',
    titulo: 'Título', resumen: 'Resumen', cuerpo: 'Cuerpo', ctah: 'Botón: enlace', ctal: 'Botón: texto',
    addBlock: 'Añadir bloque', save: 'Guardar guía', del: 'Borrar', saved: 'Guardado ✓', preview: 'Ver en la guía ↗',
    up: '↑', down: '↓', rm: 'Quitar', adv: 'Bloque avanzado (recorrido) — se conserva',
    bt: { p: 'Párrafo', h: 'Subtítulo', tip: 'Consejo', note: 'Nota', warn: 'Aviso', list: 'Lista', steps: 'Pasos', img: 'Imagen' },
    itemsHint: 'Un elemento por línea', imgUrl: 'Ruta de la imagen', imgAlt: 'Texto alternativo', imgCap: 'Pie de foto',
    confirmDel: '¿Borrar esta guía? Si venía del código, volverá la original.',
  },
  en: {
    title: 'Guides', sub: 'Edit guides, create new ones or delete them. Published on save, no deploy.',
    nueva: '+ New guide', buscar: 'Search guide…', base: 'from code', mine: 'yours', edited: 'edited',
    slug: 'Slug (URL)', cat: 'Category', icon: 'Icon (emoji)', cover: 'Cover image (path)', nuevo: 'Mark as "New"',
    titulo: 'Title', resumen: 'Summary', cuerpo: 'Body', ctah: 'Button: link', ctal: 'Button: text',
    addBlock: 'Add block', save: 'Save guide', del: 'Delete', saved: 'Saved ✓', preview: 'Open in guide ↗',
    up: '↑', down: '↓', rm: 'Remove', adv: 'Advanced block (walk) — kept as is',
    bt: { p: 'Paragraph', h: 'Heading', tip: 'Tip', note: 'Note', warn: 'Warning', list: 'List', steps: 'Steps', img: 'Image' },
    itemsHint: 'One item per line', imgUrl: 'Image path', imgAlt: 'Alt text', imgCap: 'Caption',
    confirmDel: 'Delete this guide? If it came from code, the original returns.',
  },
};

function blankArt(cats: any[]): Art {
  return { slug: '', cat: cats[0]?.id || 'start', icon: '📖', title: { es: '', en: '' }, summary: { es: '', en: '' }, body: { es: [{ p: '' }], en: [{ p: '' }] } };
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

  async function load() {
    const r = await fetch('/api/guide'); const j = await r.json();
    setArts(j.articles || []); setCats(j.categories || []); setCustom(j.customSlugs || []); setCode(j.codeSlugs || []);
  }
  useEffect(() => { load(); }, []);

  function pick(a: Art) { setForm(JSON.parse(JSON.stringify(a))); setSel(a.slug); setSaved(false); }
  function nuevo() { const a = blankArt(cats); setForm(a); setSel('__new__'); setSaved(false); }

  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    return arts.filter((a) => !n || a.slug.includes(n) || (a.title?.[lang] || '').toLowerCase().includes(n));
  }, [arts, q, lang]);

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

  // ---- edición de bloques del idioma activo ----
  const blocks: Blk[] = form ? (form.body[ed] || []) : [];
  const setBlocks = (bl: Blk[]) => setForm({ ...form!, body: { ...form!.body, [ed]: bl } });
  const setBlk = (i: number, v: Blk) => { const c = [...blocks]; c[i] = v; setBlocks(c); };
  const move = (i: number, d: number) => { const c = [...blocks]; const j = i + d; if (j < 0 || j >= c.length) return; [c[i], c[j]] = [c[j], c[i]]; setBlocks(c); };
  const rm = (i: number) => setBlocks(blocks.filter((_, k) => k !== i));
  const add = (type: string) => {
    const nb: any = type === 'list' || type === 'steps' ? { [type]: [''] } : type === 'img' ? { img: '', alt: '' } : { [type]: '' };
    setBlocks([...blocks, nb]);
  };
  const blkType = (b: Blk) => ['p', 'h', 'tip', 'note', 'warn', 'list', 'steps', 'img'].find((k) => b[k] !== undefined) || (b.walk ? 'walk' : 'adv');

  const inp: React.CSSProperties = { width: '100%', margin: 0, fontSize: 13 };
  const catName = (id: string) => { const c = cats.find((x) => x.id === id); return c ? (c.name?.[lang] || id) : id; };

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800 }}>📚 {t.title}</div>
        <div className="muted" style={{ fontSize: 13 }}>{t.sub}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px,300px) 1fr', gap: 14, alignItems: 'start' }}>
        {/* Lista */}
        <div className="card" style={{ padding: 12 }}>
          <button className="btn btn-primary" style={{ width: '100%', marginBottom: 8, fontSize: 13 }} onClick={nuevo}>{t.nueva}</button>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.buscar} style={{ ...inp, marginBottom: 8 }} />
          <div style={{ maxHeight: 520, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 5 }}>
            {list.map((a) => {
              const isMine = customSlugs.includes(a.slug); const isCode = codeSlugs.includes(a.slug);
              const tag = isMine && isCode ? t.edited : isMine ? t.mine : t.base;
              return (
                <button key={a.slug} onClick={() => pick(a)} style={{ textAlign: 'left', padding: '8px 10px', borderRadius: 9, cursor: 'pointer', border: '1px solid ' + (sel === a.slug ? 'var(--brand)' : 'var(--line)'), background: sel === a.slug ? 'rgba(124,140,255,.12)' : 'var(--bg2)', color: 'var(--tx)' }}>
                  <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                    <span>{a.icon}</span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title?.[lang] || a.slug}</span>
                    <span className="pill" style={{ fontSize: 9, background: 'var(--card2)', color: 'var(--mut)' }}>{tag}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Editor */}
        {!form ? (
          <div className="card muted" style={{ fontSize: 13 }}>{lang === 'en' ? 'Pick a guide or create a new one.' : 'Elige una guía o crea una nueva.'}</div>
        ) : (
          <div className="card">
            {/* Meta */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10, marginBottom: 12 }}>
              <label style={{ fontSize: 12 }} className="muted">{t.slug}<input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} style={inp} /></label>
              <label style={{ fontSize: 12 }} className="muted">{t.cat}
                <select value={form.cat} onChange={(e) => setForm({ ...form, cat: e.target.value })} style={inp}>
                  {cats.map((c) => <option key={c.id} value={c.id}>{c.name?.[lang] || c.id}</option>)}
                </select>
              </label>
              <label style={{ fontSize: 12 }} className="muted">{t.icon}<input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} style={inp} /></label>
              <label style={{ fontSize: 12 }} className="muted">{t.cover}<input value={form.cover || ''} onChange={(e) => setForm({ ...form, cover: e.target.value })} placeholder="/guia/…svg" style={inp} /></label>
            </div>
            <label className="row" style={{ gap: 7, fontSize: 13, cursor: 'pointer', marginBottom: 12 }}><input type="checkbox" checked={!!form.updated} onChange={(e) => setForm({ ...form, updated: e.target.checked })} style={{ width: 'auto', margin: 0 }} /> {t.nuevo}</label>

            {/* Idioma */}
            <div className="row" style={{ gap: 6, marginBottom: 10 }}>
              {(['es', 'en'] as const).map((l) => (
                <button key={l} onClick={() => setEd(l)} className={'btn ' + (ed === l ? 'btn-primary' : 'btn-ghost')} style={{ fontSize: 12, padding: '4px 12px' }}>{l.toUpperCase()}</button>
              ))}
            </div>

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
                        <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => move(i, -1)}>{t.up}</button>
                        <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => move(i, 1)}>{t.down}</button>
                        <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 12, color: 'var(--red)' }} onClick={() => rm(i)}>{t.rm}</button>
                      </span>
                    </div>
                    {type === 'walk' || type === 'adv' ? (
                      <div className="muted" style={{ fontSize: 12 }}>{t.adv}</div>
                    ) : type === 'img' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <input value={b.img || ''} onChange={(e) => setBlk(i, { ...b, img: e.target.value })} placeholder={t.imgUrl} style={inp} />
                        <input value={b.alt || ''} onChange={(e) => setBlk(i, { ...b, alt: e.target.value })} placeholder={t.imgAlt} style={inp} />
                        <input value={b.caption || ''} onChange={(e) => setBlk(i, { ...b, caption: e.target.value })} placeholder={t.imgCap} style={inp} />
                      </div>
                    ) : type === 'list' || type === 'steps' ? (
                      <>
                        <textarea value={(b[type] || []).join('\n')} onChange={(e) => setBlk(i, { [type]: e.target.value.split('\n').filter((x) => x.trim()) })} rows={Math.max(3, (b[type] || []).length + 1)} style={inp} />
                        <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>{t.itemsHint}</div>
                      </>
                    ) : type === 'h' ? (
                      <input value={b.h || ''} onChange={(e) => setBlk(i, { h: e.target.value })} style={inp} />
                    ) : (
                      <>
                        <textarea value={b[type] || ''} onChange={(e) => setBlk(i, { ...b, [type]: e.target.value })} rows={3} style={inp} />
                        {(type === 'tip' || type === 'note' || type === 'warn') && (
                          <input value={b.title || ''} onChange={(e) => setBlk(i, { ...b, title: e.target.value })} placeholder="Título (opcional)" style={{ ...inp, marginTop: 6 }} />
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              <span className="muted" style={{ fontSize: 12, alignSelf: 'center' }}>{t.addBlock}:</span>
              {(['p', 'h', 'tip', 'note', 'warn', 'list', 'steps', 'img'] as const).map((k) => (
                <button key={k} className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => add(k)}>{(t.bt as any)[k]}</button>
              ))}
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
      </div>
    </div>
  );
}
