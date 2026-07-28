'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast, toastErr } from '@/lib/toast';
import { useLang } from '@/lib/lang';

// Balance real: gastos operacionales del trader vs ganancia de trading = neto real.
type Item = { id: string; category: string; label: string | null; amount: number; currency: string; spent_on: string; recurring: boolean; note: string | null };

const CAT_LABEL: Record<string, [string, string]> = {
  funding: ['Cuenta de fondeo (reto)', 'Funded account (challenge)'],
  vps: ['VPS / hosting', 'VPS / hosting'],
  software: ['Software / EA / indicador', 'Software / EA / indicator'],
  data: ['Datos / feed', 'Data / feed'],
  internet: ['Internet', 'Internet'],
  journal: ['Suscripción / journal', 'Subscription / journal'],
  education: ['Educación / mentoría', 'Education / mentoring'],
  fees: ['Comisiones / retiros', 'Fees / withdrawals'],
  other: ['Otro…', 'Other…'],
};
const CAT_COLOR: Record<string, string> = { funding: '#D4537E', vps: '#1D9E75', software: '#7F77DD', data: '#378ADD', internet: '#EF9F27', journal: '#5DCAA5', education: '#F0997B', fees: '#888780', other: '#B4B2A9' };

function monthNow() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
function shiftMonth(m: string, delta: number) { const [y, mo] = m.split('-').map(Number); const d = new Date(y, mo - 1 + delta, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }

export default function Expenses() {
  const { lang } = useLang();
  const L = (es: string, en: string) => (lang === 'en' ? en : es);
  const cat = (k: string) => (CAT_LABEL[k] || CAT_LABEL.other)[lang === 'en' ? 1 : 0];
  const [month, setMonth] = useState(monthNow());
  const [d, setD] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ category: 'funding', label: '', amount: '', recurring: false });

  async function load() { const r = await fetch('/api/expenses?month=' + month); setD(await r.json()); }
  useEffect(() => { load(); }, [month]);

  async function add() {
    if (!f.amount || Number(f.amount) <= 0) { toast(L('Escribe el monto.', 'Enter the amount.')); return; }
    setBusy(true);
    try {
      const r = await fetch('/api/expenses', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...f, amount: Number(f.amount), spent_on: month + '-15' }) });
      if (!r.ok) { toastErr(await r.json()); return; }
      setF({ category: 'funding', label: '', amount: '', recurring: false }); load();
    } finally { setBusy(false); }
  }
  async function del(id: string) {
    if (!confirm(L('¿Borrar este gasto?', 'Delete this expense?'))) return;
    await fetch('/api/expenses', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) }); load();
  }

  const monthLabel = (() => { const [y, mo] = month.split('-').map(Number); return new Date(y, mo - 1, 1).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES', { month: 'long', year: 'numeric' }); })();

  if (!d) return <div className="wrap-wide" style={{ padding: '22px 0' }}><div className="card muted">…</div></div>;

  if (d.locked) return (
    <div className="wrap-wide" style={{ padding: '22px 0' }}>
      <div className="card" style={{ maxWidth: 520, textAlign: 'center', margin: '0 auto' }}>
        <div style={{ fontSize: 30, marginBottom: 8 }}>🧮</div>
        <h3 style={{ marginBottom: 8 }}>{L('Balance real', 'True P&L')}</h3>
        <p className="muted" style={{ fontSize: 14, marginBottom: 14 }}>{L('Lleva tus gastos (retos, VPS, software…) y ve lo que de verdad te quedó. Disponible en Pro y superiores.', 'Track your costs (challenges, VPS, software…) and see what you truly netted. Available on Pro and above.')}</p>
        <Link className="btn btn-primary" href="/pricing">{L('Ver planes', 'See plans')}</Link>
      </div>
    </div>
  );

  const cats = Object.entries(d.byCategory || {}).sort((a: any, b: any) => b[1] - a[1]) as [string, number][];
  const maxCat = cats.length ? Math.max(...cats.map((c) => c[1])) : 1;
  const inp = { padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--tx)' } as any;

  return (
    <div className="wrap-wide" style={{ padding: '22px 0' }}>
      <div className="row between" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        <div className="row" style={{ gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 22 }}>🧮</span>
          <div><h2 style={{ margin: 0, fontSize: 20 }}>{L('Balance real', 'True P&L')}</h2>
            <div className="muted" style={{ fontSize: 13 }}>{L('Lo que de verdad te quedó, después de tus gastos.', 'What you truly kept, after your costs.')}</div></div>
        </div>
        <div className="row" style={{ gap: 6, alignItems: 'center' }}>
          <button className="btn btn-ghost" style={{ padding: '5px 10px' }} onClick={() => setMonth(shiftMonth(month, -1))}>‹</button>
          <span style={{ fontSize: 14, textTransform: 'capitalize', minWidth: 130, textAlign: 'center' }}>{monthLabel}</span>
          <button className="btn btn-ghost" style={{ padding: '5px 10px' }} onClick={() => setMonth(shiftMonth(month, 1))} disabled={month >= monthNow()}>›</button>
        </div>
      </div>

      {/* Bruto / Gastos / Neto */}
      <div className="grid g3" style={{ marginBottom: 16 }}>
        <div className="card kpi"><div className="lbl">{L('Ganancia bruta', 'Gross profit')}</div><div className="val" style={{ color: d.gross >= 0 ? 'var(--green)' : 'var(--red)' }}>{d.gross >= 0 ? '+' : ''}${d.gross.toLocaleString()}</div><div className="muted" style={{ fontSize: 12 }}>{L('trading del mes', 'trading this month')}</div></div>
        <div className="card kpi"><div className="lbl">{L('Gastos', 'Expenses')}</div><div className="val" style={{ color: 'var(--red)' }}>−${d.expenses.toLocaleString()}</div><div className="muted" style={{ fontSize: 12 }}>{L('operacionales', 'operational')}</div></div>
        <div className="card kpi" style={{ boxShadow: 'inset 0 0 0 2px var(--soft-brand)' }}><div className="lbl">{L('NETO REAL', 'TRUE NET')}</div><div className="val" style={{ color: d.net >= 0 ? 'var(--green)' : 'var(--red)' }}>{d.net >= 0 ? '' : '−'}${Math.abs(d.net).toLocaleString()}</div></div>
      </div>

      {/* Añadir gasto */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 10 }}>{L('Añadir gasto', 'Add expense')}</h3>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} style={{ ...inp, minWidth: 190, margin: 0 }}>
            {Object.keys(CAT_LABEL).map((k) => <option key={k} value={k}>{cat(k)}</option>)}
          </select>
          {f.category === 'other' && <input value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder={L('¿Qué gasto?', 'What expense?')} style={{ ...inp, margin: 0, width: 160 }} />}
          <input value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/[^\d.]/g, '') })} placeholder="$ 0" inputMode="decimal" style={{ ...inp, margin: 0, width: 110 }} />
          <label className="row" style={{ gap: 6, fontSize: 13, color: 'var(--mut)', cursor: 'pointer' }}><input type="checkbox" checked={f.recurring} onChange={(e) => setF({ ...f, recurring: e.target.checked })} style={{ width: 'auto', margin: 0 }} /> {L('Mensual', 'Monthly')}</label>
          <button className="btn btn-primary" onClick={add} disabled={busy}>＋ {L('Añadir', 'Add')}</button>
        </div>
        <p className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>{L('¿No está en la lista? Elige "Otro…" y escríbelo. "Mensual" se repite solo cada mes (VPS, suscripciones).', 'Not in the list? Pick "Other…" and type it. "Monthly" repeats each month by itself (VPS, subscriptions).')}</p>
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

      {/* Lista de gastos del mes */}
      <div className="card">
        <h3 style={{ marginBottom: 10 }}>{L('Gastos de este mes', "This month's expenses")}</h3>
        {!d.items.length && <p className="muted" style={{ fontSize: 14 }}>{L('Aún no hay gastos este mes.', 'No expenses this month yet.')}</p>}
        {d.items.map((e: Item) => (
          <div key={e.id} className="row between" style={{ borderTop: '1px solid var(--line)', padding: '9px 0', fontSize: 13.5, gap: 8, flexWrap: 'wrap' }}>
            <span className="row" style={{ gap: 8 }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: CAT_COLOR[e.category] || '#888', flex: 'none' }} />
              <span>{e.category === 'other' && e.label ? e.label : cat(e.category)}{e.recurring && <span className="pill" style={{ marginLeft: 6, fontSize: 11, color: 'var(--soft-green)', background: 'rgba(52,226,160,.15)' }}>{L('mensual', 'monthly')}</span>}</span>
            </span>
            <span className="row" style={{ gap: 12 }}><b>${Number(e.amount).toLocaleString()}</b>
              <button className="btn btn-ghost" style={{ padding: '3px 8px', fontSize: 12 }} onClick={() => del(e.id)}>✕</button></span>
          </div>
        ))}
      </div>
    </div>
  );
}
