'use client';
import { useEffect, useState } from 'react';
import { toast } from '@/lib/toast';
import { Hint } from '@/app/components/HintPop';
import GuidePanel, { type GuideStep } from '@/app/components/GuidePanel';

type Slot = { key: string; es: string; en: string; size: string; page: string };
type Rate = Slot & { price: number; unit: 'week' | 'month' | 'cpm' };
type Campaign = { id: string; advertiser: string; contact: string; slot_key: string; creative_url: string; link_url: string; alt: string; lang: string; starts_at: string | null; ends_at: string | null; weight: number; price: number; status: string; impressions: number; clicks: number };

const UNIT: Record<string, [string, string]> = { week: ['/ semana', '/ week'], month: ['/ mes', '/ month'], cpm: ['CPM (mil impresiones)', 'CPM (per 1k impressions)'] };
const emptyForm = { id: '', advertiser: '', contact: '', slot_key: '', creative_url: '', creative_path: '', link_url: '', alt: '', lang: 'all', geo: 'all', geo_tier: '', geo_exclude: '', device: 'all', category: 'general', disclaimer: false, pricing_model: 'flat', budget: 0, daily_cap: 0, starts_at: '', ends_at: '', weight: 1, price: 0, status: 'active' };
const emptyPartner = { id: '', name: '', logo_url: '', blurb_es: '', blurb_en: '', link_url: '', category: 'broker', geo: 'all', cpa_payout: 0, featured: false, rank: 100, regulated: '', status: 'active' };

export default function AdsAdmin({ es }: { es: boolean }) {
  const L = (a: string, b: string) => (es ? a : b);
  const [cfg, setCfg] = useState<any>({ enabled: true, nativeEnabled: false, autoApprove: false, freqCap: 3, programmatic: { enabled: false, code: '' }, riskDisclaimer: { es: '', en: '' } });
  const [rates, setRates] = useState<Rate[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [camps, setCamps] = useState<Campaign[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [form, setForm] = useState<any>(emptyForm);
  const [pForm, setPForm] = useState<any>(emptyPartner);
  const [progCode, setProgCode] = useState('');
  const [busy, setBusy] = useState('');

  async function load() {
    try {
      const j = await (await fetch('/api/admin/ads')).json();
      if (j.config) { setCfg(j.config); setRates(j.rates || []); setSlots(j.slots || []); setCamps(j.campaigns || []); setPartners(j.partners || []); setProgCode(j.config.programmatic?.code || ''); }
    } catch {}
  }
  useEffect(() => { load(); }, []);
  const pending = camps.filter((c: any) => c.status === 'pending');

  async function patch(body: any, okMsg: string) {
    setBusy('cfg');
    try {
      const r = await fetch('/api/admin/ads', { method: 'PATCH', body: JSON.stringify(body) });
      if (r.ok) { toast(okMsg, 'ok'); load(); }
      else toast(r.status === 423 ? L('Panel bloqueado: desbloquea con tu PIN.', 'Panel locked: unlock with your PIN.') : L('No se pudo guardar.', 'Could not save.'), 'err');
    } catch { toast(L('Error de red.', 'Network error.'), 'err'); } finally { setBusy(''); }
  }
  async function saveRates() {
    const map: any = {}; rates.forEach((r) => { map[r.key] = { price: r.price, unit: r.unit }; });
    await patch({ rates: map }, L('Tarifario guardado.', 'Rate card saved.'));
  }
  async function post(body: any, okMsg: string) {
    setBusy('camp');
    try {
      const r = await fetch('/api/admin/ads', { method: 'POST', body: JSON.stringify(body) });
      const j = await r.json();
      if (r.ok) { toast(okMsg, 'ok'); setForm(emptyForm); load(); }
      else toast(j.error || L('No se pudo guardar.', 'Could not save.'), 'err');
    } catch { toast(L('Error de red.', 'Network error.'), 'err'); } finally { setBusy(''); }
  }

  const box: any = { background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 12, padding: 14 };
  const lbl: any = { fontSize: 11.5, color: 'var(--mut)', marginBottom: 5 };
  const slotName = (k: string) => { const s = slots.find((x) => x.key === k); return s ? (es ? s.es : s.en) + ' · ' + s.size : k; };
  const ctr = (c: Campaign) => (c.impressions > 0 ? ((c.clicks / c.impressions) * 100).toFixed(1) + '%' : '—');
  const stColor: Record<string, string> = { active: '#34e2a0', paused: '#f5b23e', draft: '#7c8cff', pending: '#e0a92e', rejected: '#ef6262', scheduled: '#7c8cff', ended: 'var(--mut)' };

  const guideSteps: GuideStep[] = [
    { target: '[data-guide="review"]', title: L('1 · Revisar artes', '1 · Review creatives'), body: L('Cuando un anunciante paga en /publicidad, su banner NO sale live: espera aquí tu aprobación. Revisa que el arte y el enlace sean apropiados y aprueba o rechaza. Sin clientes todavía, esto estará vacío.', 'When an advertiser pays on /publicidad, their banner does NOT go live: it waits here for your approval. Check the creative and link, then approve or reject. With no clients yet, this is empty.') },
    { target: '[data-guide="settings"]', title: L('2 · Ajustes', '2 · Settings'), body: L('Aquí decides qué se muestra en un hueco vacío. Sin anunciantes, se ve tu anuncio de "Pro" (no queda vacío). El relleno programático es opcional (solo si tienes AdSense/Ezoic). El aviso de riesgo ya viene listo.', 'Here you decide what shows in an empty slot. With no advertisers, your "Pro" ad shows (never blank). Programmatic fill is optional (only if you have AdSense/Ezoic). The risk disclaimer is ready.') },
    { target: '[data-guide="rates"]', title: L('3 · Poner precios', '3 · Set prices'), body: L('Define cuánto cobras por cada espacio y tamaño. Es tu tarifario: lo que verá el anunciante en /publicidad. Ponlo una vez y guarda.', 'Set how much you charge per space and size. This is your rate card: what advertisers see on /publicidad. Set once and save.') },
    { target: '[data-guide="campaign"]', title: L('4 · Crear campaña a mano', '4 · Create a campaign manually'), body: L('Si vendiste un espacio por fuera (WhatsApp, correo), créalo aquí: sube el banner, pon el enlace y actívalo. También llegan solas desde /publicidad.', 'If you sold a space off-platform (WhatsApp, email), create it here: upload the banner, set the link, activate. They also arrive on their own from /publicidad.') },
    { target: '[data-guide="partners"]', title: L('5 · Directorio de socios (CPA)', '5 · Partner directory (CPA)'), body: L('El ángulo que más rinde sin anunciantes: brokers y prop firms que te pagan por cada registro. Añádelos aquí y aparecen en /socios con tu enlace afiliado. Empieza por aquí.', 'The highest-yield angle without advertisers: brokers and prop firms that pay you per signup. Add them here and they appear on /socios with your affiliate link. Start here.') },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h2 style={{ fontSize: 20, margin: '0 0 2px' }}>{L('Espacios patrocinados', 'Sponsored spaces')}</h2>
          <div className="muted" style={{ fontSize: 13 }}>{L('Vende banners por ubicación y tamaño. Solo se muestran en la web y solo a usuarios del plan gratis.', 'Sell banners by placement and size. Shown only on web and only to free-plan users.')}</div>
        </div>
        <GuidePanel storageKey="ads" title={L('Guía de Publicidad', 'Advertising guide')} steps={guideSteps} es={es} />
      </div>

      {/* Interruptores globales */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
        <div onClick={() => patch({ enabled: !cfg.enabled }, cfg.enabled ? L('Anuncios apagados.', 'Ads off.') : L('Anuncios encendidos.', 'Ads on.'))} style={{ ...box, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div><div style={{ fontWeight: 700, fontSize: 13.5 }}>{L('Anuncios (global)', 'Ads (global)')}</div><div className="muted" style={{ fontSize: 12 }}>{L('Interruptor maestro para todos los espacios.', 'Master switch for every space.')}</div></div>
          <span style={{ fontSize: 12, fontWeight: 700, color: cfg.enabled ? '#34e2a0' : 'var(--mut)' }}>{cfg.enabled ? 'ON' : 'OFF'}</span>
        </div>
        <div onClick={() => patch({ nativeEnabled: !cfg.nativeEnabled }, L('Guardado.', 'Saved.'))} style={{ ...box, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div><div style={{ fontWeight: 700, fontSize: 13.5 }}>{L('Anuncios en la app nativa', 'Ads in the native app')}</div><div className="muted" style={{ fontSize: 12 }}>{L('Déjalo APAGADO hasta que Apple/Google aprueben.', 'Keep OFF until Apple/Google approve.')}</div></div>
          <span style={{ fontSize: 12, fontWeight: 700, color: cfg.nativeEnabled ? '#f5b23e' : 'var(--mut)' }}>{cfg.nativeEnabled ? 'ON' : 'OFF'}</span>
        </div>
      </div>

      {/* Cola de revisión de artes (F3) */}
      <div data-guide="review" style={{ ...box, borderColor: pending.length ? 'var(--brand)' : 'var(--line)' }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          {L('Revisión de artes', 'Creative review')}
          <Hint text={L('Los anuncios pagados en /publicidad esperan aquí tu aprobación antes de salir live. Revisa el arte y el enlace, y aprueba o rechaza. Sin clientes todavía, esto está vacío.', 'Ads paid on /publicidad wait here for your approval before going live. Check the creative and link, then approve or reject. With no clients yet, this is empty.')} />
          {pending.length > 0 && <span style={{ fontSize: 11, fontWeight: 800, background: 'var(--brand)', color: '#1a1400', borderRadius: 20, padding: '2px 9px' }}>{pending.length}</span>}
        </div>
        {pending.length === 0 ? <div className="muted" style={{ fontSize: 13 }}>{L('Nada por revisar. Las campañas pagadas en autoservicio esperan aquí tu aprobación antes de salir live.', 'Nothing to review. Paid self-serve campaigns wait here for your approval before going live.')}</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {pending.map((c: any) => (
              <div key={c.id} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', borderTop: '1px solid var(--line)', paddingTop: 10 }}>
                {c.creative_url && <img src={c.creative_url} alt="" style={{ maxWidth: 160, maxHeight: 70, borderRadius: 6, border: '1px solid var(--line)' }} />}
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>{c.advertiser} · <span className="muted" style={{ fontWeight: 400 }}>{slotName(c.slot_key)}</span></div>
                  <div className="muted" style={{ fontSize: 11.5 }}>{c.category} · ${c.price} · {c.contact}</div>
                  <a href={c.link_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11.5, color: 'var(--brand)', wordBreak: 'break-all' }}>{c.link_url}</a>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-primary" onClick={() => post({ action: 'approve', id: c.id }, L('Aprobada y live.', 'Approved and live.'))} style={{ fontSize: 12 }}>{L('Aprobar', 'Approve')}</button>
                  <button className="btn btn-ghost" onClick={() => { const note = prompt(L('Motivo del rechazo (opcional):', 'Rejection reason (optional):')) || ''; post({ action: 'reject', id: c.id, review_note: note }, L('Rechazada.', 'Rejected.')); }} style={{ fontSize: 12, color: 'var(--red,#ef6262)' }}>{L('Rechazar', 'Reject')}</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ajustes pro (F3/F5/F6) */}
      <div data-guide="settings" style={box}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>{L('Ajustes de monetización', 'Monetization settings')}
          <Hint text={L('Controlas qué se muestra en un hueco vacío (tu anuncio de Pro o una red externa), el tope de veces que un visitante ve el mismo anuncio, y el aviso de riesgo de los anuncios financieros. Sin clientes, no tienes que tocar nada.', 'You control what shows in an empty slot (your Pro ad or an external network), the cap on how many times a visitor sees the same ad, and the risk disclaimer on financial ads. With no clients, you don’t need to touch anything.')} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 }}>
          <div onClick={() => patch({ autoApprove: !cfg.autoApprove }, L('Guardado.', 'Saved.'))} style={{ ...box, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <div><div style={{ fontWeight: 600, fontSize: 13 }}>{L('Auto-aprobar artes', 'Auto-approve creatives')}</div><div className="muted" style={{ fontSize: 11 }}>{L('NO recomendado. Si está OFF, tú revisas cada anuncio.', 'Not recommended. If OFF, you review each ad.')}</div></div>
            <span style={{ fontSize: 12, fontWeight: 700, color: cfg.autoApprove ? '#f5b23e' : '#34e2a0' }}>{cfg.autoApprove ? 'ON' : 'OFF'}</span>
          </div>
          <div style={{ ...box }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{L('Tope de impresiones/visitante/día', 'Impression cap/visitor/day')}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="number" min={0} value={cfg.freqCap} onChange={(e) => setCfg({ ...cfg, freqCap: Math.max(0, parseInt(e.target.value, 10) || 0) })} style={{ margin: 0, width: 70 }} />
              <button className="btn btn-ghost" onClick={() => patch({ freqCap: cfg.freqCap }, L('Guardado.', 'Saved.'))} style={{ fontSize: 11 }}>{L('Guardar', 'Save')}</button>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{L('Relleno programático (red externa)', 'Programmatic fallback (ad network)')}</div>
            <span onClick={() => patch({ programmatic: { enabled: !cfg.programmatic?.enabled, code: progCode } }, L('Guardado.', 'Saved.'))} style={{ cursor: 'pointer', fontSize: 12, fontWeight: 700, color: cfg.programmatic?.enabled ? '#34e2a0' : 'var(--mut)' }}>{cfg.programmatic?.enabled ? 'ON' : 'OFF'}</span>
          </div>
          <div className="muted" style={{ fontSize: 11, margin: '2px 0 6px' }}>{L('Se muestra cuando ningún anunciante compró el hueco (cero impresión perdida). Pega el código de tu red (AdSense/Ezoic…).', 'Shown when no advertiser bought the slot (zero wasted impression). Paste your network code (AdSense/Ezoic…).')}</div>
          <textarea value={progCode} onChange={(e) => setProgCode(e.target.value)} placeholder="<script>…</script>" style={{ width: '100%', minHeight: 60, fontSize: 12, fontFamily: 'monospace' }} />
          <button className="btn btn-ghost" onClick={() => patch({ programmatic: { enabled: cfg.programmatic?.enabled, code: progCode } }, L('Código guardado.', 'Code saved.'))} style={{ fontSize: 11, marginTop: 6 }}>{L('Guardar código', 'Save code')}</button>
        </div>
        <div style={{ marginTop: 10 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{L('Aviso de riesgo financiero (broker/prop firm)', 'Financial risk disclaimer (broker/prop firm)')}</div>
          <input value={cfg.riskDisclaimer?.es || ''} onChange={(e) => setCfg({ ...cfg, riskDisclaimer: { ...cfg.riskDisclaimer, es: e.target.value } })} placeholder="ES" style={{ margin: '0 0 6px', width: '100%', fontSize: 12 }} />
          <input value={cfg.riskDisclaimer?.en || ''} onChange={(e) => setCfg({ ...cfg, riskDisclaimer: { ...cfg.riskDisclaimer, en: e.target.value } })} placeholder="EN" style={{ margin: 0, width: '100%', fontSize: 12 }} />
          <button className="btn btn-ghost" onClick={() => patch({ riskDisclaimer: cfg.riskDisclaimer }, L('Aviso guardado.', 'Disclaimer saved.'))} style={{ fontSize: 11, marginTop: 6 }}>{L('Guardar aviso', 'Save disclaimer')}</button>
        </div>
      </div>

      {/* Tarifario editable */}
      <div data-guide="rates" style={box}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>{L('Tarifario (precio por ubicación y tamaño)', 'Rate card (price by placement & size)')}
            <Hint text={L('El precio de cada espacio. Es lo que verá el anunciante en /publicidad. Edítalo y da "Guardar precios". Ponlo una vez.', 'The price of each space. This is what advertisers see on /publicidad. Edit it and hit "Save prices". Set once.')} />
          </div>
          <button className="btn btn-primary" onClick={saveRates} disabled={busy === 'cfg'} style={{ fontSize: 12 }}>{L('Guardar precios', 'Save prices')}</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rates.map((r, i) => (
            <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{es ? r.es : r.en}</div>
                <div className="muted" style={{ fontSize: 11 }}>{r.size} · {r.page}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ color: 'var(--mut)' }}>$</span>
                <input type="number" min={0} value={r.price} onChange={(e) => setRates((rs) => rs.map((x, j) => j === i ? { ...x, price: Math.max(0, parseFloat(e.target.value) || 0) } : x))} style={{ margin: 0, width: 90 }} />
              </div>
              <select value={r.unit} onChange={(e) => setRates((rs) => rs.map((x, j) => j === i ? { ...x, unit: e.target.value as any } : x))} style={{ margin: 0, fontSize: 12 }}>
                <option value="week">{L('/ semana', '/ week')}</option>
                <option value="month">{L('/ mes', '/ month')}</option>
                <option value="cpm">CPM</option>
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Nueva / editar campaña */}
      <div data-guide="campaign" style={box}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>{form.id ? L('Editar campaña', 'Edit campaign') : L('Nueva campaña', 'New campaign')}
          <Hint text={L('Crea un anuncio a mano (por ejemplo, si vendiste el espacio por WhatsApp). Elige ubicación, sube el banner, pon el enlace y actívalo. Puedes segmentar por país, tier, dispositivo y modelo de cobro.', 'Create an ad manually (e.g. if you sold the space over WhatsApp). Pick placement, upload the banner, set the link and activate. You can target by country, tier, device and pricing model.')} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
          <div><div style={lbl}>{L('Anunciante', 'Advertiser')}</div><input value={form.advertiser} onChange={(e) => setForm({ ...form, advertiser: e.target.value })} style={{ margin: 0, width: '100%' }} /></div>
          <div><div style={lbl}>{L('Ubicación', 'Placement')}</div><select value={form.slot_key} onChange={(e) => setForm({ ...form, slot_key: e.target.value })} style={{ margin: 0, width: '100%' }}><option value="">{L('elige…', 'choose…')}</option>{slots.map((s) => <option key={s.key} value={s.key}>{(es ? s.es : s.en) + ' · ' + s.size}</option>)}</select></div>
          <div><div style={lbl}>{L('Idioma', 'Language')}</div><select value={form.lang} onChange={(e) => setForm({ ...form, lang: e.target.value })} style={{ margin: 0, width: '100%' }}><option value="all">{L('Todos', 'All')}</option><option value="es">Español</option><option value="en">English</option></select></div>
          <div><div style={lbl}>{L('País (ISO, coma) o all', 'Country (ISO, comma) or all')}</div><input value={form.geo} onChange={(e) => setForm({ ...form, geo: e.target.value })} placeholder="all · US,MX,ES" style={{ margin: 0, width: '100%' }} /></div>
          <div><div style={lbl}>{L('Región (tier)', 'Region (tier)')}</div><select value={form.geo_tier} onChange={(e) => setForm({ ...form, geo_tier: e.target.value })} style={{ margin: 0, width: '100%' }}><option value="">{L('Todas', 'All')}</option><option value="t1">Tier 1</option><option value="t2">Tier 2</option><option value="t3">Tier 3</option></select></div>
          <div><div style={lbl}>{L('Excluir países (ISO)', 'Exclude countries (ISO)')}</div><input value={form.geo_exclude} onChange={(e) => setForm({ ...form, geo_exclude: e.target.value })} placeholder="US,FR" style={{ margin: 0, width: '100%' }} /></div>
          <div><div style={lbl}>{L('Dispositivo', 'Device')}</div><select value={form.device} onChange={(e) => setForm({ ...form, device: e.target.value })} style={{ margin: 0, width: '100%' }}><option value="all">{L('Todos', 'All')}</option><option value="desktop">{L('Escritorio', 'Desktop')}</option><option value="mobile">{L('Móvil', 'Mobile')}</option></select></div>
          <div><div style={lbl}>{L('Categoría', 'Category')}</div><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={{ margin: 0, width: '100%' }}><option value="general">General</option><option value="broker">Broker</option><option value="propfirm">Prop firm</option><option value="tool">{L('Herramienta', 'Tool')}</option><option value="education">{L('Educación', 'Education')}</option></select></div>
          <div><div style={lbl}>{L('Modelo de cobro', 'Pricing model')}</div><select value={form.pricing_model} onChange={(e) => setForm({ ...form, pricing_model: e.target.value })} style={{ margin: 0, width: '100%' }}><option value="flat">{L('Plano', 'Flat')}</option><option value="cpm">CPM</option><option value="cpc">CPC</option><option value="cpa">CPA</option></select></div>
          <div><div style={lbl}>{L('Presupuesto ($, cpm/cpc/cpa)', 'Budget ($, cpm/cpc/cpa)')}</div><input type="number" min={0} value={form.budget} onChange={(e) => setForm({ ...form, budget: Math.max(0, parseFloat(e.target.value) || 0) })} style={{ margin: 0, width: '100%' }} /></div>
          <div><div style={lbl}>{L('Tope diario ($)', 'Daily cap ($)')}</div><input type="number" min={0} value={form.daily_cap} onChange={(e) => setForm({ ...form, daily_cap: Math.max(0, parseFloat(e.target.value) || 0) })} style={{ margin: 0, width: '100%' }} /></div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}><label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, cursor: 'pointer' }}><input type="checkbox" checked={!!form.disclaimer} onChange={(e) => setForm({ ...form, disclaimer: e.target.checked })} />{L('Mostrar aviso de riesgo', 'Show risk disclaimer')}</label></div>
          <div style={{ gridColumn: '1 / -1' }}><div style={lbl}>{L('Imagen del banner (URL)', 'Banner image (URL)')}</div><input value={form.creative_url} onChange={(e) => setForm({ ...form, creative_url: e.target.value })} placeholder="https://…/banner.png" style={{ margin: 0, width: '100%' }} /></div>
          <div style={{ gridColumn: '1 / -1' }}><div style={lbl}>{L('Enlace destino', 'Destination link')}</div><input value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} placeholder="https://…" style={{ margin: 0, width: '100%' }} /></div>
          <div><div style={lbl}>{L('Inicia', 'Starts')}</div><input type="date" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} style={{ margin: 0, width: '100%' }} /></div>
          <div><div style={lbl}>{L('Termina', 'Ends')}</div><input type="date" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} style={{ margin: 0, width: '100%' }} /></div>
          <div><div style={lbl}>{L('Peso (rotación)', 'Weight (rotation)')}</div><input type="number" min={1} value={form.weight} onChange={(e) => setForm({ ...form, weight: Math.max(1, parseInt(e.target.value, 10) || 1) })} style={{ margin: 0, width: '100%' }} /></div>
          <div><div style={lbl}>{L('Precio cobrado ($)', 'Price charged ($)')}</div><input type="number" min={0} value={form.price} onChange={(e) => setForm({ ...form, price: Math.max(0, parseFloat(e.target.value) || 0) })} style={{ margin: 0, width: '100%' }} /></div>
          <div><div style={lbl}>{L('Estado', 'Status')}</div><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} style={{ margin: 0, width: '100%' }}><option value="active">{L('Activa', 'Active')}</option><option value="paused">{L('Pausada', 'Paused')}</option><option value="draft">{L('Borrador', 'Draft')}</option><option value="ended">{L('Terminada', 'Ended')}</option></select></div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button className="btn btn-primary" onClick={() => { if (!form.advertiser || !form.slot_key) return toast(L('Falta anunciante o ubicación.', 'Missing advertiser or placement.'), 'err'); post(form, form.id ? L('Campaña actualizada.', 'Campaign updated.') : L('Campaña creada.', 'Campaign created.')); }} disabled={busy === 'camp'} style={{ fontSize: 12.5 }}>{form.id ? L('Guardar cambios', 'Save changes') : L('Crear campaña', 'Create campaign')}</button>
          {form.id && <button className="btn btn-ghost" onClick={() => setForm(emptyForm)} style={{ fontSize: 12.5 }}>{L('Cancelar', 'Cancel')}</button>}
        </div>
      </div>

      {/* Lista de campañas */}
      <div style={box}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>{L('Campañas', 'Campaigns')} ({camps.length})</div>
        {camps.length === 0 ? <div className="muted" style={{ fontSize: 13 }}>{L('Aún no hay campañas. Crea una arriba o llegan solas desde /publicidad.', 'No campaigns yet. Create one above or they arrive from /publicidad.')}</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {camps.map((c) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', borderTop: '1px solid var(--line)', paddingTop: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: stColor[c.status] || 'var(--mut)', flex: 'none' }} />
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{c.advertiser || L('(sin nombre)', '(no name)')}</div>
                  <div className="muted" style={{ fontSize: 11 }}>{slotName(c.slot_key)}{c.contact ? ' · ' + c.contact : ''}</div>
                </div>
                <div className="muted" style={{ fontSize: 11.5, flex: 'none' }}>{c.impressions.toLocaleString()} impr · {c.clicks} clic · {ctr(c)}</div>
                <div style={{ display: 'flex', gap: 5, flex: 'none' }}>
                  {c.status !== 'active' ? <button className="btn btn-ghost" onClick={() => post({ action: 'status', id: c.id, status: 'active' }, L('Activada.', 'Activated.'))} style={{ fontSize: 11, padding: '3px 8px' }}>{L('Activar', 'Activate')}</button>
                    : <button className="btn btn-ghost" onClick={() => post({ action: 'status', id: c.id, status: 'paused' }, L('Pausada.', 'Paused.'))} style={{ fontSize: 11, padding: '3px 8px' }}>{L('Pausar', 'Pause')}</button>}
                  <button className="btn btn-ghost" onClick={() => setForm({ ...emptyForm, ...c, starts_at: c.starts_at ? c.starts_at.slice(0, 10) : '', ends_at: c.ends_at ? c.ends_at.slice(0, 10) : '' })} style={{ fontSize: 11, padding: '3px 8px' }}>{L('Editar', 'Edit')}</button>
                  <button className="btn btn-ghost" onClick={() => { if (confirm(L('¿Borrar esta campaña?', 'Delete this campaign?'))) post({ action: 'delete', id: c.id }, L('Borrada.', 'Deleted.')); }} style={{ fontSize: 11, padding: '3px 8px', color: 'var(--red,#ef6262)' }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Directorio de partners (CPA) — F6 */}
      <div data-guide="partners" style={box}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}>{L('Directorio de socios (CPA)', 'Partner directory (CPA)')}
          <Hint text={L('Aquí ganas SIN anunciantes: añade brokers y prop firms con tu enlace afiliado y aparecen en /socios. Cuando alguien se registra por tu enlace, te pagan comisión. Es lo primero que conviene llenar.', 'This earns you money WITHOUT advertisers: add brokers and prop firms with your affiliate link and they show on /socios. When someone signs up through your link, you get a commission. Fill this first.')} />
        </div>
        <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>{L('Brokers y prop firms que pagan por registro. Se listan en /socios. El ángulo que más rinde en este nicho.', 'Brokers and prop firms that pay per signup. Listed on /socios. The highest-yield angle in this niche.')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
          <div><div style={lbl}>{L('Nombre', 'Name')}</div><input value={pForm.name} onChange={(e) => setPForm({ ...pForm, name: e.target.value })} style={{ margin: 0, width: '100%' }} /></div>
          <div><div style={lbl}>{L('Categoría', 'Category')}</div><select value={pForm.category} onChange={(e) => setPForm({ ...pForm, category: e.target.value })} style={{ margin: 0, width: '100%' }}><option value="broker">Broker</option><option value="propfirm">Prop firm</option><option value="tool">{L('Herramienta', 'Tool')}</option></select></div>
          <div><div style={lbl}>{L('Logo (URL)', 'Logo (URL)')}</div><input value={pForm.logo_url} onChange={(e) => setPForm({ ...pForm, logo_url: e.target.value })} placeholder="https://…" style={{ margin: 0, width: '100%' }} /></div>
          <div style={{ gridColumn: '1 / -1' }}><div style={lbl}>{L('Enlace afiliado', 'Affiliate link')}</div><input value={pForm.link_url} onChange={(e) => setPForm({ ...pForm, link_url: e.target.value })} placeholder="https://…?ref=onyx" style={{ margin: 0, width: '100%' }} /></div>
          <div style={{ gridColumn: '1 / -1' }}><div style={lbl}>{L('Descripción ES', 'Description ES')}</div><input value={pForm.blurb_es} onChange={(e) => setPForm({ ...pForm, blurb_es: e.target.value })} style={{ margin: 0, width: '100%' }} /></div>
          <div style={{ gridColumn: '1 / -1' }}><div style={lbl}>{L('Descripción EN', 'Description EN')}</div><input value={pForm.blurb_en} onChange={(e) => setPForm({ ...pForm, blurb_en: e.target.value })} style={{ margin: 0, width: '100%' }} /></div>
          <div><div style={lbl}>{L('Reguladores', 'Regulators')}</div><input value={pForm.regulated} onChange={(e) => setPForm({ ...pForm, regulated: e.target.value })} placeholder="FCA, ASIC…" style={{ margin: 0, width: '100%' }} /></div>
          <div><div style={lbl}>{L('Pago CPA ($)', 'CPA payout ($)')}</div><input type="number" min={0} value={pForm.cpa_payout} onChange={(e) => setPForm({ ...pForm, cpa_payout: Math.max(0, parseFloat(e.target.value) || 0) })} style={{ margin: 0, width: '100%' }} /></div>
          <div><div style={lbl}>{L('Orden', 'Rank')}</div><input type="number" value={pForm.rank} onChange={(e) => setPForm({ ...pForm, rank: parseInt(e.target.value, 10) || 100 })} style={{ margin: 0, width: '100%' }} /></div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}><label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, cursor: 'pointer' }}><input type="checkbox" checked={!!pForm.featured} onChange={(e) => setPForm({ ...pForm, featured: e.target.checked })} />{L('Destacado', 'Featured')}</label></div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button className="btn btn-primary" onClick={() => { if (!pForm.name || !pForm.link_url) return toast(L('Falta nombre o enlace.', 'Missing name or link.'), 'err'); post({ entity: 'partner', ...pForm }, pForm.id ? L('Socio actualizado.', 'Partner updated.') : L('Socio añadido.', 'Partner added.')); setPForm(emptyPartner); }} disabled={busy === 'camp'} style={{ fontSize: 12.5 }}>{pForm.id ? L('Guardar', 'Save') : L('Añadir socio', 'Add partner')}</button>
          {pForm.id && <button className="btn btn-ghost" onClick={() => setPForm(emptyPartner)} style={{ fontSize: 12.5 }}>{L('Cancelar', 'Cancel')}</button>}
        </div>
        {partners.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
            {partners.map((p) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', borderTop: '1px solid var(--line)', paddingTop: 6 }}>
                <div style={{ flex: 1, minWidth: 140, fontSize: 13 }}>{p.featured ? '★ ' : ''}{p.name} <span className="muted" style={{ fontSize: 11 }}>· {p.category}</span></div>
                <div className="muted" style={{ fontSize: 11.5 }}>{p.clicks || 0} clic · {p.signups || 0} reg</div>
                <button className="btn btn-ghost" onClick={() => setPForm({ ...emptyPartner, ...p })} style={{ fontSize: 11, padding: '3px 8px' }}>{L('Editar', 'Edit')}</button>
                <button className="btn btn-ghost" onClick={() => { if (confirm(L('¿Borrar socio?', 'Delete partner?'))) post({ entity: 'partner', action: 'delete', id: p.id }, L('Borrado.', 'Deleted.')); }} style={{ fontSize: 11, padding: '3px 8px', color: 'var(--red,#ef6262)' }}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="muted" style={{ fontSize: 11, borderTop: '1px dashed var(--line)', paddingTop: 8 }}>
        {L('Requiere correr una vez supabase/ads.sql, ads_v2.sql y ads_v3.sql. Los enlaces llevan rel="sponsored nofollow" y todo va etiquetado como Publicidad. Páginas públicas: /publicidad (vender espacios) y /socios (directorio CPA).', 'Run supabase/ads.sql, ads_v2.sql and ads_v3.sql once. Links use rel="sponsored nofollow" and are labeled as advertising. Public pages: /publicidad (sell spaces) and /socios (CPA directory).')}
      </div>
    </div>
  );
}
