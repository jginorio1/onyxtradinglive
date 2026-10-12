'use client';
// Editor del centro de guías visual "/como-usar" (solo dueño). Edita secciones,
// guías y pasos: títulos ES/EN, descripciones, la imagen (horneada con sus
// indicadores) y la LEYENDA (marcadores: número + texto bilingüe). Se guarda en
// la nube y /como-usar lo sirve al instante, sin desplegar.
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { toast, confirmDialog } from '@/lib/toast';
import { DEFAULT_HOWTO, type Cat, type Guide, type Step, type Marker } from '@/lib/howtoDefault';

const T: any = {
  es: { title: 'Cómo usar (/como-usar)', sub: 'Edita las guías visuales: textos, pasos e imágenes. Se publica al guardar, sin desplegar.',
    save: 'Guardar', saved: 'Guardado ✓', view: 'Ver ↗', reset: 'Restaurar del código',
    secs: 'Secciones y guías', addSec: '+ Sección', addGuide: '+ Guía', up: '▲', down: '▼', del: 'Borrar',
    secName: 'Nombre de la sección', gId: 'ID (slug)', gIcon: 'Icono', gMins: 'Minutos', gTitle: 'Título de la guía',
    steps: 'Pasos', addStep: '+ Paso', stTitle: 'Título del paso', img: 'Imagen (ruta o sube)', up2: 'Subir', stDes: 'Descripción',
    mk: 'Leyenda (indicadores)', addMk: '+ Indicador', mkN: 'Nº', mkTxt: 'Texto', none: 'Sin guía seleccionada. Elige una a la izquierda.',
    bake: 'Los indicadores naranjas van horneados en la propia imagen. Aquí solo editas la leyenda numerada que aparece debajo.',
    confReset: '¿Volver a las guías del código? Se pierden los cambios guardados en la nube.', es: 'ES', en: 'EN' },
  en: { title: 'How-to (/como-usar)', sub: 'Edit the visual guides: text, steps and images. Published on save, no deploy.',
    save: 'Save', saved: 'Saved ✓', view: 'Open ↗', reset: 'Reset to code',
    secs: 'Sections and guides', addSec: '+ Section', addGuide: '+ Guide', up: '▲', down: '▼', del: 'Delete',
    secName: 'Section name', gId: 'ID (slug)', gIcon: 'Icon', gMins: 'Minutes', gTitle: 'Guide title',
    steps: 'Steps', addStep: '+ Step', stTitle: 'Step title', img: 'Image (path or upload)', up2: 'Upload', stDes: 'Description',
    mk: 'Legend (markers)', addMk: '+ Marker', mkN: '#', mkTxt: 'Text', none: 'No guide selected. Pick one on the left.',
    bake: 'The orange markers are baked into the image itself. Here you only edit the numbered legend shown below it.',
    confReset: 'Return to the code guides? Changes saved in the cloud are lost.', es: 'ES', en: 'EN' },
};

const blankStep = (): Step => ({ es: 'Paso nuevo', en: 'New step', des_es: '', des_en: '', img: '', markers: [] });
const blankGuide = (): Guide => ({ id: 'guia-' + Date.now().toString(36), icon: '📖', es: 'Guía nueva', en: 'New guide', mins: 2, steps: [blankStep()] });
const blankCat = (): Cat => ({ es: 'Sección nueva', en: 'New section', guides: [blankGuide()] });

export default function HowToEditor({ lang }: { lang: 'es' | 'en' }) {
  const t = T[lang];
  const [cats, setCats] = useState<Cat[]>(DEFAULT_HOWTO);
  const [sel, setSel] = useState<[number, number]>([0, 0]);  // [sección, guía]
  const [ed, setEd] = useState<'es' | 'en'>(lang);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cbRef = useRef<((url: string) => void) | null>(null);

  useEffect(() => {
    fetch('/api/howto').then((r) => r.json()).then((j) => {
      if (Array.isArray(j?.cats) && j.cats.length) setCats(j.cats);
    }).catch(() => {});
  }, []);

  // Mutación inmutable: clona, aplica y guarda en estado.
  const mut = (fn: (c: Cat[]) => void) => setCats((prev) => { const c = JSON.parse(JSON.stringify(prev)); fn(c); setSaved(false); return c; });

  const [si, gi] = sel;
  const cat = cats[si];
  const guide = cat?.guides[gi];

  async function save() {
    setBusy(true);
    try {
      const r = await fetch('/api/howto', { method: 'POST', body: JSON.stringify({ cats }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'error');
      setSaved(true); toast(t.saved); setTimeout(() => setSaved(false), 2500);
    } catch (e: any) { toast(e?.message || 'Error', 'error'); } finally { setBusy(false); }
  }
  async function reset() {
    if (!(await confirmDialog(t.confReset))) return;
    setBusy(true);
    try { await fetch('/api/howto', { method: 'DELETE' }); const j = await (await fetch('/api/howto')).json(); if (Array.isArray(j?.cats)) { setCats(j.cats); setSel([0, 0]); } toast(t.saved); }
    catch { } finally { setBusy(false); }
  }

  function pickImg(cb: (url: string) => void) { cbRef.current = cb; fileRef.current?.click(); }
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
    const data: string = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(f); });
    try {
      const r = await fetch('/api/admin/blog/upload', { method: 'POST', body: JSON.stringify({ name: f.name, data }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error || 'error');
      cbRef.current?.(j.url); setSaved(false);
    } catch (e: any) { toast(e?.message || 'Error al subir', 'error'); }
  }

  const Lbl = (p: any) => <div style={{ fontSize: 11, color: 'var(--mut)', margin: '8px 0 3px' }}>{p.children}</div>;
  const inp: any = { width: '100%', background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 8, padding: '7px 9px', color: 'var(--tx)', fontSize: 13 };

  return (
    <div>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
        <div><div style={{ fontWeight: 800, fontSize: 18 }}>{t.title}</div><div style={{ color: 'var(--mut)', fontSize: 12.5 }}>{t.sub}</div></div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 2, background: 'var(--card2)', borderRadius: 8, padding: 2 }}>
            {(['es', 'en'] as const).map((l) => <button key={l} className={'btn ' + (ed === l ? 'btn-primary' : 'btn-ghost')} style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setEd(l)}>{t[l]}</button>)}
          </div>
          <Link href="/como-usar" target="_blank" className="btn btn-ghost" style={{ fontSize: 12 }}>{t.view}</Link>
          <button className="btn btn-ghost" style={{ fontSize: 12 }} disabled={busy} onClick={reset}>{t.reset}</button>
          <button className="btn btn-primary" style={{ fontSize: 13 }} disabled={busy} onClick={save}>{saved ? t.saved : t.save}</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
        {/* ── Árbol: secciones y guías ── */}
        <div className="card" style={{ padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{t.secs}</div>
            <button className="btn btn-ghost" style={{ marginLeft: 'auto', fontSize: 11 }} onClick={() => mut((c) => { c.push(blankCat()); })}>{t.addSec}</button>
          </div>
          {cats.map((c, ci) => (
            <div key={ci} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <input value={ed === 'es' ? c.es : c.en} onChange={(e) => mut((cc) => { if (ed === 'es') cc[ci].es = e.target.value; else cc[ci].en = e.target.value; })}
                  style={{ ...inp, fontWeight: 700, fontSize: 12, padding: '5px 7px' }} />
                <button className="btn btn-ghost" style={{ fontSize: 10, padding: '3px 6px' }} title={t.up} onClick={() => mut((cc) => { if (ci > 0) { [cc[ci - 1], cc[ci]] = [cc[ci], cc[ci - 1]]; } })}>{t.up}</button>
                <button className="btn btn-ghost" style={{ fontSize: 10, padding: '3px 6px' }} title={t.down} onClick={() => mut((cc) => { if (ci < cc.length - 1) { [cc[ci + 1], cc[ci]] = [cc[ci], cc[ci + 1]]; } })}>{t.down}</button>
                <button className="btn btn-ghost" style={{ fontSize: 10, padding: '3px 6px', color: '#e0426a' }} title={t.del} onClick={() => mut((cc) => { cc.splice(ci, 1); })}>✕</button>
              </div>
              <div style={{ paddingLeft: 8, marginTop: 4 }}>
                {c.guides.map((g, ggi) => {
                  const on = ci === si && ggi === gi;
                  return (
                    <div key={ggi} style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 3 }}>
                      <button onClick={() => setSel([ci, ggi])} style={{ flex: 1, textAlign: 'left', background: on ? 'color-mix(in srgb,var(--brand) 16%,transparent)' : 'transparent', border: '1px solid ' + (on ? 'var(--brand)' : 'var(--line)'), borderRadius: 7, padding: '5px 8px', color: on ? 'var(--tx)' : 'var(--mut)', cursor: 'pointer', fontSize: 12.5 }}>
                        {g.icon} {(ed === 'es' ? g.es : g.en) || g.id} <span style={{ opacity: .6 }}>· {g.steps.length}</span>
                      </button>
                      <button className="btn btn-ghost" style={{ fontSize: 9, padding: '3px 5px' }} onClick={() => mut((cc) => { if (ggi > 0) { [cc[ci].guides[ggi - 1], cc[ci].guides[ggi]] = [cc[ci].guides[ggi], cc[ci].guides[ggi - 1]]; } })}>{t.up}</button>
                      <button className="btn btn-ghost" style={{ fontSize: 9, padding: '3px 5px' }} onClick={() => mut((cc) => { const gs = cc[ci].guides; if (ggi < gs.length - 1) { [gs[ggi + 1], gs[ggi]] = [gs[ggi], gs[ggi + 1]]; } })}>{t.down}</button>
                    </div>
                  );
                })}
                <button className="btn btn-ghost" style={{ fontSize: 11, marginTop: 4 }} onClick={() => mut((cc) => { cc[ci].guides.push(blankGuide()); })}>{t.addGuide}</button>
              </div>
            </div>
          ))}
        </div>

        {/* ── Editor de la guía ── */}
        <div className="card" style={{ padding: 14 }}>
          {!guide ? <div style={{ color: 'var(--mut)', fontSize: 13 }}>{t.none}</div> : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px', gap: 10 }}>
                <div><Lbl>{t.gTitle} ({t[ed]})</Lbl><input value={ed === 'es' ? guide.es : guide.en} onChange={(e) => mut((c) => { if (ed === 'es') c[si].guides[gi].es = e.target.value; else c[si].guides[gi].en = e.target.value; })} style={inp} /></div>
                <div><Lbl>{t.gIcon}</Lbl><input value={guide.icon} onChange={(e) => mut((c) => { c[si].guides[gi].icon = e.target.value; })} style={inp} /></div>
                <div><Lbl>{t.gMins}</Lbl><input type="number" value={guide.mins} onChange={(e) => mut((c) => { c[si].guides[gi].mins = Number(e.target.value) || 0; })} style={inp} /></div>
              </div>
              <div><Lbl>{t.gId}</Lbl><input value={guide.id} onChange={(e) => mut((c) => { c[si].guides[gi].id = e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-'); })} style={inp} /></div>
              <div style={{ display: 'flex', alignItems: 'center', margin: '16px 0 6px' }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{t.steps}</div>
                <button className="btn btn-ghost" style={{ marginLeft: 'auto', fontSize: 11 }} onClick={() => mut((c) => { c[si].guides[gi].steps.push(blankStep()); })}>{t.addStep}</button>
                <button className="btn btn-ghost" style={{ fontSize: 11, marginLeft: 6, color: '#e0426a' }} onClick={() => mut((c) => { c[si].guides.splice(gi, 1); })} title={t.del + ' guía'}>{t.del} guía</button>
              </div>
              <div style={{ background: 'color-mix(in srgb,var(--brand) 8%,transparent)', border: '1px dashed color-mix(in srgb,var(--brand) 40%,var(--line))', borderRadius: 9, padding: '8px 11px', fontSize: 12, color: 'var(--mut)', marginBottom: 12 }}>💡 {t.bake}</div>

              {guide.steps.map((st, sti) => (
                <div key={sti} className="card" style={{ padding: 12, marginBottom: 10, background: 'var(--card2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <div style={{ width: 24, height: 24, borderRadius: 7, background: 'linear-gradient(135deg,#ffcf5c,#ff6a2b)', color: '#241002', fontWeight: 800, fontSize: 12, display: 'grid', placeItems: 'center' }}>{sti + 1}</div>
                    <input value={ed === 'es' ? st.es : st.en} onChange={(e) => mut((c) => { if (ed === 'es') c[si].guides[gi].steps[sti].es = e.target.value; else c[si].guides[gi].steps[sti].en = e.target.value; })} placeholder={t.stTitle} style={{ ...inp, flex: 1 }} />
                    <button className="btn btn-ghost" style={{ fontSize: 10, padding: '4px 7px' }} onClick={() => mut((c) => { const s = c[si].guides[gi].steps; if (sti > 0) { [s[sti - 1], s[sti]] = [s[sti], s[sti - 1]]; } })}>{t.up}</button>
                    <button className="btn btn-ghost" style={{ fontSize: 10, padding: '4px 7px' }} onClick={() => mut((c) => { const s = c[si].guides[gi].steps; if (sti < s.length - 1) { [s[sti + 1], s[sti]] = [s[sti], s[sti + 1]]; } })}>{t.down}</button>
                    <button className="btn btn-ghost" style={{ fontSize: 10, padding: '4px 7px', color: '#e0426a' }} onClick={() => mut((c) => { c[si].guides[gi].steps.splice(sti, 1); })}>✕</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 10, alignItems: 'end' }}>
                    <div><Lbl>{t.img}</Lbl><input value={st.img} onChange={(e) => mut((c) => { c[si].guides[gi].steps[sti].img = e.target.value; })} placeholder="guia-img/…" style={inp} /></div>
                    <button className="btn btn-ghost" style={{ fontSize: 12, height: 34 }} onClick={() => pickImg((url) => mut((c) => { c[si].guides[gi].steps[sti].img = url; }))}>⬆ {t.up2}</button>
                  </div>
                  {st.img ? <img src={st.img.startsWith('http') ? st.img : '/' + st.img} alt="" style={{ marginTop: 8, maxHeight: 150, borderRadius: 8, border: '1px solid var(--line)' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /> : null}
                  <Lbl>{t.stDes} ({t[ed]})</Lbl>
                  <textarea value={ed === 'es' ? st.des_es : st.des_en} onChange={(e) => mut((c) => { if (ed === 'es') c[si].guides[gi].steps[sti].des_es = e.target.value; else c[si].guides[gi].steps[sti].des_en = e.target.value; })} rows={5} style={{ ...inp, fontFamily: 'inherit', resize: 'vertical' }} />

                  <div style={{ display: 'flex', alignItems: 'center', margin: '10px 0 4px' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mut)' }}>{t.mk}</div>
                    <button className="btn btn-ghost" style={{ marginLeft: 'auto', fontSize: 10 }} onClick={() => mut((c) => { const m = c[si].guides[gi].steps[sti].markers || (c[si].guides[gi].steps[sti].markers = []); m.push({ x: 50, y: 50, n: m.length + 1, es: '', en: '' }); })}>{t.addMk}</button>
                  </div>
                  {(st.markers || []).map((m: Marker, mi: number) => (
                    <div key={mi} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                      <input type="number" value={m.n ?? mi + 1} onChange={(e) => mut((c) => { c[si].guides[gi].steps[sti].markers![mi].n = Number(e.target.value) || 0; })} style={{ ...inp, width: 54 }} title={t.mkN} />
                      <input value={ed === 'es' ? m.es : m.en} onChange={(e) => mut((c) => { const mm = c[si].guides[gi].steps[sti].markers![mi]; if (ed === 'es') mm.es = e.target.value; else mm.en = e.target.value; })} placeholder={t.mkTxt} style={{ ...inp, flex: 1 }} />
                      <button className="btn btn-ghost" style={{ fontSize: 10, padding: '4px 7px', color: '#e0426a' }} onClick={() => mut((c) => { c[si].guides[gi].steps[sti].markers!.splice(mi, 1); })}>✕</button>
                    </div>
                  ))}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
