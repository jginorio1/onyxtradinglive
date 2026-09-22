'use client';
import { useEffect, useState } from 'react';
import { toast } from '@/lib/toast';

type Slot = { key: string; es: string; en: string; size: string; page: string };
type Rate = Slot & { price: number; unit: 'week' | 'month' | 'cpm' };
type Campaign = { id: string; advertiser: string; contact: string; slot_key: string; creative_url: string; link_url: string; alt: string; lang: string; starts_at: string | null; ends_at: string | null; weight: number; price: number; status: string; impressions: number; clicks: number };

const UNIT: Record<string, [string, string]> = { week: ['/ semana', '/ week'], month: ['/ mes', '/ month'], cpm: ['CPM (mil impresiones)', 'CPM (per 1k impressions)'] };
const emptyForm = { id: '', advertiser: '', contact: '', slot_key: '', creative_url: '', link_url: '', alt: '', lang: 'all', geo: 'all', starts_at: '', ends_at: '', weight: 1, price: 0, status: 'active' };

export default function AdsAdmin({ es }: { es: boolean }) {
  const L = (a: string, b: string) => (es ? a : b);
  const [cfg, setCfg] = useState<{ enabled: boolean; nativeEnabled: boolean }>({ enabled: true, nativeEnabled: false });
  const [rates, setRates] = useState<Rate[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [camps, setCamps] = useState<Campaign[]>([]);
  const [form, setForm] = useState<any>(emptyForm);
  const [busy, setBusy] = useState('');

  async function load() {
    try {
      const j = await (await fetch('/api/admin/ads')).json();
      if (j.config) { setCfg(j.config); setRates(j.rates || []); setSlots(j.slots || []); setCamps(j.campaigns || []); }
    } catch {}
  }
  useEffect(() => { load(); }, []);

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
  const stColor: Record<string, string> = { active: '#34e2a0', paused: '#f5b23e', draft: '#7c8cff', scheduled: '#7c8cff', ended: 'var(--mut)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h2 style={{ fontSize: 20, margin: '0 0 2px' }}>{L('Espacios patrocinados', 'Sponsored spaces')}</h2>
        <div className="muted" style={{ fontSize: 13 }}>{L('Vende banners por ubicación y tamaño. Solo se muestran en la web y solo a usuarios del plan gratis.', 'Sell banners by placement and size. Shown only on web and only to free-plan users.')}</div>
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

      {/* Tarifario editable */}
      <div style={box}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{L('Tarifario (precio por ubicación y tamaño)', 'Rate card (price by placement & size)')}</div>
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
      <div style={box}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>{form.id ? L('Editar campaña', 'Edit campaign') : L('Nueva campaña', 'New campaign')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
          <div><div style={lbl}>{L('Anunciante', 'Advertiser')}</div><input value={form.advertiser} onChange={(e) => setForm({ ...form, advertiser: e.target.value })} style={{ margin: 0, width: '100%' }} /></div>
          <div><div style={lbl}>{L('Ubicación', 'Placement')}</div><select value={form.slot_key} onChange={(e) => setForm({ ...form, slot_key: e.target.value })} style={{ margin: 0, width: '100%' }}><option value="">{L('elige…', 'choose…')}</option>{slots.map((s) => <option key={s.key} value={s.key}>{(es ? s.es : s.en) + ' · ' + s.size}</option>)}</select></div>
          <div><div style={lbl}>{L('Idioma', 'Language')}</div><select value={form.lang} onChange={(e) => setForm({ ...form, lang: e.target.value })} style={{ margin: 0, width: '100%' }}><option value="all">{L('Todos', 'All')}</option><option value="es">Español</option><option value="en">English</option></select></div>
          <div><div style={lbl}>{L('País (ISO, coma) o all', 'Country (ISO, comma) or all')}</div><input value={form.geo} onChange={(e) => setForm({ ...form, geo: e.target.value })} placeholder="all · US,MX,ES" style={{ margin: 0, width: '100%' }} /></div>
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

      <div className="muted" style={{ fontSize: 11, borderTop: '1px dashed var(--line)', paddingTop: 8 }}>
        {L('Requiere correr una vez supabase/ads.sql. Los enlaces llevan rel="sponsored nofollow" y todo va etiquetado como Publicidad. La página pública para vender está en /publicidad.', 'Run supabase/ads.sql once. Links use rel="sponsored nofollow" and are labeled as advertising. The public sales page is at /publicidad.')}
      </div>
    </div>
  );
}
