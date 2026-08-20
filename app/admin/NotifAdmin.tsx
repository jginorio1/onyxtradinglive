'use client';
import { useEffect, useState } from 'react';
import { toast } from '@/lib/toast';
import NotifPreview from './previews/NotifPreview';

// Admin → Notificaciones. El dueño edite, por cada tipo de aviso: on/off, canales
// (campana / push / Telegram) y los textos ES/EN. Los "extra" nacen apagados.
function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return <span className="toggle" onClick={onClick} style={{ background: on ? 'var(--green)' : '#556080', boxShadow: on ? 'none' : 'inset 0 0 0 1px rgba(255,255,255,.12)' }}><span className="knob" style={{ left: on ? 21 : 3 }} /></span>;
}

export default function NotifAdmin({ lang }: { lang: 'es' | 'en' }) {
  const es = lang === 'es';
  const [cat, setCat] = useState<any[]>([]);
  const [ov, setOv] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const r = await fetch('/api/admin/notifications'); const j = await r.json();
      setCat(j.catalog || []);
      // Semilla: parte de los valores por defecto del catálogo mezclados con overrides.
      const seed: Record<string, any> = {};
      for (const d of (j.catalog || [])) {
        const o = (j.overrides || {})[d.key] || {};
        seed[d.key] = {
          on: o.on ?? !d.extra,
          bell: o.bell ?? d.bell, push: o.push ?? d.push, telegram: o.telegram ?? d.telegram,
          title_es: o.title_es ?? d.es.title, title_en: o.title_en ?? d.en.title,
          body_es: o.body_es ?? d.es.body, body_en: o.body_en ?? d.en.body,
        };
      }
      setOv(seed);
    } catch {}
  }
  useEffect(() => { load(); }, []);

  const set = (k: string, f: string, v: any) => setOv((p) => ({ ...p, [k]: { ...p[k], [f]: v } }));
  const [aiKey, setAiKey] = useState('');       // qué tarjeta tiene abierta la IA
  const [aiText, setAiText] = useState<Record<string, string>>({});
  const [aiBusy, setAiBusy] = useState('');
  async function runAi(k: string) {
    setAiBusy(k);
    try {
      const r = await fetch('/api/admin/notifications/ai', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: k, instruction: aiText[k] || '' }) });
      const j = await r.json();
      if (!r.ok) { toast(j.error || 'Error'); }
      else { setOv((p) => ({ ...p, [k]: { ...p[k], title_es: j.title_es, title_en: j.title_en, body_es: j.body_es, body_en: j.body_en } })); toast(es ? 'Redactado ✨' : 'Drafted ✨', 'ok'); }
    } catch { toast('Error'); }
    setAiBusy('');
  }
  async function save() {
    setBusy(true);
    try {
      const r = await fetch('/api/admin/notifications', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ overrides: ov }) });
      if (r.ok) toast(es ? 'Guardado' : 'Saved', 'ok'); else toast('Error');
    } catch { toast('Error'); }
    setBusy(false);
  }

  const groups = Array.from(new Set(cat.map((d) => d.group)));
  const inp = { width: '100%', padding: '7px 9px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--tx)', fontSize: 12.5, fontFamily: 'inherit', margin: 0 } as any;
  const chLabel = (c: string) => c === 'bell' ? (es ? 'Campana' : 'Bell') : c === 'push' ? 'Push' : 'Telegram';

  return (
    <div style={{ maxWidth: 900 }}>
      <div className="row between" style={{ marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 18, margin: 0 }}>🔔 {es ? 'Notificaciones' : 'Notifications'}</h2>
          <p className="muted" style={{ fontSize: 12.5, margin: '2px 0 0' }}>{es ? 'Prende/apaga cada aviso, elige sus canales y edita el texto. Usa {llaves} como variables.' : 'Turn each alert on/off, pick its channels and edit the text. Use {braces} as variables.'}</p>
        </div>
        <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? '…' : (es ? 'Guardar cambios' : 'Save changes')}</button>
      </div>

      {groups.map((g) => (
        <div key={g} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, color: 'var(--mut)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>{g}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {cat.filter((d) => d.group === g).map((d) => {
              const o = ov[d.key] || {};
              const chans: string[] = d.editableChannels || ['bell', 'push', 'telegram'];
              return (
                <div key={d.key} className="card" style={{ padding: 12, opacity: o.on ? 1 : 0.6 }}>
                  <div className="row between" style={{ alignItems: 'center', gap: 8 }}>
                    <b style={{ fontSize: 13.5 }}>{es ? o.title_es : o.title_en} {d.extra && <span className="pill" style={{ fontSize: 10, background: 'rgba(124,140,255,.15)', color: 'var(--soft-brand)' }}>{es ? 'extra' : 'extra'}</span>}</b>
                    <label className="row" style={{ gap: 6, fontSize: 12, cursor: 'pointer' }}><Toggle on={!!o.on} onClick={() => set(d.key, 'on', !o.on)} /> {o.on ? (es ? 'Activo' : 'On') : (es ? 'Apagado' : 'Off')}</label>
                  </div>
                  <div className="row" style={{ gap: 14, margin: '8px 0 2px', flexWrap: 'wrap' }}>
                    {chans.map((c) => (
                      <label key={c} className="row" style={{ gap: 6, fontSize: 12, cursor: 'pointer' }}><Toggle on={!!o[c]} onClick={() => set(d.key, c, !o[c])} /> {chLabel(c)}</label>
                    ))}
                  </div>
                  <div style={{ marginTop: 8, background: 'rgba(124,140,255,.08)', border: '1px solid rgba(124,140,255,.25)', borderRadius: 8, padding: 8 }}>
                    {aiKey === d.key ? (
                      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                        <input placeholder={es ? 'Instrucción (ej: más motivador y corto)' : 'Instruction (e.g. more motivating and short)'} value={aiText[d.key] || ''} onChange={(e) => setAiText((p) => ({ ...p, [d.key]: e.target.value }))} style={{ ...inp, flex: 1, minWidth: 160 }} />
                        <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={() => runAi(d.key)} disabled={aiBusy === d.key}>{aiBusy === d.key ? '…' : (es ? 'Redactar' : 'Draft')}</button>
                        <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setAiKey('')}>✕</button>
                      </div>
                    ) : (
                      <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setAiKey(d.key)}>✨ {es ? 'Redactar con IA' : 'Write with AI'}</button>
                    )}
                  </div>
                  <div className="grid g2" style={{ gap: 8, marginTop: 8 }}>
                    <div>
                      <div className="muted" style={{ fontSize: 11, marginBottom: 3 }}>Título (ES)</div>
                      <input style={inp} value={o.title_es || ''} onChange={(e) => set(d.key, 'title_es', e.target.value)} />
                      <textarea style={{ ...inp, marginTop: 6, minHeight: 42, resize: 'vertical' }} value={o.body_es || ''} onChange={(e) => set(d.key, 'body_es', e.target.value)} />
                    </div>
                    <div>
                      <div className="muted" style={{ fontSize: 11, marginBottom: 3 }}>Title (EN)</div>
                      <input style={inp} value={o.title_en || ''} onChange={(e) => set(d.key, 'title_en', e.target.value)} />
                      <textarea style={{ ...inp, marginTop: 6, minHeight: 42, resize: 'vertical' }} value={o.body_en || ''} onChange={(e) => set(d.key, 'body_en', e.target.value)} />
                    </div>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <div className="muted" style={{ fontSize: 11, marginBottom: 5 }}>{es ? 'Vista previa (como le llega al trader)' : 'Preview (as the trader receives it)'}</div>
                    <NotifPreview
                      title={es ? o.title_es : o.title_en}
                      body={es ? o.body_es : o.body_en}
                      bell={chans.includes('bell') ? !!o.bell : false}
                      push={chans.includes('push') ? !!o.push : false}
                      telegram={chans.includes('telegram') ? !!o.telegram : false}
                      es={es}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
