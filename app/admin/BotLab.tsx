'use client';
import { useEffect, useMemo, useState } from 'react';
import { toast, toastErr } from '@/lib/toast';
import { useLang } from '@/lib/lang';

// ============================================================
// Panel admin de Onyx Bot Lab — centro de mando visual.
// Aprobar robots, atender leads, confirmar USDT, pagar creadores,
// chat traducido y ajustes. Tarjetas de colores, iluminado y robusto.
// ============================================================
function money(cents: number) { return '$' + ((cents || 0) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 }); }
const GOLD = 'var(--gold, #ffd45e)';
const VIOLET = '#a06bff';
const CYAN = '#38d9ff';

// Iconos de línea (modernos, sin dependencias).
function Ic({ n, s = 18, c = 'currentColor' }: { n: string; s?: number; c?: string }) {
  const p: Record<string, any> = {
    bot: <><rect x="4" y="8" width="16" height="11" rx="3" /><path d="M12 8V4M9 4h6M8.5 13h.01M15.5 13h.01" /></>,
    clock: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></>,
    spark: <path d="M13 2 4 14h7l-1 8 9-12h-7z" />,
    coin: <><ellipse cx="12" cy="7" rx="7" ry="3" /><path d="M5 7v6c0 1.7 3.1 3 7 3s7-1.3 7-3V7M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" /></>,
    users: <><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3 3-5 6-5s6 2 6 5M16 6a3 3 0 0 1 0 6M21 20c0-2-1.5-3.5-3.5-4.3" /></>,
    inbox: <><path d="M4 13h4l1.5 3h5L16 13h4" /><path d="M4 13 6 5h12l2 8v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /></>,
    card: <><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18" /></>,
    chat: <path d="M4 5h16v11H9l-4 3v-3H4z" />,
    cog: <><circle cx="12" cy="12" r="3" /><path d="M12 3v3M12 18v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M3 12h3M18 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></>,
    chart: <path d="M4 20V10M10 20V4M16 20v-7M4 20h16" />,
    check: <path d="M4 12l5 5 11-11" />,
    x: <path d="M6 6l12 12M18 6 6 18" />,
    grid: <><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="8" rx="1.5" /><rect x="3" y="13" width="8" height="8" rx="1.5" /><rect x="13" y="13" width="8" height="8" rx="1.5" /></>,
    bell: <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6M10 20a2 2 0 0 0 4 0" />,
  };
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{p[n] || null}</svg>;
}

export default function BotLab({ canManage = true }: { canManage?: boolean }) {
  const { lang } = useLang(); const es = lang === 'es';
  const [d, setD] = useState<any>(null);
  const [set, setSet] = useState<any>(null);
  const [sub, setSub] = useState<'resumen' | 'marketplace' | 'servicios' | 'pagos' | 'creadores' | 'chat' | 'ajustes'>('resumen');

  async function load() { try { const r = await fetch('/api/admin/botlab'); const j = await r.json(); setD(j); setSet(j.settings); } catch {} }
  useEffect(() => { load(); }, []);

  async function act(body: any, ok?: string) {
    try { const r = await fetch('/api/admin/botlab', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const j = await r.json(); if (!r.ok) throw new Error(j.error); if (ok) toast(ok); load(); return j; } catch (e: any) { toastErr(e?.message || 'error'); }
  }

  if (!d) return <div className="muted" style={{ padding: 20 }}>{es ? 'Cargando…' : 'Loading…'}</div>;
  const stat = d.stats || {};
  const crypto = d.crypto || [];
  const leads = d.leads || [];
  const payouts = d.payouts || [];
  const pend = (d.products || []).filter((p: any) => p.status === 'pending');
  const pendingPayouts = payouts.filter((p: any) => p.status !== 'paid');

  const tabs: [any, string, string, number][] = [
    ['resumen', es ? 'Resumen' : 'Overview', 'grid', 0],
    ['marketplace', es ? 'Marketplace' : 'Marketplace', 'bot', pend.length],
    ['servicios', es ? 'Servicios / Leads' : 'Services / Leads', 'inbox', stat.newLeads || 0],
    ['pagos', es ? 'Pagos USDT' : 'USDT payments', 'coin', crypto.length],
    ['creadores', es ? 'Creadores' : 'Creators', 'users', pendingPayouts.length],
    ['chat', es ? 'Chat' : 'Chat', 'chat', 0],
    ['ajustes', es ? 'Ajustes' : 'Settings', 'cog', 0],
  ];

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {/* KPI strip iluminado */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12 }}>
        <StatCard label={es ? 'Robots activos' : 'Active robots'} value={stat.activeProducts || 0} sub={es ? `${stat.pendingProducts || 0} por revisar` : `${stat.pendingProducts || 0} to review`} color="var(--brand)" icon={<Ic n="bot" c="var(--brand)" />} onClick={() => setSub('marketplace')} />
        <StatCard label={es ? 'Ventas brutas' : 'Gross sales'} value={money(stat.grossCents || 0)} sub={es ? `${stat.salesCount || 0} ventas` : `${stat.salesCount || 0} sales`} color={GOLD} icon={<Ic n="chart" c={GOLD} />} />
        <StatCard label={es ? 'Comisión Onyx' : 'Onyx commission'} value={money(stat.commissionCents || 0)} sub={es ? 'ingreso de la plataforma' : 'platform revenue'} color="var(--green)" icon={<Ic n="coin" c="var(--green)" />} />
        <StatCard label={es ? 'Licencias activas' : 'Active licenses'} value={stat.activeLicenses || 0} sub={es ? `${stat.creatorsCount || 0} creadores` : `${stat.creatorsCount || 0} creators`} color={VIOLET} icon={<Ic n="users" c={VIOLET} />} />
        <StatCard label={es ? 'Leads nuevos' : 'New leads'} value={stat.newLeads || 0} sub={es ? `${stat.totalLeads || 0} en total` : `${stat.totalLeads || 0} total`} color={CYAN} icon={<Ic n="inbox" c={CYAN} />} onClick={() => setSub('servicios')} />
        <StatCard label={es ? 'USDT por confirmar' : 'USDT to confirm'} value={crypto.length} sub={es ? `${money(stat.pendingPayoutsCents || 0)} en retiros` : `${money(stat.pendingPayoutsCents || 0)} in payouts`} color="var(--amber)" icon={<Ic n="card" c="var(--amber)" />} onClick={() => setSub('pagos')} />
      </div>

      {/* Sub-pestañas con iconos y badges */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {tabs.map(([k, lbl, ic, n]) => {
          const on = sub === k;
          return (
            <button key={k} onClick={() => setSub(k)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: 12, fontSize: 13.5, fontWeight: 700, cursor: 'pointer', border: '1px solid ' + (on ? 'var(--brand)' : 'var(--line)'), background: on ? 'linear-gradient(135deg,color-mix(in srgb,var(--brand) 22%,transparent),transparent)' : 'var(--card)', color: on ? 'var(--brand)' : 'var(--tx)', boxShadow: on ? '0 0 0 1px color-mix(in srgb,var(--brand) 30%,transparent)' : 'none' }}>
              <Ic n={ic} s={16} c={on ? 'var(--brand)' : 'var(--mut)'} /> {lbl}
              {n > 0 && <span style={{ background: on ? 'var(--brand)' : 'var(--red)', color: '#0b1020', fontSize: 10.5, fontWeight: 800, borderRadius: 99, padding: '1px 7px', minWidth: 18, textAlign: 'center' }}>{n}</span>}
            </button>
          );
        })}
      </div>

      {sub === 'resumen' && <Overview es={es} d={d} stat={stat} crypto={crypto} pend={pend} leads={leads} pendingPayouts={pendingPayouts} go={setSub} />}
      {sub === 'marketplace' && <Marketplace es={es} d={d} canManage={canManage} act={act} />}
      {sub === 'servicios' && <Leads es={es} leads={leads} stat={stat} canManage={canManage} act={act} />}
      {sub === 'pagos' && <CryptoPayments es={es} crypto={crypto} canManage={canManage} act={act} />}
      {sub === 'creadores' && <Payouts es={es} payouts={payouts} canManage={canManage} act={act} />}
      {sub === 'chat' && <ChatInbox es={es} canManage={canManage} />}
      {sub === 'ajustes' && set && <Settings es={es} set={set} setSet={setSet} canManage={canManage} act={act} />}
    </div>
  );
}

// ---------- primitivas de UI ----------
const card: any = { background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16, padding: 18 };
function btn(c: string): any { return { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 9, cursor: 'pointer', fontWeight: 800, fontSize: 12.5, border: `1px solid color-mix(in srgb,${c} 40%,transparent)`, background: `color-mix(in srgb,${c} 12%,transparent)`, color: c }; }

function StatCard({ label, value, sub, color, icon, onClick }: any) {
  const Tag: any = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick} style={{ position: 'relative', overflow: 'hidden', textAlign: 'left', cursor: onClick ? 'pointer' : 'default', border: `1px solid color-mix(in srgb,${color} 32%,var(--line))`, borderRadius: 16, padding: '15px 16px', background: `linear-gradient(140deg, color-mix(in srgb,${color} 13%,var(--card)), var(--card) 70%)`, color: 'var(--tx)', width: '100%' }}>
      <div style={{ position: 'absolute', top: -34, right: -30, width: 100, height: 100, borderRadius: '50%', background: color, filter: 'blur(42px)', opacity: 0.22 }} />
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 9 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 10, background: `color-mix(in srgb,${color} 16%,transparent)`, border: `1px solid color-mix(in srgb,${color} 30%,transparent)` }}>{icon}</span>
        <span className="muted" style={{ fontSize: 12.5, fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ position: 'relative', fontSize: 27, fontWeight: 800, color, marginTop: 8, lineHeight: 1 }}>{value}</div>
      {sub && <div className="muted" style={{ position: 'relative', fontSize: 11.5, marginTop: 4 }}>{sub}</div>}
    </Tag>
  );
}

function SectionHead({ icon, color, title, desc, right }: any) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: 12, flex: 'none', background: `color-mix(in srgb,${color} 15%,transparent)`, border: `1px solid color-mix(in srgb,${color} 32%,transparent)` }}><Ic n={icon} s={20} c={color} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h3 style={{ margin: 0, fontSize: 17 }}>{title}</h3>
        {desc && <p className="muted" style={{ fontSize: 12.5, margin: '3px 0 0' }}>{desc}</p>}
      </div>
      {right}
    </div>
  );
}

// ---------- Resumen ----------
function Overview({ es, d, stat, crypto, pend, leads, pendingPayouts, go }: any) {
  const attn = [
    { k: 'marketplace', n: pend.length, color: 'var(--amber)', icon: 'bot', label: es ? 'Robots por revisar' : 'Robots to review', cta: es ? 'Revisar ahora' : 'Review now' },
    { k: 'pagos', n: crypto.length, color: GOLD, icon: 'coin', label: es ? 'Pagos USDT por confirmar' : 'USDT payments to confirm', cta: es ? 'Confirmar' : 'Confirm' },
    { k: 'servicios', n: stat.newLeads || 0, color: CYAN, icon: 'inbox', label: es ? 'Leads sin atender' : 'Unattended leads', cta: es ? 'Atender' : 'Handle' },
    { k: 'creadores', n: pendingPayouts.length, color: VIOLET, icon: 'users', label: es ? 'Retiros por pagar' : 'Payouts to pay', cta: es ? 'Pagar' : 'Pay' },
  ].filter((a) => a.n > 0);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={card}>
        <SectionHead icon="bell" color="var(--brand)" title={es ? 'Necesita tu atención' : 'Needs your attention'} desc={es ? 'Lo pendiente, ordenado por urgencia. Toca para ir directo.' : 'Everything pending, by urgency. Tap to jump.'} />
        {!attn.length ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 16, borderRadius: 12, background: 'color-mix(in srgb,var(--green) 10%,transparent)', border: '1px solid color-mix(in srgb,var(--green) 30%,transparent)', color: 'var(--green)', fontWeight: 700, fontSize: 14 }}>
            <Ic n="check" c="var(--green)" /> {es ? 'Todo al día. No hay nada pendiente.' : 'All caught up. Nothing pending.'}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
            {attn.map((a) => (
              <button key={a.k} onClick={() => go(a.k)} style={{ position: 'relative', overflow: 'hidden', textAlign: 'left', cursor: 'pointer', padding: 16, borderRadius: 14, border: `1px solid color-mix(in srgb,${a.color} 40%,var(--line))`, background: `linear-gradient(140deg,color-mix(in srgb,${a.color} 15%,var(--bg2)),var(--bg2))`, color: 'var(--tx)' }}>
                <div style={{ position: 'absolute', top: -26, right: -22, width: 80, height: 80, borderRadius: '50%', background: a.color, filter: 'blur(36px)', opacity: 0.28 }} />
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Ic n={a.icon} s={18} c={a.color} /><span className="muted" style={{ fontSize: 12.5, fontWeight: 600 }}>{a.label}</span>
                </div>
                <div style={{ position: 'relative', fontSize: 30, fontWeight: 800, color: a.color, margin: '8px 0 4px' }}>{a.n}</div>
                <div style={{ position: 'relative', fontSize: 12.5, fontWeight: 800, color: a.color }}>{a.cta} →</div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={card}>
        <SectionHead icon="chart" color="var(--green)" title={es ? 'Salud del negocio' : 'Business health'} desc={es ? 'Cifras acumuladas del marketplace.' : 'Cumulative marketplace figures.'} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12 }}>
          {([
            [es ? 'Ventas brutas' : 'Gross sales', money(stat.grossCents || 0), GOLD],
            [es ? 'Comisión Onyx' : 'Onyx commission', money(stat.commissionCents || 0), 'var(--green)'],
            [es ? 'Pagado a creadores' : 'Paid to creators', money((stat.grossCents || 0) - (stat.commissionCents || 0)), VIOLET],
            [es ? 'Robots activos' : 'Active robots', stat.activeProducts || 0, 'var(--brand)'],
            [es ? 'Licencias activas' : 'Active licenses', stat.activeLicenses || 0, CYAN],
            [es ? 'Creadores' : 'Creators', stat.creatorsCount || 0, 'var(--amber)'],
          ] as [string, any, string][]).map(([l, v, c], i) => (
            <div key={i} style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--bg2)', borderLeft: `3px solid ${c}` }}>
              <div className="muted" style={{ fontSize: 11.5 }}>{l}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: c, marginTop: 3 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------- Marketplace (revisión + publicados) ----------
function Marketplace({ es, d, canManage, act }: any) {
  const [f, setF] = useState<'pending' | 'active' | 'rejected'>('pending');
  const products = (d.products || []) as any[];
  const counts = { pending: products.filter((p) => p.status === 'pending').length, active: products.filter((p) => p.status === 'active').length, rejected: products.filter((p) => p.status === 'rejected').length };
  const list = products.filter((p) => p.status === f);
  const filters: [any, string, string][] = [
    ['pending', es ? 'Por revisar' : 'To review', 'var(--amber)'],
    ['active', es ? 'Publicados' : 'Published', 'var(--green)'],
    ['rejected', es ? 'Rechazados' : 'Rejected', 'var(--red)'],
  ];
  return (
    <div style={card}>
      <SectionHead icon="bot" color="var(--brand)" title={es ? 'Marketplace de robots' : 'Robot marketplace'} desc={es ? 'Aprueba con operaciones reales medidas por la plataforma.' : 'Approve using real trades measured by the platform.'} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {filters.map(([k, lbl, c]) => {
          const on = f === k;
          return <button key={k} onClick={() => setF(k)} style={{ padding: '7px 13px', borderRadius: 99, fontSize: 12.5, fontWeight: 800, cursor: 'pointer', border: `1px solid ${on ? c : 'var(--line)'}`, background: on ? `color-mix(in srgb,${c} 16%,transparent)` : 'transparent', color: on ? c : 'var(--tx)' }}>{lbl} · {(counts as any)[k]}</button>;
        })}
      </div>
      {f === 'pending' && !!list.length && (
        <div style={{ fontSize: 12, color: 'var(--mut)', background: 'var(--bg2)', borderRadius: 10, padding: 11, marginBottom: 14, borderLeft: '3px solid var(--amber)' }}>
          {es ? 'Aprueba solo si: la estrategia está descrita, hay historial real, es honesto (sin “ganancias garantizadas”), muestra riesgo/drawdown, y no es copia ni spam.' : 'Approve only if: strategy described, real history, honest (no “guaranteed profits”), shows risk/drawdown, and it is not a copy or spam.'}
        </div>
      )}
      {!list.length && <div className="muted" style={{ fontSize: 13, padding: '8px 0' }}>{es ? 'Nada aquí.' : 'Nothing here.'}</div>}
      <div style={{ display: 'grid', gap: 12 }}>
        {f === 'pending'
          ? list.map((p) => <ReviewCard key={p.id} p={p} es={es} canManage={canManage} act={act} />)
          : list.map((p) => <ProductRow key={p.id} p={p} es={es} canManage={canManage} act={act} />)}
      </div>
    </div>
  );
}

// Fila compacta para robots ya publicados/rechazados.
function ProductRow({ p, es, canManage, act }: any) {
  const active = p.status === 'active';
  const c = active ? 'var(--green)' : 'var(--red)';
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', padding: 13, borderRadius: 13, border: `1px solid color-mix(in srgb,${c} 28%,var(--line))`, background: `linear-gradient(140deg,color-mix(in srgb,${c} 7%,transparent),transparent 60%)` }}>
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <b style={{ fontSize: 14.5 }}>{p.name}</b>
          <span style={{ fontWeight: 800, color: GOLD }}>{money(p.price_cents)}</span>
          {p.verified && <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--brand)', display: 'inline-flex', alignItems: 'center', gap: 3 }}><Ic n="check" s={12} c="var(--brand)" />{es ? 'Verificado' : 'Verified'}</span>}
          {p.is_official && <span style={{ fontSize: 10.5, fontWeight: 800, color: GOLD }}>★ {es ? 'Oficial' : 'Official'}</span>}
        </div>
        <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{es ? 'por' : 'by'} {p.seller_name}{p.perf?.score ? ` · score ${p.perf.score}` : ''}{p.perf?.trades ? ` · ${p.perf.trades} ${es ? 'ops' : 'trades'}` : ''}</div>
      </div>
      {canManage && active && (
        <>
          <button onClick={() => act({ action: 'product_status', id: p.id, status: 'active', verified: !p.verified }, es ? 'Actualizado' : 'Updated')} style={btn(p.verified ? 'var(--mut)' : 'var(--brand)')}>{p.verified ? (es ? 'Quitar verificado' : 'Unverify') : (es ? 'Verificar' : 'Verify')}</button>
          <button onClick={() => act({ action: 'product_status', id: p.id, status: 'pending' }, es ? 'Regresado a revisión' : 'Sent to review')} style={btn('var(--amber)')}>{es ? 'Despublicar' : 'Unpublish'}</button>
        </>
      )}
      {canManage && !active && (
        <button onClick={() => act({ action: 'product_status', id: p.id, status: 'pending' }, es ? 'Reabierto' : 'Reopened')} style={btn('var(--brand)')}>{es ? 'Reabrir' : 'Reopen'}</button>
      )}
    </div>
  );
}

// ---------- Leads / Servicios ----------
const LEAD_STATES: [string, string, string, string][] = [
  // key, es, en, color
  ['new', 'Nuevo', 'New', 'var(--amber)'],
  ['contacted', 'Contactado', 'Contacted', CYAN],
  ['in_progress', 'En proceso', 'In progress', 'var(--brand)'],
  ['won', 'Ganado', 'Won', 'var(--green)'],
  ['lost', 'Perdido', 'Lost', 'var(--red)'],
];
function leadColor(s: string) { return (LEAD_STATES.find((x) => x[0] === s) || LEAD_STATES[0])[3]; }

function Leads({ es, leads, stat, canManage, act }: any) {
  const [q, setQ] = useState('');
  const [f, setF] = useState<string>('all');
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (leads as any[]).filter((l) => (f === 'all' || l.status === f) && (!t || [l.name, l.email, l.service, l.platform, l.message].some((x) => String(x || '').toLowerCase().includes(t))));
  }, [leads, q, f]);
  const counts: Record<string, number> = { all: leads.length };
  LEAD_STATES.forEach(([k]) => { counts[k] = (leads as any[]).filter((l) => l.status === k).length; });

  return (
    <div style={card}>
      <SectionHead icon="inbox" color={CYAN} title={es ? 'Servicios y leads' : 'Services & leads'} desc={es ? 'Propuestas high-ticket: instalación, automatización a medida, Elite.' : 'High-ticket proposals: install, bespoke automation, Elite.'}
        right={<input value={q} onChange={(e) => setQ(e.target.value)} placeholder={es ? 'Buscar…' : 'Search…'} style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--tx)', fontSize: 13, minWidth: 150 }} />} />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {(['all', ...LEAD_STATES.map((s) => s[0])]).map((k) => {
          const on = f === k;
          const c = k === 'all' ? 'var(--brand)' : leadColor(k);
          const lbl = k === 'all' ? (es ? 'Todos' : 'All') : (() => { const s = LEAD_STATES.find((x) => x[0] === k)!; return es ? s[1] : s[2]; })();
          return <button key={k} onClick={() => setF(k)} style={{ padding: '6px 12px', borderRadius: 99, fontSize: 12.5, fontWeight: 800, cursor: 'pointer', border: `1px solid ${on ? c : 'var(--line)'}`, background: on ? `color-mix(in srgb,${c} 16%,transparent)` : 'transparent', color: on ? c : 'var(--tx)' }}>{lbl} · {counts[k] || 0}</button>;
        })}
      </div>

      {!filtered.length && <div className="muted" style={{ fontSize: 13, padding: '8px 0' }}>{es ? 'Sin resultados.' : 'No results.'}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 12 }}>
        {filtered.slice(0, 60).map((l: any) => <LeadCard key={l.id} l={l} es={es} canManage={canManage} act={act} />)}
      </div>
    </div>
  );
}

function LeadCard({ l, es, canManage, act }: any) {
  const c = leadColor(l.status);
  const when = l.created_at ? new Date(l.created_at).toLocaleDateString(es ? 'es' : 'en', { day: '2-digit', month: 'short' }) : '';
  const stLabel = (() => { const s = LEAD_STATES.find((x) => x[0] === l.status) || LEAD_STATES[0]; return es ? s[1] : s[2]; })();
  return (
    <div style={{ position: 'relative', overflow: 'hidden', padding: 15, borderRadius: 14, border: `1px solid color-mix(in srgb,${c} 30%,var(--line))`, background: `linear-gradient(150deg,color-mix(in srgb,${c} 8%,var(--bg2)),var(--bg2))` }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: c }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 10.5, fontWeight: 800, padding: '3px 9px', borderRadius: 99, background: 'color-mix(in srgb,var(--brand) 15%,transparent)', color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '.03em' }}>{l.service || (es ? 'servicio' : 'service')}</span>
        <span style={{ marginLeft: 'auto', fontSize: 10.5, fontWeight: 800, padding: '3px 9px', borderRadius: 99, background: `color-mix(in srgb,${c} 18%,transparent)`, color: c }}>{stLabel}</span>
      </div>
      <div style={{ fontSize: 15, fontWeight: 800 }}>{l.name || l.email || (es ? 'Lead' : 'Lead')}</div>
      <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
        {[l.email, l.platform, l.budget && `💰 ${l.budget}`, when].filter(Boolean).join(' · ')}
      </div>
      {l.message && <div style={{ fontSize: 13, marginTop: 9, color: 'var(--tx)', background: 'var(--card)', borderRadius: 10, padding: '9px 11px', maxHeight: 120, overflow: 'auto' }}>{l.message}</div>}
      {canManage && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 11 }}>
          {LEAD_STATES.map(([k, e2, en, kc]) => (
            <button key={k} onClick={() => act({ action: 'lead_status', id: l.id, status: k }, es ? 'Estado actualizado' : 'Status updated')} disabled={l.status === k} style={{ padding: '5px 9px', borderRadius: 8, fontSize: 11.5, fontWeight: 800, cursor: l.status === k ? 'default' : 'pointer', border: `1px solid color-mix(in srgb,${kc} ${l.status === k ? 60 : 25}%,var(--line))`, background: l.status === k ? kc : 'transparent', color: l.status === k ? '#0b1020' : kc, opacity: l.status === k ? 1 : 0.85 }}>{es ? e2 : en}</button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Pagos USDT ----------
function CryptoPayments({ es, crypto, canManage, act }: any) {
  return (
    <div style={card}>
      <SectionHead icon="coin" color={GOLD} title={es ? 'Pagos USDT por confirmar' : 'USDT payments to confirm'} desc={es ? 'Con la wallet on-chain se confirman solos; aquí están los que faltan.' : 'On-chain they confirm automatically; here are the rest.'} />
      {!crypto.length && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 16, borderRadius: 12, background: 'color-mix(in srgb,var(--green) 10%,transparent)', border: '1px solid color-mix(in srgb,var(--green) 30%,transparent)', color: 'var(--green)', fontWeight: 700, fontSize: 14 }}>
          <Ic n="check" c="var(--green)" /> {es ? 'Sin pagos pendientes.' : 'No pending payments.'}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 12 }}>
        {(crypto as any[]).map((c: any) => (
          <div key={c.id} style={{ position: 'relative', overflow: 'hidden', padding: 15, borderRadius: 14, border: `1px solid color-mix(in srgb,${GOLD} 32%,var(--line))`, background: `linear-gradient(150deg,color-mix(in srgb,${GOLD} 10%,var(--bg2)),var(--bg2))` }}>
            <div style={{ position: 'absolute', top: -26, right: -22, width: 80, height: 80, borderRadius: '50%', background: GOLD, filter: 'blur(36px)', opacity: 0.22 }} />
            <div style={{ position: 'relative', display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: GOLD }}>${c.amount_usd}</span>
              <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>USDT{c.network ? ` · ${String(c.network).toUpperCase()}` : ''}</span>
            </div>
            <div className="muted" style={{ position: 'relative', fontSize: 12, marginTop: 4 }}>{c.buyer} · {c.purpose}</div>
            <div className="muted" style={{ position: 'relative', fontSize: 11, fontFamily: 'monospace', wordBreak: 'break-all', marginTop: 6, background: 'var(--card)', borderRadius: 8, padding: '6px 8px' }}>{c.txid || (es ? '(sin hash aún)' : '(no hash yet)')}</div>
            {canManage && (
              <div style={{ position: 'relative', display: 'flex', gap: 8, marginTop: 11 }}>
                <button onClick={() => act({ action: 'crypto_confirm', id: c.id }, es ? 'Confirmado' : 'Confirmed')} style={btn('var(--green)')}><Ic n="check" s={14} c="var(--green)" />{es ? 'Confirmar' : 'Confirm'}</button>
                <button onClick={() => act({ action: 'crypto_reject', id: c.id })} style={btn('var(--red)')}><Ic n="x" s={14} c="var(--red)" />{es ? 'Rechazar' : 'Reject'}</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Creadores / Payouts ----------
function Payouts({ es, payouts, canManage, act }: any) {
  const pend = (payouts as any[]).filter((p) => p.status !== 'paid');
  const paid = (payouts as any[]).filter((p) => p.status === 'paid');
  const row = (p: any) => {
    const done = p.status === 'paid';
    const c = done ? 'var(--green)' : 'var(--amber)';
    return (
      <div key={p.id} style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', padding: 13, borderRadius: 13, border: `1px solid color-mix(in srgb,${c} 26%,var(--line))`, background: `linear-gradient(140deg,color-mix(in srgb,${c} 7%,transparent),transparent 60%)` }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 10, background: `color-mix(in srgb,${c} 15%,transparent)` }}><Ic n="coin" s={17} c={c} /></span>
        <div style={{ flex: 1, minWidth: 150 }}>
          <b style={{ fontSize: 15 }}>{money(p.amount_cents)}</b>
          <div className="muted" style={{ fontSize: 12, marginTop: 1 }}>{String(p.method || '').toUpperCase()}{p.destination ? ` · ${p.destination}` : ''}</div>
        </div>
        <span style={{ fontSize: 11.5, fontWeight: 800, padding: '3px 10px', borderRadius: 99, background: `color-mix(in srgb,${c} 16%,transparent)`, color: c }}>{done ? (es ? 'Pagado' : 'Paid') : (es ? 'Pendiente' : 'Pending')}</span>
        {canManage && !done && <button onClick={() => act({ action: 'payout_paid', id: p.id }, es ? 'Marcado pagado' : 'Marked paid')} style={btn('var(--green)')}><Ic n="check" s={14} c="var(--green)" />{es ? 'Marcar pagado' : 'Mark paid'}</button>}
      </div>
    );
  };
  return (
    <div style={card}>
      <SectionHead icon="users" color={VIOLET} title={es ? 'Pagos a creadores' : 'Creator payouts'} desc={es ? 'Retiros solicitados por los creadores de robots.' : 'Withdrawals requested by robot creators.'} />
      {!payouts.length && <div className="muted" style={{ fontSize: 13 }}>{es ? 'Sin retiros.' : 'No payouts.'}</div>}
      {!!pend.length && <>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--amber)', margin: '2px 0 8px' }}>{es ? 'Pendientes' : 'Pending'} · {pend.length}</div>
        <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>{pend.map(row)}</div>
      </>}
      {!!paid.length && <>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--green)', margin: '2px 0 8px' }}>{es ? 'Pagados' : 'Paid'} · {paid.length}</div>
        <div style={{ display: 'grid', gap: 8 }}>{paid.slice(0, 20).map(row)}</div>
      </>}
    </div>
  );
}

// ---------- Ajustes ----------
function Settings({ es, set, setSet, canManage, act }: any) {
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={card}>
        <SectionHead icon="coin" color="var(--green)" title={es ? 'Comisión y cobros' : 'Commission & payouts'} desc={es ? 'Qué se queda Onyx y a qué wallets llega el USDT.' : 'What Onyx keeps and where USDT lands.'} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
          <Field label={es ? 'Comisión Onyx (%)' : 'Onyx fee (%)'} value={set.fee_pct} onChange={(v: any) => setSet({ ...set, fee_pct: v })} />
          <Field label={es ? 'Wallet USDT · Ethereum (0x…)' : 'USDT wallet · Ethereum (0x…)'} value={set.usdt_erc20} onChange={(v: any) => setSet({ ...set, usdt_erc20: v })} wide />
          <Field label={es ? 'Wallet USDT · TRON (T…)' : 'USDT wallet · TRON (T…)'} value={set.usdt_trc20} onChange={(v: any) => setSet({ ...set, usdt_trc20: v })} wide />
        </div>
        <p className="muted" style={{ fontSize: 11.5, marginTop: 10 }}>{es ? 'Pon una o ambas wallets; el cliente elige la red al pagar. Con ETHERSCAN_API_KEY (Ethereum) y/o la wallet TRON, los pagos se confirman SOLOS on-chain (cada 3 min). Sin eso, se confirman a mano en Pagos USDT.' : 'Set one or both wallets; the buyer picks the network at checkout. With ETHERSCAN_API_KEY (Ethereum) and/or the TRON wallet, payments confirm AUTOMATICALLY on-chain (every 3 min). Otherwise confirm them manually under USDT payments.'}</p>
      </div>

      <div style={card}>
        <SectionHead icon="spark" color={GOLD} title={es ? 'Servicios high-ticket' : 'High-ticket services'} desc={es ? 'Precios de referencia que ve el cliente.' : 'Reference prices shown to clients.'} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12 }}>
          <Field label={es ? 'A medida desde ($)' : 'Bespoke from ($)'} value={set.service_automate_from} onChange={(v: any) => setSet({ ...set, service_automate_from: v })} />
          <Field label={es ? 'Instalación ($)' : 'Install ($)'} value={set.service_install_price} onChange={(v: any) => setSet({ ...set, service_install_price: v })} />
          <Field label={es ? 'Elite desde ($)' : 'Elite from ($)'} value={set.service_elite_from} onChange={(v: any) => setSet({ ...set, service_elite_from: v })} />
        </div>
      </div>

      <div style={card}>
        <SectionHead icon="bell" color={CYAN} title={es ? 'Avisos' : 'Alerts'} desc={es ? 'A dónde llegan las propuestas y pagos nuevos.' : 'Where new proposals and payments land.'} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
          <Field label={es ? 'Correo de avisos (propuestas)' : 'Notify email (leads)'} value={set.notify_email} onChange={(v: any) => setSet({ ...set, notify_email: v })} wide />
          <Field label={es ? 'Chat de Telegram para avisos' : 'Telegram chat for alerts'} value={set.telegram_chat} onChange={(v: any) => setSet({ ...set, telegram_chat: v })} />
        </div>
      </div>

      {canManage && (
        <div>
          <button onClick={() => act({ action: 'settings', ...set }, es ? 'Ajustes guardados' : 'Settings saved')} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '11px 20px', borderRadius: 12, border: 'none', fontWeight: 800, fontSize: 14, cursor: 'pointer', background: 'linear-gradient(135deg,var(--brand),' + VIOLET + ')', color: '#0b1020' }}><Ic n="check" s={16} c="#0b1020" />{es ? 'Guardar cambios' : 'Save changes'}</button>
        </div>
      )}
    </div>
  );
}

// ---------- Score gauge + ReviewCard (revisión con operaciones reales) ----------
function ScoreGauge({ score, color }: { score: number; color: string }) {
  const r = 34, c = 2 * Math.PI * r, off = c * (1 - Math.max(0, Math.min(100, score)) / 100);
  return (
    <div style={{ position: 'relative', width: 88, height: 88, flex: 'none' }}>
      <svg width="88" height="88" viewBox="0 0 88 88" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="44" cy="44" r={r} fill="none" stroke="var(--line)" strokeWidth="8" />
        <circle cx="44" cy="44" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} style={{ filter: `drop-shadow(0 0 6px ${color})`, transition: 'stroke-dashoffset .6s' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 24, fontWeight: 800, color, lineHeight: 1 }}>{score}</span>
        <span className="muted" style={{ fontSize: 9, letterSpacing: '.06em' }}>SCORE</span>
      </div>
    </div>
  );
}

function ReviewCard({ p, es, canManage, act }: any) {
  const [reason, setReason] = useState('');
  const [open, setOpen] = useState(false);
  const money2 = (cc: number) => '$' + ((cc || 0) / 100).toLocaleString('en-US');
  const meta = [p.platform && p.platform !== 'any' ? String(p.platform).toUpperCase() : null, p.kind === 'subscription' ? (es ? 'renta ' + (p.interval === 'year' ? 'anual' : 'mensual') : 'rental') : (es ? 'pago único' : 'one-time'), p.category].filter(Boolean).join(' · ');
  const s = p._score || { hasData: false, score: 0, verdict: 'review', flags: [], parts: [] };
  const color = !s.hasData ? 'var(--mut)' : s.verdict === 'approve' ? 'var(--green)' : s.verdict === 'review' ? 'var(--amber)' : 'var(--red)';
  const verdictTx = !s.hasData ? (es ? 'Sin datos reales' : 'No real data') : s.verdict === 'approve' ? (es ? 'Recomendado aprobar' : 'Recommended approve') : s.verdict === 'review' ? (es ? 'Revisar a fondo' : 'Review closely') : (es ? 'No recomendado' : 'Not recommended');
  const kpi = (k: string, v: any, c?: string) => (
    <div style={{ background: 'var(--bg2)', borderRadius: 9, padding: '7px 9px', textAlign: 'center', minWidth: 62 }}>
      <div style={{ fontSize: 14.5, fontWeight: 800, color: c || 'var(--tx)' }}>{v}</div>
      <div className="muted" style={{ fontSize: 10 }}>{k}</div>
    </div>
  );
  return (
    <div style={{ border: `1px solid ${s.hasData ? `color-mix(in srgb,${color} 45%,var(--line))` : 'var(--line)'}`, borderRadius: 14, padding: 14, background: s.hasData ? `linear-gradient(180deg, color-mix(in srgb,${color} 6%,transparent), transparent 60%)` : 'transparent' }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <ScoreGauge score={s.hasData ? s.score : 0} color={color} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <b style={{ fontSize: 15 }}>{p.name}</b>
            <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--gold)' }}>{money2(p.price_cents)}</span>
            <span className="muted" style={{ fontSize: 12 }}>· {es ? 'por' : 'by'} {p.seller_name}</span>
          </div>
          <div style={{ marginTop: 5, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 99, background: `color-mix(in srgb,${color} 15%,transparent)`, border: `1px solid color-mix(in srgb,${color} 45%,transparent)`, color, fontSize: 12, fontWeight: 800 }}>
            {s.hasData ? (s.verdict === 'approve' ? '✓' : s.verdict === 'review' ? '◐' : '✕') : '○'} {verdictTx}
          </div>
          {p.tagline && <div style={{ fontSize: 13, marginTop: 6 }}>{p.tagline}</div>}
          <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>{meta}</div>
        </div>
      </div>

      {s.hasData ? (
        <div style={{ display: 'flex', gap: 7, marginTop: 12, flexWrap: 'wrap' }}>
          {kpi(es ? 'Operac.' : 'Trades', s.trades)}
          {kpi(es ? 'Días' : 'Days', s.days)}
          {kpi('Profit factor', s.pf, s.pf >= 1.3 ? 'var(--green)' : s.pf >= 1 ? 'var(--amber)' : 'var(--red)')}
          {kpi(es ? 'Aciertos' : 'Win', s.winRate + '%')}
          {kpi('Drawdown', s.ddPct + '%', s.ddPct <= 15 ? 'var(--green)' : 'var(--red)')}
          {kpi(es ? 'Neto' : 'Net', '$' + s.netProfit.toLocaleString('en-US'), s.netProfit >= 0 ? 'var(--green)' : 'var(--red)')}
          {kpi(es ? 'Cuenta' : 'Acct', s.live ? (es ? 'Real' : 'Live') : 'Demo', s.live ? 'var(--green)' : 'var(--mut)')}
        </div>
      ) : (
        <div style={{ marginTop: 12, fontSize: 12.5, color: 'var(--amber)', background: 'color-mix(in srgb,var(--amber) 10%,transparent)', border: '1px solid color-mix(in srgb,var(--amber) 35%,transparent)', borderRadius: 10, padding: '9px 11px' }}>
          ⚠ {es ? 'Este robot no está ligado a operaciones reales en la plataforma (o aún no ha operado). Revísalo manualmente o pídele al creador que lo corra en una cuenta conectada.' : 'This robot is not linked to real trades on the platform (or has not traded yet). Review manually or ask the creator to run it on a connected account.'}
          {p.proof_url && <> · <a href={p.proof_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand)', fontWeight: 700 }}>{es ? 'Ver prueba externa' : 'View external proof'}</a></>}
        </div>
      )}

      {s.hasData && (
        <div style={{ marginTop: 8 }}>
          <button onClick={() => setOpen((o) => !o)} className="muted" style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--brand)' }}>{open ? '▾' : '▸'} {es ? 'Cómo se calculó' : 'How it scored'}{s.flags?.length ? ` · ${s.flags.length} ⚠` : ''}</button>
          {open && (
            <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
              {s.parts.map((pt: any) => (
                <div key={pt.k} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <span style={{ width: 96, color: 'var(--mut)' }}>{pt.k}</span>
                  <span style={{ flex: 1, height: 7, borderRadius: 4, background: 'var(--bg2)', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: `${(pt.v / pt.max) * 100}%`, background: color }} /></span>
                  <span style={{ width: 66, textAlign: 'right' }}>{pt.v}/{pt.max} <span className="muted">· {pt.note}</span></span>
                </div>
              ))}
              {s.flags?.length > 0 && <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 2 }}>⚠ {s.flags.join(' · ')}</div>}
            </div>
          )}
        </div>
      )}

      {p.description && <div style={{ fontSize: 13, marginTop: 10, whiteSpace: 'pre-wrap', color: 'var(--tx)' }}>{p.description}</div>}

      {canManage && (
        <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => act({ action: 'product_status', id: p.id, status: 'active', verified: true }, es ? 'Aprobado y verificado' : 'Approved & verified')} style={btn('var(--green)')}>{es ? 'Aprobar ✓ verificado' : 'Approve ✓ verified'}</button>
          <button onClick={() => act({ action: 'product_status', id: p.id, status: 'active', verified: false }, es ? 'Publicado (sin verificar)' : 'Published (unverified)')} style={btn('var(--brand)')}>{es ? 'Aprobar sin verificar' : 'Approve unverified'}</button>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={es ? 'Motivo de rechazo (opcional)' : 'Reject reason (optional)'} style={{ flex: 1, minWidth: 160, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--tx)', fontSize: 12.5 }} />
          <button onClick={() => act({ action: 'product_status', id: p.id, status: 'rejected', review_note: reason })} style={btn('var(--red)')}>{es ? 'Rechazar' : 'Reject'}</button>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, wide }: any) {
  return <label style={{ display: 'block', gridColumn: wide ? 'span 2' : 'auto' }}><span className="muted" style={{ fontSize: 12 }}>{label}</span><input value={value ?? ''} onChange={(e) => onChange(e.target.value)} style={{ width: '100%', marginTop: 4, padding: '9px 11px', borderRadius: 9, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--tx)', fontSize: 13.5 }} /></label>;
}

// ---------- Chat traducido ----------
function ChatInbox({ es, canManage }: { es: boolean; canManage: boolean }) {
  const [threads, setThreads] = useState<any[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  async function loadThreads() { try { const r = await fetch('/api/admin/botlab/chat'); const j = await r.json(); setThreads(j.threads || []); } catch {} }
  async function openThread(id: string) { setOpenId(id); try { const r = await fetch('/api/admin/botlab/chat?thread=' + id); const j = await r.json(); setMsgs(j.messages || []); loadThreads(); } catch {} }
  useEffect(() => { loadThreads(); const iv = setInterval(() => { loadThreads(); if (openId) openThread(openId); }, 10000); return () => clearInterval(iv); }, [openId]); // eslint-disable-line

  async function reply() {
    const t = text.trim(); if (!t || !openId) return; setText(''); setSending(true);
    try { const r = await fetch('/api/admin/botlab/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ thread: openId, text: t }) }); const j = await r.json(); if (!r.ok) throw new Error(j.error); setMsgs(j.messages || []); } catch (e: any) { toastErr(e?.message); } finally { setSending(false); }
  }

  const cc: any = { background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14 };
  return (
    <div style={card}>
      <SectionHead icon="chat" color={VIOLET} title={es ? 'Chat con clientes' : 'Client chat'} desc={es ? 'Tú respondes en español; el cliente lo recibe en su idioma.' : 'You reply in Spanish; the client receives it in their language.'} />
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 14, minHeight: 420 }}>
        <div style={{ ...cc, padding: 8, overflowY: 'auto', maxHeight: 520 }}>
          {!threads.length && <div className="muted" style={{ fontSize: 13, padding: 12 }}>{es ? 'Sin conversaciones aún.' : 'No conversations yet.'}</div>}
          {threads.map((t) => (
            <button key={t.id} onClick={() => openThread(t.id)} style={{ width: '100%', textAlign: 'left', padding: 10, borderRadius: 10, border: 'none', cursor: 'pointer', marginBottom: 4, background: openId === t.id ? 'color-mix(in srgb,var(--brand) 16%,transparent)' : 'transparent', color: 'var(--tx)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <b style={{ fontSize: 13.5, flex: 1 }}>{t.who}</b>
                {t.lang && <span className="muted" style={{ fontSize: 10.5, textTransform: 'uppercase' }}>{t.lang}</span>}
                {t.unread_admin > 0 && <span style={{ background: 'var(--red)', color: '#fff', fontSize: 10, fontWeight: 800, borderRadius: 99, padding: '1px 6px' }}>{t.unread_admin}</span>}
              </div>
              <div className="muted" style={{ fontSize: 11.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.preview || '—'}</div>
            </button>
          ))}
        </div>
        <div style={{ ...cc, display: 'flex', flexDirection: 'column' }}>
          {!openId ? (
            <div className="muted" style={{ margin: 'auto', fontSize: 13 }}>{es ? 'Elige una conversación.' : 'Pick a conversation.'}</div>
          ) : (
            <>
              <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 440 }}>
                {msgs.map((m, i) => (
                  <div key={i} style={{ maxWidth: '80%', alignSelf: m.sender === 'admin' ? 'flex-end' : 'flex-start' }}>
                    <div style={{ padding: '9px 12px', borderRadius: 12, fontSize: 13.5, background: m.sender === 'admin' ? 'linear-gradient(120deg,var(--brand),var(--brand2,#a06bff))' : 'var(--bg2)', color: m.sender === 'admin' ? '#0b1020' : 'var(--tx)', border: m.sender === 'admin' ? 'none' : '1px solid var(--line)' }}>{m.es}</div>
                    {m.sender === 'user' && m.lang && m.lang !== 'es' && <div className="muted" style={{ fontSize: 10.5, marginTop: 2 }}>{es ? 'original' : 'original'} ({m.lang}): {m.orig}</div>}
                  </div>
                ))}
              </div>
              {canManage && (
                <div style={{ display: 'flex', gap: 8, padding: 10, borderTop: '1px solid var(--line)' }}>
                  <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') reply(); }} placeholder={es ? 'Responde en español…' : 'Reply in Spanish…'} style={{ flex: 1, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: '9px 12px', color: 'var(--tx)', fontSize: 13.5, outline: 'none' }} />
                  <button onClick={reply} disabled={sending} style={{ padding: '9px 16px', borderRadius: 10, border: 'none', fontWeight: 800, cursor: 'pointer', background: 'var(--brand)', color: '#0b1020' }}>{es ? 'Enviar' : 'Send'}</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
