'use client';
import { useEffect, useState } from 'react';

// Panel admin · Reserva de espacios por cupo fijo.
//  · Editar el cupo (máx anunciantes rotando) por ubicación + parámetros.
//  · Ver todas las reservas y CONFIRMAR el pago (activa/programa + acredita la
//    comisión del vendedor) o cancelar (libera cupo + revierte comisión).
export default function AdSpaceBooking({ es = true }: { es?: boolean }) {
  const L = (a: string, b: string) => (es ? a : b);
  const [d, setD] = useState<any>(null);
  const [caps, setCaps] = useState<Record<string, number>>({});
  const [cfg, setCfg] = useState<any>({ defaultCap: 4, spaceCommissionPct: 15, holdMinutes: 45, maturationDays: 14 });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  // --- módulo de cotizaciones / propuestas ---
  const [ok2, setOk2] = useState('');
  const [f, setF] = useState<any>({ slot: '', start: '', end: '', advertiser: '', company: '', email: '', link: '', price: 0, rep_id: '' });
  const [cal, setCal] = useState<any[]>([]);
  const [range, setRange] = useState<any>(null);
  const todayStr = new Date().toISOString().slice(0, 10);

  const load = async () => {
    try {
      const r = await fetch('/api/admin/ads/booking', { cache: 'no-store' });
      const j = await r.json();
      setD(j);
      setCaps(j.settings?.caps || {});
      setCfg({ defaultCap: j.settings?.defaultCap ?? 4, spaceCommissionPct: j.settings?.spaceCommissionPct ?? 15, holdMinutes: j.settings?.holdMinutes ?? 45, maturationDays: j.settings?.maturationDays ?? 14 });
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
  const saveSettings = async () => { const j = await post({ action: 'save_settings', caps, ...cfg }); if (j.ok) { setMsg(L('Guardado ✓', 'Saved ✓')); await load(); } };
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
            <label style={lblS}>{L('Ubicación', 'Placement')}</label>
            <select value={f.slot} onChange={(e) => onSlotF(e.target.value)} style={inpS}>
              <option value="">{L('— Elige un espacio —', '— Choose a space —')}</option>
              {(d.slots || []).map((s: any) => <option key={s.key} value={s.key}>{(es ? s.es : s.en)} · {s.size} · {L('cupo', 'cap')} {s.cap} · ${s.price}</option>)}
            </select>
          </div>
          <div><label style={lblS}>{L('Desde', 'From')}</label><input type="date" min={todayStr} value={f.start} onChange={(e) => { setFF('start', e.target.value); refreshCal(f.slot, e.target.value, f.end); }} style={inpS} /></div>
          <div><label style={lblS}>{L('Hasta', 'To')}</label><input type="date" min={f.start || todayStr} value={f.end} onChange={(e) => { setFF('end', e.target.value); refreshCal(f.slot, f.start, e.target.value); }} style={inpS} /></div>
          <div><label style={lblS}>{L('Contacto (anunciante)', 'Contact (advertiser)')}</label><input value={f.advertiser} onChange={(e) => setFF('advertiser', e.target.value)} style={inpS} /></div>
          <div><label style={lblS}>{L('Empresa', 'Company')}</label><input value={f.company} onChange={(e) => setFF('company', e.target.value)} style={inpS} /></div>
          <div><label style={lblS}>{L('Correo del anunciante', 'Advertiser email')}</label><input value={f.email} onChange={(e) => setFF('email', e.target.value)} style={inpS} /></div>
          <div><label style={lblS}>{L('Enlace / web', 'Link / website')}</label><input value={f.link} onChange={(e) => setFF('link', e.target.value)} style={inpS} /></div>
          <div><label style={lblS}>{L('Precio total (USD)', 'Total price (USD)')}</label><input type="number" min={0} value={f.price} onChange={(e) => setFF('price', Number(e.target.value) || 0)} style={inpS} /></div>
          <div>
            <label style={lblS}>{L('Atribuir a vendedor (opcional)', 'Attribute to seller (optional)')}</label>
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

      <div style={cardS}>
        <div style={{ fontWeight: 600, color: 'var(--tx,#e8ecf5)', marginBottom: 10 }}>{L('Ajustes de espacios', 'Space settings')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
          <NumF label={L('Cupo por defecto', 'Default cap')} v={cfg.defaultCap} on={(x) => setCfg({ ...cfg, defaultCap: x })} />
          <NumF label={L('Comisión vendedor %', 'Seller commission %')} v={cfg.spaceCommissionPct} on={(x) => setCfg({ ...cfg, spaceCommissionPct: x })} />
          <NumF label={L('Reserva sin pagar (min)', 'Hold (min)')} v={cfg.holdMinutes} on={(x) => setCfg({ ...cfg, holdMinutes: x })} />
          <NumF label={L('Maduración comisión (días)', 'Commission maturation (days)')} v={cfg.maturationDays} on={(x) => setCfg({ ...cfg, maturationDays: x })} />
        </div>
        <div style={{ fontWeight: 600, color: 'var(--tx,#e8ecf5)', margin: '14px 0 8px' }}>{L('Cupo por ubicación', 'Cap per placement')}</div>
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

function NumF({ label, v, on }: { label: string; v: number; on: (x: number) => void }) {
  return (
    <div>
      <label style={{ fontSize: 12, color: 'var(--mut,#9aa6bd)', display: 'block', marginBottom: 4 }}>{label}</label>
      <input type="number" value={v} onChange={(e) => on(Number(e.target.value) || 0)}
        style={{ width: '100%', padding: '8px 10px', borderRadius: 9, border: '1px solid var(--line,#2a3350)', background: 'var(--card,#1b2338)', color: 'var(--tx,#e8ecf5)', fontSize: 13 }} />
    </div>
  );
}

const cardS: React.CSSProperties = { background: 'var(--panel,#161c2e)', border: '1px solid var(--line,#2a3350)', borderRadius: 14, padding: 16 };
const btnS: React.CSSProperties = { padding: '8px 14px', borderRadius: 9, border: '1px solid var(--line,#2a3350)', background: 'var(--card,#1b2338)', color: 'var(--tx,#e8ecf5)', cursor: 'pointer', fontSize: 13 };
const btnPS: React.CSSProperties = { ...btnS, background: 'var(--accent,#8b93ff)', color: '#fff', border: 'none', fontWeight: 600 };
const inpS: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 9, border: '1px solid var(--line,#2a3350)', background: 'var(--card,#1b2338)', color: 'var(--tx,#e8ecf5)', fontSize: 13 };
const lblS: React.CSSProperties = { fontSize: 12, color: 'var(--mut,#9aa6bd)', display: 'block', marginBottom: 4 };
