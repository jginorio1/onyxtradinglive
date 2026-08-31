'use client';
import { mkL } from '@/lib/i18n';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast, toastErr } from '@/lib/toast';
import { useLang } from '@/lib/lang';
import OnyxIcon from '@/app/components/OnyxIcon';

// Balance real (robusto): gastos operacionales con reembolso, prop firm, cuenta
// vinculada y ROI por firma. Bruto trading − costo real = neto.
type Item = { id: string; category: string; label: string | null; amount: number; currency: string; spent_on: string; recurring: boolean; note: string | null; provider: string | null; firm: string | null; acc_size: number | null; phase: string | null; account_id: string | null; refundable: boolean; recovered: number };

const CAT_LABEL: Record<string, [string, string]> = {
  funding: ['Cuenta de fondeo (reto)', 'Funded account (challenge)'],
  vps: ['VPS / hosting', 'VPS / hosting'], software: ['Software / EA / indicador', 'Software / EA / indicator'],
  data: ['Datos / feed', 'Data / feed'], internet: ['Internet', 'Internet'], journal: ['Suscripción / journal', 'Subscription / journal'],
  education: ['Educación / mentoría', 'Education / mentoring'], fees: ['Comisiones / retiros', 'Fees / withdrawals'], other: ['Otro…', 'Other…'],
};
const CAT_COLOR: Record<string, string> = { funding: '#D4537E', vps: '#1D9E75', software: '#7F77DD', data: '#378ADD', internet: '#EF9F27', journal: '#5DCAA5', education: '#F0997B', fees: '#888780', other: '#B4B2A9' };
const PHASE_LABEL: Record<string, [string, string]> = { p1: ['Reto Fase 1', 'Challenge Phase 1'], p2: ['Reto Fase 2', 'Challenge Phase 2'], funded: ['Fondeada', 'Funded'], reset: ['Reset', 'Reset'] };
const FIRMS = ['FTMO', 'The5ers', 'MyFundedFX', 'FundedNext', 'FTUK', 'Alpha Capital', 'E8', 'Otra'];

function monthNow() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
function shiftMonth(m: string, delta: number) { const [y, mo] = m.split('-').map(Number); const d = new Date(y, mo - 1 + delta, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
const emptyForm = (m: string) => ({ id: '', category: 'funding', amount: '', provider: '', recurring: false, spent_on: m + '-15', firm: 'FTMO', firmOther: '', acc_size: '', phase: 'p1', account_id: '', refundable: false, recovered: '' });

export default function Expenses() {
  const { lang } = useLang();
  const L = mkL(lang);
  const cat = (k: string) => (CAT_LABEL[k] || CAT_LABEL.other)[lang === 'en' ? 1 : 0];
  const ph = (k: string | null) => k && PHASE_LABEL[k] ? PHASE_LABEL[k][lang === 'en' ? 1 : 0] : '';
  const [month, setMonth] = useState(monthNow());
  const [d, setD] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState<any>(emptyForm(monthNow()));
  const set = (k: string, v: any) => setF((o: any) => ({ ...o, [k]: v }));
  const [rcpt, setRcpt] = useState('');
  const [coach, setCoach] = useState('');
  const [cOpen, setCOpen] = useState(true);
  const [cMsg, setCMsg] = useState('');

  function fileToB64(file: File): Promise<string> {
    return new Promise((res) => { const rd = new FileReader(); rd.onload = () => res(String(rd.result).split(',')[1] || ''); rd.readAsDataURL(file); });
  }
  // Lee un recibo con AI (archivo adjunto o texto pegado) y prellena el formulario.
  async function readReceipt(file?: File) {
    if (!file && rcpt.trim().length < 10) { toast(L('Adjunta un recibo o pega su texto.', 'Attach a receipt or paste its text.')); return; }
    setBusy(true);
    try {
      const body: any = { text: rcpt, lang };
      if (file) {
        if (file.size > 6_000_000) { toast(L('Archivo muy grande (máx ~6 MB).', 'File too large (max ~6 MB).')); return; }
        body.file = { media_type: file.type || 'application/octet-stream', data: await fileToB64(file) };
      }
      const r = await fetch('/api/expenses/read', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) { toastErr(j); return; }
      const dat = j.data || {};
      setF((o: any) => ({
        ...o,
        category: dat.category || o.category,
        amount: dat.amount !== undefined ? String(dat.amount) : o.amount,
        provider: dat.provider || o.provider,
        firm: dat.firm ? (FIRMS.includes(dat.firm) ? dat.firm : 'Otra') : o.firm,
        firmOther: dat.firm && !FIRMS.includes(dat.firm) ? dat.firm : o.firmOther,
        acc_size: dat.acc_size !== undefined ? String(dat.acc_size) : o.acc_size,
        phase: dat.phase || o.phase,
        refundable: dat.refundable !== undefined ? dat.refundable : o.refundable,
        recovered: dat.recovered !== undefined ? String(dat.recovered) : o.recovered,
        recurring: dat.recurring !== undefined ? dat.recurring : o.recurring,
      }));
      setRcpt('');
      toast(L('Leído — revisa los campos y guarda.', 'Read — review the fields and save.'), 'ok');
    } finally { setBusy(false); }
  }

  // Coach de gasto: lectura honesta del dinero.
  async function genCoach() {
    setBusy(true); setCMsg(''); setCoach('');
    try {
      const r = await fetch('/api/expenses/coach?lang=' + lang);
      const j = await r.json();
      if (j.locked) { setCMsg(L('No disponible.', 'Not available.')); return; }
      if (j.empty) { setCMsg(L('Apunta algún gasto para tu lectura.', 'Log an expense for your read.')); return; }
      if (!j.ok) { setCMsg(L('No se pudo generar. Inténtalo otra vez.', "Couldn't generate. Try again.")); return; }
      setCoach(j.review || ''); setCOpen(true);
    } finally { setBusy(false); }
  }

  async function load() { const r = await fetch('/api/expenses?month=' + month); setD(await r.json()); }
  useEffect(() => { load(); }, [month]);

  function payload() {
    const firm = f.category === 'funding' ? (f.firm === 'Otra' ? f.firmOther : f.firm) : undefined;
    return {
      id: f.id || undefined, category: f.category, amount: Number(f.amount), provider: f.provider || undefined,
      recurring: f.recurring, spent_on: f.spent_on,
      firm, acc_size: f.acc_size ? Number(f.acc_size) : undefined, phase: f.category === 'funding' ? f.phase : undefined,
      account_id: f.account_id || undefined, refundable: f.category === 'funding' ? f.refundable : false,
      recovered: f.refundable ? Number(f.recovered || 0) : 0,
    };
  }
  async function submit() {
    if (!f.amount || Number(f.amount) <= 0) { toast(L('Escribe el monto.', 'Enter the amount.')); return; }
    setBusy(true);
    try {
      const r = await fetch('/api/expenses', { method: f.id ? 'PATCH' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload()) });
      if (!r.ok) { toastErr(await r.json()); return; }
      setF(emptyForm(month)); load();
    } finally { setBusy(false); }
  }
  function edit(e: Item) {
    setF({ id: e.id, category: e.category, amount: String(e.amount), provider: e.provider || '', recurring: e.recurring, spent_on: e.spent_on,
      firm: e.firm && FIRMS.includes(e.firm) ? e.firm : (e.firm ? 'Otra' : 'FTMO'), firmOther: e.firm && !FIRMS.includes(e.firm) ? e.firm : '',
      acc_size: e.acc_size ? String(e.acc_size) : '', phase: e.phase || 'p1', account_id: e.account_id || '', refundable: e.refundable, recovered: e.recovered ? String(e.recovered) : '' });
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  async function del(id: string) { if (!confirm(L('¿Borrar este gasto?', 'Delete this expense?'))) return; await fetch('/api/expenses', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) }); if (f.id === id) setF(emptyForm(month)); load(); }

  const monthLabel = (() => { const [y, mo] = month.split('-').map(Number); return new Date(y, mo - 1, 1).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES', { month: 'long', year: 'numeric' }); })();
  const inp = { padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--tx)', width: '100%' } as any;
  const lbl = { fontSize: 11, color: 'var(--mut)', display: 'block', marginBottom: 3 } as any;

  if (!d) return <div style={{ maxWidth: 1180, margin: '0 auto', padding: '22px 22px', fontSize: 15 }}><div className="card muted">…</div></div>;
  if (d.locked) return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: '22px 22px', fontSize: 15 }}>
      <div className="card" style={{ maxWidth: 520, textAlign: 'center', margin: '0 auto' }}>
        <div style={{ marginBottom: 8, display: "flex", justifyContent: "center", color: "var(--brand)" }}><OnyxIcon emoji="🧮" size={30} /></div>
        <h3 style={{ marginBottom: 8 }}>{L('Ganancia neta', 'Net profit')}</h3>
        <p className="muted" style={{ fontSize: 14, marginBottom: 14 }}>{L('Lleva tus gastos (retos, VPS, software…) y ve lo que de verdad te quedó. Disponible en Pro y superiores.', 'Track your costs (challenges, VPS, software…) and see what you truly netted. Available on Pro and above.')}</p>
        <Link className="btn btn-primary" href="/pricing">{L('Ver planes', 'See plans')}</Link>
      </div>
    </div>
  );

  const cats = Object.entries(d.byCategory || {}).sort((a: any, b: any) => b[1] - a[1]) as [string, number][];
  const maxCat = cats.length ? Math.max(...cats.map((c) => c[1])) : 1;

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: '22px 22px', fontSize: 15 }}>
      <Link href="/dashboard" className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 13, marginBottom: 12, display: 'inline-flex' }}>← {L('Dashboard', 'Dashboard')}</Link>
      <div className="row between" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        <div className="row" style={{ gap: 10, alignItems: 'center' }}>
          <span style={{ display: "inline-flex", color: "var(--brand)" }}><OnyxIcon emoji="🧮" size={22} /></span>
          <div><h2 style={{ margin: 0, fontSize: 20 }}>{L('Ganancia neta', 'Net profit')}</h2>
            <div className="muted" style={{ fontSize: 13 }}>{L('Lo que de verdad te quedó, después de tus gastos.', 'What you truly kept, after your costs.')}</div></div>
        </div>
        <div className="row" style={{ gap: 6, alignItems: 'center' }}>
          <button className="btn btn-ghost" style={{ padding: '5px 10px' }} onClick={() => setMonth(shiftMonth(month, -1))}>‹</button>
          <span style={{ fontSize: 14, textTransform: 'capitalize', minWidth: 130, textAlign: 'center' }}>{monthLabel}</span>
          <button className="btn btn-ghost" style={{ padding: '5px 10px' }} onClick={() => setMonth(shiftMonth(month, 1))} disabled={month >= monthNow()}>›</button>
        </div>
      </div>

      {/* Bruto / Gastos / Neto */}
      <div className="grid g3" style={{ marginBottom: 8 }}>
        <div className="card kpi"><div className="lbl">{L('Ganancia bruta', 'Gross profit')}</div><div className="val" style={{ color: d.gross >= 0 ? 'var(--green)' : 'var(--red)' }}>{d.gross >= 0 ? '+' : ''}${d.gross.toLocaleString()}</div><div className="muted" style={{ fontSize: 12 }}>{L('trading del mes', 'trading this month')}</div></div>
        <div className="card kpi"><div className="lbl">{L('Gastos reales', 'Real cost')}</div><div className="val" style={{ color: 'var(--red)' }}>−${d.expenses.toLocaleString()}</div><div className="muted" style={{ fontSize: 12 }}>{L('menos reembolsos', 'minus refunds')}</div></div>
        <div className="card kpi" style={{ boxShadow: 'inset 0 0 0 2px var(--soft-brand)' }}><div className="lbl">{L('NETO REAL', 'TRUE NET')}</div><div className="val" style={{ color: d.net >= 0 ? 'var(--green)' : 'var(--red)' }}>{d.net >= 0 ? '' : '−'}${Math.abs(d.net).toLocaleString()}</div></div>
      </div>
      {d.breakeven > 0 && <div style={{ background: 'rgba(255,192,77,.10)', border: '1px solid var(--amber)', color: 'var(--amber)', borderRadius: 10, padding: '9px 13px', fontSize: 13, marginBottom: 16 }}>⚖️ {L('Te faltan', 'You still need')} <b>${d.breakeven.toLocaleString()}</b> {L('de ganancia para cubrir los gastos de este mes.', 'in profit to cover this month’s costs.')}</div>}

      {/* Añadir / editar gasto */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 10 }}>{f.id ? L('Editar gasto', 'Edit expense') : L('Añadir gasto', 'Add expense')}</h3>

        {/* Lector de recibos con AI */}
        {!f.id && (
          <div style={{ marginBottom: 12, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: 12 }}>
            <div className="muted" style={{ fontSize: 12.5, marginBottom: 8 }}>✨ {L('Adjunta el recibo (PDF o foto) o pega el texto — lo apunto con AI', 'Attach the receipt (PDF or photo) or paste the text — I log it with AI')}</div>
            <label className="btn btn-primary" style={{ display: 'inline-flex', cursor: 'pointer', marginBottom: 8 }}>
              📎 {L('Adjuntar recibo', 'Attach receipt')}
              <input type="file" accept="application/pdf,image/*" style={{ display: 'none' }} onChange={(e) => { const file = e.target.files?.[0]; if (file) readReceipt(file); e.currentTarget.value = ''; }} disabled={busy} />
            </label>
            <div className="muted" style={{ fontSize: 11.5, margin: '0 0 6px' }}>{L('— o pega el texto —', '— or paste the text —')}</div>
            <textarea value={rcpt} onChange={(e) => setRcpt(e.target.value)} placeholder={L('Ej: correo de compra de un reto FTMO, cargo del banco, renovación de suscripción…', 'e.g. FTMO challenge purchase email, bank charge, subscription renewal…')}
              style={{ width: '100%', minHeight: 54, padding: '9px 11px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--tx)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }} />
            <button className="btn btn-ghost" style={{ marginTop: 8 }} onClick={() => readReceipt()} disabled={busy}>{busy ? '…' : '✨ ' + L('Leer texto con AI', 'Read text with AI')}</button>
          </div>
        )}

        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
          <div><span style={lbl}>{L('Categoría', 'Category')}</span><select value={f.category} onChange={(e) => set('category', e.target.value)} style={{ ...inp, margin: 0 }}>{Object.keys(CAT_LABEL).map((k) => <option key={k} value={k}>{cat(k)}</option>)}</select></div>
          <div><span style={lbl}>{L('Monto', 'Amount')}</span><input value={f.amount} onChange={(e) => set('amount', e.target.value.replace(/[^\d.]/g, ''))} placeholder="$ 0" inputMode="decimal" style={{ ...inp, margin: 0 }} /></div>
          <div><span style={lbl}>{L('Fecha', 'Date')}</span><input type="date" value={f.spent_on} onChange={(e) => set('spent_on', e.target.value)} style={{ ...inp, margin: 0 }} /></div>
          <div><span style={lbl}>{L('Proveedor / detalle', 'Provider / detail')}</span><input value={f.provider} onChange={(e) => set('provider', e.target.value)} placeholder={L('Contabo, TradingView…', 'Contabo, TradingView…')} style={{ ...inp, margin: 0 }} /></div>
        </div>

        {f.category === 'funding' && (
          <div style={{ marginTop: 10, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 11.5, color: 'var(--soft-brand)', marginBottom: 8 }}>{L('Como es de fondeo, cuéntame más:', 'Since it’s a funded account, tell me more:')}</div>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10 }}>
              <div><span style={lbl}>{L('Prop firm', 'Prop firm')}</span><select value={f.firm} onChange={(e) => set('firm', e.target.value)} style={{ ...inp, margin: 0 }}>{FIRMS.map((x) => <option key={x} value={x}>{x === 'Otra' ? L('Otra…', 'Other…') : x}</option>)}</select></div>
              {f.firm === 'Otra' && <div><span style={lbl}>{L('Nombre', 'Name')}</span><input value={f.firmOther} onChange={(e) => set('firmOther', e.target.value)} style={{ ...inp, margin: 0 }} /></div>}
              <div><span style={lbl}>{L('Tamaño', 'Size')}</span><input value={f.acc_size} onChange={(e) => set('acc_size', e.target.value.replace(/[^\d]/g, ''))} placeholder="50000" inputMode="numeric" style={{ ...inp, margin: 0 }} /></div>
              <div><span style={lbl}>{L('Tipo', 'Type')}</span><select value={f.phase} onChange={(e) => set('phase', e.target.value)} style={{ ...inp, margin: 0 }}>{Object.keys(PHASE_LABEL).map((k) => <option key={k} value={k}>{ph(k)}</option>)}</select></div>
              <div><span style={lbl}>{L('Cuenta', 'Account')}</span><select value={f.account_id} onChange={(e) => set('account_id', e.target.value)} style={{ ...inp, margin: 0 }}><option value="">{L('— ninguna —', '— none —')}</option>{(d.accounts || []).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
            </div>
            <label className="row" style={{ gap: 6, marginTop: 10, fontSize: 12.5, color: 'var(--mut)', cursor: 'pointer', alignItems: 'flex-start' }}>
              <input type="checkbox" checked={f.refundable} onChange={(e) => set('refundable', e.target.checked)} style={{ width: 'auto', margin: '2px 0 0' }} />
              <span>{L('Reembolsable (la firma me devuelve la tarifa al pasar / al primer retiro)', 'Refundable (the firm returns the fee when I pass / at first payout)')}</span>
            </label>
            {f.refundable && <div style={{ marginTop: 8, maxWidth: 200 }}><span style={lbl}>{L('Ya recuperado ($)', 'Recovered so far ($)')}</span><input value={f.recovered} onChange={(e) => set('recovered', e.target.value.replace(/[^\d.]/g, ''))} placeholder="0" inputMode="decimal" style={{ ...inp, margin: 0 }} /></div>}
          </div>
        )}

        <div className="row" style={{ gap: 8, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <label className="row" style={{ gap: 6, fontSize: 13, color: 'var(--mut)', cursor: 'pointer' }}><input type="checkbox" checked={f.recurring} onChange={(e) => set('recurring', e.target.checked)} style={{ width: 'auto', margin: 0 }} /> {L('Mensual', 'Monthly')}</label>
          <button className="btn btn-primary" onClick={submit} disabled={busy} style={{ marginLeft: 'auto' }}>{busy ? '…' : (f.id ? L('Guardar cambios', 'Save changes') : '＋ ' + L('Añadir', 'Add'))}</button>
          {f.id && <button className="btn btn-ghost" onClick={() => setF(emptyForm(month))}>{L('Cancelar', 'Cancel')}</button>}
        </div>
      </div>

      {/* ROI por prop firm */}
      {!!(d.firms || []).length && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 4 }}>{L('¿Qué prop firm te sale a cuenta?', 'Which prop firm pays off?')}</h3>
          <p className="muted" style={{ fontSize: 12, marginBottom: 12 }}>{L('Gastado en retos vs. recuperado + ganado con esa firma (este año).', 'Spent on challenges vs. recovered + earned with that firm (this year).')}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(d.firms || []).map((fm: any) => (
              <div key={fm.firm} className="row between" style={{ background: 'var(--bg2)', borderRadius: 8, padding: '9px 12px', flexWrap: 'wrap', gap: 8, fontSize: 13 }}>
                <b style={{ minWidth: 90 }}>{fm.firm}</b>
                <span className="muted">−${fm.spent.toLocaleString()} {L('gastado', 'spent')}</span>
                <span className="muted">${fm.recovered.toLocaleString()} {L('recup.', 'recov.')}</span>
                <span style={{ color: fm.earned >= 0 ? 'var(--green)' : 'var(--red)' }}>{fm.earned >= 0 ? '+' : '−'}${Math.abs(fm.earned).toLocaleString()} {L('ganado', 'earned')}</span>
                <span className="pill" style={{ color: fm.roi >= 0 ? 'var(--soft-green)' : 'var(--red)', background: fm.roi >= 0 ? 'rgba(52,226,160,.15)' : 'rgba(255,107,125,.15)' }}>ROI {fm.roi >= 0 ? '+' : ''}{fm.roi}%</span>
              </div>
            ))}
          </div>
          <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>{L('El "ganado" solo cuenta si vinculaste el reto a una cuenta conectada.', 'Earned only counts if you linked the challenge to a connected account.')}</p>
        </div>
      )}

      {/* Coach de gasto */}
      <div className="card" style={{ marginBottom: 16, border: '1px solid rgba(124,140,255,.3)' }}>
        <div className="row between" style={{ flexWrap: 'wrap', gap: 8, marginBottom: coach && cOpen ? 10 : 0 }}>
          <div className="row" style={{ gap: 10, alignItems: 'center' }}>
            <span style={{ display: "inline-flex", color: "var(--purple)" }}><OnyxIcon emoji="🧠" size={20} /></span>
            <div><b style={{ fontSize: 14.5 }}>{L('Coach de gasto', 'Spending coach')}</b>
              <div className="muted" style={{ fontSize: 12 }}>{L('Una lectura honesta de tu dinero.', 'An honest read of your money.')}</div></div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            {coach && <button className="btn btn-ghost" onClick={() => setCOpen((o) => !o)}>{cOpen ? '▲ ' + L('Ocultar', 'Hide') : '▼ ' + L('Ver', 'Show')}</button>}
            <button className="btn btn-primary" onClick={genCoach} disabled={busy}>{busy && !coach ? '…' : (coach ? '↻ ' + L('Otra vez', 'Again') : '✨ ' + L('Generar lectura', 'Generate read'))}</button>
          </div>
        </div>
        {cMsg && <div className="muted" style={{ fontSize: 13 }}>{cMsg}</div>}
        {coach && cOpen && <div style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: '12px 14px', fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{coach}</div>}
      </div>

      {/* Por categoría */}
      {!!cats.length && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 12 }}>{L('Gastos por categoría', 'Expenses by category')}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {cats.map(([k, v]) => (
              <div key={k}>
                <div className="row between" style={{ fontSize: 13, marginBottom: 3 }}><span>{cat(k)}</span><b>${v.toLocaleString()}</b></div>
                <div style={{ height: 7, background: 'var(--bg2)', borderRadius: 4, overflow: 'hidden' }}><div style={{ width: Math.round((v / maxCat) * 100) + '%', height: '100%', background: CAT_COLOR[k] || '#888' }} /></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista */}
      <div className="card">
        <h3 style={{ marginBottom: 10 }}>{L('Gastos de este mes', "This month's expenses")}</h3>
        {!d.items.length && <p className="muted" style={{ fontSize: 14 }}>{L('Aún no hay gastos este mes.', 'No expenses this month yet.')}</p>}
        {d.items.map((e: Item) => {
          const name = e.category === 'other' && e.provider ? e.provider : cat(e.category);
          const sub = [e.firm, e.acc_size ? '$' + Number(e.acc_size).toLocaleString() : '', ph(e.phase), e.provider && e.category !== 'other' ? e.provider : ''].filter(Boolean).join(' · ');
          const real = Math.max(0, Number(e.amount) - Number(e.recovered || 0));
          return (
            <div key={e.id} className="row between" style={{ borderTop: '1px solid var(--line)', padding: '10px 0', gap: 8, flexWrap: 'wrap' }}>
              <span className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: CAT_COLOR[e.category] || '#888', flex: 'none', marginTop: 5 }} />
                <span>
                  <span style={{ fontSize: 13.5 }}>{name}{e.recurring && <span className="pill" style={{ marginLeft: 6, fontSize: 11, color: 'var(--soft-green)', background: 'rgba(52,226,160,.15)' }}>{L('mensual', 'monthly')}</span>}{e.refundable && <span className="pill" style={{ marginLeft: 6, fontSize: 11, color: 'var(--soft-brand)', background: 'rgba(124,140,255,.15)' }}>{L('reembolsable', 'refundable')}</span>}</span>
                  {sub && <span className="muted" style={{ display: 'block', fontSize: 11.5 }}>{sub}</span>}
                </span>
              </span>
              <span className="row" style={{ gap: 10, alignItems: 'center' }}>
                <span style={{ textAlign: 'right' }}><b>${real.toLocaleString()}</b>{Number(e.recovered) > 0 && <span className="muted" style={{ display: 'block', fontSize: 11 }}>${Number(e.amount).toLocaleString()} − ${Number(e.recovered).toLocaleString()}</span>}</span>
                <button className="btn btn-ghost" style={{ padding: '3px 8px', fontSize: 12 }} onClick={() => edit(e)}>✏️</button>
                <button className="btn btn-ghost" style={{ padding: '3px 8px', fontSize: 12 }} onClick={() => del(e.id)}>✕</button>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
