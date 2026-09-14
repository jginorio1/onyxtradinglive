'use client';
import { useEffect, useState } from 'react';
import { toast } from '@/lib/toast';
import OnyxIcon from '@/app/components/OnyxIcon';

// Interruptor moderno (mismo estilo que el piloto del blog).
function Switch({ on, accent = '#34e2a0' }: { on: boolean; accent?: string }) {
  return (
    <span style={{ display: 'inline-block', verticalAlign: 'middle', width: 42, height: 24, borderRadius: 999, flex: 'none', position: 'relative', transition: 'all .18s',
      background: on ? accent : 'var(--line)', boxShadow: on ? `0 0 14px -2px ${accent}` : 'none' }}>
      <span style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .18s', boxShadow: '0 2px 5px rgba(0,0,0,.35)' }} />
    </span>
  );
}

type Topics = { macro: boolean; markets: boolean; earnings: boolean; crypto: boolean };
type Custom = { id: string; name: string; url: string; cat: string };
type Cfg = { enabled: boolean; mode: 'auto' | 'draft'; maxPerDay: number; minMinutesBetween: number; emailSegment: string; topics: Topics; sources: Record<string, boolean>; custom_sources: Custom[]; maxAgeMin: number; seo: boolean };
type Src = { id: string; name: string; url: string; tier: 'primary' | 'wire'; cat: string };

const SEGMENTS = [
  { id: 'all', es: 'Todos (opt-in)', en: 'All (opted-in)' },
  { id: 'free', es: 'Plan gratis', en: 'Free plan' },
  { id: 'paid', es: 'Con plan de pago', en: 'Paying' },
  { id: 'connected', es: 'Con cuenta conectada', en: 'Connected' },
];
const CATLBL: Record<string, [string, string]> = { macro: ['Macro', 'Macro'], markets: ['Mercados', 'Markets'], earnings: ['Earnings', 'Earnings'], crypto: ['Cripto', 'Crypto'] };

export default function NewsPilot({ es, onChanged }: { es: boolean; onChanged?: () => void }) {
  const L = (a: string, b: string) => (es ? a : b);
  const [open, setOpen] = useState(false);
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [sources, setSources] = useState<Src[]>([]);
  const [recent, setRecent] = useState<any[]>([]);
  const [lastRun, setLastRun] = useState<{ at: string; via: string; reason: string; posted: number; candidate: string } | null>(null);
  const [cronHits1h, setCronHits1h] = useState<number | null>(null);
  const [busy, setBusy] = useState('');
  // Añadir fuente personalizada + resultado de la prueba de cada URL.
  const [nf, setNf] = useState<{ name: string; url: string; cat: string }>({ name: '', url: '', cat: 'markets' });
  const [tests, setTests] = useState<Record<string, { ok: boolean; count?: number; sample?: string; error?: string; loading?: boolean }>>({});

  async function load() {
    try {
      const r = await fetch('/api/admin/news'); const j = await r.json();
      if (j.settings) { setCfg(j.settings); setSources(j.sources || []); setRecent(j.recent || []); setLastRun(j.lastRun || null); setCronHits1h(typeof j.cronHits1h === 'number' ? j.cronHits1h : null); }
    } catch {}
  }
  useEffect(() => { load(); }, []);

  function upd<K extends keyof Cfg>(k: K, v: Cfg[K]) { setCfg((c) => (c ? { ...c, [k]: v } : c)); }
  function updTopic(k: keyof Topics) { setCfg((c) => (c ? { ...c, topics: { ...c.topics, [k]: !c.topics[k] } } : c)); }
  function updSource(id: string, on: boolean) { setCfg((c) => (c ? { ...c, sources: { ...c.sources, [id]: on } } : c)); }

  // Prueba una URL de feed contra el servidor (¿responde? ¿cuántos titulares?).
  async function testFeed(url: string, key: string) {
    if (!/^https?:\/\//i.test(url)) { setTests((t) => ({ ...t, [key]: { ok: false, error: L('URL inválida', 'Invalid URL') } })); return; }
    setTests((t) => ({ ...t, [key]: { ok: false, loading: true } }));
    try {
      const r = await fetch('/api/admin/news', { method: 'POST', body: JSON.stringify({ action: 'test', url }) });
      const j = await r.json();
      setTests((t) => ({ ...t, [key]: { ok: !!j.ok, count: j.count, sample: j.sample, error: j.error } }));
    } catch { setTests((t) => ({ ...t, [key]: { ok: false, error: L('Error de red', 'Network error') } })); }
  }
  // Añade la fuente personalizada al config (tras opcionalmente probarla).
  function addCustom() {
    const url = nf.url.trim();
    if (!/^https?:\/\//i.test(url)) { toast(L('Pon una URL de feed válida (http…).', 'Enter a valid feed URL (http…).'), 'err'); return; }
    const id = 'x_' + Math.random().toString(36).slice(2, 9);
    const item: Custom = { id, name: (nf.name.trim() || url).slice(0, 60), url, cat: nf.cat };
    setCfg((c) => (c ? { ...c, custom_sources: [...(c.custom_sources || []), item] } : c));
    setNf({ name: '', url: '', cat: 'markets' });
    toast(L('Fuente añadida. No olvides Guardar.', 'Source added. Remember to Save.'), 'ok');
  }
  function delCustom(id: string) {
    setCfg((c) => (c ? { ...c, custom_sources: (c.custom_sources || []).filter((x) => x.id !== id) } : c));
  }
  function updCustomField(id: string, k: keyof Custom, v: string) {
    setCfg((c) => (c ? { ...c, custom_sources: (c.custom_sources || []).map((x) => (x.id === id ? { ...x, [k]: v } : x)) } : c));
  }

  async function save() {
    if (!cfg) return;
    setBusy('save');
    try {
      const r = await fetch('/api/admin/news', { method: 'PATCH', body: JSON.stringify(cfg) });
      if (r.ok) { toast(L('Piloto de noticias guardado.', 'News pilot saved.'), 'ok'); onChanged?.(); }
      else toast(L('No se pudo guardar.', 'Could not save.'), 'err');
    } catch { toast(L('Error de red.', 'Network error.'), 'err'); } finally { setBusy(''); }
  }
  async function testNow() {
    setBusy('test');
    try {
      const r = await fetch('/api/admin/news', { method: 'POST' }); const j = await r.json();
      const msg = j.reason === 'posted' ? L('¡Publicó un artículo! Revisa el blog.', 'Posted an article! Check the blog.')
        : j.reason === 'drafted' ? L('Creó un borrador para revisar.', 'Created a draft to review.')
        : j.reason === 'no_fresh' ? L('No hay noticias frescas ahora mismo.', 'No fresh news right now.')
        : j.reason === 'all_seen' ? L('Todo lo reciente ya se había visto.', 'Everything recent was already seen.')
        : j.reason === 'cap_reached' ? L('Ya llegaste al tope de hoy.', 'Daily cap reached.')
        : j.reason === 'too_soon' ? L('Muy pronto tras el último (separación mínima).', 'Too soon after the last one.')
        : j.reason === 'gen_failed' ? L('La IA no pudo redactar (revisa la API key).', 'AI could not write (check API key).')
        : L('Ciclo ejecutado. Sin publicación.', 'Cycle ran. Nothing posted.');
      toast(msg, j.reason === 'posted' || j.reason === 'drafted' ? 'ok' : 'info');
      load();
    } catch { toast(L('Error de red.', 'Network error.'), 'err'); } finally { setBusy(''); }
  }

  if (!cfg) return null;
  const A = '#f5b23e';
  const box: any = { background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 12, padding: '12px 14px' };
  const lbl: any = { fontSize: 11.5, color: 'var(--mut)', marginBottom: 5 };

  // "hace X" legible a partir de una fecha ISO.
  const ago = (iso: string) => {
    const ms = Date.now() - new Date(iso).getTime();
    if (!Number.isFinite(ms) || ms < 0) return '';
    const m = Math.floor(ms / 60000), h = Math.floor(m / 60);
    if (m < 1) return L('hace segundos', 'seconds ago');
    if (m < 60) return L(`hace ${m} min`, `${m} min ago`);
    if (h < 24) return L(`hace ${h} h`, `${h} h ago`);
    return L(`hace ${Math.floor(h / 24)} días`, `${Math.floor(h / 24)} days ago`);
  };
  // Motivo del último ciclo en lenguaje claro.
  const reasonLbl = (r: string) => {
    const m: Record<string, [string, string]> = {
      posted: ['Publicó un artículo ✅', 'Posted an article ✅'],
      drafted: ['Dejó un borrador', 'Left a draft'],
      no_fresh: ['Sin noticias frescas importantes', 'No fresh important news'],
      all_seen: ['Todo lo reciente ya se había visto', 'Everything recent already seen'],
      cap_reached: ['Ya llegó al tope diario', 'Daily cap reached'],
      too_soon: ['Muy pronto tras la última', 'Too soon after the last'],
      disabled: ['Vigilante apagado', 'Watcher off'],
      no_sources: ['Sin fuentes activas', 'No active sources'],
      gen_failed: ['La IA no pudo redactar', 'AI could not write'],
    };
    if (r?.startsWith('error')) return [`Error: ${r.slice(7)}`, `Error: ${r.slice(7)}`][es ? 0 : 1];
    return (m[r] ? (es ? m[r][0] : m[r][1]) : r) || (es ? 'sin datos' : 'no data');
  };
  // ¿El cron parece vivo? última corrida vía cron hace ≤ 10 min.
  const cronHealthy = lastRun && lastRun.via === 'cron' && (Date.now() - new Date(lastRun.at).getTime()) < 10 * 60000;

  return (
    <div className="card" style={{ border: '1px solid ' + (cfg.enabled ? 'color-mix(in srgb,#f5b23e 45%,var(--line))' : 'var(--line)') }}>
      {/* Cabecera plegable */}
      <div onClick={() => setOpen((o) => !o)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', fontSize: 17, background: `${A}22`, border: `1px solid ${A}55` }}><OnyxIcon emoji="📰" size={15} /></span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14.5 }}>{L('Piloto de noticias económicas', 'Economic news pilot')}</div>
            <div className="muted" style={{ fontSize: 12 }}>{L('Detecta noticias importantes casi en vivo, escribe el artículo, lo publica y lo envía por email.', 'Detects important news near-live, writes the article, publishes and emails it.')}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="pill" style={{ fontSize: 11, color: cfg.enabled ? 'var(--soft-green)' : 'var(--mut)', background: cfg.enabled ? 'rgba(52,226,160,.15)' : 'var(--card2)' }}>{cfg.enabled ? L('Activo', 'On') : L('Apagado', 'Off')}</span>
          <span style={{ color: 'var(--mut)' }}>{open ? '▲' : '▼'}</span>
        </div>
      </div>

      {open && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Master + modo */}
          <div onClick={() => upd('enabled', !cfg.enabled)} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', ...box, borderColor: cfg.enabled ? A + '66' : 'var(--line)' }}>
            <div><div style={{ fontSize: 13.5, fontWeight: 700 }}>{L('Vigilante activo', 'Watcher on')}</div><div className="muted" style={{ fontSize: 12 }}>{L('Corre cada ~3 min y actúa solo cuando detecta algo importante.', 'Runs every ~3 min and acts only on important news.')}</div></div>
            <Switch on={cfg.enabled} accent={A} />
          </div>

          {/* Estado del cron: última corrida real (para saber si dispara solo) */}
          <div style={{ ...box, borderColor: lastRun ? (cronHealthy ? 'color-mix(in srgb,#34e2a0 40%,var(--line))' : 'color-mix(in srgb,#f5b23e 40%,var(--line))') : 'var(--line)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', flex: 'none', background: !lastRun ? 'var(--mut)' : cronHealthy ? '#34e2a0' : '#f5b23e', boxShadow: lastRun && cronHealthy ? '0 0 8px #34e2a0' : 'none' }} />
                <span style={{ fontSize: 13, fontWeight: 700 }}>{L('Última corrida', 'Last run')}</span>
              </div>
              {lastRun ? (
                <span className="muted" style={{ fontSize: 12 }}>{ago(lastRun.at)} · {lastRun.via === 'cron' ? L('automática', 'automatic') : L('prueba manual', 'manual test')}</span>
              ) : <span className="muted" style={{ fontSize: 12 }}>{L('Aún sin corridas registradas', 'No runs recorded yet')}</span>}
            </div>
            {lastRun && <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{reasonLbl(lastRun.reason)}{lastRun.candidate ? ` — “${lastRun.candidate.slice(0, 70)}”` : ''}</div>}
            {/* LATIDOS DEL CRON: prueba definitiva. ~20 por hora (cada 3 min) = el cron
                de Vercel dispara bien. 0 = no dispara (aunque esté en Pro). */}
            {cronHits1h != null && (
              <div style={{ fontSize: 12, marginTop: 8, display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', flex: 'none', background: cronHits1h >= 3 ? '#34e2a0' : '#f5b23e', boxShadow: cronHits1h >= 3 ? '0 0 8px #34e2a0' : 'none' }} />
                <span style={{ fontWeight: 700 }}>{cronHits1h}</span>
                <span className="muted">{L('corridas automáticas en la última hora', 'automatic runs in the last hour')} <span style={{ opacity: .7 }}>({L('esperado ~20', 'expected ~20')})</span></span>
              </div>
            )}
            {cronHits1h === 0 && (
              <div style={{ fontSize: 11.5, marginTop: 6, color: '#f5b23e' }}>
                {L('El cron de Vercel NO está disparando /api/cron/news (0 corridas/hora). Aun estando en Pro puede pasar si el deploy no registró vercel.json o hay demasiados crons. Solución segura: un cron externo (cron-job.org) que llame /api/cron/news?key=CRON_SECRET cada 3 min.', 'Vercel cron is NOT firing /api/cron/news (0 runs/hour). Even on Pro this can happen if the deploy didn’t register vercel.json or there are too many crons. Safe fix: an external cron (cron-job.org) hitting /api/cron/news?key=CRON_SECRET every 3 min.')}
              </div>
            )}
          </div>

          <div style={box}>
            <div style={lbl}>{L('Al detectar una noticia importante', 'When it detects important news')}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {([['auto', L('Publicar + email al instante', 'Publish + email instantly')], ['draft', L('Dejar borrador para revisar', 'Leave a draft to review')]] as const).map(([v, t]) => (
                <button key={v} type="button" onClick={() => upd('mode', v)} className="btn btn-ghost" style={{ fontSize: 12, border: '1px solid ' + (cfg.mode === v ? A : 'var(--line)'), background: cfg.mode === v ? `color-mix(in srgb,${A} 18%,transparent)` : 'transparent' }}>{t}</button>
              ))}
            </div>
          </div>

          {/* Límites */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
            <div style={box}><div style={lbl}>{L('Máx por día', 'Max per day')}</div><input type="number" min={1} max={50} value={cfg.maxPerDay} onChange={(e) => upd('maxPerDay', Math.max(1, Math.min(50, parseInt(e.target.value, 10) || 1)))} style={{ margin: 0, width: '100%' }} /></div>
            <div style={box}><div style={lbl}>{L('Separación mínima (min)', 'Min gap (min)')}</div><input type="number" min={0} max={720} value={cfg.minMinutesBetween} onChange={(e) => upd('minMinutesBetween', Math.max(0, Math.min(720, parseInt(e.target.value, 10) || 0)))} style={{ margin: 0, width: '100%' }} /></div>
            <div style={box}><div style={lbl}>{L('Frescura máx (min)', 'Max age (min)')}</div><input type="number" min={5} max={720} value={cfg.maxAgeMin} onChange={(e) => upd('maxAgeMin', Math.max(5, Math.min(720, parseInt(e.target.value, 10) || 5)))} style={{ margin: 0, width: '100%' }} /></div>
            <div style={box}><div style={lbl}>{L('Email a', 'Email to')}</div><select value={cfg.emailSegment} onChange={(e) => upd('emailSegment', e.target.value)} style={{ margin: 0, width: '100%' }}>{SEGMENTS.map((s) => <option key={s.id} value={s.id}>{es ? s.es : s.en}</option>)}</select></div>
          </div>

          {/* Temas */}
          <div style={box}>
            <div style={lbl}>{L('Temas que disparan artículos', 'Topics that trigger articles')}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(Object.keys(cfg.topics) as (keyof Topics)[]).map((k) => (
                <button key={k} type="button" onClick={() => updTopic(k)} className="btn btn-ghost" style={{ fontSize: 12, borderRadius: 99, border: '1px solid ' + (cfg.topics[k] ? '#7c8cff' : 'var(--line)'), background: cfg.topics[k] ? 'color-mix(in srgb,#7c8cff 16%,transparent)' : 'transparent' }}>{(es ? CATLBL[k]?.[0] : CATLBL[k]?.[1]) || k}{cfg.topics[k] ? ' ✓' : ''}</button>
              ))}
            </div>
          </div>

          {/* SEO ligero */}
          <div onClick={() => upd('seo', !(cfg.seo !== false))} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', ...box }}>
            <div><div style={{ fontSize: 13, fontWeight: 700 }}>{L('Optimizar SEO en las noticias', 'SEO-optimize the news')}</div><div className="muted" style={{ fontSize: 11.5 }}>{L('Foco en el evento + teje UNA keyword de tu lista/Search Console solo si encaja. Marca NewsArticle.', 'Event-focused + weaves ONE keyword from your list/Search Console only if it fits. Marks NewsArticle.')}</div></div>
            <Switch on={cfg.seo !== false} accent="#7c8cff" />
          </div>

          {/* Fuentes de casa */}
          <div style={box}>
            <div style={lbl}>{L('Fuentes (RSS) — de dónde saca las noticias. Enciende/apaga, abre el enlace o pruébala.', 'Sources (RSS) — where news comes from. Toggle, open the link or test it.')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {sources.map((s) => {
                const on = cfg.sources[s.id] !== false;
                const tr = tests['b_' + s.id];
                return (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--line)', borderRadius: 9, padding: '7px 9px', background: on ? 'color-mix(in srgb,#34e2a0 7%,transparent)' : 'transparent' }}>
                    <span onClick={() => updSource(s.id, !on)} style={{ cursor: 'pointer', flex: 'none' }}><Switch on={on} accent="#34e2a0" /></span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 600 }}>{s.name}</span>
                        <span style={{ fontSize: 10, color: 'var(--mut)' }}>{s.tier === 'primary' ? '★' : ''} {(es ? CATLBL[s.cat]?.[0] : CATLBL[s.cat]?.[1]) || s.cat}</span>
                        {tr && !tr.loading && <span style={{ fontSize: 10.5, color: tr.ok ? 'var(--green)' : 'var(--red,#ef6262)' }}>{tr.ok ? `● ${tr.count} ${L('titulares', 'headlines')}` : `● ${L('sin respuesta', 'no response')}`}</span>}
                      </div>
                      <a href={s.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ fontSize: 10.5, color: '#7c8cff', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: '100%' }}>{s.url}</a>
                    </div>
                    <button type="button" className="btn btn-ghost" onClick={() => testFeed(s.url, 'b_' + s.id)} disabled={tr?.loading} style={{ fontSize: 11, padding: '4px 8px', flex: 'none' }}>{tr?.loading ? '…' : L('Probar', 'Test')}</button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Fuentes personalizadas */}
          <div style={box}>
            <div style={lbl}>{L('Tus fuentes (añade cualquier RSS/Atom)', 'Your sources (add any RSS/Atom feed)')}</div>
            {(cfg.custom_sources || []).length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                {(cfg.custom_sources || []).map((s) => {
                  const on = cfg.sources[s.id] !== false;
                  const tr = tests['c_' + s.id];
                  return (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--line)', borderRadius: 9, padding: '7px 9px', background: on ? 'color-mix(in srgb,#7c8cff 8%,transparent)' : 'transparent' }}>
                      <span onClick={() => updSource(s.id, !on)} style={{ cursor: 'pointer', flex: 'none' }}><Switch on={on} accent="#7c8cff" /></span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <input value={s.name} onChange={(e) => updCustomField(s.id, 'name', e.target.value)} style={{ margin: 0, fontSize: 12.5, fontWeight: 600, padding: '2px 6px', width: 130 }} />
                          <select value={s.cat} onChange={(e) => updCustomField(s.id, 'cat', e.target.value)} style={{ margin: 0, fontSize: 11, padding: '2px 4px' }}>
                            {Object.keys(CATLBL).map((k) => <option key={k} value={k}>{es ? CATLBL[k][0] : CATLBL[k][1]}</option>)}
                          </select>
                          {tr && !tr.loading && <span style={{ fontSize: 10.5, color: tr.ok ? 'var(--green)' : 'var(--red,#ef6262)' }}>{tr.ok ? `● ${tr.count} ${L('titulares', 'headlines')}` : `● ${tr.error || L('sin respuesta', 'no response')}`}</span>}
                        </div>
                        <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10.5, color: '#7c8cff', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: '100%' }}>{s.url}</a>
                      </div>
                      <button type="button" className="btn btn-ghost" onClick={() => testFeed(s.url, 'c_' + s.id)} disabled={tr?.loading} style={{ fontSize: 11, padding: '4px 8px', flex: 'none' }}>{tr?.loading ? '…' : L('Probar', 'Test')}</button>
                      <button type="button" className="btn btn-ghost" onClick={() => delCustom(s.id)} title={L('Quitar', 'Remove')} style={{ fontSize: 12, padding: '4px 8px', flex: 'none', color: 'var(--red,#ef6262)' }}>✕</button>
                    </div>
                  );
                })}
              </div>
            )}
            {/* Añadir */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <input value={nf.name} onChange={(e) => setNf({ ...nf, name: e.target.value })} placeholder={L('Nombre (ej. Reuters)', 'Name (e.g. Reuters)')} style={{ margin: 0, fontSize: 12, padding: '6px 8px', width: 150 }} />
              <input value={nf.url} onChange={(e) => setNf({ ...nf, url: e.target.value })} placeholder="https://…/rss" style={{ margin: 0, fontSize: 12, padding: '6px 8px', flex: 1, minWidth: 180 }} />
              <select value={nf.cat} onChange={(e) => setNf({ ...nf, cat: e.target.value })} style={{ margin: 0, fontSize: 12, padding: '6px 6px' }}>
                {Object.keys(CATLBL).map((k) => <option key={k} value={k}>{es ? CATLBL[k][0] : CATLBL[k][1]}</option>)}
              </select>
              <button type="button" className="btn btn-ghost" onClick={() => testFeed(nf.url, 'new')} disabled={tests['new']?.loading} style={{ fontSize: 12 }}>{tests['new']?.loading ? '…' : L('Probar', 'Test')}</button>
              <button type="button" className="btn btn-primary" onClick={addCustom} style={{ fontSize: 12 }}>＋ {L('Añadir', 'Add')}</button>
            </div>
            {tests['new'] && !tests['new'].loading && (
              <div style={{ fontSize: 11, marginTop: 6, color: tests['new'].ok ? 'var(--green)' : 'var(--red,#ef6262)' }}>
                {tests['new'].ok ? L(`✓ Responde: ${tests['new'].count} titulares. Ej.: `, `✓ Works: ${tests['new'].count} headlines. E.g.: `) + (tests['new'].sample || '') : `✕ ${tests['new'].error || L('no responde', 'no response')}`}
              </div>
            )}
          </div>

          {/* Acciones */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={save} disabled={busy === 'save'} style={{ fontSize: 12.5 }}>{busy === 'save' ? '…' : L('Guardar', 'Save')}</button>
            <button className="btn btn-ghost" onClick={testNow} disabled={!!busy} style={{ fontSize: 12.5 }}>{busy === 'test' ? '…' : L('Probar ahora', 'Test now')}</button>
          </div>

          {/* Aviso salvaguardas */}
          <div className="muted" style={{ fontSize: 11, borderTop: '1px dashed var(--line)', paddingTop: 8 }}>
            {L('Nota: neutral y factual, cita la fuente, sin promesas ni predicciones; evita duplicados y respeta el tope diario. Requiere correr una vez supabase/news_pilot.sql.', 'Note: neutral and factual, cites the source, no promises or predictions; dedupes and respects the daily cap. Run supabase/news_pilot.sql once.')}
          </div>

          {/* Últimos vistos */}
          {recent.length > 0 && (
            <div style={box}>
              <div style={lbl}>{L('Últimos titulares vistos', 'Recently seen headlines')}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 200, overflow: 'auto' }}>
                {recent.map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}>
                    <span style={{ flex: 'none', color: r.posted ? 'var(--green)' : 'var(--mut)' }}>{r.posted ? '✓' : '·'}</span>
                    <span style={{ flex: 'none', color: 'var(--mut)', width: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.source}</span>
                    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
