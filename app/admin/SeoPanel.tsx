'use client';
import { mkL } from '@/lib/i18n';
import { useEffect, useState } from 'react';
import { toast, toastErr } from '@/lib/toast';
import { useLang } from '@/lib/lang';

// ============================================================
// Admin → SEO. Todo el SEO en un sitio:
//  · Estado de las integraciones (Search Console, GA4, verificación) + cómo activarlas.
//  · Rendimiento en Google (consultas top = tus keywords, posición/ranking, clics, páginas).
//  · Editor de meta (título + descripción) por página con vista previa del snippet.
//  · Keyword research con IA (keywords de intención + títulos + clusters para el blog).
// ============================================================

type SeoMeta = Record<string, { title_es?: string; title_en?: string; desc_es?: string; desc_en?: string }>;
const PAGES: Array<[string, string, string]> = [
  ['home', 'Inicio (landing)', 'Home (landing)'],
  ['pricing', 'Planes y precios', 'Pricing'],
];

export default function SeoPanel() {
  const { lang } = useLang();
  const L = mkL(lang);
  const es = lang !== 'en';
  const [data, setData] = useState<any>(null);
  const [meta, setMeta] = useState<SeoMeta>({});
  const [busy, setBusy] = useState('');
  const [days, setDays] = useState(28);
  const [topic, setTopic] = useState('');
  const [ideas, setIdeas] = useState<any>(null);

  async function load(d = days) {
    const r = await fetch('/api/admin/seo?days=' + d);
    const j = await r.json();
    setData(j); setMeta(j.meta || {});
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const setM = (page: string, k: string, v: string) => setMeta((o) => ({ ...o, [page]: { ...(o[page] || {}), [k]: v } }));

  async function save() {
    setBusy('save');
    try {
      const r = await fetch('/api/admin/seo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ meta }) });
      const j = await r.json(); if (!r.ok) { toastErr(j); return; }
      toast(L('Meta SEO guardado ✓', 'SEO meta saved ✓'), 'ok');
    } finally { setBusy(''); }
  }
  async function genKeywords() {
    if (!topic.trim()) { toast(L('Escribe un tema.', 'Write a topic.')); return; }
    setBusy('kw');
    try {
      const r = await fetch('/api/admin/seo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'keywords', topic, lang }) });
      const j = await r.json(); if (!r.ok) { toastErr(j); return; }
      setIdeas(j.ideas);
    } finally { setBusy(''); }
  }

  if (!data) return <div className="card muted">…</div>;
  const env = data.env || {};
  const search = data.search || {};
  const site = env.site || '';
  const pct = (n: number) => `${(Number(n) * 100).toFixed(1)}%`;
  const inp = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--tx)', marginTop: 4 } as any;
  const chip = (ok: boolean, label: string) => (
    <span className="pill" style={{ background: ok ? 'rgba(52,226,160,.15)' : 'rgba(240,160,20,.14)', color: ok ? 'var(--green)' : 'var(--amber)' }}>{ok ? '✓' : '○'} {label}</span>
  );

  return (
    <>
      <div className="tabhead">
        <div className="th-row"><span className="th-ic">🔎</span><span className="th-t">SEO</span></div>
        <div className="th-s">{L('Rendimiento en Google, meta por página y keywords con IA. El sitemap y robots.txt ya funcionan solos.', 'Google performance, per-page meta and AI keywords. Sitemap and robots.txt already run on their own.')}</div>
      </div>

      {/* Estado + setup */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {chip(true, 'sitemap.xml')}{chip(true, 'robots.txt')}
          {chip(env.gsc, 'Search Console')}{chip(env.ga, 'Analytics (GA4)')}
          {chip(env.googleVerify, L('Verificación Google', 'Google verify'))}{chip(env.bingVerify, 'Bing')}
        </div>
        <div className="muted" style={{ fontSize: 12.5, marginTop: 10, lineHeight: 1.6 }}>
          {L('Pasos en Google (una vez):', 'Steps in Google (once):')} <b>1)</b> {L('crea la propiedad en Search Console y verifícala', 'create the property in Search Console and verify it')} · <b>2)</b> {L('envía tu sitemap:', 'submit your sitemap:')} <code>{site}/sitemap.xml</code>
          <br />{L('Para ver el ranking aquí dentro, añade una cuenta de servicio de Google como usuario de la propiedad y pon en Vercel:', 'To see rankings in here, add a Google service account as a user of the property and set in Vercel:')} <code>GSC_CLIENT_EMAIL</code>, <code>GSC_PRIVATE_KEY</code>, <code>GSC_SITE_URL</code>. {L('Para analítica:', 'For analytics:')} <code>NEXT_PUBLIC_GA_ID</code>. {L('Para verificar por meta:', 'To verify via meta:')} <code>GOOGLE_SITE_VERIFICATION</code>.
        </div>
      </div>

      {/* Rendimiento en Google */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="row between" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <h3 style={{ margin: 0 }}>📈 {L('Rendimiento en Google', 'Google performance')}</h3>
          <select value={days} onChange={(e) => { const d = Number(e.target.value); setDays(d); load(d); }} style={{ ...inp, width: 'auto', marginTop: 0 }}>
            <option value={7}>{L('7 días', '7 days')}</option><option value={28}>{L('28 días', '28 days')}</option><option value={90}>{L('90 días', '90 days')}</option>
          </select>
        </div>

        {!env.gsc && <div className="muted" style={{ fontSize: 13, marginTop: 10 }}>{L('Search Console no está conectado. Conéctalo (arriba) para ver aquí tu ranking, keywords, clics e impresiones reales de Google.', 'Search Console is not connected. Connect it (above) to see your real ranking, keywords, clicks and impressions from Google here.')}</div>}
        {env.gsc && !search.ok && <div className="muted" style={{ fontSize: 13, marginTop: 10 }}>{L('No se pudieron leer los datos de Search Console. Revisa que la cuenta de servicio sea usuario de la propiedad y que GSC_SITE_URL sea correcta.', 'Could not read Search Console data. Check the service account is a user of the property and GSC_SITE_URL is correct.')} ({search.reason})</div>}

        {env.gsc && search.ok && (
          <>
            <div className="grid g4" style={{ marginTop: 12 }}>
              <div className="tile"><div className="muted" style={{ fontSize: 12 }}>{L('Clics', 'Clicks')}</div><div style={{ fontSize: 22, fontWeight: 800 }}>{(search.totals?.clicks ?? 0).toLocaleString()}</div></div>
              <div className="tile"><div className="muted" style={{ fontSize: 12 }}>{L('Impresiones', 'Impressions')}</div><div style={{ fontSize: 22, fontWeight: 800 }}>{(search.totals?.impressions ?? 0).toLocaleString()}</div></div>
              <div className="tile"><div className="muted" style={{ fontSize: 12 }}>CTR</div><div style={{ fontSize: 22, fontWeight: 800 }}>{pct(search.totals?.ctr ?? 0)}</div></div>
              <div className="tile"><div className="muted" style={{ fontSize: 12 }}>{L('Posición media', 'Avg position')}</div><div style={{ fontSize: 22, fontWeight: 800, color: 'var(--soft-brand)' }}>{(search.totals?.position ?? 0).toFixed(1)}</div></div>
            </div>

            <div className="grid g2" style={{ gap: 14, marginTop: 14 }}>
              <div>
                <div className="muted" style={{ fontSize: 12, marginBottom: 6, fontWeight: 700 }}>{L('Consultas top (tus keywords)', 'Top queries (your keywords)')}</div>
                {(search.queries || []).slice(0, 15).map((q: any, i: number) => (
                  <div key={i} className="row between" style={{ borderTop: i ? '1px solid var(--line)' : 'none', padding: '6px 0', gap: 8, fontSize: 12.5 }}>
                    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.keys?.[0]}</span>
                    <span className="muted" style={{ whiteSpace: 'nowrap' }}>#{q.position?.toFixed(0)} · {q.clicks} clic · {q.impressions} imp</span>
                  </div>
                ))}
                {!(search.queries || []).length && <div className="muted" style={{ fontSize: 12 }}>{L('Aún sin datos (Google tarda unos días).', 'No data yet (Google takes a few days).')}</div>}
              </div>
              <div>
                <div className="muted" style={{ fontSize: 12, marginBottom: 6, fontWeight: 700 }}>{L('Páginas top', 'Top pages')}</div>
                {(search.pages || []).slice(0, 15).map((q: any, i: number) => (
                  <div key={i} className="row between" style={{ borderTop: i ? '1px solid var(--line)' : 'none', padding: '6px 0', gap: 8, fontSize: 12.5 }}>
                    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(q.keys?.[0] || '').replace(site, '') || '/'}</span>
                    <span className="muted" style={{ whiteSpace: 'nowrap' }}>{q.clicks} clic · {q.impressions} imp</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Keyword research con IA */}
      <div className="card" style={{ marginBottom: 14 }}>
        <h3 style={{ marginBottom: 4 }}>💡 {L('Keywords con IA', 'AI keywords')}</h3>
        <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>{L('Da un tema y Onyx AI propone keywords de intención, títulos SEO y clusters para el blog.', 'Give a topic and Onyx AI proposes intent keywords, SEO titles and clusters for the blog.')}</p>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={L('Ej: pasar el reto de una prop firm', 'e.g. passing a prop-firm challenge')} style={{ ...inp, marginTop: 0, flex: 1, minWidth: 200 }} />
          <button className="btn btn-primary" onClick={genKeywords} disabled={busy === 'kw'} style={{ whiteSpace: 'nowrap' }}>{busy === 'kw' ? '…' : '✨ ' + L('Generar', 'Generate')}</button>
        </div>
        {ideas && (
          <div style={{ marginTop: 12 }}>
            {!!(ideas.clusters || []).length && (
              <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                {ideas.clusters.map((c: string, i: number) => <span key={i} className="pill" style={{ background: 'rgba(124,140,255,.15)', color: 'var(--soft-brand)' }}>{c}</span>)}
              </div>
            )}
            {(ideas.keywords || []).map((k: any, i: number) => (
              <div key={i} style={{ borderTop: '1px solid var(--line)', padding: '8px 0' }}>
                <div className="row between" style={{ gap: 8, flexWrap: 'wrap' }}>
                  <b style={{ fontSize: 13.5 }}>{k.keyword}</b>
                  <span className="pill gray" style={{ fontSize: 11 }}>{k.intent}</span>
                </div>
                <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>📝 {k.title}</div>
              </div>
            ))}
            <div className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>{L('Usa un título en Admin → Blog para escribir el artículo con la IA.', 'Use a title in Admin → Blog to write the article with AI.')}</div>
          </div>
        )}
      </div>

      {/* Editor de meta por página + snippet */}
      <div className="card">
        <h3 style={{ marginBottom: 4 }}>🏷️ {L('Meta por página (título + descripción)', 'Per-page meta (title + description)')}</h3>
        <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>{L('Lo que ve Google y la gente en los resultados. Vacío = usa el texto por defecto. Título ~60, descripción ~155 caracteres. El blog edita su meta desde Admin → Blog.', 'What Google and people see in results. Empty = uses the default. Title ~60, description ~155 chars. The blog edits its meta in Admin → Blog.')}</p>
        {PAGES.map(([id, esN, enN]) => {
          const o = meta[id] || {};
          const title = (es ? o.title_es : o.title_en) || '';
          const desc = (es ? o.desc_es : o.desc_en) || '';
          return (
            <div key={id} style={{ borderTop: '1px solid var(--line)', paddingTop: 12, marginTop: 12 }}>
              <b style={{ fontSize: 14 }}>{es ? esN : enN}</b>
              <div className="grid g2" style={{ gap: 12, marginTop: 6 }}>
                <label className="muted" style={{ fontSize: 12 }}>{L('Título (ES)', 'Title (ES)')} <span style={{ color: (o.title_es || '').length > 60 ? 'var(--amber)' : 'var(--mut)' }}>{(o.title_es || '').length}/60</span><input value={o.title_es || ''} onChange={(e) => setM(id, 'title_es', e.target.value)} style={inp} /></label>
                <label className="muted" style={{ fontSize: 12 }}>{L('Título (EN)', 'Title (EN)')} <span style={{ color: (o.title_en || '').length > 60 ? 'var(--amber)' : 'var(--mut)' }}>{(o.title_en || '').length}/60</span><input value={o.title_en || ''} onChange={(e) => setM(id, 'title_en', e.target.value)} style={inp} /></label>
                <label className="muted" style={{ fontSize: 12 }}>{L('Descripción (ES)', 'Description (ES)')} <span style={{ color: (o.desc_es || '').length > 155 ? 'var(--amber)' : 'var(--mut)' }}>{(o.desc_es || '').length}/155</span><textarea value={o.desc_es || ''} onChange={(e) => setM(id, 'desc_es', e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} /></label>
                <label className="muted" style={{ fontSize: 12 }}>{L('Descripción (EN)', 'Description (EN)')} <span style={{ color: (o.desc_en || '').length > 155 ? 'var(--amber)' : 'var(--mut)' }}>{(o.desc_en || '').length}/155</span><textarea value={o.desc_en || ''} onChange={(e) => setM(id, 'desc_en', e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} /></label>
              </div>
              {/* Vista previa del snippet de Google */}
              {(title || desc) && (
                <div style={{ marginTop: 8, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 12px', maxWidth: 560 }}>
                  <div style={{ fontSize: 12, color: 'var(--green)' }}>{site.replace(/^https?:\/\//, '')}{id === 'pricing' ? '/pricing' : ''}</div>
                  <div style={{ color: 'var(--soft-brand,#7c8cff)', fontSize: 16, margin: '2px 0' }}>{title || '—'}</div>
                  <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.4 }}>{desc || '—'}</div>
                </div>
              )}
            </div>
          );
        })}
        <div className="row" style={{ gap: 8, marginTop: 14 }}>
          <button className="btn btn-primary" onClick={save} disabled={busy === 'save'}>{busy === 'save' ? '…' : L('Guardar meta', 'Save meta')}</button>
        </div>
      </div>
    </>
  );
}
