'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/lib/lang';
import { mkL } from '@/lib/i18n';

type Acc = {
  id: string; login: string; nickname: string | null; broker: string | null; platform: string;
  goals: Record<string, boolean>;
  connectorLive: boolean; guardianOn: boolean; copyKey: boolean; copyLive: boolean; tvOn: boolean;
};

const PLATS = ['MT5', 'MT4', 'cTrader'];

export default function SetupGuide() {
  const { lang } = useLang();
  const L = mkL(lang);
  const [data, setData] = useState<{ caps: any; accounts: Acc[] } | null>(null);
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState('');            // cuenta seleccionada en el popup ('' = cuenta nueva)
  const [newPlat, setNewPlat] = useState('MT5');
  const [busy, setBusy] = useState('');

  const load = () => fetch('/api/setup').then((r) => r.json()).then(setData).catch(() => setData({ caps: {}, accounts: [] }));
  useEffect(() => { load(); const iv = setInterval(load, 12000); return () => clearInterval(iv); }, []);

  const caps = data?.caps || {};
  const accounts = data?.accounts || [];
  const hasAcc = accounts.length > 0;

  // ¿Qué objetivos ofrece el plan?
  const goalDefs = useMemo(() => ([
    { k: 'journal', label: L('Diario y estadísticas', 'Journal and stats'), always: true, on: true },
    { k: 'guardian', label: L('Onyx Guardian', 'Onyx Guardian'), show: !!caps.manager },
    { k: 'copy', label: L('Copy trading', 'Copy trading'), show: !!caps.copy },
    { k: 'tv', label: 'TradingView', show: !!(caps.tv || caps.copy) },
  ].filter((g) => g.always || g.show)), [caps, lang]);

  const acc = useMemo(() => accounts.find((a) => a.id === sel) || null, [accounts, sel]);

  async function saveGoals(accountId: string, goals: Record<string, boolean>) {
    setBusy('goals');
    try { await fetch('/api/setup', { method: 'PATCH', body: JSON.stringify({ accountId, goals }) }); await load(); }
    finally { setBusy(''); }
  }
  function toggleGoal(a: Acc, k: string) {
    if (k === 'journal') return;
    const goals = { ...(a.goals || {}), [k]: !a.goals?.[k] };
    setData((d) => d ? { ...d, accounts: d.accounts.map((x) => x.id === a.id ? { ...x, goals } : x) } : d);
    saveGoals(a.id, goals);
  }

  // Construye los pasos de una cuenta (o de una cuenta nueva) con estado en vivo.
  type St = { key: string; title: string; sub: string; done: boolean; href: string };
  function stepsFor(a: Acc | null, plat: string, goals: Record<string, boolean>): St[] {
    const g = goals || {};
    const s: St[] = [];
    s.push({ key: 'connect', title: L(`Conecta la cuenta (${plat})`, `Connect the account (${plat})`), sub: L('Instala el conector y pega tu API key.', 'Install the connector and paste your API key.'), done: !!a, href: '/dashboard/keys' });
    s.push({ key: 'connector', title: L('El conector está reportando', 'Connector is reporting'), sub: L('Deja el EA/cBot conector corriendo para ver tus estadísticas.', 'Keep the connector EA/cBot running to see your stats.'), done: !!a?.connectorLive, href: '/dashboard/keys' });
    if (g.guardian) s.push({ key: 'guardian', title: L('Onyx Guardian activo', 'Onyx Guardian active'), sub: L('Instala el EA del gestor y fija tus límites de riesgo.', 'Install the manager EA and set your risk limits.'), done: !!a?.guardianOn, href: '/dashboard/manager' });
    if (g.copy || g.tv) s.push({ key: 'copy', title: L('EA de Copy corriendo', 'Copy EA running'), sub: g.tv && !g.copy ? L('También ejecuta las señales de TradingView.', 'Also executes TradingView signals.') : L('Copia de una cuenta maestra a esclavas.', 'Copy from a master account to slaves.'), done: !!a?.copyLive, href: '/dashboard/copy' });
    if (g.tv) s.push({ key: 'tv', title: L('TradingView conectado', 'TradingView connected'), sub: L('Pega tu webhook y envía una señal de prueba.', 'Paste your webhook and send a test signal.'), done: !!a?.tvOn, href: '/dashboard/tradingview' });
    return s;
  }

  if (!data) return null;

  const accLabel = (a: Acc) => (a.nickname || a.broker || 'MT') + ' · ' + a.login;
  const goalsOf = (a: Acc) => ({ journal: true, guardian: !!a.goals?.guardian, copy: !!a.goals?.copy, tv: !!a.goals?.tv });
  const accDone = (a: Acc) => stepsFor(a, a.platform, goalsOf(a)).every((s) => s.done);
  const allDone = hasAcc && accounts.every(accDone);

  // ---------- Estado vacío: onboarding grande ----------
  if (!hasAcc) {
    const steps = stepsFor(null, newPlat, { journal: true, guardian: goalDefs.some((g) => g.k === 'guardian'), copy: false, tv: false });
    return (
      <div className="card" style={{ padding: 22, marginBottom: 16, border: '2px solid var(--brand)', boxShadow: '0 0 30px rgba(124,140,255,.18)' }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>👋 {L('Empecemos: conecta tu primera cuenta', 'Let\'s start: connect your first account')}</div>
        <p className="muted" style={{ fontSize: 13.5, marginBottom: 16 }}>{L('Elige tu plataforma y sigue los pasos. Cada uno se marca solo cuando lo completes.', 'Pick your platform and follow the steps. Each one checks itself when you complete it.')}</p>
        <div style={{ marginBottom: 14 }}>
          <span className="muted" style={{ fontSize: 12.5, marginRight: 8 }}>{L('Plataforma', 'Platform')}:</span>
          {PLATS.map((p) => <button key={p} className={'btn ' + (newPlat === p ? 'btn-primary' : 'btn-ghost')} style={{ marginRight: 6, padding: '5px 12px', fontSize: 13 }} onClick={() => setNewPlat(p)}>{p}</button>)}
        </div>
        <StepList steps={steps} L={L} />
        <Link className="btn btn-primary" href="/dashboard/keys" style={{ marginTop: 8 }}>{L('Conectar cuenta →', 'Connect account →')}</Link>
      </div>
    );
  }

  // ---------- Con cuentas: lanzador (+ popup) ----------
  return (
    <>
      {!allDone && (
        <div className="card" style={{ padding: '12px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13.5, fontWeight: 700 }}>{L('Configuración', 'Setup')}</span>
            {accounts.map((a) => (
              <button key={a.id} className="pill" onClick={() => { setSel(a.id); setOpen(true); }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--card2)', cursor: 'pointer', border: '1px solid var(--line)' }}
                title={accDone(a) ? L('Listo', 'Done') : L('Falta configurar', 'Needs setup')}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: accDone(a) ? 'var(--green)' : 'var(--amber)' }} />
                {accLabel(a)}
              </button>
            ))}
          </div>
          <button className="btn btn-primary" style={{ padding: '7px 14px', fontSize: 13 }} onClick={() => { setSel(accounts[0]?.id || ''); setOpen(true); }}>＋ {L('Añadir cuenta', 'Add account')}</button>
        </div>
      )}

      {open && (
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '6vh 16px', overflow: 'auto' }}>
          <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: '100%', maxWidth: 480, padding: 20 }}>
            <div className="row between" style={{ alignItems: 'center', marginBottom: 4 }}>
              <b style={{ fontSize: 16 }}>{L('Configurar cuenta', 'Configure account')}</b>
              <button className="btn btn-ghost" style={{ padding: '2px 10px' }} onClick={() => setOpen(false)}>✕</button>
            </div>

            {/* Selector de cuenta + añadir nueva */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', margin: '10px 0 14px' }}>
              <select value={sel} onChange={(e) => setSel(e.target.value)} style={{ padding: '6px 10px', flex: 1, minWidth: 160 }}>
                {accounts.map((a) => <option key={a.id} value={a.id}>{accLabel(a)}</option>)}
              </select>
              <Link className="btn btn-ghost" href="/dashboard/keys" style={{ fontSize: 13 }}>＋ {L('Nueva', 'New')}</Link>
            </div>

            {acc && (<>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{L('¿Qué harás con esta cuenta?', 'What will you do with this account?')} · {acc.platform}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginBottom: 16 }}>
                {goalDefs.map((g) => {
                  const on = g.k === 'journal' ? true : !!acc.goals?.[g.k];
                  return (
                    <button key={g.k} onClick={() => toggleGoal(acc, g.k)} disabled={g.k === 'journal' || busy === 'goals'}
                      className="card" style={{ padding: '8px 10px', textAlign: 'left', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, cursor: g.k === 'journal' ? 'default' : 'pointer', border: on ? '2px solid var(--brand)' : '1px solid var(--line)', opacity: g.k === 'journal' ? .75 : 1 }}>
                      <span style={{ width: 16, height: 16, borderRadius: 4, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, background: on ? 'var(--brand)' : 'transparent', color: '#fff', border: on ? 'none' : '1px solid var(--line)' }}>{on ? '✓' : ''}</span>
                      {g.label}
                    </button>
                  );
                })}
              </div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>{L('Pasos para esta cuenta', 'Steps for this account')}</div>
              <StepList steps={stepsFor(acc, acc.platform, goalsOf(acc))} L={L} onClose={() => setOpen(false)} />
            </>)}
          </div>
        </div>
      )}
    </>
  );
}

function StepList({ steps, L, onClose }: { steps: { key: string; title: string; sub: string; done: boolean; href: string }[]; L: any; onClose?: () => void }) {
  return (
    <div>
      {steps.map((s, i) => (
        <div key={s.key} style={{ display: 'flex', gap: 11, alignItems: 'flex-start', padding: '10px 0', borderTop: i ? '1px solid var(--line)' : 'none' }}>
          <span style={{ flex: 'none', width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, background: s.done ? 'var(--green)' : 'var(--card2)', color: s.done ? '#fff' : 'var(--mut)', border: s.done ? 'none' : '1px solid var(--line)' }}>{s.done ? '✓' : i + 1}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: s.done ? 'var(--green)' : 'var(--tx)' }}>{s.title}</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 1 }}>{s.sub}</div>
          </div>
          {!s.done && <Link href={s.href} onClick={onClose} className="btn btn-ghost" style={{ padding: '3px 10px', fontSize: 12, flex: 'none' }}>{L('Ir', 'Go')}</Link>}
        </div>
      ))}
    </div>
  );
}
