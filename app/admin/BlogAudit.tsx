'use client';
import { useState } from 'react';
import { toast } from '@/lib/toast';
import OnyxIcon from '@/app/components/OnyxIcon';

// Onyx Content Auditor · panel del dueño. Escanea todos los artículos y muestra
// salud + peores primero + arreglos con IA (aprobados por artículo).
export default function BlogAudit({ es, onChanged }: { es: boolean; onChanged?: () => void }) {
  const L = (a: string, b: string) => (es ? a : b);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<any>(null);
  const [showAll, setShowAll] = useState(false);
  const [exp, setExp] = useState<string | null>(null);
  const [fix, setFix] = useState<string>('');
  const [angles, setAngles] = useState<Record<string, string[]>>({});
  const [batch, setBatch] = useState<{ running: boolean; done: number; total: number }>({ running: false, done: 0, total: 0 });

  // Arreglo en LOTE: mejora todos los artículos por debajo del umbral, uno a uno
  // en segundo plano, con barra de progreso y tolerancia a límites de la API.
  async function batchFix(threshold = 70) {
    const targets = (data?.posts || []).filter((p: any) => p.score < threshold);
    if (!targets.length) { toast(L('Nada por debajo del umbral. ¡Buen trabajo!', 'Nothing below the threshold. Nice!')); return; }
    setBatch({ running: true, done: 0, total: targets.length });
    let done = 0, fails = 0, last = '';
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0; i < targets.length; i++) {
      const p = targets[i]; let ok = false, rl = false;
      try {
        const r = await fetch('/api/admin/blog/audit', { method: 'POST', body: JSON.stringify({ action: 'fix_seo', id: p.id, kw: p.kw }) });
        const j = await r.json();
        if (j.ok) { ok = true; done++; fails = 0; setBatch({ running: true, done, total: targets.length }); }
        else { fails++; last = j.error || ''; rl = /429|rate|limit|overload|529/i.test(last); }
      } catch { fails++; last = 'red'; }
      if (fails >= 20) { toast((L('La IA se detuvo (posible límite). Espera unos minutos y pulsa "Arreglar todos" otra vez; retoma donde quedó.', 'AI stopped (limit). Wait a few minutes and press "Fix all" again; it resumes.')) + (last ? ` · ${last}` : '')); break; }
      await sleep(ok ? 2500 : (rl ? Math.min(60000, 15000 * fails) : Math.min(20000, 3000 * fails)));
    }
    setBatch({ running: false, done: 0, total: 0 });
    if (done) toast(L(`✓ ${done} artículo(s) mejorado(s).`, `✓ ${done} article(s) improved.`), 'ok');
    await scan(); onChanged?.();
  }

  async function scan() {
    setBusy(true);
    try { const r = await fetch('/api/admin/blog/audit'); const j = await r.json(); if (j.ok) setData(j); else toast(j.error || 'Error', 'error'); }
    catch { toast(L('No se pudo auditar.', 'Could not audit.')); }
    setBusy(false);
  }
  async function action(id: string, act: string, kw?: string) {
    setFix(id + act);
    try {
      const r = await fetch('/api/admin/blog/audit', { method: 'POST', body: JSON.stringify({ action: act, id, kw }) });
      const j = await r.json();
      if (!j.ok) { toast((j.error || 'Error') + '', 'error'); }
      else if (act === 'suggest_angle') { setAngles((a) => ({ ...a, [id]: j.titles || [] })); }
      else { toast(L('✓ Aplicado. Revísalo en el editor.', '✓ Applied. Review it in the editor.'), 'ok'); await scan(); onChanged?.(); }
    } catch { toast(L('No se pudo.', 'Could not.')); }
    setFix('');
  }

  async function toggleAuto(enabled: boolean) {
    try { const r = await fetch('/api/admin/blog/audit', { method: 'POST', body: JSON.stringify({ action: 'set_autofix', enabled }) }); const j = await r.json(); if (j.ok) setData((d: any) => ({ ...d, autofix: j.autofix })); } catch {}
  }
  const clr = (n: number) => (n >= 75 ? 'var(--green)' : n >= 55 ? 'var(--amber)' : 'var(--red)');
  const posts = data?.posts || [];
  const shown = showAll ? posts : posts.slice(0, 25);

  const bar = (label: string, ic: string, v: number) => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}><span className="muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><OnyxIcon emoji={ic} size={12} /> {label}</span><span style={{ color: clr(v) }}>{v}</span></div>
      <div style={{ height: 5, borderRadius: 99, background: 'var(--card)', overflow: 'hidden' }}><div style={{ height: '100%', width: `${v}%`, background: clr(v) }} /></div>
    </div>
  );

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div className="row between" style={{ padding: '12px 14px', cursor: 'pointer', flexWrap: 'wrap', gap: 8 }} onClick={() => { setOpen((o) => !o); if (!data) scan(); }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--bg2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand)' }}><OnyxIcon emoji="🔎" size={18} /></span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{L('Auditor de contenido', 'Content auditor')}</div>
            <div className="muted" style={{ fontSize: 12 }}>{L('Escanea todos los artículos: unicidad, SEO, enlaces y frescura. Arregla con IA.', 'Scans every article: uniqueness, SEO, links and freshness. Fix with AI.')}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {data && <span style={{ fontSize: 22, fontWeight: 800, color: clr(data.health) }}>{data.health}<span className="muted" style={{ fontSize: 11, fontWeight: 400 }}>/100</span></span>}
          {data && (data.posts || []).some((p: any) => p.score < 70) && (
            <button className="btn btn-primary" style={{ fontSize: 12, background: 'linear-gradient(135deg,#7c8cff,#34e2a0)', color: '#0b0d17' }} disabled={batch.running || busy} onClick={(e) => { e.stopPropagation(); batchFix(70); }}>
              {batch.running ? `⏳ ${batch.done}/${batch.total}` : <><OnyxIcon emoji="✨" size={13} /> {L('Arreglar todos', 'Fix all')} ({(data.posts || []).filter((p: any) => p.score < 70).length})</>}
            </button>
          )}
          <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={(e) => { e.stopPropagation(); scan(); }} disabled={busy || batch.running}>{busy ? '…' : `↻ ${L('Auditar', 'Audit')}`}</button>
        </div>
      </div>
      {batch.running && (
        <div style={{ padding: '0 14px 12px' }}>
          <div style={{ height: 6, borderRadius: 99, background: 'var(--bg2)', overflow: 'hidden' }}><div style={{ height: '100%', width: `${Math.round((batch.done / Math.max(1, batch.total)) * 100)}%`, background: 'linear-gradient(90deg,#7c8cff,#34e2a0)', transition: 'width .3s' }} /></div>
          <div className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>{L('Mejorando en lote… no cierres la pestaña. Si se detiene por límite, vuelve a pulsar "Arreglar todos" y retoma.', 'Batch improving… keep this tab open. If it stops on a limit, press "Fix all" again to resume.')}</div>
        </div>
      )}

      {open && (
        <div style={{ padding: '0 14px 14px' }}>
          {!data && <div className="muted" style={{ fontSize: 13, padding: 12 }}>{busy ? L('Escaneando…', 'Scanning…') : L('Pulsa Auditar para escanear.', 'Press Audit to scan.')}</div>}
          {data && (
            <>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8, marginBottom: 12 }}>
                {[
                  [L('Únicos', 'Unique'), `${data.counts.unique}/${data.counts.total}`, 'var(--tx)'],
                  [L('Se parecen', 'Similar'), data.counts.dupes, data.counts.dupes ? 'var(--amber)' : 'var(--green)'],
                  [L('Huérfanos', 'Orphans'), data.counts.orphans, data.counts.orphans ? 'var(--amber)' : 'var(--green)'],
                  [L('SEO flojo', 'Weak SEO'), data.counts.thin, data.counts.thin ? 'var(--amber)' : 'var(--green)'],
                  [data.gsc ? L('Sin indexar', 'Not indexed') : L('Sin GSC', 'No GSC'), data.gsc ? data.counts.notIndexed : '—', data.counts.notIndexed ? 'var(--amber)' : 'var(--mut)'],
                ].map((c: any, i) => (
                  <div key={i} style={{ background: 'var(--bg2)', borderRadius: 10, padding: 10 }}><div className="muted" style={{ fontSize: 11 }}>{c[0]}</div><div style={{ fontSize: 19, fontWeight: 700, color: c[2] }}>{c[1]}</div></div>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', background: 'var(--bg2)', borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}><OnyxIcon emoji="🔁" size={14} /> {L('Auto-mejorar en segundo plano', 'Auto-improve in the background')}</div>
                  <div className="muted" style={{ fontSize: 11.5 }}>{L('El servidor mejora los artículos flojos solo, sin tener la pestaña abierta. Sobrevive a refrescos.', 'The server improves weak articles on its own, no open tab needed. Survives refreshes.')}</div>
                </div>
                <label style={{ position: 'relative', display: 'inline-block', width: 42, height: 24, flex: '0 0 auto' }}>
                  <input type="checkbox" checked={!!data.autofix?.enabled} onChange={(e) => toggleAuto(e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
                  <span style={{ position: 'absolute', inset: 0, borderRadius: 999, background: data.autofix?.enabled ? 'var(--green)' : 'var(--line)', transition: '.2s' }} />
                  <span style={{ position: 'absolute', top: 3, left: data.autofix?.enabled ? 21 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: '.2s' }} />
                </label>
              </div>

              {data.keywordMap?.some((k: any) => k.count > 1) && (
                <div style={{ background: 'rgba(255,192,77,.08)', border: '1px solid var(--amber)', borderRadius: 10, padding: '8px 10px', marginBottom: 12, fontSize: 12 }}>
                  <b style={{ color: 'var(--amber)' }}>{L('Canibalización de keywords', 'Keyword cannibalization')}:</b> {data.keywordMap.filter((k: any) => k.count > 1).slice(0, 6).map((k: any) => `«${k.kw}» ×${k.count}`).join(' · ')}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {shown.map((p: any) => (
                  <div key={p.id} style={{ background: 'var(--bg2)', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', cursor: 'pointer' }} onClick={() => setExp(exp === p.id ? null : p.id)}>
                      <span style={{ width: 36, height: 36, borderRadius: '50%', border: `2px solid ${clr(p.score)}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, flex: '0 0 auto', color: clr(p.score) }}>{p.score}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</div>
                        <div className="muted" style={{ fontSize: 11 }}>{p.status === 'scheduled' ? L('programado', 'scheduled') : L('publicado', 'published')} · /blog/{p.slug}{p.issues.length ? ` · ${p.issues.length} ${L('avisos', 'issues')}` : ''}</div>
                      </div>
                      <OnyxIcon emoji={exp === p.id ? '📊' : '🔎'} size={14} />
                    </div>
                    {exp === p.id && (
                      <div style={{ padding: '0 11px 11px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10 }}>
                          {bar(L('Unicidad', 'Unique'), '🔁', p.pillars.unique)}
                          {bar('SEO', '🔎', p.pillars.seo)}
                          {bar(L('Enlaces', 'Links'), '🔗', p.pillars.links)}
                          {bar(L('Frescura', 'Fresh'), '📊', p.pillars.fresh)}
                        </div>
                        {p.issues.length > 0 && (
                          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: 'var(--mut)', lineHeight: 1.6 }}>
                            {p.issues.map((is: any, i: number) => <li key={i}>{es ? is.text_es : is.text_en}</li>)}
                          </ul>
                        )}
                        {angles[p.id] && (
                          <div style={{ background: 'var(--card)', borderRadius: 8, padding: '8px 10px' }}>
                            <div style={{ fontSize: 11.5, fontWeight: 600, marginBottom: 4, color: 'var(--soft-brand)' }}>{L('Ángulos nuevos sugeridos:', 'Suggested new angles:')}</div>
                            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, lineHeight: 1.6 }}>{angles[p.id].map((t, i) => <li key={i}>{t}</li>)}</ul>
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button className="btn btn-ghost" style={{ fontSize: 12 }} disabled={!!fix} onClick={() => action(p.id, 'fix_seo', p.kw)}>{fix === p.id + 'fix_seo' ? '…' : <><OnyxIcon emoji="✨" size={13} /> {L('Mejorar SEO', 'Fix SEO')}</>}</button>
                          <button className="btn btn-ghost" style={{ fontSize: 12 }} disabled={!!fix} onClick={() => action(p.id, 'refresh', p.kw)}>{fix === p.id + 'refresh' ? '…' : <>↻ {L('Refrescar', 'Refresh')}</>}</button>
                          {(p.sim || p.kw) && <button className="btn btn-ghost" style={{ fontSize: 12 }} disabled={!!fix} onClick={() => action(p.id, 'suggest_angle', p.kw)}>{fix === p.id + 'suggest_angle' ? '…' : <><OnyxIcon emoji="🔁" size={13} /> {L('Diferenciar ángulo', 'Differentiate')}</>}</button>}
                          <a className="btn btn-ghost" style={{ fontSize: 12 }} href={`/blog/${p.slug}`} target="_blank" rel="noreferrer">{L('Ver', 'View')} →</a>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {posts.length > 25 && <button className="btn btn-ghost" style={{ fontSize: 12, marginTop: 10 }} onClick={() => setShowAll((s) => !s)}>{showAll ? L('Ver menos', 'Show less') : L(`Ver los ${posts.length}`, `Show all ${posts.length}`)}</button>}
              <div className="muted" style={{ fontSize: 11, marginTop: 10 }}>{L('Ordenado por peor puntuación. Los arreglos usan tu IA y se aplican a ese artículo (revísalo en el editor). Frescura usa datos reales de Search Console.', 'Sorted worst-first. Fixes use your AI and apply to that article (review it in the editor). Freshness uses real Search Console data.')}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
