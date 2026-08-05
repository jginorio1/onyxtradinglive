'use client';
import { mkL } from '@/lib/i18n';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/lang';
import OnyxIcon from '@/app/components/OnyxIcon';
import ConfirmNote from './ConfirmNote';

// Finanzas de Onyx (P&L del negocio). Ingresos de Stripe vs gastos registrados.
// Solo la ve quien tenga el permiso 'finanzas'. canManage = puede registrar gastos.

const CATS = ['infra', 'sueldos', 'ads', 'herramientas', 'legal', 'otros'];
const CAT_LABEL: Record<string, [string, string]> = {
  infra: ['Infraestructura', 'Infrastructure'], sueldos: ['Sueldos', 'Salaries'], ads: ['Publicidad', 'Ads'],
  herramientas: ['Herramientas', 'Tools'], legal: ['Legal', 'Legal'], otros: ['Otros', 'Other'],
};
const CAT_COLOR: Record<string, string> = { infra: 'var(--brand)', sueldos: 'var(--purple)', ads: 'var(--gold)', herramientas: 'var(--cyan)', legal: 'var(--red)', otros: 'var(--mut)' };
const GREEN = 'var(--green)', RED = 'var(--red)', BRAND = 'var(--brand)', GOLD = 'var(--gold)';

export default function Finanzas({ canManage = false }: { canManage?: boolean }) {
  const { lang } = useLang();
  const es = lang !== 'en';
  const L = mkL(lang);
  const [d, setD] = useState<any>(null);
  const [mode, setMode] = useState<'collected' | 'mrr'>('collected');
  const [busy, setBusy] = useState(false);
  const empty = { name: '', category: 'infra', amount: '', kind: 'recurring', interval: 'monthly', incurred_on: new Date().toISOString().slice(0, 10), vendor: '', ends_on: '' };
  const [form, setForm] = useState<any>(empty);
  const [editId, setEditId] = useState<string | null>(null);
  const [cashInput, setCashInput] = useState('');
  const [cf, setCf] = useState<any>(null);   // confirmación con nota

  async function load() {
    const r = await fetch(`/api/admin/finanzas?income=${mode}&lang=${lang}`);
    const j = await r.json();
    if (!j.error) { setD(j); setCashInput(String(j.cash || '')); }
  }
  useEffect(() => { load(); }, [mode]);

  const fmt = (n: number) => (n < 0 ? '−' : '') + '$' + Math.abs(Math.round(n || 0)).toLocaleString();

  async function saveExpense() {
    if (!form.name || !form.amount) return;
    setBusy(true);
    const body: any = { ...form, amount: Number(form.amount), ends_on: form.ends_on || null };
    if (editId) { body.action = 'update'; body.id = editId; }
    await fetch('/api/admin/finanzas', { method: 'POST', body: JSON.stringify(body) });
    setBusy(false); setForm(empty); setEditId(null); load();
  }
  function del(id: string) {
    setCf({ title: L('¿Borrar este gasto?', 'Delete this expense?'), danger: true, run: async (note: string) => {
      await fetch('/api/admin/finanzas', { method: 'POST', body: JSON.stringify({ action: 'delete', id, note }) });
      load();
    } });
  }
  async function toggleActive(e: any) {
    await fetch('/api/admin/finanzas', { method: 'POST', body: JSON.stringify({ action: 'update', id: e.id, active: !e.active }) });
    load();
  }
  function editExpense(e: any) {
    setEditId(e.id);
    setForm({ name: e.name, category: e.category, amount: String(e.amount), kind: e.kind, interval: e.interval, incurred_on: e.incurred_on, vendor: e.vendor || '', ends_on: e.ends_on || '' });
  }
  async function saveCash() {
    await fetch('/api/admin/finanzas', { method: 'PUT', body: JSON.stringify({ balance: Number(cashInput) }) });
    load();
  }

  if (!d) return <div className="card muted">…</div>;
  if (!d.configured) return <div className="card"><b>{L('Ingresos no configurados', 'Revenue not configured')}</b><p className="muted" style={{ marginTop: 6 }}>{L('Falta STRIPE_SECRET_KEY en Vercel para leer los ingresos.', 'STRIPE_SECRET_KEY missing in Vercel to read revenue.')}</p></div>;

  const s = d.series || [];
  const maxV = Math.max(1, ...s.map((m: any) => Math.max(m.income, m.expense)));
  const tm = d.thisMonth;
  const marginColor = tm.margin == null ? 'var(--tx)' : tm.margin >= 40 ? GREEN : tm.margin >= 15 ? GOLD : RED;
  const netColor = tm.net >= 0 ? GREEN : RED;
  const maxCat = Math.max(1, ...(d.categories || []).map((c: any) => c.total));

  // Geometría del gráfico
  const W = 520, H = 150, pad = 8, bw = s.length ? (W - pad * 2) / s.length : W;
  const y = (v: number) => H - 18 - (v / maxV) * (H - 34);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ConfirmNote act={cf} onClose={() => setCf(null)} />
      <div className="row between" style={{ flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <div>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 9 }}><span className="card-ic"><OnyxIcon emoji="📊" size={16} /></span> {L('Finanzas de Onyx', 'Onyx finances')}</h3>
          <div className="muted" style={{ fontSize: 13 }}>{L('Ingresos de Stripe menos tus gastos del negocio.', 'Stripe revenue minus your business expenses.')}</div>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <button className={'btn ' + (mode === 'collected' ? 'btn-primary' : 'btn-ghost')} style={{ fontSize: 12.5 }} onClick={() => setMode('collected')}>{L('Cobrado real', 'Collected')}</button>
          <button className={'btn ' + (mode === 'mrr' ? 'btn-primary' : 'btn-ghost')} style={{ fontSize: 12.5 }} onClick={() => setMode('mrr')}>MRR</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid g4">
        <div className="statcard" style={{ ['--ac' as any]: netColor }}>
          <span className="statcard-ic"><OnyxIcon emoji="💰" size={17} /></span>
          <div className="sc-lbl">{L('Beneficio neto (mes)', 'Net profit (month)')}</div>
          <div className="sc-val" style={{ color: netColor }}>{fmt(tm.net)}</div>
          <div className="sc-sub">{L('Ingresos', 'Income')} {fmt(tm.income)} · {L('Gastos', 'Expenses')} {fmt(tm.expense)}</div>
        </div>
        <div className="statcard" style={{ ['--ac' as any]: marginColor }}>
          <span className="statcard-ic"><OnyxIcon emoji="📈" size={17} /></span>
          <div className="sc-lbl">{L('Margen', 'Margin')}</div>
          <div className="sc-val" style={{ color: marginColor }}>{tm.margin == null ? '—' : tm.margin + '%'}</div>
          {tm.margin != null ? <div className="statbar"><i style={{ width: Math.max(2, Math.min(100, tm.margin)) + '%' }} /></div> : null}
        </div>
        <div className="statcard" style={{ ['--ac' as any]: GOLD }}>
          <span className="statcard-ic"><OnyxIcon emoji="🔁" size={17} /></span>
          <div className="sc-lbl">{L('Gasto fijo / mes', 'Fixed cost / month')}</div>
          <div className="sc-val" style={{ color: GOLD }}>{fmt(d.burn)}</div>
          <div className="sc-sub">{d.mrr > 0 ? L('Pesa el', 'It is') + ' ' + Math.round((d.burn / d.mrr) * 100) + '% ' + L('de tu MRR', 'of your MRR') : L('sin MRR aún', 'no MRR yet')}</div>
        </div>
        <div className="statcard" style={{ ['--ac' as any]: d.runway == null ? 'var(--mut)' : d.runway >= 6 ? GREEN : RED }}>
          <span className="statcard-ic"><OnyxIcon emoji="🛟" size={17} /></span>
          <div className="sc-lbl">Runway</div>
          <div className="sc-val" style={{ color: d.runway == null ? 'var(--tx)' : d.runway >= 6 ? GREEN : RED }}>{d.runway == null ? '—' : d.runway + ' ' + L('meses', 'mo')}</div>
          <div className="sc-sub">{L('Caja', 'Cash')} {fmt(d.cash)}</div>
        </div>
      </div>

      {/* Gráfico ingresos vs gastos + beneficio */}
      <div className="card">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}><span className="card-ic"><OnyxIcon emoji="📊" size={16} /></span> {L('Ingresos vs gastos · beneficio', 'Income vs expenses · profit')}</h3>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ overflow: 'visible' }}>
          <line x1="0" y1={H - 18} x2={W} y2={H - 18} stroke="var(--line)" strokeWidth="1" />
          {s.map((m: any, i: number) => {
            const cx = pad + i * bw + bw / 2;
            const w = Math.min(18, bw / 3);
            return (
              <g key={i}>
                <rect x={cx - w - 1} y={y(m.income)} width={w} height={Math.max(0, (H - 18) - y(m.income))} rx="3" fill={GREEN} />
                <rect x={cx + 1} y={y(m.expense)} width={w} height={Math.max(0, (H - 18) - y(m.expense))} rx="3" fill={RED} opacity="0.85" />
                <text x={cx} y={H - 4} textAnchor="middle" fontSize="9" fill="var(--mut)">{m.label}</text>
              </g>
            );
          })}
          {s.length > 1 && (
            <path d={s.map((m: any, i: number) => `${i === 0 ? 'M' : 'L'}${pad + i * bw + bw / 2},${y(m.net > 0 ? m.net : 0)}`).join(' ')}
              fill="none" stroke={BRAND} strokeWidth="2.5" style={{ filter: 'drop-shadow(0 0 4px var(--brand))' }} />
          )}
        </svg>
        <div className="row" style={{ gap: 16, marginTop: 8, fontSize: 12, color: 'var(--mut)', flexWrap: 'wrap' }}>
          <span><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: GREEN, marginRight: 5 }} />{L('Ingresos', 'Income')}</span>
          <span><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: RED, marginRight: 5 }} />{L('Gastos', 'Expenses')}</span>
          <span><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: BRAND, marginRight: 5 }} />{L('Beneficio', 'Profit')}</span>
        </div>
      </div>

      <div className="grid g2">
        {/* Desglose por categoría */}
        <div className="card">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}><span className="card-ic"><OnyxIcon emoji="🧩" size={16} /></span> {L('Gastos por categoría (mes)', 'Expenses by category (month)')}</h3>
          {(d.categories || []).length === 0 ? <p className="muted">{L('Sin gastos este mes.', 'No expenses this month.')}</p> : (d.categories || []).map((c: any) => (
            <div key={c.category} style={{ marginBottom: 10 }}>
              <div className="row between" style={{ fontSize: 13, marginBottom: 4 }}>
                <span>{CAT_LABEL[c.category]?.[es ? 0 : 1] || c.category}</span>
                <span style={{ fontWeight: 700 }}>{fmt(c.total)} {c.one_off > 0 ? <span className="muted" style={{ fontSize: 11 }}>({L('puntual', 'one-off')} {fmt(c.one_off)})</span> : null}</span>
              </div>
              <div style={{ height: 8, borderRadius: 6, background: 'var(--bg2)', overflow: 'hidden' }}>
                <div style={{ width: (c.total / maxCat) * 100 + '%', height: '100%', borderRadius: 6, background: CAT_COLOR[c.category] || BRAND, boxShadow: `0 0 8px color-mix(in srgb, ${CAT_COLOR[c.category] || BRAND} 60%, transparent)` }} />
              </div>
            </div>
          ))}
          {/* Caja */}
          {canManage && (
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 5 }}>💰 {L('Tu caja actual (para el runway)', 'Your current cash (for runway)')}</div>
              <div className="row" style={{ gap: 8 }}>
                <input type="number" value={cashInput} onChange={(e) => setCashInput(e.target.value)} placeholder="0" style={{ margin: 0, flex: 1 }} />
                <button className="btn btn-ghost" onClick={saveCash}>{L('Guardar', 'Save')}</button>
              </div>
            </div>
          )}
        </div>

        {/* Registrar / lista de gastos */}
        <div className="card">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}><span className="card-ic"><OnyxIcon emoji="💸" size={16} /></span> {L('Gastos', 'Expenses')}</h3>
          {canManage && (
            <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{editId ? L('Editar gasto', 'Edit expense') : L('Añadir gasto', 'Add expense')}</div>
              <div className="grid g2" style={{ gap: 8 }}>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={L('Nombre (Vercel, Sueldo…)', 'Name (Vercel, Salary…)')} style={{ margin: 0 }} />
                <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder={L('Importe', 'Amount')} style={{ margin: 0 }} />
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={{ margin: 0 }}>
                  {CATS.map((c) => <option key={c} value={c}>{CAT_LABEL[c][es ? 0 : 1]}</option>)}
                </select>
                <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} style={{ margin: 0 }}>
                  <option value="recurring">{L('Recurrente', 'Recurring')}</option>
                  <option value="one_off">{L('Puntual', 'One-off')}</option>
                </select>
                {form.kind === 'recurring' && (
                  <select value={form.interval} onChange={(e) => setForm({ ...form, interval: e.target.value })} style={{ margin: 0 }}>
                    <option value="monthly">{L('Mensual', 'Monthly')}</option>
                    <option value="yearly">{L('Anual', 'Yearly')}</option>
                  </select>
                )}
                <input type="date" value={form.incurred_on} onChange={(e) => setForm({ ...form, incurred_on: e.target.value })} style={{ margin: 0 }} />
              </div>
              <div className="row" style={{ gap: 8, marginTop: 8 }}>
                <button className="btn btn-primary" onClick={saveExpense} disabled={busy || !form.name || !form.amount} style={{ fontSize: 13 }}>{busy ? '…' : (editId ? L('Guardar cambios', 'Save changes') : '＋ ' + L('Añadir', 'Add'))}</button>
                {editId && <button className="btn btn-ghost" onClick={() => { setEditId(null); setForm(empty); }} style={{ fontSize: 13 }}>{L('Cancelar', 'Cancel')}</button>}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
            {(d.expenses || []).length === 0 ? <p className="muted">{L('Aún no hay gastos registrados.', 'No expenses yet.')}</p> : (d.expenses || []).map((e: any) => (
              <div key={e.id} className="row between" style={{ background: 'var(--bg2)', borderRadius: 8, padding: '8px 10px', fontSize: 13, opacity: e.active ? 1 : 0.5 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.name}</div>
                  <div className="muted" style={{ fontSize: 11 }}>
                    <span className="pill" style={{ fontSize: 9.5, background: `color-mix(in srgb, ${CAT_COLOR[e.category] || BRAND} 16%, transparent)`, color: CAT_COLOR[e.category] || BRAND }}>{CAT_LABEL[e.category]?.[es ? 0 : 1] || e.category}</span>
                    {' '}{e.kind === 'recurring' ? (e.interval === 'yearly' ? L('anual', 'yearly') : L('mensual', 'monthly')) : L('puntual', 'one-off')}
                  </div>
                </div>
                <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                  <span style={{ fontWeight: 700 }}>{fmt(e.amount)}</span>
                  {canManage && <>
                    <button className="btn btn-ghost" style={{ padding: '2px 7px', fontSize: 11 }} onClick={() => toggleActive(e)} title={e.active ? L('Pausar', 'Pause') : L('Activar', 'Activate')}>{e.active ? '⏸' : '▶'}</button>
                    <button className="btn btn-ghost" style={{ padding: '2px 7px', fontSize: 11 }} onClick={() => editExpense(e)}>✎</button>
                    <button className="btn btn-ghost" style={{ padding: '2px 7px', fontSize: 11, color: 'var(--red)' }} onClick={() => del(e.id)}>✕</button>
                  </>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
