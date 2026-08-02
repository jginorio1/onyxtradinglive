'use client';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/lang';

// Landing Builder · Fase 1: Hero del landing, FAQ por página y tabla de comparación.
// Guarda en landing_content; las páginas lo aplican por encima del texto en código.
type Faq = [string, string, string, string];
type Row = { es: string; en: string; v: (boolean | string)[]; head?: boolean };

const FAQ_PAGES: [string, string, string][] = [
  ['landing', 'Landing', 'Landing'],
  ['embajadores', 'Embajadores', 'Ambassadors'],
  ['invita', 'Invita y gana', 'Invite & earn'],
  ['mentores', 'Mentores', 'Mentors'],
];
const PLAN_COLS = ['Free', 'Pro', 'Elite', 'Black'];

type Card = { i?: string; t_es: string; t_en: string; d_es: string; d_en: string };

// Editor reutilizable de una lista de tarjetas (eco / features / pasos).
// showIcon=false para pasos numerados. tLabel/dLabel personalizan las etiquetas.
function CardList({ cards, onChange, showIcon, addLabel, tLabel, dLabel, es }: {
  cards: Card[]; onChange: (c: Card[]) => void; showIcon: boolean;
  addLabel: string; tLabel: string; dLabel: string; es: boolean;
}) {
  const inp = { width: '100%', margin: 0 } as any;
  const set = (i: number, patch: Partial<Card>) => { const r = [...cards]; r[i] = { ...r[i], ...patch }; onChange(r); };
  return (
    <>
      {cards.map((c, i) => (
        <div key={i} className="card" style={{ padding: 12, marginBottom: 10, background: 'var(--card2)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: showIcon ? '70px 1fr 1fr' : '1fr 1fr', gap: 8, marginBottom: 6, alignItems: 'center' }}>
            {showIcon && <input title={es ? 'Emoji / icono' : 'Emoji / icon'} placeholder="🛡️" style={{ ...inp, textAlign: 'center', fontSize: 18 }} value={c.i || ''} onChange={(e) => set(i, { i: e.target.value })} />}
            <input placeholder={`${tLabel} (ES)`} style={inp} value={c.t_es} onChange={(e) => set(i, { t_es: e.target.value })} />
            <input placeholder={`${tLabel} (EN)`} style={inp} value={c.t_en} onChange={(e) => set(i, { t_en: e.target.value })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <textarea rows={2} placeholder={`${dLabel} (ES)`} style={inp} value={c.d_es} onChange={(e) => set(i, { d_es: e.target.value })} />
            <textarea rows={2} placeholder={`${dLabel} (EN)`} style={inp} value={c.d_en} onChange={(e) => set(i, { d_en: e.target.value })} />
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button className="btn btn-ghost" style={{ padding: '3px 9px', fontSize: 12 }} disabled={!i} onClick={() => { const r = [...cards];[r[i - 1], r[i]] = [r[i], r[i - 1]]; onChange(r); }}>↑</button>
            <button className="btn btn-ghost" style={{ padding: '3px 9px', fontSize: 12 }} disabled={i === cards.length - 1} onClick={() => { const r = [...cards];[r[i + 1], r[i]] = [r[i], r[i + 1]]; onChange(r); }}>↓</button>
            <button className="btn btn-ghost" style={{ padding: '3px 9px', fontSize: 12, color: 'var(--red)' }} onClick={() => onChange(cards.filter((_, j) => j !== i))}>{es ? 'Eliminar' : 'Delete'}</button>
          </div>
        </div>
      ))}
      <button className="btn btn-ghost" onClick={() => onChange([...cards, { i: showIcon ? '✨' : undefined, t_es: '', t_en: '', d_es: '', d_en: '' }])}>＋ {addLabel}</button>
    </>
  );
}

export default function LandingBuilder() {
  const { lang } = useLang();
  const es = lang === 'es';
  const L = (a: string, b: string) => (es ? a : b);

  const [sub, setSub] = useState<'hero' | 'faq' | 'compare' | 'eco' | 'features' | 'how' | 'trust' | 'cta' | 'pages' | 'nav' | 'footer' | 'legal'>('hero');
  const [pageId, setPageId] = useState('embajadores');
  const [legalDoc, setLegalDoc] = useState<'terms' | 'privacy'>('terms');
  const [content, setContent] = useState<any>(null);
  const [defaults, setDefaults] = useState<any>({});
  const [faqPage, setFaqPage] = useState('landing');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/admin/landing-content').then((r) => r.json()).then((j) => { setContent(j.content || {}); setDefaults(j.defaults || {}); }).catch(() => setContent({}));
  }, []);

  async function save(patch: any) {
    setBusy(true);
    try {
      const r = await fetch('/api/admin/landing-content', { method: 'PATCH', body: JSON.stringify(patch) });
      const j = await r.json();
      if (j.content) setContent(j.content);
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } finally { setBusy(false); }
  }

  if (!content) return <div className="muted">…</div>;

  const hero = content.hero || {};
  const setHero = (k: string, v: string) => setContent({ ...content, hero: { ...hero, [k]: v } });

  // Si no hay FAQ guardada para esta página (o quedó vacía de una versión anterior),
  // sembramos con las del código (defaults.faq) para que el editor no salga vacío.
  const savedFaq = content.faq?.[faqPage];
  const faqRows: Faq[] = (Array.isArray(savedFaq) && savedFaq.length) ? savedFaq : (defaults.faq?.[faqPage] || []);
  const setFaq = (rows: Faq[]) => setContent({ ...content, faq: { ...(content.faq || {}), [faqPage]: rows } });

  const compareRows: Row[] = content.compare?.length ? content.compare : (defaults.compare || []);
  const setCompare = (rows: Row[]) => setContent({ ...content, compare: rows });

  // Fase 2 · si no hay override guardado, se arranca desde los textos actuales del código.
  const eco = content.eco || defaults.eco || {};
  const setEco = (patch: any) => setContent({ ...content, eco: { ...eco, ...patch } });
  const features = content.features || defaults.features || {};
  const setFeatures = (patch: any) => setContent({ ...content, features: { ...features, ...patch } });
  const how = content.how || defaults.how || {};
  const setHow = (patch: any) => setContent({ ...content, how: { ...how, ...patch } });
  const trust = content.trust || defaults.trust || { es: [], en: [] };
  const setTrust = (patch: any) => setContent({ ...content, trust: { ...trust, ...patch } });
  const cta = content.cta || defaults.cta || {};
  const setCta = (patch: any) => setContent({ ...content, cta: { ...cta, ...patch } });

  // Fase 3/4
  const pageDefs = defaults.pages || {};                 // { id: {label_es,label_en,fields:[]} }
  const pageVals = content.pages || {};                  // { id: { key: {es,en} } }
  const setPageField = (pid: string, key: string, lng: 'es' | 'en', v: string) =>
    setContent({ ...content, pages: { ...pageVals, [pid]: { ...(pageVals[pid] || {}), [key]: { ...((pageVals[pid] || {})[key] || {}), [lng]: v } } } });
  const navDefs = defaults.nav || [];                    // [{key,es,en}]
  const navVals = content.nav || {};                     // { key: {es,en} }
  const setNav = (key: string, lng: 'es' | 'en', v: string) =>
    setContent({ ...content, nav: { ...navVals, [key]: { ...(navVals[key] || {}), [lng]: v } } });
  const footer = content.footer || defaults.footer || { links: [] };
  const setFooter = (patch: any) => setContent({ ...content, footer: { ...footer, ...patch } });
  const legal = content.legal || defaults.legal || {};
  const setLegal = (patch: any) => setContent({ ...content, legal: { ...legal, ...patch } });

  const inp = { width: '100%', margin: 0 } as any;
  const lbl = { fontSize: 11.5, color: 'var(--mut)', marginBottom: 3 } as any;

  return (
    <>
      <div className="row between" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        <div>
          <h3 style={{ marginBottom: 2 }}>🧩 Landing Builder</h3>
          <p className="muted" style={{ fontSize: 12.5 }}>{L('Edita el contenido público. Si dejas un campo vacío, se usa el texto original.', 'Edit public content. Leave a field empty to keep the original text.')}</p>
        </div>
        {saved && <span className="pill" style={{ color: 'var(--soft-green)', background: 'rgba(52,226,160,.15)' }}>{L('✓ Guardado', '✓ Saved')}</span>}
      </div>

      {/* sub-tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {([['hero', L('Hero del landing', 'Landing hero')], ['features', L('Funciones', 'Features')], ['eco', L('Ecosistema', 'Ecosystem')], ['how', L('Cómo funciona', 'How it works')], ['trust', L('Insignias de confianza', 'Trust badges')], ['cta', L('Llamada final (CTA)', 'Final CTA')], ['faq', L('FAQ por página', 'FAQ per page')], ['compare', L('Comparación de planes', 'Plan comparison')], ['pages', L('Otras páginas', 'Other pages')], ['nav', L('Menú (nav)', 'Menu (nav)')], ['footer', L('Footer', 'Footer')], ['legal', L('Legales', 'Legal')]] as const).map(([k, label]) => (
          <button key={k} className={'btn ' + (sub === k ? 'btn-primary' : 'btn-ghost')} style={{ padding: '6px 13px', fontSize: 13 }} onClick={() => setSub(k as any)}>{label}</button>
        ))}
      </div>

      {/* HERO */}
      {sub === 'hero' && (
        <div className="card" style={{ padding: 18, maxWidth: 640 }}>
          <div style={{ display: 'grid', gap: 12 }}>
            {[['h1a', L('Título — línea 1', 'Title — line 1')], ['h1b', L('Título — línea 2', 'Title — line 2')], ['sub', L('Subtítulo', 'Subtitle')]].map(([k, label]) => (
              <div key={k} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><div style={lbl}>{label} · ES</div>{k === 'sub' ? <textarea rows={2} style={inp} value={hero[`${k}_es`] || ''} onChange={(e) => setHero(`${k}_es`, e.target.value)} /> : <input style={inp} value={hero[`${k}_es`] || ''} onChange={(e) => setHero(`${k}_es`, e.target.value)} />}</div>
                <div><div style={lbl}>{label} · EN</div>{k === 'sub' ? <textarea rows={2} style={inp} value={hero[`${k}_en`] || ''} onChange={(e) => setHero(`${k}_en`, e.target.value)} /> : <input style={inp} value={hero[`${k}_en`] || ''} onChange={(e) => setHero(`${k}_en`, e.target.value)} />}</div>
              </div>
            ))}
          </div>
          <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={() => save({ hero })} disabled={busy}>{busy ? '…' : L('Guardar hero', 'Save hero')}</button>
        </div>
      )}

      {/* FAQ */}
      {sub === 'faq' && (
        <div className="card" style={{ padding: 18 }}>
          <div style={{ marginBottom: 12 }}>
            <span className="muted" style={{ fontSize: 12.5, marginRight: 8 }}>{L('Página', 'Page')}:</span>
            <select value={faqPage} onChange={(e) => setFaqPage(e.target.value)} style={{ padding: '5px 10px' }}>
              {FAQ_PAGES.map(([id, e2, en]) => <option key={id} value={id}>{es ? e2 : en}</option>)}
            </select>
            <span className="muted" style={{ fontSize: 11.5, marginLeft: 10 }}>{L('Vacío = usa las FAQ del código.', 'Empty = uses the code FAQ.')}</span>
          </div>
          {faqRows.map((row, i) => (
            <div key={i} className="card" style={{ padding: 12, marginBottom: 10, background: 'var(--card2)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 6 }}>
                <input placeholder={L('Pregunta (ES)', 'Question (ES)')} style={inp} value={row[0]} onChange={(e) => { const r = [...faqRows]; r[i] = [e.target.value, row[1], row[2], row[3]]; setFaq(r); }} />
                <input placeholder={L('Pregunta (EN)', 'Question (EN)')} style={inp} value={row[2]} onChange={(e) => { const r = [...faqRows]; r[i] = [row[0], row[1], e.target.value, row[3]]; setFaq(r); }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <textarea rows={2} placeholder={L('Respuesta (ES)', 'Answer (ES)')} style={inp} value={row[1]} onChange={(e) => { const r = [...faqRows]; r[i] = [row[0], e.target.value, row[2], row[3]]; setFaq(r); }} />
                <textarea rows={2} placeholder={L('Respuesta (EN)', 'Answer (EN)')} style={inp} value={row[3]} onChange={(e) => { const r = [...faqRows]; r[i] = [row[0], row[1], row[2], e.target.value]; setFaq(r); }} />
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <button className="btn btn-ghost" style={{ padding: '3px 9px', fontSize: 12 }} disabled={!i} onClick={() => { const r = [...faqRows];[r[i - 1], r[i]] = [r[i], r[i - 1]]; setFaq(r); }}>↑</button>
                <button className="btn btn-ghost" style={{ padding: '3px 9px', fontSize: 12 }} disabled={i === faqRows.length - 1} onClick={() => { const r = [...faqRows];[r[i + 1], r[i]] = [r[i], r[i + 1]]; setFaq(r); }}>↓</button>
                <button className="btn btn-ghost" style={{ padding: '3px 9px', fontSize: 12, color: 'var(--red)' }} onClick={() => setFaq(faqRows.filter((_, j) => j !== i))}>{L('Eliminar', 'Delete')}</button>
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button className="btn btn-ghost" onClick={() => setFaq([...faqRows, ['', '', '', '']])}>＋ {L('Añadir pregunta', 'Add question')}</button>
            <button className="btn btn-primary" onClick={() => save({ faq: { ...(content.faq || {}), [faqPage]: faqRows } })} disabled={busy}>{busy ? '…' : L('Guardar FAQ', 'Save FAQ')}</button>
          </div>
        </div>
      )}

      {/* COMPARACIÓN */}
      {sub === 'compare' && (
        <div className="card" style={{ padding: 18 }}>
          <p className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>{L('Cada celda de plan: escribe “si” (✓), “-” (nada) o un texto (ej. “30 días”). Marca “Grupo” para filas de subtítulo.', 'Each plan cell: type “yes” (✓), “-” (none) or text (e.g. “30 days”). Tick “Group” for subtitle rows.')}</p>
          <div style={{ overflowX: 'auto' }}>
            {compareRows.map((row, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.6fr repeat(4, 0.7fr) auto', gap: 6, alignItems: 'center', padding: '6px 0', borderTop: i ? '1px solid var(--line)' : 'none' }}>
                <input placeholder="ES" style={inp} value={row.es} onChange={(e) => { const r = [...compareRows]; r[i] = { ...row, es: e.target.value }; setCompare(r); }} />
                <input placeholder="EN" style={inp} value={row.en} onChange={(e) => { const r = [...compareRows]; r[i] = { ...row, en: e.target.value }; setCompare(r); }} />
                {PLAN_COLS.map((c, ci) => (
                  <input key={ci} title={c} placeholder={c} style={{ ...inp, opacity: row.head ? .3 : 1 }} disabled={!!row.head}
                    value={row.v?.[ci] === true ? 'si' : row.v?.[ci] === false ? '-' : String(row.v?.[ci] ?? '')}
                    onChange={(e) => { const r = [...compareRows]; const v = [...(row.v || [false, false, false, false])]; const t = e.target.value.trim().toLowerCase(); v[ci] = (t === 'si' || t === 'sí' || t === 'yes' || t === 'true' || t === '✓') ? true : (t === '' || t === '-' || t === 'no') ? false : e.target.value; r[i] = { ...row, v }; setCompare(r); }} />
                ))}
                <div style={{ display: 'flex', gap: 3 }}>
                  <button className="btn btn-ghost" title={L('Grupo', 'Group')} style={{ padding: '2px 6px', fontSize: 11, background: row.head ? 'var(--brand)' : undefined, color: row.head ? '#fff' : undefined }} onClick={() => { const r = [...compareRows]; r[i] = { ...row, head: !row.head }; setCompare(r); }}>H</button>
                  <button className="btn btn-ghost" style={{ padding: '2px 6px', fontSize: 11 }} disabled={!i} onClick={() => { const r = [...compareRows];[r[i - 1], r[i]] = [r[i], r[i - 1]]; setCompare(r); }}>↑</button>
                  <button className="btn btn-ghost" style={{ padding: '2px 6px', fontSize: 11 }} disabled={i === compareRows.length - 1} onClick={() => { const r = [...compareRows];[r[i + 1], r[i]] = [r[i], r[i + 1]]; setCompare(r); }}>↓</button>
                  <button className="btn btn-ghost" style={{ padding: '2px 6px', fontSize: 11, color: 'var(--red)' }} onClick={() => setCompare(compareRows.filter((_, j) => j !== i))}>✕</button>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <button className="btn btn-ghost" onClick={() => setCompare([...compareRows, { es: '', en: '', v: [false, false, false, false] }])}>＋ {L('Añadir fila', 'Add row')}</button>
            <button className="btn btn-ghost" onClick={() => { if (confirm(L('¿Volver a las filas del código?', 'Reset to code rows?'))) setCompare(defaults.compare || []); }}>{L('Restaurar por defecto', 'Reset to default')}</button>
            <button className="btn btn-primary" onClick={() => save({ compare: compareRows })} disabled={busy}>{busy ? '…' : L('Guardar comparación', 'Save comparison')}</button>
          </div>
        </div>
      )}

      {/* FUNCIONES */}
      {sub === 'features' && (
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14, maxWidth: 640 }}>
            <div><div style={lbl}>{L('Título de la sección', 'Section title')} · ES</div><input style={inp} value={features.t_es || ''} onChange={(e) => setFeatures({ t_es: e.target.value })} /></div>
            <div><div style={lbl}>{L('Título de la sección', 'Section title')} · EN</div><input style={inp} value={features.t_en || ''} onChange={(e) => setFeatures({ t_en: e.target.value })} /></div>
          </div>
          <CardList es={es} showIcon cards={features.cards || []} onChange={(c) => setFeatures({ cards: c })}
            addLabel={L('Añadir función', 'Add feature')} tLabel={L('Título', 'Title')} dLabel={L('Descripción', 'Description')} />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn btn-ghost" onClick={() => { if (confirm(L('¿Volver al texto del código?', 'Reset to code text?'))) setContent({ ...content, features: defaults.features }); }}>{L('Restaurar', 'Reset')}</button>
            <button className="btn btn-primary" onClick={() => save({ features })} disabled={busy}>{busy ? '…' : L('Guardar funciones', 'Save features')}</button>
          </div>
        </div>
      )}

      {/* ECOSISTEMA */}
      {sub === 'eco' && (
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14, maxWidth: 720 }}>
            {[['badge', L('Insignia', 'Badge')], ['t', L('Título', 'Title')], ['s', L('Subtítulo', 'Subtitle')]].map(([k, label]) => (
              <div key={k} style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><div style={lbl}>{label} · ES</div><input style={inp} value={eco[`${k}_es`] || ''} onChange={(e) => setEco({ [`${k}_es`]: e.target.value })} /></div>
                <div><div style={lbl}>{label} · EN</div><input style={inp} value={eco[`${k}_en`] || ''} onChange={(e) => setEco({ [`${k}_en`]: e.target.value })} /></div>
              </div>
            ))}
          </div>
          <CardList es={es} showIcon cards={eco.cards || []} onChange={(c) => setEco({ cards: c })}
            addLabel={L('Añadir tarjeta', 'Add card')} tLabel={L('Título', 'Title')} dLabel={L('Descripción', 'Description')} />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn btn-ghost" onClick={() => { if (confirm(L('¿Volver al texto del código?', 'Reset to code text?'))) setContent({ ...content, eco: defaults.eco }); }}>{L('Restaurar', 'Reset')}</button>
            <button className="btn btn-primary" onClick={() => save({ eco })} disabled={busy}>{busy ? '…' : L('Guardar ecosistema', 'Save ecosystem')}</button>
          </div>
        </div>
      )}

      {/* CÓMO FUNCIONA */}
      {sub === 'how' && (
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14, maxWidth: 640 }}>
            <div><div style={lbl}>{L('Título de la sección', 'Section title')} · ES</div><input style={inp} value={how.t_es || ''} onChange={(e) => setHow({ t_es: e.target.value })} /></div>
            <div><div style={lbl}>{L('Título de la sección', 'Section title')} · EN</div><input style={inp} value={how.t_en || ''} onChange={(e) => setHow({ t_en: e.target.value })} /></div>
          </div>
          <p className="muted" style={{ fontSize: 11.5, marginBottom: 8 }}>{L('Los pasos se numeran solos (1, 2, 3…).', 'Steps are numbered automatically (1, 2, 3…).')}</p>
          <CardList es={es} showIcon={false} cards={how.steps || []} onChange={(c) => setHow({ steps: c })}
            addLabel={L('Añadir paso', 'Add step')} tLabel={L('Título del paso', 'Step title')} dLabel={L('Detalle', 'Detail')} />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn btn-ghost" onClick={() => { if (confirm(L('¿Volver al texto del código?', 'Reset to code text?'))) setContent({ ...content, how: defaults.how }); }}>{L('Restaurar', 'Reset')}</button>
            <button className="btn btn-primary" onClick={() => save({ how })} disabled={busy}>{busy ? '…' : L('Guardar pasos', 'Save steps')}</button>
          </div>
        </div>
      )}

      {/* CONFIANZA */}
      {sub === 'trust' && (
        <div className="card" style={{ padding: 18, maxWidth: 640 }}>
          <p className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>{L('Las insignias que salen bajo el hero. Puedes usar emojis.', 'The badges shown under the hero. You can use emojis.')}</p>
          {(trust.es || []).map((_: string, i: number) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <input placeholder={`ES #${i + 1}`} style={inp} value={trust.es?.[i] || ''} onChange={(e) => { const a = [...(trust.es || [])]; a[i] = e.target.value; setTrust({ es: a }); }} />
              <input placeholder={`EN #${i + 1}`} style={inp} value={trust.en?.[i] || ''} onChange={(e) => { const a = [...(trust.en || [])]; a[i] = e.target.value; setTrust({ en: a }); }} />
              <button className="btn btn-ghost" style={{ padding: '4px 9px', fontSize: 12, color: 'var(--red)' }} onClick={() => { setTrust({ es: (trust.es || []).filter((_: string, j: number) => j !== i), en: (trust.en || []).filter((_: string, j: number) => j !== i) }); }}>✕</button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button className="btn btn-ghost" onClick={() => setTrust({ es: [...(trust.es || []), ''], en: [...(trust.en || []), ''] })}>＋ {L('Añadir insignia', 'Add badge')}</button>
            <button className="btn btn-primary" onClick={() => save({ trust })} disabled={busy}>{busy ? '…' : L('Guardar insignias', 'Save badges')}</button>
          </div>
        </div>
      )}

      {/* CTA FINAL */}
      {sub === 'cta' && (
        <div className="card" style={{ padding: 18, maxWidth: 640 }}>
          <div style={{ display: 'grid', gap: 12 }}>
            {[['t', L('Título de cierre', 'Closing title')], ['btn', L('Texto del botón', 'Button text')]].map(([k, label]) => (
              <div key={k} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><div style={lbl}>{label} · ES</div><input style={inp} value={cta[`${k}_es`] || ''} onChange={(e) => setCta({ [`${k}_es`]: e.target.value })} /></div>
                <div><div style={lbl}>{label} · EN</div><input style={inp} value={cta[`${k}_en`] || ''} onChange={(e) => setCta({ [`${k}_en`]: e.target.value })} /></div>
              </div>
            ))}
          </div>
          <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={() => save({ cta })} disabled={busy}>{busy ? '…' : L('Guardar CTA', 'Save CTA')}</button>
        </div>
      )}

      {/* OTRAS PÁGINAS (Fase 3) */}
      {sub === 'pages' && (
        <div className="card" style={{ padding: 18 }}>
          <div style={{ marginBottom: 14 }}>
            <span className="muted" style={{ fontSize: 12.5, marginRight: 8 }}>{L('Página', 'Page')}:</span>
            <select value={pageId} onChange={(e) => setPageId(e.target.value)} style={{ padding: '5px 10px' }}>
              {Object.keys(pageDefs).map((id) => <option key={id} value={id}>{es ? pageDefs[id].label_es : pageDefs[id].label_en}</option>)}
            </select>
            <span className="muted" style={{ fontSize: 11.5, marginLeft: 10 }}>{L('Vacío = usa el texto del código.', 'Empty = uses the code text.')}</span>
          </div>
          <div style={{ display: 'grid', gap: 14, maxWidth: 820 }}>
            {(pageDefs[pageId]?.fields || []).map((f: any) => (
              <div key={f.key} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div style={lbl}>{(es ? f.label_es : f.label_en)} · ES</div>
                  {f.multiline
                    ? <textarea rows={2} style={inp} placeholder={f.es} value={pageVals[pageId]?.[f.key]?.es ?? ''} onChange={(e) => setPageField(pageId, f.key, 'es', e.target.value)} />
                    : <input style={inp} placeholder={f.es} value={pageVals[pageId]?.[f.key]?.es ?? ''} onChange={(e) => setPageField(pageId, f.key, 'es', e.target.value)} />}
                </div>
                <div>
                  <div style={lbl}>{(es ? f.label_es : f.label_en)} · EN</div>
                  {f.multiline
                    ? <textarea rows={2} style={inp} placeholder={f.en} value={pageVals[pageId]?.[f.key]?.en ?? ''} onChange={(e) => setPageField(pageId, f.key, 'en', e.target.value)} />
                    : <input style={inp} placeholder={f.en} value={pageVals[pageId]?.[f.key]?.en ?? ''} onChange={(e) => setPageField(pageId, f.key, 'en', e.target.value)} />}
                </div>
              </div>
            ))}
          </div>
          <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={() => save({ pages: content.pages || {} })} disabled={busy}>{busy ? '…' : L('Guardar página', 'Save page')}</button>
        </div>
      )}

      {/* MENÚ (nav) */}
      {sub === 'nav' && (
        <div className="card" style={{ padding: 18, maxWidth: 720 }}>
          <p className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>{L('Etiquetas del menú superior del landing. Vacío = usa el texto del código.', 'Landing top-menu labels. Empty = uses the code text.')}</p>
          <div style={{ display: 'grid', gap: 8 }}>
            {navDefs.map((n: any) => (
              <div key={n.key} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 1fr', gap: 8, alignItems: 'center' }}>
                <span className="muted" style={{ fontSize: 12 }}>{n.key}</span>
                <input placeholder={n.es} style={inp} value={navVals[n.key]?.es ?? ''} onChange={(e) => setNav(n.key, 'es', e.target.value)} />
                <input placeholder={n.en} style={inp} value={navVals[n.key]?.en ?? ''} onChange={(e) => setNav(n.key, 'en', e.target.value)} />
              </div>
            ))}
          </div>
          <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={() => save({ nav: content.nav || {} })} disabled={busy}>{busy ? '…' : L('Guardar menú', 'Save menu')}</button>
        </div>
      )}

      {/* FOOTER */}
      {sub === 'footer' && (
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16, maxWidth: 640 }}>
            <div><div style={lbl}>{L('Lema (opcional)', 'Tagline (optional)')} · ES</div><input style={inp} value={footer.tagline_es || ''} onChange={(e) => setFooter({ tagline_es: e.target.value })} /></div>
            <div><div style={lbl}>{L('Lema (opcional)', 'Tagline (optional)')} · EN</div><input style={inp} value={footer.tagline_en || ''} onChange={(e) => setFooter({ tagline_en: e.target.value })} /></div>
          </div>
          <div style={lbl}>{L('Enlaces del footer', 'Footer links')}</div>
          {(footer.links || []).map((lk: any, i: number) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.1fr auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <input placeholder="ES" style={inp} value={lk.es} onChange={(e) => { const r = [...footer.links]; r[i] = { ...lk, es: e.target.value }; setFooter({ links: r }); }} />
              <input placeholder="EN" style={inp} value={lk.en} onChange={(e) => { const r = [...footer.links]; r[i] = { ...lk, en: e.target.value }; setFooter({ links: r }); }} />
              <input placeholder="/ruta" style={inp} value={lk.href} onChange={(e) => { const r = [...footer.links]; r[i] = { ...lk, href: e.target.value }; setFooter({ links: r }); }} />
              <div style={{ display: 'flex', gap: 3 }}>
                <button className="btn btn-ghost" style={{ padding: '2px 7px', fontSize: 11 }} disabled={!i} onClick={() => { const r = [...footer.links];[r[i - 1], r[i]] = [r[i], r[i - 1]]; setFooter({ links: r }); }}>↑</button>
                <button className="btn btn-ghost" style={{ padding: '2px 7px', fontSize: 11 }} disabled={i === footer.links.length - 1} onClick={() => { const r = [...footer.links];[r[i + 1], r[i]] = [r[i], r[i + 1]]; setFooter({ links: r }); }}>↓</button>
                <button className="btn btn-ghost" style={{ padding: '2px 7px', fontSize: 11, color: 'var(--red)' }} onClick={() => setFooter({ links: footer.links.filter((_: any, j: number) => j !== i) })}>✕</button>
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn btn-ghost" onClick={() => setFooter({ links: [...(footer.links || []), { es: '', en: '', href: '/' }] })}>＋ {L('Añadir enlace', 'Add link')}</button>
            <button className="btn btn-primary" onClick={() => save({ footer })} disabled={busy}>{busy ? '…' : L('Guardar footer', 'Save footer')}</button>
          </div>
        </div>
      )}

      {/* LEGALES */}
      {sub === 'legal' && (
        <div className="card" style={{ padding: 18 }}>
          <div style={{ marginBottom: 12 }}>
            <span className="muted" style={{ fontSize: 12.5, marginRight: 8 }}>{L('Documento', 'Document')}:</span>
            <select value={legalDoc} onChange={(e) => setLegalDoc(e.target.value as any)} style={{ padding: '5px 10px' }}>
              <option value="terms">{L('Términos', 'Terms')}</option>
              <option value="privacy">{L('Privacidad', 'Privacy')}</option>
            </select>
            <span className="muted" style={{ fontSize: 11.5, marginLeft: 10 }}>{L('1ª línea = título · líneas con «## » = subtítulo · párrafos separados por línea en blanco.', '1st line = title · lines with “## ” = heading · paragraphs separated by a blank line.')}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={lbl}>ES</div>
              <textarea rows={18} style={{ ...inp, fontFamily: 'inherit', lineHeight: 1.6 }} value={legal[`${legalDoc}_es`] ?? ''} onChange={(e) => setLegal({ [`${legalDoc}_es`]: e.target.value })} />
            </div>
            <div>
              <div style={lbl}>EN</div>
              <textarea rows={18} style={{ ...inp, fontFamily: 'inherit', lineHeight: 1.6 }} value={legal[`${legalDoc}_en`] ?? ''} onChange={(e) => setLegal({ [`${legalDoc}_en`]: e.target.value })} />
            </div>
          </div>
          <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={() => save({ legal })} disabled={busy}>{busy ? '…' : L('Guardar legales', 'Save legal')}</button>
        </div>
      )}
    </>
  );
}
