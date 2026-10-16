'use client';
import { useEffect, useState } from 'react';
import Icon from '@/app/components/Icons';
import { flagEmoji } from '@/lib/geo';

// Onyx AI · Insights de soporte (admin). Lee los KPIs + temas/mejorar/añadir de
// /api/admin/support/insights y permite convertir un hallazgo en artículo de la
// Base IA con un clic. Colapsable; la parte de IA viene de caché (botón Actualizar).
export default function SupportInsights({ lang }: { lang: string }) {
  const es = lang !== 'en';
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState('');
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const [drafting, setDrafting] = useState<Record<string, boolean>>({});

  async function load(d = days, refresh = false) {
    setBusy(true); setErr('');
    try {
      const r = await fetch(`/api/admin/support/insights?days=${d}&lang=${lang}${refresh ? '&refresh=1' : ''}`, { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok || j.error) { setErr(j.error || 'error'); setData(null); }
      else setData(j);
    } catch { setErr('error'); }
    setBusy(false);
  }
  useEffect(() => { if (open && !data) load(); /* eslint-disable-next-line */ }, [open]);

  const [dups, setDups] = useState<Record<string, boolean>>({});
  async function toKb(topic: string) {
    if (added[topic] || drafting[topic]) return;
    setDrafting((s) => ({ ...s, [topic]: true }));
    try {
      // Mandamos `topic`: la IA redacta el artículo completo (título + contenido).
      const r = await fetch('/api/admin/support/insights', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ topic, lang }) });
      const j = await r.json().catch(() => ({} as any));
      if (j?.duplicate) setDups((s) => ({ ...s, [topic]: true }));
      else setAdded((s) => ({ ...s, [topic]: true }));
    } catch {}
    setDrafting((s) => ({ ...s, [topic]: false }));
  }

  const k = data?.kpis;
  const ai = data?.ai;
  const maxTopic = Math.max(1, ...(ai?.topics || []).map((t: any) => t.count || 0));
  const langName = (c: string) => ({ es: 'Español', en: 'English', pt: 'Português', zh: '中文', ja: '日本語', vi: 'Tiếng Việt', fr: 'Français', ar: 'العربية' } as any)[c] || c;

  const Kpi = ({ label, value, sub, tone }: any) => (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 12px', minWidth: 0 }}>
      <div className="muted" style={{ fontSize: 11.5 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: tone || 'var(--tx)' }}>{value}</div>
      {sub && <div className="muted" style={{ fontSize: 10.5 }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ marginBottom: 12 }}>
      <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', gap: 8, alignItems: 'center' }} onClick={() => setOpen((v) => !v)}>
        <Icon name="sparkles" size={15} /> {es ? 'Onyx AI · Insights de soporte' : 'Onyx AI · Support insights'}
        <span style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s', display: 'inline-flex' }}><Icon name="chevronDown" size={15} /></span>
      </button>

      {open && (
        <div className="card" style={{ padding: 14, marginTop: 10 }}>
          <div className="row between" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <div className="row" style={{ gap: 6 }}>
              {[7, 30, 90].map((d) => (
                <button key={d} onClick={() => { setDays(d); load(d); }} className="btn btn-ghost"
                  style={{ padding: '5px 11px', fontSize: 12, ...(days === d ? { background: 'var(--brand)', color: '#0b0d17', borderColor: 'transparent' } : {}) }}>
                  {d} {es ? 'días' : 'days'}
                </button>
              ))}
            </div>
            <button onClick={() => load(days, true)} disabled={busy} className="btn btn-ghost" style={{ padding: '5px 11px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Icon name="refresh" size={13} /> {busy ? (es ? 'Analizando…' : 'Analyzing…') : (es ? 'Actualizar IA' : 'Refresh AI')}
            </button>
          </div>

          {err && <div style={{ color: 'var(--red)', fontSize: 12.5, marginBottom: 8 }}>{es ? 'No se pudo cargar.' : 'Could not load.'} {err}</div>}
          {!data && busy && <div className="muted" style={{ fontSize: 12.5 }}>{es ? 'Cargando…' : 'Loading…'}</div>}

          {k && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8, marginBottom: 12 }}>
                <Kpi label={es ? 'Conversaciones' : 'Conversations'} value={k.total} sub={`${k.leads} ${es ? 'leads' : 'leads'} · ${k.users} ${es ? 'usuarios' : 'users'}`} />
                <Kpi label={es ? 'Resueltas por IA' : 'AI-resolved'} value={`${k.aiResolvedPct}%`} tone="var(--soft-green)" sub={`${k.humanPct}% ${es ? 'con persona' : 'with a person'}`} />
                <Kpi label={es ? '1ª respuesta' : 'First reply'} value={k.firstRespMin != null ? `${k.firstRespMin} min` : '—'} sub={es ? 'media humana' : 'human avg'} />
                <Kpi label={es ? 'Idioma top' : 'Top language'} value={k.langs?.[0] ? langName(k.langs[0].lang) : '—'} sub={k.peakHours?.[0] != null ? `${es ? 'pico' : 'peak'} ${k.peakHours[0].hour}:00` : ''} />
              </div>

              {/* De dónde escriben (por IP, aproximado) */}
              {!!(k.countries || []).length && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="flag" size={14} /> {es ? 'De dónde escriben' : 'Where they write from'}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                    {k.countries.map((c: any, i: number) => (
                      <span key={i} style={{ fontSize: 12.5, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 999, padding: '4px 11px' }}>{flagEmoji(c.country)} {c.country} · {c.count}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Pocas conversaciones: la IA no inventa temas/sugerencias sin datos reales */}
              {data?.lowData && (
                <div style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: 12, fontSize: 12.5, lineHeight: 1.6 }} className="muted">
                  <div style={{ fontWeight: 700, color: 'var(--tx)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="bulb" size={14} /> {es ? 'Aún no hay suficientes datos' : 'Not enough data yet'}</div>
                  {es
                    ? 'La IA solo sugiere temas y mejoras cuando hay suficientes preguntas reales de clientes. Con pocas conversaciones inventaría genéricos, así que esperamos a que llegue tráfico real. Los KPIs de arriba sí son reales.'
                    : 'The AI only suggests topics and improvements once there are enough real customer questions. With few conversations it would just fabricate generic ones, so we wait for real traffic. The KPIs above are real.'}
                </div>
              )}

              {/* Lo más preguntado */}
              {!!(ai?.topics || []).length && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="message" size={14} /> {es ? 'Lo que más pregunta la gente' : 'What people ask most'}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {ai.topics.map((t: any, i: number) => (
                      <div key={i}>
                        <div className="row between" style={{ fontSize: 12.5 }}><span>{t.label}</span><span className="muted">{t.count}</span></div>
                        <div style={{ height: 6, background: 'var(--bg2)', borderRadius: 4, marginTop: 3 }}>
                          <div style={{ width: `${Math.round((t.count / maxTopic) * 100)}%`, height: 6, background: 'var(--brand)', borderRadius: 4 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Dónde mejorar */}
              {!!(ai?.improve || []).length && (
                <div style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: 11, marginBottom: 10 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6, color: 'var(--soft-brand, #ffb15e)', display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="flag" size={14} /> {es ? 'Dónde mejorar' : 'Where to improve'}</div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.6 }}>{ai.improve.map((s: string, i: number) => <li key={i} className="muted">{s}</li>)}</ul>
                </div>
              )}

              {/* Qué añadir (con botón → Base IA) */}
              {!!(ai?.add || []).length && (
                <div style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: 11 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8, color: 'var(--soft-green, #34e2a0)', display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="bulb" size={14} /> {es ? 'Qué añadir (sugerencia IA)' : 'What to add (AI suggestion)'}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {ai.add.map((s: string, i: number) => (
                      <div key={i} className="row between" style={{ gap: 8, alignItems: 'flex-start' }}>
                        <span className="muted" style={{ fontSize: 12.5, lineHeight: 1.5, flex: 1 }}>{s}</span>
                        <button onClick={() => toKb(s)} disabled={!!added[s] || !!drafting[s] || !!dups[s]} className="btn btn-ghost" style={{ padding: '4px 9px', fontSize: 11.5, flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 5, ...(added[s] ? { color: 'var(--soft-green)' } : dups[s] ? { color: 'var(--muted)' } : {}) }}>
                          <Icon name={added[s] ? 'check' : dups[s] ? 'check' : drafting[s] ? 'sparkles' : 'plus'} size={12} /> {added[s] ? (es ? 'Añadido' : 'Added') : dups[s] ? (es ? 'Ya existe' : 'Exists') : drafting[s] ? (es ? 'Redactando…' : 'Writing…') : (es ? 'Base IA' : 'KB')}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {data?.aiAt && <div className="muted" style={{ fontSize: 10.5, marginTop: 10, textAlign: 'right' }}>{es ? 'IA actualizada' : 'AI updated'}: {new Date(data.aiAt).toLocaleString()}</div>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
