'use client';
import { mkL } from '@/lib/i18n';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/lang';
import OnyxIcon from '@/app/components/OnyxIcon';
import Revenue from './Revenue';
import Finanzas from './Finanzas';
import AcademyAdmin from './AcademyAdmin';

// ============================================================
// Facturación · un solo lugar para todo lo de dinero en el admin.
// Tira de reconciliación (Stripe real vs libro) + 3 tarjetas que son resumen y
// selector a la vez; al pulsar una, su reporte completo se abre debajo sin salir.
//   · Suscripciones Onyx  → Revenue (MRR, churn, cobros…)
//   · Academia            → AcademyAdmin (comisiones, saldo/payouts de plataforma)
//   · Negocio (P&L)       → Finanzas (ingresos − gastos)
// ============================================================
type View = 'onyx' | 'academia' | 'negocio';

export default function Facturacion({ showIngresos, showAcademia, showFinanzas, canManageFinanzas, canManageAcademy }:
  { showIngresos: boolean; showAcademia: boolean; showFinanzas: boolean; canManageFinanzas: boolean; canManageAcademy: boolean }) {
  const { lang } = useLang();
  const es = lang !== 'en';
  const L = mkL(lang);
  const first: View = showIngresos ? 'onyx' : showAcademia ? 'academia' : 'negocio';
  const [view, setView] = useState<View>(first);
  const [sum, setSum] = useState<any>({});

  useEffect(() => {
    if (showIngresos) fetch('/api/admin/revenue').then((r) => r.ok ? r.json() : null).then((j) => j && setSum((s: any) => ({ ...s, rev: j }))).catch(() => {});
    if (showAcademia || showIngresos) fetch('/api/admin/academy').then((r) => r.ok ? r.json() : null).then((j) => j && setSum((s: any) => ({ ...s, acad: j }))).catch(() => {});
    if (showFinanzas) fetch('/api/admin/finanzas').then((r) => r.ok ? r.json() : null).then((j) => j && setSum((s: any) => ({ ...s, fin: j }))).catch(() => {});
  }, []);

  // Revenue/Finanzas ya vienen en dólares; las comisiones de academia en centavos.
  const $ = (n: number) => '$' + Math.round(n || 0).toLocaleString(es ? 'es-ES' : 'en-US');
  const $c = (c: number) => '$' + Math.round((c || 0) / 100).toLocaleString(es ? 'es-ES' : 'en-US');

  const rev = sum.rev; const acad = sum.acad; const fin = sum.fin;
  const acaFee = (acad?.academies || []).reduce((s: number, a: any) => s + (a.feeCents || 0), 0);
  const acaSales = (acad?.academies || []).reduce((s: number, a: any) => s + (a.sales || 0), 0);
  const acaGross = (acad?.academies || []).reduce((s: number, a: any) => s + (a.grossCents || 0), 0);
  const bal = acad?.platform?.balance;

  // Color por métrica: verde = sano; ámbar = comisión; el P&L se pinta según su signo.
  const GREEN = 'var(--soft-green, var(--green))'; const GOLD = 'var(--gold)'; const RED = 'var(--red)'; const BRAND = 'var(--brand)';
  const netVal = fin?.thisMonth?.net;
  const cards: { key: View; show: boolean; ic: string; title: string; big: string; sub: string; color: string }[] = [
    { key: 'onyx', show: showIngresos, ic: 'card', title: L('Suscripciones Onyx', 'Onyx subscriptions'), big: rev ? $(rev.mrr) : '—', sub: rev ? `${rev.activeSubs} ${L('activas', 'active')} · ${L('churn', 'churn')} ${rev.churnPct}%` : L('MRR', 'MRR'), color: rev ? ((rev.churnPct ?? 0) > 8 ? GOLD : GREEN) : BRAND },
    { key: 'academia', show: showAcademia, ic: 'graduation', title: L('Academia (comisión)', 'Academy (commission)'), big: acad ? $c(acaFee) : '—', sub: acad ? `${acaSales} ${L('ventas', 'sales')} · vol. ${$c(acaGross)}` : L('comisión', 'commission'), color: GOLD },
    { key: 'negocio', show: showFinanzas, ic: 'finance', title: L('Negocio (P&L)', 'Business (P&L)'), big: fin?.thisMonth ? $(netVal) : '—', sub: L('ingresos − gastos', 'income − expenses'), color: netVal == null ? BRAND : (netVal >= 0 ? GREEN : RED) },
  ];
  const visible = cards.filter((c) => c.show);

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {/* Reconciliación: lo que Stripe realmente tiene vs lo que dice el libro */}
      {bal && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, padding: '10px 14px' }}>
          <span style={{ fontSize: 13, color: 'var(--mut)', display: 'flex', alignItems: 'center', gap: 8 }}><OnyxIcon name="guardian" size={15} /> {L('Reconciliación (Stripe vs libro)', 'Reconciliation (Stripe vs ledger)')}</span>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12.5 }}>
            <span className="muted">{L('Stripe disponible', 'Stripe available')} <b style={{ color: 'var(--tx)' }}>{$c(bal.available)}</b> · {L('pendiente', 'pending')} <b style={{ color: 'var(--tx)' }}>{$c(bal.pending)}</b></span>
            <span className="muted">{L('Comisión en libro', 'Ledger commission')} <b style={{ color: 'var(--tx)' }}>{$c(acaFee)}</b></span>
          </div>
        </div>
      )}

      {/* Tarjetas = resumen + selector */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12 }}>
        {visible.map((c) => {
          const on = view === c.key;
          return (
            <button key={c.key} onClick={() => setView(c.key)} className="card" style={{
              textAlign: 'left', cursor: 'pointer', padding: '14px 16px', transition: 'box-shadow .18s, border-color .18s, transform .12s',
              border: `1.5px solid ${on ? c.color : 'var(--line)'}`,
              background: on ? `color-mix(in srgb,${c.color} 10%,var(--card))` : 'var(--card)',
              boxShadow: on ? `0 0 0 1px ${c.color}, 0 0 18px color-mix(in srgb,${c.color} 45%,transparent)` : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: c.color }}><span style={{ color: c.color, display: 'inline-flex' }}><OnyxIcon name={c.ic as any} size={16} glow={on} /></span> {c.title}</div>
              <div style={{ fontSize: 24, fontWeight: 800, margin: '6px 0 2px', color: c.color, textShadow: on ? `0 0 12px color-mix(in srgb,${c.color} 55%,transparent)` : 'none' }}>{c.big}</div>
              <div className="muted" style={{ fontSize: 12 }}>{c.sub}</div>
            </button>
          );
        })}
      </div>

      {/* Reporte de la vista activa */}
      <div>
        {view === 'onyx' && showIngresos && <Revenue />}
        {view === 'academia' && showAcademia && <AcademyAdmin canManage={canManageAcademy} />}
        {view === 'negocio' && showFinanzas && <Finanzas canManage={canManageFinanzas} />}
      </div>
    </div>
  );
}
