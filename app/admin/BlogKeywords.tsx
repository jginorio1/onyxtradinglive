'use client';
import { useEffect, useState, type CSSProperties } from 'react';
import { useLang } from '@/lib/lang';
import { toast } from '@/lib/toast';

// Interruptor moderno (pastilla iluminada) — mismo estilo que el piloto automático.
function Sw({ on, accent = '#34e2a0' }: { on: boolean; accent?: string }) {
  return (
    <span style={{ width: 42, height: 24, borderRadius: 999, flex: 'none', position: 'relative', transition: 'all .18s', background: on ? accent : 'var(--line)', boxShadow: on ? `0 0 14px -2px ${accent}` : 'none' }}>
      <span style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .18s', boxShadow: '0 2px 5px rgba(0,0,0,.35)' }} />
    </span>
  );
}
function ToggleRow({ on, onToggle, label, accent = '#7c8cff' }: { on: boolean; onToggle: () => void; label: string; accent?: string }) {
  return (
    <div onClick={onToggle} style={{ cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
      <span style={{ fontSize: 13 }}>{label}</span>
      <Sw on={on} accent={accent} />
    </div>
  );
}

// Palabras clave prioritarias del blog + ideas desde Search Console.
export default function BlogKeywords() {
  const { lang } = useLang();
  const L = (es: string, en: string) => (lang === 'en' ? en : es);
  const [d, setD] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
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
    if (cur.length >= 7) { toast(L('Máximo 7 recomendado (mantén el foco).', 'Max 7 recommended (keep focus).'), 'warn'); }
    upd(list, [...cur, v]);
  }
  const rmKw = (list: 'es' | 'en', v: string) => upd(list, (s[list] || []).filter((x: string) => x !== v));

  async function save() {
    setBusy(true);
    try {
      const body = { enabled: s.enabled, intensity: s.intensity, variants: s.variants, internalLinks: s.internalLinks, es: s.es, en: s.en };
      const r = await fetch('/api/admin/blog/keywords', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) toast(j.error || 'Error'); else { toast(L('Keywords guardadas.', 'Keywords saved.'), 'ok'); await load(); }
    } finally { setBusy(false); }
  }

  if (!d) return null;
  const cov = (k: string) => d.coverage?.[k] ?? 0;
  const glow = (c: string): CSSProperties => ({ background: 'var(--bg2)', border: `1px solid ${c}40`, borderRadius: 14, padding: 14, boxShadow: `0 0 0 1px ${c}14, 0 10px 26px -14px ${c}` });
  const fieldL: CSSProperties = { fontSize: 11.5, color: 'var(--mut)', display: 'block', marginBottom: 5, fontWeight: 600 };

  const KwCard = ({ l, accent }: { l: 'es' | 'en'; accent: string }) => {
    const input = l === 'es' ? esInput : enInput;
    const setInput = l === 'es' ? setEsInput : setEnInput;
    const add = () => { addKw(l, input); setInput(''); };
    return (
      <div style={glow(accent)}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>{l === 'es' ? '🇪🇸' : '🇬🇧'}</span>{l === 'es' ? L('Keywords en español', 'Spanish keywords') : L('Keywords en inglés', 'English keywords')}
          <span className="muted" style={{ fontSize: 11, fontWeight: 400 }}>· {(s[l] || []).length}/7</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 10 }}>
          {(s[l] || []).map((k: string) => (
            <span key={k} style={{ fontSize: 12.5, background: `${accent}22`, color: 'var(--tx)', border: `1px solid ${accent}55`, padding: '5px 10px', borderRadius: 999, display: 'inline-flex', gap: 7, alignItems: 'center' }}>
              {k} <span className="muted" style={{ fontSize: 10 }}>({cov(k)})</span>
              <span style={{ cursor: 'pointer', opacity: .7 }} onClick={() => rmKw(l, k)}>✕</span>
            </span>
          ))}
          {!(s[l] || []).length && <span className="muted" style={{ fontSize: 12 }}>{L('Aún ninguna.', 'None yet.')}</span>}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
            placeholder={l === 'es' ? 'ej: gestión de riesgo' : 'e.g. risk management'} style={{ margin: 0, flex: 1, fontSize: 13 }} />
          <button className="btn btn-ghost" style={{ fontSize: 13, padding: '0 14px', flex: 'none' }} onClick={add}>＋</button>
        </div>
      </div>
    );
  };

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 12 }}>
      <div className="row between" style={{ padding: '12px 14px', cursor: 'pointer', flexWrap: 'wrap', gap: 8 }} onClick={() => setOpen((o) => !o)}>
        <div className="row" style={{ gap: 10, alignItems: 'center', minWidth: 0 }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, flex: 'none', background: 'linear-gradient(135deg,#ffc04d,#ff8a97)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0b0d17', fontWeight: 800 }}>🎯</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{L('Palabras clave prioritarias', 'Priority keywords')}</div>
            <div className="muted" style={{ fontSize: 12 }}>{L('El AI apunta a una keyword por artículo y rota para cubrirlas todas.', 'The AI targets one keyword per article and rotates to cover them all.')}</div>
          </div>
        </div>
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          <span className="pill" style={{ fontSize: 11, color: s.enabled ? 'var(--soft-green)' : 'var(--mut)', background: s.enabled ? 'rgba(52,226,160,.15)' : 'var(--card2)' }}>{s.enabled ? L('Activo', 'On') : L('Apagado', 'Off')}</span>
          <span style={{ color: 'var(--mut)' }}>{open ? '▴' : '▾'}</span>
        </div>
      </div>

      {open && (
        <div style={{ padding: 14, borderTop: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Ajustes */}
          <div style={glow('#5ecfff')}>
            <div onClick={() => upd('enabled', !s.enabled)} style={{ cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'flex-start', paddingBottom: 10, marginBottom: 4, borderBottom: '1px solid var(--line)' }}>
              <span style={{ width: 30, height: 30, borderRadius: 9, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, background: '#34e2a022', border: '1px solid #34e2a055' }}>🎯</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>{L('Activar keywords en el generador', 'Enable keywords in the generator')}</div>
                <div className="muted" style={{ fontSize: 12, lineHeight: 1.45 }}>{L('Recomendado: 5–7 por idioma, sin relleno.', 'Recommended: 5–7 per language, no stuffing.')}</div>
              </div>
              <Sw on={s.enabled} accent="#34e2a0" />
            </div>
            <div style={{ marginTop: 8 }}>
              <label style={fieldL}>{L('Intensidad de la keyword', 'Keyword intensity')}</label>
              <select value={s.intensity} onChange={(e) => upd('intensity', e.target.value)} style={{ margin: 0, fontSize: 13, maxWidth: 240 }}>
                <option value="soft">{L('Suave (1–2 veces)', 'Soft (1–2 times)')}</option>
                <option value="normal">{L('Normal (2–3 veces)', 'Normal (2–3 times)')}</option>
                <option value="strong">{L('Fuerte (4–6 veces)', 'Strong (4–6 times)')}</option>
              </select>
            </div>
            <ToggleRow on={s.variants} onToggle={() => upd('variants', !s.variants)} accent="#c584ff" label={L('Permitir variantes y sinónimos (se lee más natural)', 'Allow variants and synonyms (reads more natural)')} />
            <ToggleRow on={s.internalLinks} onToggle={() => upd('internalLinks', !s.internalLinks)} accent="#7c8cff" label={L('Añadir enlace interno a la página pilar', 'Add internal link to the pillar page')} />
          </div>

          {/* Keywords ES / EN en dos tarjetas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 12 }}>
            <KwCard l="es" accent="#7c8cff" />
            <KwCard l="en" accent="#34e2a0" />
          </div>

          {/* Ideas desde Search Console */}
          <div style={glow('#ffc04d')}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}><span>💡</span>{L('Ideas desde Search Console', 'Ideas from Search Console')}</div>
            {!d.gsc && <p className="muted" style={{ fontSize: 12, margin: 0 }}>{L('Conecta Search Console (Admin → SEO) para ver aquí tus consultas reales de Google y sus oportunidades.', 'Connect Search Console (Admin → SEO) to see your real Google queries and opportunities here.')}</p>}
            {d.gsc && !(d.ideas || []).length && <p className="muted" style={{ fontSize: 12, margin: 0 }}>{L('Aún sin datos de Google (tarda unos días).', 'No Google data yet (takes a few days).')}</p>}
            {(d.ideas || []).length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 240, overflowY: 'auto' }}>
                {d.ideas.slice(0, 25).map((q: any) => (
                  <div key={q.query} className="row between" style={{ alignItems: 'center', fontSize: 12.5, padding: '6px 9px', borderRadius: 8, background: q.opportunity ? 'rgba(52,226,160,.10)' : 'var(--card2)', border: '1px solid var(--line)' }}>
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

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={save} disabled={busy} style={{ boxShadow: '0 8px 20px -8px var(--brand)' }}>{busy ? '…' : L('Guardar keywords', 'Save keywords')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
