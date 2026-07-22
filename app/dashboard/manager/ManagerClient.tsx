'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { errMsg } from '@/lib/i18nErrors';

type Lang = 'es' | 'en';

const T: any = {
  es: {
    title: 'Gestor', back: 'Volver al panel', save: 'Guardar y enviar', saved: 'Enviado al MetaTrader', saving: '...',
    noAcc: 'Conecta una cuenta MT para usar el gestor.', connect: 'Conectar cuenta →',
    lockT: 'El gestor está en los planes de pago', lockD: 'Deja que Onyx mueva tus stops, aplique trailing y cierre por partes mientras tú te concentras en operar.', lockCta: 'Ver planes →',
    account: 'Cuenta', live: 'EA conectado', offline: 'EA sin señal', never: 'Nunca ha sincronizado',
    onoff: 'Gestor activo en esta cuenta', onoffD: 'Si lo apagas, Onyx no toca ninguna operación.',
    units: 'Trabajo con mis niveles en', uPips: 'Pips', uR: 'R (múltiplos del stop)', uMoney: 'Dinero',
    unitsHelp: { pips: 'Los niveles se miden en pips del par.', r: '1R es la distancia de tu stop. Se adapta a cada operación.', money: 'Los niveles se miden en la divisa de tu cuenta.' },

    beT: 'Break even', beD: 'Mueve el stop cuando la operación va a favor, para que ya no pueda perder.',
    beTrigger: 'Se activa cuando gane', beMode: 'Dónde queda el stop',
    beBelow: 'Por debajo de la entrada', beBelowD: 'Le das aire. Aún puede perder un poco.',
    beAt: 'Justo en la entrada', beAtD: 'Cierras a cero de precio, pero pierdes las comisiones.',
    beAbove: 'Por encima, cubriendo costes', beAboveD: 'Break even de verdad: sales a cero real.',
    beOffset: 'Colchón extra', beCosts: 'Cubrir comisiones y swap automáticamente', beCostsD: 'Onyx lee lo que te cobró el bróker en cada operación.',

    trT: 'Trailing stop', trD: 'Persigue al precio para asegurar ganancia mientras siga a tu favor.',
    trStart: 'Empieza cuando gane', trDist: 'Distancia al precio', trType: 'Tipo',
    trFixed: 'Distancia fija', trSoon: 'Máximos/mínimos, media móvil y ATR llegan en la siguiente versión.',

    ptT: 'Take profits parciales', ptD: 'Cierra la posición por partes según avanza a tu favor.',
    ptAt: 'Al llegar a', ptClose: 'Cierro', ptTotal: 'Total cerrado', ptOver: 'La suma no puede pasar de 100%.',
    ptMinLot: 'Ojo: si tu operación es de 0.01 lotes, el bróker no deja partirla. Los parciales se saltarán.',

    qaT: 'Acciones rápidas', qaD: 'Se ejecutan en tu MetaTrader en unos segundos.',
    qaBe: 'Poner SL en break even', qaHalf: 'Cerrar la mitad', qaProfit: 'Cerrar solo las ganadoras', qaAll: 'Cerrar todo',
    qaConfirm: '¿Seguro? Esto afecta a tus operaciones reales.', qaSent: 'Orden enviada. El EA la ejecutará en segundos.',

    tplT: 'Plantillas', tplD: 'Guarda esta configuración y aplícala a otras cuentas.', tplSave: 'Guardar como plantilla',
    tplName: 'Nombre de la plantilla', tplApply: 'Aplicar', tplDel: 'Borrar', tplNone: 'Todavía no tienes plantillas.',

    evT: 'Últimas intervenciones', evNone: 'Onyx aún no ha hecho nada en tus cuentas.',
    kinds: { breakeven: 'Break even', trailing: 'Trailing', partial: 'Cierre parcial', close_all: 'Cerró todo', blocked: 'Bloqueó', info: 'Aviso' },
    warnT: 'Ten esto en cuenta', warn1: 'Onyx solo actúa con MetaTrader abierto, AlgoTrading encendido y conexión activa. Si tu ordenador se apaga, no protege. Si operas en serio, usa un VPS.', warn2: 'Es una ayuda, no una garantía. Un hueco de mercado puede saltarse cualquier stop.', warn3: 'Pon el EA en un solo gráfico por cuenta. Gestiona todas tus posiciones desde ahí.',
    adv: 'Disponible en Elite',
  },
  en: {
    title: 'Manager', back: 'Back to dashboard', save: 'Save and send', saved: 'Sent to MetaTrader', saving: '...',
    noAcc: 'Connect an MT account to use the manager.', connect: 'Connect account →',
    lockT: 'The manager is on the paid plans', lockD: 'Let Onyx move your stops, run trailing and close in parts while you focus on trading.', lockCta: 'See plans →',
    account: 'Account', live: 'EA connected', offline: 'EA not reporting', never: 'Never synced',
    onoff: 'Manager active on this account', onoffD: 'If you turn it off, Onyx touches nothing.',
    units: 'I set my levels in', uPips: 'Pips', uR: 'R (stop multiples)', uMoney: 'Money',
    unitsHelp: { pips: 'Levels measured in pips of the pair.', r: '1R is your stop distance. Adapts to every trade.', money: 'Levels measured in your account currency.' },

    beT: 'Break even', beD: 'Moves the stop once the trade goes your way, so it can no longer lose.',
    beTrigger: 'Triggers when profit reaches', beMode: 'Where the stop lands',
    beBelow: 'Below entry', beBelowD: 'Gives it room. It can still lose a bit.',
    beAt: 'Exactly at entry', beAtD: 'Zero on price, but you lose the fees.',
    beAbove: 'Above entry, covering costs', beAboveD: 'Real break even: you exit at true zero.',
    beOffset: 'Extra buffer', beCosts: 'Cover commission and swap automatically', beCostsD: 'Onyx reads what your broker charged on each trade.',

    trT: 'Trailing stop', trD: 'Follows price to lock in profit while the trade keeps running.',
    trStart: 'Starts when profit reaches', trDist: 'Distance from price', trType: 'Type',
    trFixed: 'Fixed distance', trSoon: 'Highs/lows, moving average and ATR come in the next version.',

    ptT: 'Partial take profits', ptD: 'Closes the position in parts as it moves your way.',
    ptAt: 'When it reaches', ptClose: 'Close', ptTotal: 'Total closed', ptOver: 'The sum cannot exceed 100%.',
    ptMinLot: 'Heads up: with 0.01 lots your broker will not let it be split. Partials will be skipped.',

    qaT: 'Quick actions', qaD: 'They run in your MetaTrader within seconds.',
    qaBe: 'Move SL to break even', qaHalf: 'Close half', qaProfit: 'Close winners only', qaAll: 'Close everything',
    qaConfirm: 'Are you sure? This affects your real trades.', qaSent: 'Order sent. The EA will run it in seconds.',

    tplT: 'Templates', tplD: 'Save this setup and apply it to other accounts.', tplSave: 'Save as template',
    tplName: 'Template name', tplApply: 'Apply', tplDel: 'Delete', tplNone: 'No templates yet.',

    evT: 'Latest actions', evNone: 'Onyx has not done anything on your accounts yet.',
    kinds: { breakeven: 'Break even', trailing: 'Trailing', partial: 'Partial close', close_all: 'Closed all', blocked: 'Blocked', info: 'Notice' },
    warnT: 'Keep this in mind', warn1: 'Onyx only acts with MetaTrader open, AlgoTrading on and a live connection. If your computer shuts down, it does not protect. If you trade seriously, use a VPS.', warn2: 'It is a helper, not a guarantee. A market gap can jump over any stop.', warn3: 'Run the EA on a single chart per account. It manages all your positions from there.',
    adv: 'Available on Elite',
  },
};

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return <span className="toggle" onClick={onClick} style={{ background: on ? '#34e2a0' : 'var(--line)' }}><span className="knob" style={{ left: on ? 21 : 3 }} /></span>;
}

export default function ManagerClient() {
  const [lang, setLang] = useState<Lang>('es');
  const [d, setD] = useState<any>(null);
  const [sel, setSel] = useState('');
  const [cfg, setCfg] = useState<any>(null);
  const [units, setUnits] = useState('pips');
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [tplName, setTplName] = useState('');
  const t = T[lang];

  useEffect(() => {
    try { const s = localStorage.getItem('onyx_lang'); if (s === 'en' || s === 'es') setLang(s as Lang); } catch {}
    load();
  }, []);

  async function load() {
    try {
      const r = await fetch('/api/manager');
      if (!r.ok) { setD({ accounts: [], caps: {} }); return; }
      const j = await r.json();
      setD(j);
      const first = j.accounts?.[0];
      if (first) { setSel(first.id); setCfg(first.manager.config); setUnits(first.manager.units); setEnabled(first.manager.enabled); }
    } catch { setD({ accounts: [], caps: {} }); }
  }
  function switchLang(l: Lang) { setLang(l); try { localStorage.setItem('onyx_lang', l); } catch {} }

  const acc = useMemo(() => (d?.accounts || []).find((a: any) => a.id === sel), [d, sel]);
  const caps = d?.caps || {};
  const advanced = !!caps.manager_advanced;

  function pick(id: string) {
    const a = (d?.accounts || []).find((x: any) => x.id === id);
    if (!a) return;
    setSel(id); setCfg(a.manager.config); setUnits(a.manager.units); setEnabled(a.manager.enabled); setMsg('');
  }
  const set = (path: string, value: any) => {
    const [g, k] = path.split('.');
    setCfg({ ...cfg, [g]: { ...cfg[g], [k]: value } });
  };
  const setLevel = (i: number, k: string, v: any) => {
    const levels = cfg.partials.levels.map((l: any, ix: number) => (ix === i ? { ...l, [k]: v } : l));
    setCfg({ ...cfg, partials: { ...cfg.partials, levels } });
  };
  const totalClose = (cfg?.partials?.levels || []).filter((l: any) => l.on).reduce((s: number, l: any) => s + Number(l.close || 0), 0);

  async function save() {
    setBusy('save'); setMsg('');
    const r = await fetch('/api/manager', { method: 'POST', body: JSON.stringify({ account_id: sel, enabled, units, config: cfg }) });
    const j = await r.json(); setBusy('');
    if (!r.ok) { alert(errMsg(j, lang)); return; }
    setMsg(t.saved); setTimeout(() => setMsg(''), 3000); load();
  }
  async function command(cmd: string) {
    if (!confirm(t.qaConfirm)) return;
    setBusy(cmd);
    const r = await fetch('/api/manager/command', { method: 'POST', body: JSON.stringify({ account_id: sel, command: cmd }) });
    const j = await r.json(); setBusy('');
    if (!r.ok) { alert(errMsg(j, lang)); return; }
    alert(t.qaSent);
  }
  async function saveTemplate() {
    if (!tplName.trim()) return;
    setBusy('tpl');
    const r = await fetch('/api/manager', { method: 'PUT', body: JSON.stringify({ name: tplName, units, config: cfg }) });
    const j = await r.json(); setBusy('');
    if (!r.ok) { alert(errMsg(j, lang)); return; }
    setTplName(''); load();
  }
  async function delTemplate(id: string) {
    await fetch('/api/manager', { method: 'PUT', body: JSON.stringify({ action: 'delete', id }) });
    load();
  }

  const lbl = { fontSize: 12, color: 'var(--mut)', display: 'block', marginBottom: 4 } as any;
  const card = { marginBottom: 14 } as any;
  const num = { margin: 0, width: 100, padding: '7px 10px' } as any;

  const Header = (
    <div className="topbar"><div className="wrap-wide">
      <Link className="logo" href="/dashboard"><img src="/onyx-symbol.png" alt="Onyx" style={{ width: 28, height: 28, objectFit: 'contain' }} /> {t.title}</Link>
      <div className="row">
        <button className="btn btn-ghost" style={{ padding: '6px 10px' }} onClick={() => switchLang(lang === 'es' ? 'en' : 'es')}>{lang === 'es' ? '🇬🇧 EN' : '🇪🇸 ES'}</button>
        <Link className="btn btn-ghost" href="/dashboard">{t.back}</Link>
      </div>
    </div></div>
  );

  if (!d) return <>{Header}<div className="wrap" style={{ padding: 30 }}><p className="muted">…</p></div></>;

  if (!caps.manager) return (
    <>{Header}
      <div className="wrap" style={{ padding: '40px 22px', maxWidth: 620 }}>
        <div className="card" style={{ textAlign: 'center', padding: '38px 22px', border: '1px solid #a06bff' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔒</div>
          <h2 style={{ marginBottom: 8 }}>{t.lockT}</h2>
          <p className="muted" style={{ marginBottom: 18 }}>{t.lockD}</p>
          <Link className="btn btn-primary" href="/pricing">{t.lockCta}</Link>
        </div>
      </div>
    </>
  );

  if (!d.accounts?.length) return (
    <>{Header}
      <div className="wrap" style={{ padding: '40px 22px', maxWidth: 560 }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <p className="muted" style={{ marginBottom: 14 }}>{t.noAcc}</p>
          <Link className="btn btn-primary" href="/dashboard/keys">{t.connect}</Link>
        </div>
      </div>
    </>
  );

  return (
    <>{Header}
      <div className="wrap" style={{ padding: '22px 22px 50px', maxWidth: 780 }}>

        {/* Cuenta */}
        <div className="card" style={card}>
          <span style={lbl}>{t.account}</span>
          <select value={sel} onChange={(e) => pick(e.target.value)} style={{ margin: 0 }}>
            {d.accounts.map((a: any) => <option key={a.id} value={a.id}>{a.nickname || a.login} · {a.broker || ''}</option>)}
          </select>
          {acc && (
            <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              {acc.last_sync_at
                ? <span className="pill" style={{ color: acc.live ? 'var(--green)' : 'var(--amber)', background: acc.live ? 'rgba(52,226,160,.15)' : 'rgba(255,192,77,.15)' }}>{acc.live ? t.live : t.offline}</span>
                : <span className="pill">{t.never}</span>}
              {acc.ea_version && <span className="muted" style={{ fontSize: 12 }}>EA {acc.ea_version}</span>}
            </div>
          )}
          <div className="row between" style={{ borderTop: '1px solid var(--line)', marginTop: 14, paddingTop: 14, flexWrap: 'wrap', gap: 10 }}>
            <div><div style={{ fontWeight: 700 }}>{t.onoff}</div><div className="muted" style={{ fontSize: 13 }}>{t.onoffD}</div></div>
            <Toggle on={enabled} onClick={() => setEnabled(!enabled)} />
          </div>
        </div>

        {/* Unidades */}
        <div className="card" style={card}>
          <span style={lbl}>{t.units}</span>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {([['pips', t.uPips], ['r', t.uR], ['money', t.uMoney]] as [string, string][]).map(([k, label]) => (
              <button key={k} className={'btn ' + (units === k ? 'btn-primary' : 'btn-ghost')} style={{ flex: 1, minWidth: 120 }} onClick={() => setUnits(k)}>{label}</button>
            ))}
          </div>
          <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>{t.unitsHelp[units]}</div>
        </div>

        {/* Break even */}
        <div className="card" style={card}>
          <div className="row between" style={{ marginBottom: 4 }}>
            <h3>{t.beT}</h3>
            <Toggle on={!!cfg?.breakeven?.on} onClick={() => set('breakeven.on', !cfg.breakeven.on)} />
          </div>
          <p className="muted" style={{ fontSize: 13, marginBottom: cfg?.breakeven?.on ? 14 : 0 }}>{t.beD}</p>

          {cfg?.breakeven?.on && (
            <>
              <div style={{ maxWidth: 220, marginBottom: 14 }}>
                <span style={lbl}>{t.beTrigger}</span>
                <input type="number" value={cfg.breakeven.trigger} onChange={(e) => set('breakeven.trigger', Number(e.target.value))} style={num} />
              </div>

              <span style={lbl}>{t.beMode}</span>
              {([['below', t.beBelow, t.beBelowD], ['at', t.beAt, t.beAtD], ['above', t.beAbove, t.beAboveD]] as [string, string, string][]).map(([k, ti, de]) => (
                <div key={k} onClick={() => set('breakeven.mode', k)}
                  style={{ border: '1px solid ' + (cfg.breakeven.mode === k ? 'var(--brand)' : 'var(--line)'), background: cfg.breakeven.mode === k ? 'rgba(124,140,255,.10)' : 'transparent', borderRadius: 10, padding: '10px 12px', marginBottom: 8, cursor: 'pointer' }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{ti}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{de}</div>
                </div>
              ))}

              <div className="row" style={{ gap: 14, marginTop: 10, flexWrap: 'wrap' }}>
                <div><span style={lbl}>{t.beOffset}</span><input type="number" value={cfg.breakeven.offset} onChange={(e) => set('breakeven.offset', Number(e.target.value))} style={num} /></div>
              </div>

              <div className="row between" style={{ borderTop: '1px solid var(--line)', marginTop: 14, paddingTop: 12, flexWrap: 'wrap', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 200 }}><div style={{ fontSize: 14 }}>{t.beCosts}</div><div className="muted" style={{ fontSize: 12 }}>{t.beCostsD}</div></div>
                <Toggle on={!!cfg.breakeven.cover_costs} onClick={() => set('breakeven.cover_costs', !cfg.breakeven.cover_costs)} />
              </div>
            </>
          )}
        </div>

        {/* Trailing */}
        <div className="card" style={card}>
          <div className="row between" style={{ marginBottom: 4 }}>
            <h3>{t.trT}</h3>
            <Toggle on={!!cfg?.trailing?.on} onClick={() => set('trailing.on', !cfg.trailing.on)} />
          </div>
          <p className="muted" style={{ fontSize: 13, marginBottom: cfg?.trailing?.on ? 14 : 0 }}>{t.trD}</p>
          {cfg?.trailing?.on && (
            <>
              <div className="row" style={{ gap: 14, flexWrap: 'wrap' }}>
                <div><span style={lbl}>{t.trStart}</span><input type="number" value={cfg.trailing.start} onChange={(e) => set('trailing.start', Number(e.target.value))} style={num} /></div>
                <div><span style={lbl}>{t.trDist}</span><input type="number" value={cfg.trailing.distance} onChange={(e) => set('trailing.distance', Number(e.target.value))} style={num} /></div>
                <div><span style={lbl}>{t.trType}</span><select value="fixed" disabled style={{ margin: 0, width: 160 }}><option value="fixed">{t.trFixed}</option></select></div>
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>{t.trSoon}</div>
            </>
          )}
        </div>

        {/* TP parciales */}
        <div className="card" style={{ ...card, opacity: advanced ? 1 : .75 }}>
          <div className="row between" style={{ marginBottom: 4, flexWrap: 'wrap', gap: 8 }}>
            <div className="row" style={{ gap: 8 }}>
              <h3>{t.ptT}</h3>
              {!advanced && <span className="pill" style={{ color: '#7fe9c0', background: 'rgba(52,226,160,.15)', border: '1px solid #34e2a0' }}>🔒 {t.adv}</span>}
            </div>
            {advanced && <Toggle on={!!cfg?.partials?.on} onClick={() => set('partials.on', !cfg.partials.on)} />}
          </div>
          <p className="muted" style={{ fontSize: 13, marginBottom: advanced && cfg?.partials?.on ? 14 : 0 }}>{t.ptD}</p>

          {advanced && cfg?.partials?.on && (
            <>
              {cfg.partials.levels.map((l: any, i: number) => (
                <div key={i} className="row" style={{ gap: 10, marginBottom: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <span className="muted" style={{ fontSize: 13, width: 40 }}>TP{i + 1}</span>
                  <div><span style={lbl}>{t.ptAt}</span><input type="number" value={l.at} onChange={(e) => setLevel(i, 'at', Number(e.target.value))} style={num} /></div>
                  <div><span style={lbl}>{t.ptClose}</span><input type="number" value={l.close} onChange={(e) => setLevel(i, 'close', Number(e.target.value))} style={{ ...num, width: 80 }} /></div>
                  <span className="muted" style={{ fontSize: 13, paddingBottom: 8 }}>%</span>
                  <div style={{ paddingBottom: 4 }}><Toggle on={!!l.on} onClick={() => setLevel(i, 'on', !l.on)} /></div>
                </div>
              ))}
              <div className="row between" style={{ borderTop: '1px solid var(--line)', paddingTop: 10, marginTop: 6 }}>
                <span className="muted" style={{ fontSize: 13 }}>{t.ptTotal}</span>
                <b style={{ color: totalClose > 100 ? 'var(--red)' : 'var(--tx)' }}>{totalClose}%</b>
              </div>
              {totalClose > 100 && <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 6 }}>{t.ptOver}</div>}
              <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>{t.ptMinLot}</div>
            </>
          )}
        </div>

        <div className="row" style={{ gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={save} disabled={busy === 'save' || totalClose > 100}>{busy === 'save' ? t.saving : t.save}</button>
          {msg && <span style={{ color: 'var(--green)', fontSize: 14 }}>{msg}</span>}
        </div>

        {/* Acciones rápidas */}
        <div className="card" style={card}>
          <h3 style={{ marginBottom: 4 }}>{t.qaT}</h3>
          <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>{t.qaD}</p>
          <div className="grid g2" style={{ gap: 8 }}>
            <button className="btn btn-ghost" onClick={() => command('sl_to_be')} disabled={!!busy}>{t.qaBe}</button>
            <button className="btn btn-ghost" onClick={() => command('close_half')} disabled={!!busy}>{t.qaHalf}</button>
            <button className="btn btn-ghost" onClick={() => command('close_profitable')} disabled={!!busy}>{t.qaProfit}</button>
            <button className="btn btn-danger" onClick={() => command('close_all')} disabled={!!busy}>{t.qaAll}</button>
          </div>
        </div>

        {/* Plantillas */}
        <div className="card" style={card}>
          <h3 style={{ marginBottom: 4 }}>{t.tplT}</h3>
          <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>{t.tplD}</p>
          {!d.templates?.length && <p className="muted" style={{ fontSize: 14, marginBottom: 12 }}>{t.tplNone}</p>}
          {(d.templates || []).map((tp: any) => (
            <div key={tp.id} className="row between" style={{ borderTop: '1px solid var(--line)', padding: '9px 0', flexWrap: 'wrap', gap: 8 }}>
              <b style={{ fontSize: 14 }}>{tp.name}</b>
              <div className="row" style={{ gap: 6 }}>
                <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => { setCfg(tp.config); setUnits(tp.units); }}>{t.tplApply}</button>
                <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => delTemplate(tp.id)}>{t.tplDel}</button>
              </div>
            </div>
          ))}
          <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <input value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder={t.tplName} style={{ margin: 0, maxWidth: 240 }} />
            <button className="btn btn-ghost" onClick={saveTemplate} disabled={!tplName.trim() || busy === 'tpl'}>{t.tplSave}</button>
          </div>
        </div>

        {/* Historial */}
        <div className="card" style={card}>
          <h3 style={{ marginBottom: 10 }}>{t.evT}</h3>
          {!d.events?.length && <p className="muted" style={{ fontSize: 14 }}>{t.evNone}</p>}
          {(d.events || []).map((e: any) => (
            <div key={e.id} className="row between" style={{ borderTop: '1px solid var(--line)', padding: '9px 0', fontSize: 13, flexWrap: 'wrap', gap: 8 }}>
              <span><b>{t.kinds[e.kind] || e.kind}</b> {e.symbol ? `· ${e.symbol}` : ''} {e.detail ? `· ${e.detail}` : ''}</span>
              <span className="muted" style={{ fontSize: 12 }}>{new Date(e.created_at).toLocaleString()}</span>
            </div>
          ))}
        </div>

        {/* Avisos honestos */}
        <div className="card" style={{ border: '1px solid var(--amber)' }}>
          <h3 style={{ marginBottom: 10, color: 'var(--amber)' }}>{t.warnT}</h3>
          <p className="muted" style={{ fontSize: 13, marginBottom: 8 }}>{t.warn1}</p>
          <p className="muted" style={{ fontSize: 13, marginBottom: 8 }}>{t.warn2}</p>
          <p className="muted" style={{ fontSize: 13 }}>{t.warn3}</p>
        </div>
      </div>
    </>
  );
}
