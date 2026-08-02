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

export default function LandingBuilder() {
  const { lang } = useLang();
  const es = lang === 'es';
  const L = (a: string, b: string) => (es ? a : b);

  const [sub, setSub] = useState<'hero' | 'faq' | 'compare'>('hero');
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

  const faqRows: Faq[] = content.faq?.[faqPage] || [];
  const setFaq = (rows: Faq[]) => setContent({ ...content, faq: { ...(content.faq || {}), [faqPage]: rows } });

  const compareRows: Row[] = content.compare?.length ? content.compare : (defaults.compare || []);
  const setCompare = (rows: Row[]) => setContent({ ...content, compare: rows });

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
        {([['hero', L('Hero del landing', 'Landing hero')], ['faq', L('FAQ por página', 'FAQ per page')], ['compare', L('Comparación de planes', 'Plan comparison')]] as const).map(([k, label]) => (
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
            <button className="btn btn-primary" onClick={() => save({ faq: content.faq || {} })} disabled={busy}>{busy ? '…' : L('Guardar FAQ', 'Save FAQ')}</button>
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
    </>
  );
}
