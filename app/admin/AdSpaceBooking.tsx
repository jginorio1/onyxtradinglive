'use client';
import { useEffect, useState } from 'react';
import SlotPreview from '@/app/components/SlotPreview';
import { HintPop } from '@/app/components/HintPop';

// Panel admin · Reserva de espacios por cupo fijo.
//  · Editar el cupo (máx anunciantes rotando) por ubicación + parámetros.
//  · Ver todas las reservas y CONFIRMAR el pago (activa/programa + acredita la
//    comisión del vendedor) o cancelar (libera cupo + revierte comisión).
export default function AdSpaceBooking({ es = true }: { es?: boolean }) {
  const L = (a: string, b: string) => (es ? a : b);
  const Hint = (a: string, b: string) => <HintPop text={L(a, b)} glyph="?" />;
  const [d, setD] = useState<any>(null);
  const [caps, setCaps] = useState<Record<string, number>>({});
  const [cfg, setCfg] = useState<any>({ defaultCap: 4, spaceCommissionPct: 15, holdMinutes: 45, maturationDays: 14 });
  const [pFill, setPFill] = useState(true);                       // partners: por defecto
  const [pSlots, setPSlots] = useState<Record<string, boolean>>({}); // override por ubicación
  const [pPin, setPPin] = useState<Record<string, string>>({});      // partner fijo por ubicación
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  // --- módulo de cotizaciones / propuestas ---
  const [ok2, setOk2] = useState('');
  const [f, setF] = useState<any>({ slot: '', start: '', end: '', advertiser: '', company: '', email: '', link: '', price: 0, rep_id: '', lang: es ? 'es' : 'en' });
  // Plantilla de la cotización (editable por idioma) + días de validez + idioma de edición/preview.
  const [tpl, setTpl] = useState<any>(null);
  const [validDays, setValidDays] = useState<number>(15);
  const [tplLang, setTplLang] = useState<'es' | 'en'>(es ? 'es' : 'en');
  const [cal, setCal] = useState<any[]>([]);
  const [range, setRange] = useState<any>(null);
  const todayStr = new Date().toISOString().slice(0, 10);

  const load = async () => {
    try {
      const r = await fetch('/api/admin/ads/booking', { cache: 'no-store' });
      const j = await r.json();
      setD(j);
      setCaps(j.settings?.caps || {});
      setCfg({
        defaultCap: j.settings?.defaultCap ?? 4, spaceCommissionPct: j.settings?.spaceCommissionPct ?? 15,
        spaceOv1Pct: j.settings?.spaceOv1Pct ?? null, spaceOv2Pct: j.settings?.spaceOv2Pct ?? null,
        globalOv1: j.settings?.globalOv1 ?? 7, globalOv2: j.settings?.globalOv2 ?? 4,
        holdMinutes: j.settings?.holdMinutes ?? 45, maturationDays: j.settings?.maturationDays ?? 14,
      });
      setPFill(j.settings?.partnerFill !== false);
      setPSlots(j.settings?.partnerFillSlots || {});
      setPPin(j.settings?.partnerSlotPin || {});
      setValidDays(j.settings?.quoteValidityDays ?? 15);
      setTpl(j.settings?.quoteTemplate || null);
    } catch {}
  };
  useEffect(() => { load(); }, []);

  const post = async (body: any) => {
    setBusy(true); setMsg('');
    const r = await fetch('/api/admin/ads/booking', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json(); setBusy(false);
    if (j.error) setMsg(j.error);
    return j;
  };
  const saveSettings = async () => { const j = await post({ action: 'save_settings', caps, ...cfg, partnerFill: pFill, partnerFillSlots: pSlots, partnerSlotPin: pPin }); if (j.ok) { setMsg(L('Guardado ✓', 'Saved ✓')); await load(); } };
  // Guardar plantilla de cotización + días de validez.
  const setTplField = (k: string, v: string) => setTpl((p: any) => ({ ...p, [tplLang]: { ...(p?.[tplLang] || {}), [k]: v } }));
  const saveTemplate = async () => { const j = await post({ action: 'save_settings', quoteValidityDays: validDays, quoteTemplate: tpl }); if (j.ok) { setMsg(L('Plantilla guardada ✓', 'Template saved ✓')); await load(); } };
  const setSlotFill = (k: string, v: '' | 'yes' | 'no') => setPSlots((p) => { const n = { ...p }; if (v === '') delete n[k]; else n[k] = v === 'yes'; return n; });
  const setSlotPin = (k: string, v: string) => setPPin((p) => { const n = { ...p }; if (!v) delete n[k]; else n[k] = v; return n; });
  const confirmPaid = async (id: string) => { const j = await post({ action: 'confirm_paid', id }); if (j.ok) { setMsg(L('Pago confirmado ✓', 'Payment confirmed ✓')); await load(); } };
  const cancel = async (id: string) => { const j = await post({ action: 'cancel', id }); if (j.ok) { await load(); } };
  const sweep = async () => { const j = await post({ action: 'sweep' }); if (j.ok) { setMsg(L(`Limpieza: ${j.expired} vencidas, ${j.released} liberadas`, `Sweep: ${j.expired} expired, ${j.released} released`)); await load(); } };

  // Cotizaciones / propuestas
  const setFF = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const refreshCal = async (slot = f.slot, start = f.start, end = f.end) => {
    if (!slot) { setCal([]); setRange(null); return; }
    const j = await post({ action: 'availability', slot, from: todayStr, days: 42 });
    if (j.ok) setCal(j.calendar || []);
    if (start && end) { const rc = await post({ action: 'availability', slot, from: start, days: 1, start, end }); }
    // capacidad del rango: reutiliza el calendario para el pico
    if (start && end && j.calendar) {
      const inR = j.calendar.filter((c: any) => c.date >= start && c.date <= end);
      const peak = inR.reduce((m: number, c: any) => Math.max(m, c.used), 0);
      const cap = inR[0]?.cap ?? 0;
      setRange({ cap, peak, free: Math.max(0, cap - peak) });
    } else setRange(null);
  };
  const onSlotF = (slot: string) => { const sc = (d?.slots || []).find((x: any) => x.key === slot); setF((p: any) => ({ ...p, slot, price: p.price || (sc?.price || 0) })); refreshCal(slot, f.start, f.end); };
  const validF = () => f.slot && /^\d{4}-\d{2}-\d{2}$/.test(f.start) && /^\d{4}-\d{2}-\d{2}$/.test(f.end) && f.end >= f.start && f.advertiser.trim();
  const dl = (b64: string, name: string) => {
    try { const bin = atob(b64); const arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([arr], { type: 'application/pdf' })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 4000); } catch {}
  };
  const quotePdf = async () => { if (!validF()) { setMsg(L('Completa ubicación, fechas y anunciante.', 'Fill placement, dates and advertiser.')); return; } setOk2(''); const j = await post({ action: 'proposal_pdf', ...f }); if (j.pdf) dl(j.pdf, j.filename || 'propuesta.pdf'); };
  const quoteEmail = async () => { if (!validF()) { setMsg(L('Completa ubicación, fechas y anunciante.', 'Fill placement, dates and advertiser.')); return; } if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) { setMsg(L('Escribe el correo del anunciante.', 'Enter the advertiser email.')); return; } setOk2(''); const j = await post({ action: 'proposal_email', ...f }); if (j.sent) setOk2(L('Propuesta enviada ✓', 'Proposal sent ✓')); };
  const quoteBook = async () => { if (!validF()) { setMsg(L('Completa ubicación, fechas y anunciante.', 'Fill placement, dates and advertiser.')); return; } setOk2(''); const j = await post({ action: 'create', ...f }); if (j.ok) { setOk2(L('Espacio reservado ✓', 'Space reserved ✓')); await load(); await refreshCal(); } };

  if (!d) return <div style={cardS}>{L('Cargando…', 'Loading…')}</div>;
  if (d.error) return <div style={cardS}>{d.error}</div>;

  const phaseColor: Record<string, string> = { live: '#22c55e', scheduled: '#8b93ff', hold: '#f0b74e', ended: '#9aa6bd', expired: '#9aa6bd' };
  const phaseLabel = (p: string) => ({ live: L('En vivo', 'Live'), scheduled: L('Programado', 'Scheduled'), hold: L('Reservado (sin pagar)', 'Held (unpaid)'), ended: L('Terminado', 'Ended'), expired: L('Vencido', 'Expired') } as any)[p] || p;

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={cardS}>
        <h3 style={{ marginTop: 0, marginBottom: 4, color: 'var(--tx,#e8ecf5)' }}>{L('Reserva de espacios', 'Ad space booking')}</h3>
        <div style={{ fontSize: 12.5, color: 'var(--mut,#9aa6bd)' }}>
          {L('El cupo es cuántos anunciantes pueden rotar a la vez en una ubicación. Los vendedores reservan fechas y ganan comisión; tú confirmas el pago para activar. Todo automático: se enciende el día de inicio y se apaga al terminar.',
             'The cap is how many advertisers can rotate at once in a placement. Sellers reserve dates and earn commission; you confirm payment to activate. Fully automatic: goes live on the start date and pauses at the end.')}
        </div>
      </div>

      {msg && <div style={{ ...cardS, borderColor: '#8b93ff', color: 'var(--tx,#e8ecf5)', fontSize: 13 }}>{msg}</div>}

      <div style={cardS}>
        <div style={{ fontWeight: 600, color: 'var(--tx,#e8ecf5)', marginBottom: 10 }}>{L('Cotizaciones y propuestas', 'Quotes & proposals')}</div>
        <div style={{ fontSize: 12.5, color: 'var(--mut,#9aa6bd)', marginBottom: 12 }}>{L('Arma una cotización, envíala en PDF de marca y reserva el espacio. Puedes atribuirla a un vendedor para que gane su comisión.', 'Build a quote, send it as a branded PDF and reserve the space. You can attribute it to a seller so they earn commission.')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={lblS}>{L('Ubicación', 'Placement')} {Hint('El lugar de la web donde saldrá el banner. Cada uno con su tamaño y precio.', 'The spot on the site where the banner shows. Each has its own size and price.')}</label>
            <select value={f.slot} onChange={(e) => onSlotF(e.target.value)} style={inpS}>
              <option value="">{L('— Elige un espacio —', '— Choose a space —')}</option>
              {(d.slots || []).map((s: any) => <option key={s.key} value={s.key}>{(es ? s.es : s.en)} · {s.size} · {L('cupo', 'cap')} {s.cap} · ${s.price}</option>)}
            </select>
          </div>
          {f.slot && (() => { const sc = (d.slots || []).find((x: any) => x.key === f.slot); return sc ? <div style={{ gridColumn: '1 / -1' }}><SlotPreview slotKey={sc.key} page={sc.page} size={sc.size} es={es} /></div> : null; })()}
          <div><label style={lblS}>{L('Desde', 'From')} {Hint('Primer día que el anuncio estará al aire.', 'First day the ad is live.')}</label><input type="date" min={todayStr} value={f.start} onChange={(e) => { setFF('start', e.target.value); refreshCal(f.slot, e.target.value, f.end); }} style={inpS} /></div>
          <div><label style={lblS}>{L('Hasta', 'To')} {Hint('Último día del anuncio. Se apaga solo al terminar.', 'Last day of the ad. It turns off automatically when it ends.')}</label><input type="date" min={f.start || todayStr} value={f.end} onChange={(e) => { setFF('end', e.target.value); refreshCal(f.slot, f.start, e.target.value); }} style={inpS} /></div>
          <div><label style={lblS}>{L('Contacto (anunciante)', 'Contact (advertiser)')} {Hint('Nombre de la persona de la empresa que se anuncia.', 'Name of the person at the advertising company.')}</label><input value={f.advertiser} onChange={(e) => setFF('advertiser', e.target.value)} style={inpS} /></div>
          <div><label style={lblS}>{L('Empresa', 'Company')} {Hint('Marca/empresa que se anuncia (sale en la propuesta).', 'Brand/company being advertised (shown on the proposal).')}</label><input value={f.company} onChange={(e) => setFF('company', e.target.value)} style={inpS} /></div>
          <div><label style={lblS}>{L('Correo del anunciante', 'Advertiser email')} {Hint('A este correo se envía la propuesta y llega su respuesta.', 'The proposal is sent here and their reply comes back here.')}</label><input value={f.email} onChange={(e) => setFF('email', e.target.value)} style={inpS} /></div>
          <div><label style={lblS}>{L('Enlace / web', 'Link / website')} {Hint('A dónde lleva el banner al hacer clic.', 'Where the banner takes a visitor when clicked.')}</label><input value={f.link} onChange={(e) => setFF('link', e.target.value)} style={inpS} /></div>
          <div><label style={lblS}>{L('Precio total (USD)', 'Total price (USD)')} {Hint('Lo que paga el anunciante por todo el periodo.', 'What the advertiser pays for the whole period.')}</label><input type="number" min={0} value={f.price} onChange={(e) => setFF('price', Number(e.target.value) || 0)} style={inpS} /></div>
          <div><label style={lblS}>{L('Idioma del envío', 'Send language')} {Hint('Idioma de la cotización que se genera y envía. Elige el del anunciante.', 'Language of the quote that is generated and sent. Pick the advertiser’s.')}</label>
            <select value={f.lang} onChange={(e) => setFF('lang', e.target.value)} style={inpS}>
              <option value="es">Español</option>
              <option value="en">English</option>
            </select>
          </div>
          <div>
            <label style={lblS}>{L('Atribuir a vendedor (opcional)', 'Attribute to seller (optional)')} {Hint('Si eliges un vendedor, esta venta le cuenta y gana su comisión de 3 niveles. Sin vendedor = venta directa de Onyx.', 'If you pick a seller, this sale counts for them and pays their 3-tier commission. No seller = direct Onyx sale.')}</label>
            <select value={f.rep_id} onChange={(e) => setFF('rep_id', e.target.value)} style={inpS}>
              <option value="">{L('— Sin vendedor (Onyx) —', '— No seller (Onyx) —')}</option>
              {(d.reps || []).map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
        </div>
        {range && f.start && f.end && (
          <div style={{ marginTop: 8, fontSize: 12.5, color: range.free > 0 ? '#22c55e' : '#f0736f' }}>
            {range.free > 0 ? L(`En estas fechas: cupo ${range.cap}, ocupado ${range.peak} · quedan ${range.free}.`, `These dates: cap ${range.cap}, used ${range.peak} · ${range.free} left.`) : L(`Sin cupo en estas fechas (cupo ${range.cap}).`, `No room on these dates (cap ${range.cap}).`)}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <button style={btnS} disabled={busy} onClick={quotePdf}>{L('Vista previa PDF', 'Preview PDF')}</button>
          <button style={btnS} disabled={busy} onClick={quoteEmail}>{L('Enviar propuesta por correo', 'Email the proposal')}</button>
          <button style={btnPS} disabled={busy} onClick={quoteBook}>{L('Reservar espacio', 'Reserve space')}</button>
        </div>
        {ok2 && <div style={{ marginTop: 10, fontSize: 13, color: '#22c55e' }}>{ok2}</div>}
      </div>

      {/* PLANTILLA DE LA COTIZACIÓN — editable por secciones (por idioma) + validez + vista previa en vivo. */}
      {tpl && <QuoteTemplateEditor
        L={L} es={es} tpl={tpl} tplLang={tplLang} setTplLang={setTplLang} setTplField={setTplField}
        validDays={validDays} setValidDays={setValidDays} saveTemplate={saveTemplate} busy={busy} Hint={Hint}
      />}

      {/* REPARTO DE COMISIÓN — todo en un solo sitio, con ejemplo en vivo. */}
      <div style={cardS}>
        <div style={{ fontWeight: 600, color: 'var(--tx,#e8ecf5)', marginBottom: 4, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {L('Reparto de comisión (3 niveles)', 'Commission split (3 tiers)')}
          {Hint('Cuando se paga un espacio, la comisión se reparte entre el vendedor y sus dos supervisores. Aquí defines los tres porcentajes en un solo lugar.',
                'When a space is paid, the commission is split between the seller and their two uplines. Set all three percentages here in one place.')}
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--mut,#9aa6bd)', marginBottom: 12 }}>
          {L('Sobre el precio del espacio vendido. Los overrides pueden tener su propio % o dejarlos vacíos para usar el de Ventas.',
             'On the sold space price. Overrides can have their own % or be left empty to use the Sales one.')}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
          <PctF label={L('① Vendedor directo', '① Direct seller')} hint={Hint('El que vende el espacio. Este % siempre aplica.', 'Whoever sells the space. This % always applies.')}
                v={cfg.spaceCommissionPct} placeholder="" on={(x) => setCfg({ ...cfg, spaceCommissionPct: x === '' ? 0 : Number(x) })} />
          <PctF label={L('② Líder (N1)', '② Lead (T1)')} hint={Hint('El supervisor directo del vendedor. Vacío = usa el override global de Ventas.', 'The seller’s direct upline. Empty = uses the global Sales override.')}
                v={cfg.spaceOv1Pct} placeholder={`${cfg.globalOv1}`} on={(x) => setCfg({ ...cfg, spaceOv1Pct: x === '' ? null : Number(x) })} />
          <PctF label={L('③ Director (N2)', '③ Director (T2)')} hint={Hint('El nivel por encima del líder. Vacío = usa el override global de Ventas.', 'The level above the lead. Empty = uses the global Sales override.')}
                v={cfg.spaceOv2Pct} placeholder={`${cfg.globalOv2}`} on={(x) => setCfg({ ...cfg, spaceOv2Pct: x === '' ? null : Number(x) })} />
        </div>
        {/* Ejemplo en vivo del reparto. */}
        {(() => {
          const price = 500;
          const p0 = Number(cfg.spaceCommissionPct) || 0;
          const p1 = cfg.spaceOv1Pct === null || cfg.spaceOv1Pct === undefined ? Number(cfg.globalOv1) : Number(cfg.spaceOv1Pct);
          const p2 = cfg.spaceOv2Pct === null || cfg.spaceOv2Pct === undefined ? Number(cfg.globalOv2) : Number(cfg.spaceOv2Pct);
          const d = (p: number) => `$${((price * p) / 100).toFixed(0)}`;
          const inh = (v: any) => (v === null || v === undefined);
          return (
            <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: 'color-mix(in srgb, var(--brand) 7%, transparent)', border: '1px solid var(--line,#2a3350)' }}>
              <div style={{ fontSize: 12.5, color: 'var(--tx,#e8ecf5)', marginBottom: 8 }}>
                {L(`Ejemplo: un banner de $${price} se reparte así`, `Example: a $${price} banner splits like this`)}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 12.5 }}>
                <span style={{ color: 'var(--tx,#e8ecf5)' }}>① {L('Vendedor', 'Seller')} <b>{p0}%</b> → <b style={{ color: '#22c55e' }}>{d(p0)}</b></span>
                <span style={{ color: 'var(--mut,#9aa6bd)' }}>② {L('Líder', 'Lead')} <b>{p1}%</b>{inh(cfg.spaceOv1Pct) ? L(' (Ventas)', ' (Sales)') : ''} → <b style={{ color: '#22c55e' }}>{d(p1)}</b></span>
                <span style={{ color: 'var(--mut,#9aa6bd)' }}>③ {L('Director', 'Director')} <b>{p2}%</b>{inh(cfg.spaceOv2Pct) ? L(' (Ventas)', ' (Sales)') : ''} → <b style={{ color: '#22c55e' }}>{d(p2)}</b></span>
                <span style={{ color: 'var(--tx,#e8ecf5)', marginLeft: 'auto' }}>{L('Total repartido', 'Total paid out')}: <b>{d(p0 + p1 + p2)}</b></span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--mut,#9aa6bd)', marginTop: 8 }}>
                {L('Solo aplica si la reserva tiene vendedor. El líder/director solo cobran si existen en la cadena.',
                   'Only applies if the booking has a seller. Lead/director only earn if they exist in the chain.')}
              </div>
            </div>
          );
        })()}
        <div style={{ marginTop: 12 }}><button disabled={busy} onClick={saveSettings} style={btnPS}>{L('Guardar reparto', 'Save split')}</button></div>
      </div>

      <div style={cardS}>
        <div style={{ fontWeight: 600, color: 'var(--tx,#e8ecf5)', marginBottom: 10 }}>{L('Ajustes de espacios', 'Space settings')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
          <NumF label={L('Cupo por defecto', 'Default cap')} hint={Hint('Cuántos anunciantes pueden rotar a la vez en una ubicación que no tenga su propio cupo.', 'How many advertisers can rotate at once in a placement without its own cap.')} v={cfg.defaultCap} on={(x) => setCfg({ ...cfg, defaultCap: x })} />
          <NumF label={L('Reserva sin pagar (min)', 'Hold (min)')} hint={Hint('Minutos que una reserva sin pagar aparta la fecha. Si no se paga a tiempo, el cupo se libera solo.', 'Minutes an unpaid booking holds the date. If not paid in time, the slot is released automatically.')} v={cfg.holdMinutes} on={(x) => setCfg({ ...cfg, holdMinutes: x })} />
          <NumF label={L('Maduración comisión (días)', 'Commission maturation (days)')} hint={Hint('Días que la comisión queda "en espera" antes de estar disponible para cobro (por si hay reembolso).', 'Days the commission stays "pending" before it becomes available to withdraw (in case of a refund).')} v={cfg.maturationDays} on={(x) => setCfg({ ...cfg, maturationDays: x })} />
        </div>
        <div style={{ fontWeight: 600, color: 'var(--tx,#e8ecf5)', margin: '14px 0 8px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>{L('Cupo por ubicación', 'Cap per placement')} {Hint('Máximo de anunciantes que rotan a la vez en cada espacio. Si lo dejas vacío usa el cupo por defecto.', 'Max advertisers rotating at once in each space. Left empty, it uses the default cap.')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 8 }}>
          {(d.slots || []).map((s: any) => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--line,#2a3350)', borderRadius: 9, padding: '7px 10px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, color: 'var(--tx,#e8ecf5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{es ? s.es : s.en}</div>
                <div style={{ fontSize: 11, color: 'var(--mut,#9aa6bd)' }}>{s.size} · ${s.price}</div>
              </div>
              <input type="number" min={1} value={caps[s.key] ?? s.cap} onChange={(e) => setCaps({ ...caps, [s.key]: Math.max(1, Number(e.target.value) || 1) })}
                style={{ width: 58, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--line,#2a3350)', background: 'var(--card,#1b2338)', color: 'var(--tx,#e8ecf5)', fontSize: 13, textAlign: 'center' }} />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button disabled={busy} onClick={saveSettings} style={btnPS}>{L('Guardar ajustes', 'Save settings')}</button>
          <button disabled={busy} onClick={sweep} style={btnS}>{L('Limpiar vencidas', 'Sweep expired')}</button>
        </div>
      </div>

      <div style={cardS}>
        <div style={{ fontWeight: 600, color: 'var(--tx,#e8ecf5)', marginBottom: 4, display: 'inline-flex', alignItems: 'center', gap: 6 }}>{L('Partners por ubicación', 'Partners per placement')} {Hint('“Partners” = socios del directorio (Axi, FTMO, The5ers…). Rellenan un hueco vacío cuando no hay campaña pagada y cada clic paga comisión (CPA). Elige dónde sí y dónde no.', '“Partners” = directory partners (Axi, FTMO, The5ers…). They fill an empty slot when there’s no paid campaign and each click pays commission (CPA). Choose where yes and where no.')}</div>
        <div style={{ fontSize: 12.5, color: 'var(--mut,#9aa6bd)', marginBottom: 12 }}>
          {L('Cuando un hueco no tiene campaña pagada, "partners" lo rellena con un socio del directorio (CPA) y cada clic paga comisión. Elige dónde SÍ y dónde NO. "Por defecto" en cada ubicación usa el global.',
             'When a slot has no paid campaign, "partners" fills it with a directory partner (CPA) and each click earns commission. Choose where YES and where NO. "Default" per placement uses the global one.')}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 13, color: 'var(--tx,#e8ecf5)' }}>{L('Global (por defecto):', 'Global (default):')}</span>
          <button onClick={() => setPFill(true)} style={pFill ? btnPS : btnS}>{L('Sí', 'Yes')}</button>
          <button onClick={() => setPFill(false)} style={!pFill ? btnPS : btnS}>{L('No', 'No')}</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 10 }}>
          {(d.slots || []).map((s: any) => {
            const val = pSlots[s.key] === true ? 'yes' : pSlots[s.key] === false ? 'no' : '';
            const eff = pSlots[s.key] === undefined ? pFill : pSlots[s.key];
            // Partners que rotan aquí = todos menos los fijados a OTRO espacio (exclusivos).
            const pinnedElsewhere = new Set(Object.entries(pPin).filter(([k, v]) => v && k !== s.key).map(([, v]) => String(v)));
            const nPartners = (d.partners || []).filter((p: any) => !pinnedElsewhere.has(String(p.id))).length;
            const pinnedName = pPin[s.key] ? ((d.partners || []).find((p: any) => String(p.id) === String(pPin[s.key]))?.name || null) : null;
            // Chip de estado: cuál banner sale en este espacio y si rota o está fijo.
            const chip = !eff
              ? { t: L('Sin partners aquí', 'No partners here'), bg: 'rgba(154,166,189,.15)', fg: '#9aa6bd' }
              : pinnedName
                ? { t: '📌 ' + L('Fijo · ', 'Fixed · ') + pinnedName, bg: 'rgba(91,108,255,.16)', fg: '#8aa0ff' }
                : { t: '🔁 ' + L('Rotando · ', 'Rotating · ') + nPartners, bg: 'rgba(94,214,160,.16)', fg: '#5ed6a0' };
            return (
              <div key={s.key} style={{ display: 'flex', flexDirection: 'column', gap: 8, border: '1px solid var(--line,#2a3350)', borderRadius: 10, padding: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 8, background: eff ? '#22c55e' : '#9aa6bd', flex: 'none' }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--tx,#e8ecf5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{es ? s.es : s.en}</div>
                    <div style={{ fontSize: 11, color: 'var(--mut,#9aa6bd)' }}>{s.size}</div>
                  </div>
                  <span style={{ marginLeft: 'auto', fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: chip.bg, color: chip.fg, whiteSpace: 'nowrap', flex: 'none' }}>{chip.t}</span>
                </div>
                <select value={val} onChange={(e) => setSlotFill(s.key, e.target.value as any)}
                  style={{ width: '100%', padding: '7px 8px', borderRadius: 8, border: '1px solid var(--line,#2a3350)', background: 'var(--card,#1b2338)', color: 'var(--tx,#e8ecf5)', fontSize: 12.5 }}>
                  <option value="">{L('Por defecto (usa el global)', 'Default (uses global)')}</option>
                  <option value="yes">{L('Sí · mostrar partners', 'Yes · show partners')}</option>
                  <option value="no">{L('No · dejar vacío', 'No · leave empty')}</option>
                </select>
                {/* ¿Qué partner sale en este hueco? Uno fijo o rotar todos. Solo aplica si Partners está ON aquí. */}
                <select value={pPin[s.key] || ''} disabled={!eff} onChange={(e) => setSlotPin(s.key, e.target.value)}
                  style={{ width: '100%', padding: '7px 8px', borderRadius: 8, border: '1px solid var(--line,#2a3350)', background: 'var(--card,#1b2338)', color: eff ? 'var(--tx,#e8ecf5)' : 'var(--mut,#9aa6bd)', fontSize: 12.5, opacity: eff ? 1 : .6 }}>
                  <option value="">{L('🔁 Rotar todos los partners', '🔁 Rotate all partners')}</option>
                  {(d.partners || []).map((p: any) => (
                    <option key={p.id} value={p.id}>{L('📌 Fijar: ', '📌 Pin: ')}{p.name}</option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
        {(d.partners || []).length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--mut,#9aa6bd)', marginTop: 8 }}>
            {L('Aún no hay partners activos en el directorio. Añádelos en Ads → Directorio para poder fijar uno por espacio.',
               'No active directory partners yet. Add them in Ads → Directory to pin one per placement.')}
          </div>
        )}
        <div style={{ marginTop: 12 }}><button disabled={busy} onClick={saveSettings} style={btnPS}>{L('Guardar partners', 'Save partners')}</button></div>
      </div>

      <div style={cardS}>
        <div style={{ fontWeight: 600, color: 'var(--tx,#e8ecf5)', marginBottom: 8 }}>{L('Reservas', 'Bookings')} ({(d.bookings || []).length})</div>
        {(d.bookings || []).length === 0 && <div style={{ fontSize: 13, color: 'var(--mut,#9aa6bd)' }}>{L('Sin reservas todavía.', 'No bookings yet.')}</div>}
        {(d.bookings || []).map((bk: any) => (
          <div key={bk.id} style={{ borderTop: '1px solid var(--line,#2a3350)', padding: '10px 0', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ color: 'var(--tx,#e8ecf5)', fontSize: 13.5 }}>{bk.advertiser_company || bk.advertiser} · {es ? bk.slot_name_es : bk.slot_name_en}</div>
              <div style={{ fontSize: 12, color: 'var(--mut,#9aa6bd)' }}>
                {(bk.starts_at || '').slice(0, 10)} → {(bk.ends_at || '').slice(0, 10)} · ${Math.round(bk.sold_amount || 0)}
                {bk.rep_name ? ` · ${L('vendedor', 'seller')}: ${bk.rep_name}` : ''}
                {bk.commission_pct ? ` · ${L('com.', 'comm.')} ${Math.round((bk.sold_amount || 0) * bk.commission_pct) / 100}$` : ''}
              </div>
            </div>
            <span style={{ fontSize: 11.5, padding: '3px 9px', borderRadius: 20, border: `1px solid ${phaseColor[bk.phase]}`, color: phaseColor[bk.phase] }}>{phaseLabel(bk.phase)}</span>
            {(bk.phase === 'hold' || bk.status === 'pending' || bk.status === 'draft') && (
              <button disabled={busy} onClick={() => confirmPaid(bk.id)} style={btnPS}>{L('Confirmar pago', 'Confirm payment')}</button>
            )}
            {bk.phase !== 'ended' && bk.phase !== 'expired' && (
              <button disabled={busy} onClick={() => cancel(bk.id)} style={btnS}>{L('Cancelar', 'Cancel')}</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function NumF({ label, v, on, hint }: { label: string; v: number; on: (x: number) => void; hint?: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 12, color: 'var(--mut,#9aa6bd)', display: 'inline-flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>{label} {hint}</label>
      <input type="number" value={v} onChange={(e) => on(Number(e.target.value) || 0)}
        style={{ width: '100%', padding: '8px 10px', borderRadius: 9, border: '1px solid var(--line,#2a3350)', background: 'var(--card,#1b2338)', color: 'var(--tx,#e8ecf5)', fontSize: 13 }} />
    </div>
  );
}

// Editor de la PLANTILLA de la cotización (por secciones, por idioma) con
// vista previa EN VIVO: al escribir, el panel derecho se actualiza al instante
// con datos de ejemplo, mostrando cómo se verá la propuesta.
function QuoteTemplateEditor({ L, es, tpl, tplLang, setTplLang, setTplField, validDays, setValidDays, saveTemplate, busy, Hint }: any) {
  const t = (tpl?.[tplLang] || {}) as any;
  const fill = (s: string, v: Record<string, string>) => String(s || '').replace(/\{(\w+)\}/g, (_: any, k: string) => (v[k] != null ? v[k] : `{${k}}`));
  // Fecha "válida hasta" de ejemplo = hoy + días de validez.
  const vu = new Date(Date.now() + Math.max(1, Number(validDays) || 15) * 86400000)
    .toLocaleDateString(tplLang === 'es' ? 'es-ES' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric' });
  const sv: Record<string, string> = tplLang === 'es'
    ? { advertiser: 'María', company: 'Acme Broker', seller: 'Juan Pérez', sellerEmail: 'juan@onyxtradinglive.com', slot: 'Artículo · Lateral vertical', size: '300x600', page: 'article', start: '01 oct 2026', end: '31 oct 2026', days: '31', price: '$450', cap: '4', validUntil: vu }
    : { advertiser: 'Mary', company: 'Acme Broker', seller: 'John Doe', sellerEmail: 'john@onyxtradinglive.com', slot: 'Article · Vertical sidebar', size: '300x600', page: 'article', start: 'Oct 01, 2026', end: 'Oct 31, 2026', days: '31', price: '$450', cap: '4', validUntil: vu };

  const tabBtn = (lng: 'es' | 'en', lbl: string) => (
    <button onClick={() => setTplLang(lng)} style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid var(--line,#2a3350)', background: tplLang === lng ? 'var(--accent,#8b93ff)' : 'var(--card,#1b2338)', color: tplLang === lng ? '#fff' : 'var(--tx,#e8ecf5)', cursor: 'pointer', fontSize: 12.5, fontWeight: 600 }}>{lbl}</button>
  );
  const field = (k: string, label: string, hint: string, lines = 3) => (
    <div>
      <label style={{ fontSize: 12, color: 'var(--mut,#9aa6bd)', display: 'inline-flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>{label} {Hint(hint, hint)}</label>
      <textarea value={t[k] || ''} onChange={(e) => setTplField(k, e.target.value)}
        style={{ width: '100%', minHeight: lines * 22, resize: 'vertical', padding: '8px 10px', borderRadius: 9, border: '1px solid var(--line,#2a3350)', background: 'var(--card,#1b2338)', color: 'var(--tx,#e8ecf5)', fontSize: 12.5, lineHeight: 1.5 }} />
    </div>
  );
  // Estilos del panel de vista previa (imita el PDF/correo).
  const pv: React.CSSProperties = { background: '#fff', color: '#1a1f2e', borderRadius: 10, border: '1px solid var(--line,#2a3350)', padding: 16, fontSize: 12.5, lineHeight: 1.5, maxHeight: 520, overflow: 'auto' };
  const h = (s: string): React.CSSProperties => ({ fontSize: 10, letterSpacing: '.06em', color: '#8b93ff', fontWeight: 700, textTransform: 'uppercase', margin: '12px 0 4px' });
  const bl = (s: string) => String(s || '').split('\n').map((x) => x.trim()).filter(Boolean);

  return (
    <div style={cardS}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
        <div style={{ fontWeight: 600, color: 'var(--tx,#e8ecf5)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {L('Plantilla de la cotización', 'Quote template')} {Hint('El contenido de la propuesta que se envía. Edítalo por secciones e idioma; usa variables entre llaves. La vista previa de la derecha se actualiza en vivo.', 'The content of the proposal that gets sent. Edit it by section and language; use variables in braces. The preview on the right updates live.')}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>{tabBtn('es', 'Español')}{tabBtn('en', 'English')}</div>
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--mut,#9aa6bd)', marginBottom: 12 }}>
        {L('Variables: {advertiser} {company} {seller} {slot} {size} {page} {start} {end} {days} {price} {cap} {validUntil}',
           'Variables: {advertiser} {company} {seller} {slot} {size} {page} {start} {end} {days} {price} {cap} {validUntil}')}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
        {/* Editor */}
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 12, color: 'var(--mut,#9aa6bd)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>{L('Validez (días)', 'Validity (days)')} {Hint('Días que vale la cotización. La fecha “válida hasta” = hoy + estos días, y se envía en el PDF y el correo.', 'Days the quote is valid. The “valid until” date = today + these days, shown in the PDF and email.')}</label>
            <input type="number" min={1} max={365} value={validDays} onChange={(e) => setValidDays(Math.max(1, Math.min(365, Number(e.target.value) || 15)))}
              style={{ width: 80, padding: '7px 8px', borderRadius: 8, border: '1px solid var(--line,#2a3350)', background: 'var(--card,#1b2338)', color: 'var(--tx,#e8ecf5)', fontSize: 13, textAlign: 'center' }} />
          </div>
          {field('intro', L('Introducción', 'Intro'), L('Saludo y presentación de la propuesta.', 'Greeting and proposal intro.'), 3)}
          {field('includes', L('Qué incluye (una viñeta por línea)', 'Included (one bullet per line)'), L('Cada línea es una viñeta.', 'Each line is a bullet.'), 4)}
          {field('whyOnyx', L('Por qué Onyx (una viñeta por línea)', 'Why Onyx (one bullet per line)'), L('Argumentos de valor, una viñeta por línea.', 'Value points, one bullet per line.'), 4)}
          {field('terms', L('Términos', 'Terms'), L('Condiciones de pago y activación.', 'Payment and activation terms.'), 3)}
          {field('validityNote', L('Nota de validez', 'Validity note'), L('Usa {validUntil}. Es la fecha de caducidad de la oferta.', 'Use {validUntil}. It is the offer expiry date.'), 2)}
          {field('closing', L('Cierre / firma', 'Closing / sign-off'), L('Despedida. {seller} pone el nombre del vendedor.', 'Sign-off. {seller} inserts the seller name.'), 2)}
          <div><button disabled={busy} onClick={saveTemplate} style={btnPS}>{L('Guardar plantilla', 'Save template')}</button></div>
        </div>

        {/* Vista previa en vivo */}
        <div>
          <div style={{ fontSize: 11.5, color: 'var(--mut,#9aa6bd)', marginBottom: 6 }}>{L('Vista previa en vivo (datos de ejemplo)', 'Live preview (sample data)')}</div>
          <div style={pv}>
            <div style={{ background: '#0b0f1e', color: '#fff', margin: -16, marginBottom: 12, padding: '12px 16px', borderTopLeftRadius: 10, borderTopRightRadius: 10 }}>
              <div style={{ fontWeight: 800 }}>Onyx Trading Live</div>
              <div style={{ fontSize: 11, opacity: .8 }}>{tplLang === 'es' ? 'Propuesta de publicidad' : 'Advertising proposal'}</div>
            </div>
            <p style={{ margin: '0 0 8px' }}>{fill(t.intro || '', sv)}</p>
            <div style={{ background: '#f4f6fb', borderRadius: 8, padding: 10, margin: '8px 0' }}>
              <div><b>{tplLang === 'es' ? 'Espacio' : 'Placement'}:</b> {sv.slot} · {sv.size}</div>
              <div><b>{tplLang === 'es' ? 'Fechas' : 'Dates'}:</b> {sv.start} — {sv.end} ({sv.days} {tplLang === 'es' ? 'días' : 'days'})</div>
              <div><b>{tplLang === 'es' ? 'Total' : 'Total'}:</b> <span style={{ color: '#5b62d6', fontWeight: 700 }}>{sv.price} USD</span></div>
            </div>
            <div style={h('inc')}>{tplLang === 'es' ? 'Incluye' : 'Included'}</div>
            <ul style={{ margin: '2px 0', paddingLeft: 18 }}>{bl(fill(t.includes || '', sv)).map((x, i) => <li key={i}>{x}</li>)}</ul>
            <div style={h('why')}>{tplLang === 'es' ? 'Por qué Onyx' : 'Why Onyx'}</div>
            <ul style={{ margin: '2px 0', paddingLeft: 18 }}>{bl(fill(t.whyOnyx || '', sv)).map((x, i) => <li key={i}>{x}</li>)}</ul>
            <div style={h('terms')}>{tplLang === 'es' ? 'Términos' : 'Terms'}</div>
            <p style={{ margin: '2px 0', color: '#555' }}>{fill(t.terms || '', sv)}</p>
            <p style={{ margin: '10px 0 2px', fontWeight: 700 }}>{fill(t.validityNote || '', sv)}</p>
            <p style={{ margin: '10px 0 0', whiteSpace: 'pre-line' }}>{fill(t.closing || '', sv)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Campo de porcentaje que admite vacío (para overrides que heredan el global).
// v puede ser number o null; on recibe el texto crudo ('' = vacío).
function PctF({ label, v, on, hint, placeholder }: { label: string; v: number | null | undefined; on: (x: string) => void; hint?: React.ReactNode; placeholder?: string }) {
  return (
    <div>
      <label style={{ fontSize: 12, color: 'var(--mut,#9aa6bd)', display: 'inline-flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>{label} {hint}</label>
      <div style={{ position: 'relative' }}>
        <input type="number" min={0} max={100} value={v === null || v === undefined ? '' : v} placeholder={placeholder}
          onChange={(e) => on(e.target.value)}
          style={{ width: '100%', padding: '8px 26px 8px 10px', borderRadius: 9, border: '1px solid var(--line,#2a3350)', background: 'var(--card,#1b2338)', color: 'var(--tx,#e8ecf5)', fontSize: 13 }} />
        <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--mut,#9aa6bd)', pointerEvents: 'none' }}>%</span>
      </div>
    </div>
  );
}

const cardS: React.CSSProperties = { background: 'var(--panel,#161c2e)', border: '1px solid var(--line,#2a3350)', borderRadius: 14, padding: 16 };
const btnS: React.CSSProperties = { padding: '8px 14px', borderRadius: 9, border: '1px solid var(--line,#2a3350)', background: 'var(--card,#1b2338)', color: 'var(--tx,#e8ecf5)', cursor: 'pointer', fontSize: 13 };
const btnPS: React.CSSProperties = { ...btnS, background: 'var(--accent,#8b93ff)', color: '#fff', border: 'none', fontWeight: 600 };
const inpS: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 9, border: '1px solid var(--line,#2a3350)', background: 'var(--card,#1b2338)', color: 'var(--tx,#e8ecf5)', fontSize: 13 };
const lblS: React.CSSProperties = { fontSize: 12, color: 'var(--mut,#9aa6bd)', display: 'inline-flex', alignItems: 'center', gap: 5, marginBottom: 4 };
