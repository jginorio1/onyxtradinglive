'use client';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/lang';

// Palabras clave prioritarias del blog + ideas desde Search Console.
// El AI apunta a UNA objetivo por artículo (rota sola) y teje el resto donde encaja.
export default function BlogKeywords() {
  const { lang } = useLang();
  const L = (es: string, en: string) => (lang === 'en' ? en : es);
  const [d, setD] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [esInput, setEsInput] = useState('');
  const [enInput, setEnInput] = useState('');

  async function load() { try { const r = await fetch('/api/admin/blog/keywords'); const j = await r.json(); if (!j.error) setD(j); } catch {} }
  useEffect(() => { load(); }, []);
  const s = d?.settings;
  const upd = (k: string, v: any) => setD((p: any) => ({ ...p, settings: { ...p.settings, [k]: v } }));

  function addKw(list: 'es' | 'en', val: string) {
    const v = val.trim(); if (!v) return;
    const cur = s[list] || [];
    if (cur.some((x: string) => x.toLowerCase() === v.toLowerCase())) return;
    if (cur.length >= 7) { setMsg(L('Máximo 7 recomendado (mantén el foco).', 'Max 7 recommended (keep focus).')); }
    upd(list, [...cur, v]);
  }
  const rmKw = (list: 'es' | 'en', v: string) => upd(list, (s[list] || []).filter((x: string) => x !== v));

  async function save() {
    setBusy(true); setMsg('');
    try {
      const body = { enabled: s.enabled, intensity: s.intensity, variants: s.variants, internalLinks: s.internalLinks, es: s.es, en: s.en };
      const r = await fetch('/api/admin/blog/keywords', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) setMsg(j.error || 'Error'); else { setMsg(L('Guardado ✓', 'Saved ✓')); await load(); }
    } finally { setBusy(false); }
  }

  if (!d) return null;
  const chip: any = { fontSize: 12, background: 'color-mix(in srgb,var(--brand) 16%,transparent)', color: 'var(--soft-brand)', padding: '4px 10px', borderRadius: 16, display: 'inline-flex', gap: 6, alignItems: 'center' };
  const cov = (k: string) => d.coverage?.[k] ?? 0;

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <button onClick={() => setOpen((o) => !o)} className="btn btn-ghost" style={{ width: '100%', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 2px' }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>🎯 {L('Palabras clave prioritarias', 'Priority keywords')} {s.enabled ? <span className="pill green" style={{ marginLeft: 6 }}>{L('activo', 'on')}</span> : <span className="pill" style={{ marginLeft: 6 }}>{L('apagado', 'off')}</span>}</span>
        <span>{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div style={{ marginTop: 10 }}>
          <p className="muted" style={{ fontSize: 12.5, marginBottom: 10 }}>{L('El AI apunta a UNA keyword objetivo por artículo (rota para cubrirlas todas) y teje las demás solo donde encajan, sin relleno. Recomendado: 5–7.', 'The AI targets ONE keyword per article (rotating to cover them all) and weaves the rest only where they fit, no stuffing. Recommended: 5–7.')}</p>

          <div className="row" style={{ gap: 16, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
            <label style={{ fontSize: 13, display: 'inline-flex', gap: 8, alignItems: 'center' }}><span className="toggle" onClick={() => upd('enabled', !s.enabled)} style={{ background: s.enabled ? 'var(--green)' : '#556080' }}><span className="knob" style={{ left: s.enabled ? 21 : 3 }} /></span> {L('Activar', 'Enable')}</label>
            <label style={{ fontSize: 12.5 }}>{L('Intensidad', 'Intensity')}
              <select value={s.intensity} onChange={(e) => upd('intensity', e.target.value)} style={{ margin: '0 0 0 6px' }}>
                <option value="soft">{L('Suave', 'Soft')}</option><option value="normal">Normal</option><option value="strong">{L('Fuerte', 'Strong')}</option>
              </select>
            </label>
            <label style={{ fontSize: 12.5, display: 'inline-flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={s.variants} onChange={(e) => upd('variants', e.target.checked)} /> {L('Variantes/sinónimos', 'Variants/synonyms')}</label>
            <label style={{ fontSize: 12.5, display: 'inline-flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={s.internalLinks} onChange={(e) => upd('internalLinks', e.target.checked)} /> {L('Enlaces internos', 'Internal links')}</label>
          </div>

          {(['es', 'en'] as const).map((l) => (
            <div key={l} style={{ marginBottom: 12 }}>
              <div className="muted" style={{ fontSize: 11.5, marginBottom: 5 }}>{l === 'es' ? L('Palabras clave (Español)', 'Keywords (Spanish)') : L('Palabras clave (Inglés)', 'Keywords (English)')} · {(s[l] || []).length}/7</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                {(s[l] || []).map((k: string) => (
                  <span key={k} style={chip}>{k} <span className="muted" style={{ fontSize: 10 }}>({cov(k)})</span> <span style={{ cursor: 'pointer' }} onClick={() => rmKw(l, k)}>✕</span></span>
                ))}
                {!(s[l] || []).length && <span className="muted" style={{ fontSize: 12 }}>{L('Aún ninguna.', 'None yet.')}</span>}
              </div>
              <div className="row" style={{ gap: 6, maxWidth: 420 }}>
                <input value={l === 'es' ? esInput : enInput} onChange={(e) => (l === 'es' ? setEsInput(e.target.value) : setEnInput(e.target.value))}
                  onKeyDown={(e) => { if (e.key === 'Enter') { addKw(l, l === 'es' ? esInput : enInput); l === 'es' ? setEsInput('') : setEnInput(''); } }}
                  placeholder={l === 'es' ? 'ej: gestión de riesgo' : 'e.g. risk management'} style={{ margin: 0, flex: 1 }} />
                <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => { addKw(l, l === 'es' ? esInput : enInput); l === 'es' ? setEsInput('') : setEnInput(''); }}>＋</button>
              </div>
            </div>
          ))}

          {/* Ideas desde Search Console */}
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 10, marginTop: 4 }}>
            <div className="muted" style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>💡 {L('Ideas desde Search Console', 'Ideas from Search Console')}</div>
            {!d.gsc && <p className="muted" style={{ fontSize: 12 }}>{L('Conecta Search Console (Admin → SEO) para ver aquí tus consultas reales de Google y sus oportunidades.', 'Connect Search Console (Admin → SEO) to see your real Google queries and opportunities here.')}</p>}
            {d.gsc && !(d.ideas || []).length && <p className="muted" style={{ fontSize: 12 }}>{L('Aún sin datos de Google (tarda unos días).', 'No Google data yet (takes a few days).')}</p>}
            {(d.ideas || []).length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 240, overflowY: 'auto' }}>
                {d.ideas.slice(0, 25).map((q: any) => (
                  <div key={q.query} className="row between" style={{ alignItems: 'center', fontSize: 12.5, padding: '5px 8px', borderRadius: 8, background: q.opportunity ? 'color-mix(in srgb,var(--green) 8%,transparent)' : 'transparent' }}>
                    <span style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
                      {q.opportunity && <span className="pill green" style={{ fontSize: 10 }}>{L('oportunidad', 'opportunity')}</span>}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.query}</span>
                    </span>
                    <span className="row" style={{ gap: 10, alignItems: 'center', flex: 'none' }}>
                      <span className="muted" style={{ fontSize: 11 }}>{q.impressions} impr · pos {q.position}</span>
                      <button className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => addKw(lang === 'en' ? 'en' : 'es', q.query)}>＋ {L('Añadir', 'Add')}</button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="row" style={{ gap: 12, marginTop: 12, alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? '…' : L('Guardar keywords', 'Save keywords')}</button>
            {msg && <span className="muted" style={{ fontSize: 12.5 }}>{msg}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
