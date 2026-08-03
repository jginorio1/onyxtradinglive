'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/lib/lang';
import { mkL } from '@/lib/i18n';
import OnyxIcon from '@/app/components/OnyxIcon';

type Acc = {
  id: string; login: string; nickname: string | null; broker: string | null; platform: string;
  goals: Record<string, boolean>;
  connectorLive: boolean; guardianOn: boolean; copyKey: boolean; copyLive: boolean; tvOn: boolean;
};

const PLATS = ['MT5', 'MT4', 'cTrader'];
// Mapea el nombre visible al código que usa la página de conectar, para
// preseleccionar el conector correcto de esa plataforma.
const platKey = (p: string) => ({ MT5: 'mt5', MT4: 'mt4', cTrader: 'ctrader' } as Record<string, string>)[p] || (p || 'mt5').toLowerCase();

export default function SetupGuide() {
  const { lang } = useLang();
  const L = mkL(lang);
  const [data, setData] = useState<{ caps: any; accounts: Acc[] } | null>(null);
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState('');            // cuenta seleccionada en el popup ('' = cuenta nueva)
  const [newPlat, setNewPlat] = useState('MT5');
  const [busy, setBusy] = useState('');
  const [celebrate, setCelebrate] = useState(false);

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
  type St = { key: string; icon: string; title: string; sub: string; detail: string[]; done: boolean; href: string; time?: string };
  function stepsFor(a: Acc | null, plat: string, goals: Record<string, boolean>): St[] {
    const g = goals || {};
    const s: St[] = [];
    s.push({
      key: 'connect', icon: 'accounts', done: !!a, href: '/dashboard/keys', time: '~2 min',
      title: L(`Conecta tu cuenta (${plat})`, `Connect your account (${plat})`),
      sub: L('Es como enchufar Onyx a tu cuenta de trading. Solo lee, nunca opera por ti.', 'It\'s like plugging Onyx into your trading account. Read-only, it never trades for you.'),
      detail: [
        L('Pulsa el botón “Conectar cuenta”.', 'Click the “Connect account” button.'),
        L(`Elige tu plataforma: ${plat}.`, `Pick your platform: ${plat}.`),
        L('Descarga el conector y ábrelo dentro de tu plataforma.', 'Download the connector and open it inside your platform.'),
        L('Copia tu clave (API key) de Onyx y pégala en el conector.', 'Copy your Onyx API key and paste it into the connector.'),
      ],
    });
    s.push({
      key: 'connector', icon: 'settings', done: !!a?.connectorLive, href: '/dashboard/keys',
      title: L('Enciende el conector', 'Turn the connector on'),
      sub: L('Deja tu plataforma abierta con el “AutoTrading” activado. Cuando reporte, este paso se pone verde solo.', 'Keep your platform open with “AutoTrading” on. When it reports, this step turns green by itself.'),
      detail: [
        L('Abre tu plataforma (MetaTrader / cTrader).', 'Open your platform (MetaTrader / cTrader).'),
        L('Activa el botón “AutoTrading” (arriba).', 'Enable the “AutoTrading” button (top).'),
        L('Espera unos segundos: verás tus operaciones aquí.', 'Wait a few seconds: your trades show up here.'),
      ],
    });
    if (g.guardian) s.push({
      key: 'guardian', icon: 'guardian', done: !!a?.guardianOn, href: '/dashboard/manager',
      title: L('Activa Onyx Guardian', 'Turn on Onyx Guardian'),
      sub: L('Tu red de seguridad: le dices cuánto puedes perder al día y te frena antes de pasarte.', 'Your safety net: tell it your daily loss limit and it stops you before you cross it.'),
      detail: [
        L('Instala el EA del Guardian (un clic).', 'Install the Guardian EA (one click).'),
        L('Pon tu pérdida máxima diaria y tus horarios.', 'Set your max daily loss and your hours.'),
        L('Listo: Onyx vigila esa cuenta 24/7.', 'Done: Onyx watches that account 24/7.'),
      ],
    });
    if (g.copy || g.tv) s.push({
      key: 'copy', icon: 'swap', done: !!a?.copyLive, href: '/dashboard/copy',
      title: L('Instala el EA de Copy', 'Install the Copy EA'),
      sub: g.tv && !g.copy ? L('Es el mismo que ejecuta tus señales de TradingView.', 'It\'s the same one that executes your TradingView signals.') : L('Copia las operaciones de una cuenta maestra a tus otras cuentas.', 'Copies trades from a master account to your other accounts.'),
      detail: [
        L('Descarga el EA de Copy e instálalo en tu plataforma.', 'Download the Copy EA and install it on your platform.'),
        L('Pega tu clave de Copy y activa el AutoTrading.', 'Paste your Copy key and enable AutoTrading.'),
      ],
    });
    if (g.tv) s.push({
      key: 'tv', icon: 'bars', done: !!a?.tvOn, href: '/dashboard/tradingview',
      title: L('Conecta TradingView', 'Connect TradingView'),
      sub: L('Tus alertas de TradingView abren la operación en tu cuenta real, solas.', 'Your TradingView alerts open the trade in your real account, automatically.'),
      detail: [
        L('Copia tu URL de webhook y pégala en la alerta de TradingView.', 'Copy your webhook URL and paste it into your TradingView alert.'),
        L('Copia el mensaje y envía una señal de prueba.', 'Copy the message and send a test signal.'),
      ],
    });
    return s;
  }

  const accLabel = (a: Acc) => (a.nickname || a.broker || 'MT') + ' · ' + a.login;
  const goalsOf = (a: Acc) => ({ journal: true, guardian: !!a.goals?.guardian, copy: !!a.goals?.copy, tv: !!a.goals?.tv });
  const accDone = (a: Acc) => stepsFor(a, a.platform, goalsOf(a)).every((s) => s.done);
  const allDone = hasAcc && accounts.every(accDone);
  const remaining = accounts.reduce((n, a) => n + stepsFor(a, a.platform, goalsOf(a)).filter((s) => !s.done).length, 0);

  // Mensaje "¡Todo listo!" una sola vez, cuando se completa. Vuelve a salir si
  // añades una cuenta nueva y también la terminas (la firma cambia).
  const sig = accounts.map((a) => a.id + ':' + (accDone(a) ? 1 : 0)).join('|');
  // IMPORTANTE: este useEffect va ANTES de cualquier return temprano (reglas de hooks).
  useEffect(() => {
    if (!hasAcc || !allDone) return;
    try {
      if (localStorage.getItem('onyx_setup_sig') !== sig) setCelebrate(true);
    } catch { /* localStorage no disponible */ }
  }, [hasAcc, allDone, sig]);
  function dismissCelebrate() {
    try { localStorage.setItem('onyx_setup_sig', sig); } catch {}
    setCelebrate(false);
  }

  if (!data) return null;

  // ---------- Estado vacío: onboarding grande ----------
  if (!hasAcc) {
    const steps = stepsFor(null, newPlat, { journal: true, guardian: goalDefs.some((g) => g.k === 'guardian'), copy: false, tv: false });
    const pk = platKey(newPlat);
    return (
      <div className="card" style={{ padding: 24, marginBottom: 16, border: '2px solid var(--brand)', boxShadow: '0 0 30px rgba(124,140,255,.18)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 }}>
          <span style={{ color: 'var(--brand)', display: 'inline-flex' }}><OnyxIcon name="hand" size={22} /></span>
          <span style={{ fontSize: 19, fontWeight: 800 }}>{L('Empecemos — es muy fácil', 'Let\'s start — it\'s super easy')}</span>
        </div>
        <p className="muted" style={{ fontSize: 13.5, marginBottom: 18 }}>{L('Te llevamos de la mano. Elige tu plataforma y sigue los pasos: cada uno se pone en verde solo cuando lo logras. Unos 3 minutos.', 'We\'ll guide you. Pick your platform and follow the steps: each one turns green on its own once you\'re done. About 3 minutes.')}</p>
        <div style={{ marginBottom: 18 }}>
          <div className="muted" style={{ fontSize: 12.5, marginBottom: 6 }}>{L('1 · ¿Dónde operas? (tu plataforma)', '1 · Where do you trade? (your platform)')}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {PLATS.map((p) => <button key={p} className={'btn ' + (newPlat === p ? 'btn-primary' : 'btn-ghost')} style={{ padding: '7px 16px', fontSize: 13.5 }} onClick={() => { setNewPlat(p); try { localStorage.setItem('onyx_plat', platKey(p)); } catch {} }}>{p}</button>)}
          </div>
          <div className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>{L('Es la app donde operas. Al elegirla, descargarás el conector correcto para ella.', 'It\'s the app where you trade. Picking it downloads the right connector for it.')}</div>
        </div>
        <div className="muted" style={{ fontSize: 12.5, marginBottom: 6 }}>{L('2 · Sigue estos pasos', '2 · Follow these steps')}</div>
        <StepList steps={steps} L={L} platKey={pk} />
        <Link className="btn btn-primary" href={`/dashboard/keys?platform=${pk}`} onClick={() => { try { localStorage.setItem('onyx_plat', pk); } catch {} }} style={{ marginTop: 10, padding: '11px 22px' }}>{L('Conectar cuenta →', 'Connect account →')}</Link>
      </div>
    );
  }

  // ---------- Con cuentas: lanzador (+ popup) ----------
  return (
    <>
      {hasAcc && (
        <div className="card" style={{ padding: '12px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: 'var(--brand)', display: 'inline-flex' }}><OnyxIcon name="accounts" size={16} /></span>
              {L('Tus cuentas', 'Your accounts')}
              {remaining > 0
                ? <span className="muted" style={{ fontWeight: 500 }}>· {L(`faltan ${remaining} paso${remaining > 1 ? 's' : ''}`, `${remaining} step${remaining > 1 ? 's' : ''} left`)}</span>
                : <span style={{ fontWeight: 500, color: 'var(--green)' }}>· {L('todo listo ✓', 'all set ✓')}</span>}
            </span>
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
              <StepList steps={stepsFor(acc, acc.platform, goalsOf(acc))} L={L} onClose={() => setOpen(false)} platKey={platKey(acc.platform)} />
            </>)}
          </div>
        </div>
      )}

      {celebrate && (
        <div onClick={dismissCelebrate} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6vh 16px' }}>
          <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: '100%', maxWidth: 380, padding: 26, textAlign: 'center', border: '2px solid var(--green)', boxShadow: '0 0 40px rgba(52,226,160,.3)' }}>
            <div style={{ fontSize: 40, marginBottom: 6 }}>🎉</div>
            <h3 style={{ marginBottom: 8 }}>{L('¡Todo listo!', 'All set!')}</h3>
            <p className="muted" style={{ fontSize: 14, marginBottom: 18 }}>{accounts.length > 1 ? L('Tus cuentas están conectadas y configuradas. Onyx ya está trabajando por ti.', 'Your accounts are connected and configured. Onyx is now working for you.') : L('Tu cuenta está conectada y configurada. Onyx ya está trabajando por ti.', 'Your account is connected and configured. Onyx is now working for you.')}</p>
            <button className="btn btn-primary" onClick={dismissCelebrate}>{L('Entendido', 'Got it')}</button>
          </div>
        </div>
      )}
    </>
  );
}

function StepList({ steps, L, onClose, platKey: pk }: { steps: { key: string; icon: string; title: string; sub: string; detail: string[]; done: boolean; href: string; time?: string }[]; L: any; onClose?: () => void; platKey?: string }) {
  const go = (s: any) => {
    if (s.key === 'connect' && pk) { try { localStorage.setItem('onyx_plat', pk); } catch {} }
    onClose?.();
  };
  const hrefFor = (s: any) => (s.key === 'connect' && pk) ? `${s.href}?platform=${pk}` : s.href;
  const activeIdx = steps.findIndex((s) => !s.done);   // el primer paso pendiente = el actual

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {steps.map((s, i) => {
        const active = i === activeIdx;
        const numBadge = (
          <span style={{ flex: 'none', width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 700, background: s.done ? 'var(--green)' : active ? 'var(--brand)' : 'var(--card2)', color: s.done || active ? '#fff' : 'var(--mut)', border: s.done || active ? 'none' : '1px solid var(--line)' }}>{s.done ? '✓' : i + 1}</span>
        );

        // Paso hecho: tarjeta compacta verde, no clicable.
        if (s.done) {
          return (
            <div key={s.key} className="card" style={{ padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'center', border: '1px solid rgba(52,226,160,.35)', background: 'rgba(52,226,160,.06)' }}>
              {numBadge}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 7 }}><OnyxIcon name={s.icon} size={15} glow={false} /> {s.title}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 1 }}>{s.sub}</div>
              </div>
            </div>
          );
        }

        // Paso ACTUAL: tarjeta grande iluminada + botón de ancho completo. Toda clicable.
        if (active) {
          return (
            <Link key={s.key} href={hrefFor(s)} onClick={() => go(s)} className="card" style={{ display: 'block', padding: 16, textDecoration: 'none', color: 'inherit', border: '2px solid var(--brand)', background: 'rgba(124,140,255,.08)', boxShadow: '0 0 26px rgba(124,140,255,.25)' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                {numBadge}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--brand)', display: 'inline-flex' }}><OnyxIcon name={s.icon} size={16} glow={false} /></span>
                    <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--soft-brand)' }}>{s.title}</span>
                    <span style={{ fontSize: 11, color: 'var(--soft-brand)', background: 'rgba(124,140,255,.18)', borderRadius: 20, padding: '1px 9px' }}>{L('tu paso ahora', 'your step now')}</span>
                    {s.time && <span className="muted" style={{ fontSize: 11 }}>· {s.time}</span>}
                  </div>
                  <div className="muted" style={{ fontSize: 12.5, marginTop: 4, lineHeight: 1.5 }}>{s.sub}</div>
                  {s.detail?.length > 0 && (
                    <ol style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                      {s.detail.map((d: string, j: number) => <li key={j} className="muted" style={{ fontSize: 12, lineHeight: 1.6 }}>{d}</li>)}
                    </ol>
                  )}
                </div>
              </div>
              <div style={{ marginTop: 12, background: 'var(--grad)', color: '#fff', borderRadius: 10, padding: '11px 14px', fontSize: 14, fontWeight: 700, textAlign: 'center' }}>{L('Hacer este paso', 'Do this step')} →</div>
            </Link>
          );
        }

        // Pasos siguientes: tarjeta clicable normal, discreta, con flecha grande.
        return (
          <Link key={s.key} href={hrefFor(s)} onClick={() => go(s)} className="card" style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '13px 14px', textDecoration: 'none', color: 'inherit' }}>
            {numBadge}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--mut)', display: 'flex', alignItems: 'center', gap: 7 }}><OnyxIcon name={s.icon} size={15} glow={false} /> {s.title}</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 1 }}>{s.sub}</div>
            </div>
            <span style={{ flex: 'none', color: 'var(--mut)', fontSize: 20, lineHeight: 1 }}>›</span>
          </Link>
        );
      })}
    </div>
  );
}
