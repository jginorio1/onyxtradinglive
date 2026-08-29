'use client';
import { useEffect, useMemo, useState } from 'react';
import { useLang } from '@/lib/lang';
import { toast, toastErr } from '@/lib/toast';
import OnyxIcon from '@/app/components/OnyxIcon';
import { DEFAULT_SPEC, summarize, TF_LIST, type BotSpec } from '@/lib/botSpec';

// Constructor de bots rediseñado: pantalla ancha, tarjetas iluminadas por estado,
// selector de sesión, campos activables/desactivables, aviso de incompletos,
// estimador de riesgo, semáforo de coherencia y plantillas reutilizables.
export default function BotBuilder() {
  const { lang } = useLang();
  const es = lang !== 'en';
  const L = (a: string, b: string) => (es ? a : b);
  const [s, setS] = useState<BotSpec>({ ...DEFAULT_SPEC });
  const [id, setId] = useState('');
  const [list, setList] = useState<any[]>([]);
  const [tpls, setTpls] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [big, setBig] = useState(false);
  const [off, setOff] = useState<Record<string, boolean>>({});
  const [warn, setWarn] = useState<{ key: string; label: string; opt: boolean }[]>([]);
  const [showWarn, setShowWarn] = useState(false);
  const [bal, setBal] = useState<number>(10000);
  const set = (k: keyof BotSpec, v: any) => setS((p) => ({ ...p, [k]: v }));

  useEffect(() => { load(); loadTpls(); }, []);
  async function load() { try { const r = await fetch('/api/bots/build'); const j = await r.json(); setList(j.bots || []); } catch {} }
  async function loadTpls() { try { const r = await fetch('/api/bots/templates'); const j = await r.json(); setTpls(j.templates || []); } catch {} }

  const summary = useMemo(() => summarize(s, !es), [s, es]);

  // ---- Campos requeridos (no se pueden dejar vacíos) ----
  const REQ: { key: keyof BotSpec; label: string; opt?: boolean }[] = [
    { key: 'name', label: L('Nombre del bot', 'Bot name') },
    { key: 'symbol', label: L('Instrumento', 'Instrument') },
    { key: 'slVal', label: L('Stop loss', 'Stop loss') },
    { key: 'tp1Val', label: 'TP1' },
    { key: 'runnerVal', label: L('Runner / TP final', 'Runner / final TP') },
    { key: 'riskVal', label: L('Riesgo por operación', 'Risk per trade') },
    { key: 'dailyLossVal', label: L('Cap de pérdida diaria', 'Daily loss cap'), opt: true },
  ];
  function findMissing() {
    const m: { key: string; label: string; opt: boolean }[] = [];
    for (const r of REQ) {
      if (off[r.key as string]) continue;
      const v = (s as any)[r.key];
      const empty = v === '' || v == null || (typeof v === 'number' && !(v > 0) && r.key !== 'name' && r.key !== 'symbol') || (typeof v === 'string' && !v.trim());
      if (empty) m.push({ key: r.key as string, label: r.label, opt: !!r.opt });
    }
    return m;
  }

  // ---- Semáforo de coherencia ----
  const issues = useMemo(() => {
    const out: string[] = [];
    if (s.riskUnit === 'pct' && s.dailyLossUnit === 'pct' && s.riskVal > s.dailyLossVal && s.dailyLossVal > 0)
      out.push(L(`El riesgo por operación (${s.riskVal}%) supera el cap diario (${s.dailyLossVal}%): una sola pérdida rompería el día.`, `Risk per trade (${s.riskVal}%) exceeds the daily cap (${s.dailyLossVal}%): a single loss would break the day.`));
    if (s.slUnit === 'pips' && s.tp1Unit === 'pips' && s.tp1Val <= s.slVal)
      out.push(L('El TP1 en pips es igual o menor que el stop: el R:R queda por debajo de 1.', 'TP1 in pips is equal to or smaller than the stop: R:R is below 1.'));
    if (s.partialPct >= 100) out.push(L('El parcial cierra el 100% en TP1: no queda runner para dejar correr.', 'The partial closes 100% at TP1: no runner is left to run.'));
    if (s.acctDailyStopPct > s.firmTotalLimitPct && s.firmTotalLimitPct > 0)
      out.push(L('El freno duro diario es mayor que el límite total del firm.', 'The hard daily brake is larger than the firm total limit.'));
    if (s.tp1Unit === 'rr' && s.tp1Val < 1) out.push(L('El TP1 es menor a 1R: cerrarás la mayoría en pérdida relativa.', 'TP1 is below 1R: you\'ll close most at a relative loss.'));
    return out;
  }, [s, es]);

  // ---- Estimador ----
  const est = useMemo(() => {
    const riskMoney = s.riskUnit === 'money' ? s.riskVal : bal * s.riskVal / 100;
    const dayMoney = s.dailyLossUnit === 'money' ? s.dailyLossVal : bal * s.dailyLossVal / 100;
    const rrTxt = s.tp1Unit === 'rr' ? `1 : ${s.tp1Val}` : s.runnerUnit === 'rr' ? `1 : ${s.runnerVal}` : '—';
    return { riskMoney: Math.round(riskMoney), dayMoney: Math.round(dayMoney), rrTxt };
  }, [s, bal]);

  async function save(): Promise<string | null> {
    if (!s.name.trim()) { toastErr(L('Ponle un nombre a tu bot.', 'Give your bot a name.')); return null; }
    setBusy(true);
    try {
      const r = await fetch('/api/bots/build', { method: 'POST', body: JSON.stringify({ id: id || undefined, spec: s, lang: es ? 'es' : 'en' }) });
      const j = await r.json(); if (!r.ok) { toastErr(j); setBusy(false); return null; }
      setId(j.id); toast(L('Bot guardado.', 'Bot saved.')); load(); setBusy(false); return j.id as string;
    } catch { toastErr(L('No se pudo guardar.', 'Could not save.')); setBusy(false); return null; }
  }
  // Guarda, pero antes revisa incompletos y muestra el aviso.
  async function saveChecked() {
    const m = findMissing();
    if (m.length) { setWarn(m); setShowWarn(true); return; }
    await save();
  }
  async function saveTpl() {
    const name = prompt(L('Nombre de la plantilla:', 'Template name:'), s.name);
    if (!name) return;
    try { const r = await fetch('/api/bots/templates', { method: 'POST', body: JSON.stringify({ name, spec: s }) }); const j = await r.json(); if (!r.ok) { toastErr(j); return; } toast(L('Plantilla guardada.', 'Template saved.')); loadTpls(); } catch { toastErr(L('No se pudo guardar.', 'Could not save.')); }
  }
  function applyTpl(t: any) { setS({ ...DEFAULT_SPEC, ...(t.spec || {}) }); setId(''); setOff({}); window.scrollTo({ top: 0, behavior: 'smooth' }); toast(L('Plantilla cargada.', 'Template loaded.')); }
  async function delTpl(tid: string) { if (!confirm(L('¿Borrar esta plantilla?', 'Delete this template?'))) return; await fetch('/api/bots/templates?id=' + tid, { method: 'DELETE' }); loadTpls(); }
  function edit(b: any) { setS({ ...DEFAULT_SPEC, ...(b.spec || {}) }); setId(b.id); setOff({}); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function nuevo() { setS({ ...DEFAULT_SPEC }); setId(''); setOff({}); }
  async function del(bid: string) { if (!confirm(L('¿Borrar este bot?', 'Delete this bot?'))) return; await fetch('/api/bots/build?id=' + bid, { method: 'DELETE' }); if (id === bid) nuevo(); load(); }
  async function openGuide() { let bid = id; if (!bid) { bid = (await save()) || ''; } if (bid) window.open(`/api/bots/build?guide=${bid}&lang=${es ? 'es' : 'en'}`, '_blank'); }

  // ---- Sesiones (hora del servidor, aproximada) ----
  const SESSIONS: [string, string, number, number, number, number][] = [
    ['ldn', L('Londres', 'London'), 8, 0, 17, 0],
    ['ny', L('Nueva York', 'New York'), 13, 0, 22, 0],
    ['asia', L('Asia', 'Asia'), 0, 0, 9, 0],
    ['ovl', L('Solape LDN/NY', 'LDN/NY overlap'), 13, 0, 17, 0],
  ];
  const activeSession = SESSIONS.find(([, , fh, fm, th, tm]) => s.signalFromH === fh && s.signalFromM === fm && s.signalToH === th && s.signalToM === tm)?.[0] || 'custom';
  function applySession(fh: number, fm: number, th: number, tm: number) { setS((p) => ({ ...p, signalFromH: fh, signalFromM: fm, signalToH: th, signalToM: tm })); }

  const lbl = { fontSize: 12, color: 'var(--mut)', display: 'block', marginBottom: 4 } as any;
  const inp = { margin: 0, width: '100%', fontSize: 13 } as any;
  // Tarjeta de sección "iluminada" por estado: ok (azul), warn (ámbar), off (tenue).
  const Sec = ({ ic, title, sub, tone, children }: any) => {
    const border = tone === 'warn' ? 'var(--amber, #ba7517)' : tone === 'ok' ? 'rgba(124,140,255,.75)' : 'var(--bd)';
    const bw = tone === 'off' ? 1 : 2;
    return (
      <div className="card" style={{ marginBottom: 14, border: `${bw}px solid ${border}`, opacity: tone === 'off' ? 0.72 : 1 }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: sub ? 2 : 12 }}><span className="card-ic"><OnyxIcon emoji={ic} size={16} /></span> {title}</h3>
        {sub && <p className="muted" style={{ fontSize: 12, marginBottom: 12 }}>{sub}</p>}
        <div className="grid g3" style={{ gap: 12 }}>{children}</div>
      </div>
    );
  };
  const Num = ({ k, t, step = 1, min }: any) => (<div><span style={lbl}>{t}</span><input type="number" step={step} min={min} value={(s as any)[k]} onChange={(e) => set(k, e.target.value === '' ? '' : Number(e.target.value))} style={inp} data-fld={k} /></div>);
  const Txt = ({ k, t, ph }: any) => (<div><span style={lbl}>{t}</span><input value={(s as any)[k]} onChange={(e) => set(k, e.target.value)} placeholder={ph} style={inp} data-fld={k} /></div>);
  const Sel = ({ k, t, opts }: any) => (<div><span style={lbl}>{t}</span><select value={(s as any)[k]} onChange={(e) => set(k, isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value))} style={inp}>{opts.map(([v, o]: any) => <option key={String(v)} value={v}>{o}</option>)}</select></div>);
  const Chk = ({ k, t }: any) => (<label className="row" style={{ gap: 8, cursor: 'pointer', alignItems: 'center' }}><input type="checkbox" checked={!!(s as any)[k]} onChange={(e) => set(k, e.target.checked)} style={{ width: 'auto', margin: 0 }} /> <span style={{ fontSize: 13 }}>{t}</span></label>);

  const U_RISK: any = [['pct', '%'], ['money', '$']];
  const U_SL: any = [['pips', 'pips'], ['atr', '× ATR'], ['pct', L('% precio', '% price')]];
  const U_TP: any = [['rr', 'R (RR)'], ['pips', 'pips'], ['pct', L('% precio', '% price')], ['money', '$']];
  const U_RUN: any = [...U_TP, ['structure', L('estructura', 'structure')]];
  const U_TRAIL: any = [['atr', '× ATR'], ['pips', 'pips'], ['pct', L('% precio', '% price')]];
  const ValU = ({ vk, uk, t, opts, step = 0.1, min }: any) => (
    <div>
      <span style={lbl}>{t}</span>
      <div style={{ display: 'flex', gap: 6 }}>
        <input type="number" step={step} min={min} value={(s as any)[vk]} onChange={(e) => set(vk, e.target.value === '' ? '' : Number(e.target.value))} style={{ ...inp, flex: 1, minWidth: 0 }} data-fld={vk} />
        <select value={(s as any)[uk]} onChange={(e) => set(uk, e.target.value)} style={{ ...inp, width: 104, flex: 'none' }}>{opts.map(([v, o]: any) => <option key={v} value={v}>{o}</option>)}</select>
      </div>
    </div>
  );

  // Tonos de las secciones según lo definido.
  const nz = (x: any) => typeof x === 'number' && x > 0;
  const toneExits = (nz(s.slVal) && nz(s.tp1Val) && nz(s.runnerVal)) ? 'ok' : 'warn';
  const toneRisk = (nz(s.riskVal) && nz(s.dailyLossVal)) ? 'ok' : 'warn';

  return (
    <div style={{ maxWidth: big ? 1500 : 1100, margin: '0 auto', transition: 'max-width .2s' }}>
      {/* Cabecera */}
      <div className="card" style={{ marginBottom: 14, background: 'var(--soft-brand)', border: '1px solid rgba(124,140,255,.5)' }}>
        <div className="row between" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}><OnyxIcon emoji="🤖" size={22} /> {L('Constructor de bots', 'Bot builder')}</h2>
            <p className="muted" style={{ fontSize: 13, margin: '6px 0 0' }}>{L('Arma tu bot por campos, elige qué usar y descarga EA, config y guía.', 'Build your bot by fields, choose what to use, and download EA, config and guide.')}</p>
          </div>
          <button className="btn btn-ghost" onClick={() => setBig((v) => !v)}><OnyxIcon emoji={big ? '🗕' : '🗖'} size={15} /> {big ? L('Reducir', 'Shrink') : L('Pantalla ancha', 'Wide screen')}</button>
        </div>
      </div>

      {/* Barra de completado */}
      <div className="card" style={{ marginBottom: 14, padding: '12px 16px' }}>
        {(() => { const total = REQ.length; const done = total - findMissing().length; const pct = Math.round(100 * done / total); return (
          <>
            <div className="row between" style={{ marginBottom: 6 }}><span style={{ fontSize: 13, fontWeight: 600 }}>{L('Completado', 'Completed')} {pct}%</span><span className="muted" style={{ fontSize: 12 }}>{findMissing().length ? L(`${findMissing().length} campo(s) sin definir`, `${findMissing().length} field(s) undefined`) : L('Todo listo', 'All set')}</span></div>
            <div style={{ height: 6, borderRadius: 99, background: 'var(--bg2)', overflow: 'hidden' }}><div style={{ width: pct + '%', height: '100%', background: pct === 100 ? 'var(--green, #1d9e75)' : 'var(--brand, #5b63d3)' }} /></div>
          </>
        ); })()}
      </div>

      {/* Plantillas */}
      {tpls.length > 0 && (
        <div className="card" style={{ marginBottom: 14, padding: '12px 16px' }}>
          <div className="row between" style={{ marginBottom: 8 }}><span style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 7 }}><OnyxIcon emoji="🗂️" size={15} /> {L('Mis plantillas', 'My templates')}</span></div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {tpls.map((t) => (
              <span key={t.id} className="row" style={{ gap: 4, alignItems: 'center', background: 'var(--bg2)', borderRadius: 99, padding: '4px 6px 4px 12px' }}>
                <button className="btn btn-ghost" style={{ padding: '3px 8px', fontSize: 12, border: 'none' }} onClick={() => applyTpl(t)}>{t.name}</button>
                <button aria-label="del" className="btn btn-ghost" style={{ padding: '2px 6px', fontSize: 11, border: 'none', color: 'var(--red)' }} onClick={() => delTpl(t.id)}>✕</button>
              </span>
            ))}
          </div>
        </div>
      )}

      <Sec ic="⚙️" title={L('General', 'General')} tone="ok">
        <Txt k="name" t={L('Nombre de tu bot', 'Your bot name')} ph={L('Ej: Mi cazador de Londres', 'e.g. My London hunter')} />
        <Sel k="platform" t={L('Plataforma', 'Platform')} opts={[['mt5', 'MetaTrader 5'], ['mt4', 'MetaTrader 4'], ['ctrader', 'cTrader']]} />
        <Txt k="symbol" t={L('Instrumento', 'Instrument')} ph="XAUUSD" />
        <Num k="magic" t={L('Magic (identificador)', 'Magic (id)')} />
        <Sel k="tf" t={L('Temporalidad de entrada', 'Entry timeframe')} opts={TF_LIST} />
      </Sec>

      <Sec ic="🎯" title={L('Entrada', 'Entry')} tone="ok" sub={L('El bot ejecuta la entrada en la plataforma. Elige el gatillo, el sesgo y la sesión.', 'The bot executes the entry on the platform. Pick the trigger, bias and session.')}>
        <Sel k="entryTrigger" t={L('Gatillo de entrada', 'Entry trigger')} opts={[['breakout_swing', L('Ruptura de swing + pullback', 'Swing breakout + pullback')], ['ma_cross', L('Cruce de medias', 'MA cross')], ['rsi', 'RSI'], ['donchian', 'Donchian'], ['time', L('Hora fija', 'Fixed time')]]} />
        <Sel k="trendMode" t={L('Sesgo / tendencia', 'Bias / trend')} opts={[[0, L('Media', 'Moving average')], [1, L('Estructura (HH/HL)', 'Structure (HH/HL)')], [2, 'Donchian']]} />
        <Sel k="trendTF" t={L('Temporalidad del sesgo', 'Bias timeframe')} opts={TF_LIST} />
        <Num k="microSwing" t={L('Tamaño del swing', 'Swing size')} />
        <Num k="maxTradesPerDay" t={L('Máx. ops/día (0=∞)', 'Max trades/day (0=∞)')} />
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', paddingTop: 22 }}><Chk k="allowLongs" t={L('Largos', 'Longs')} /><Chk k="allowShorts" t={L('Cortos', 'Shorts')} /></div>
      </Sec>

      {/* Selector de sesión */}
      <div className="card" style={{ marginBottom: 14, padding: '12px 16px' }}>
        <div className="row" style={{ gap: 7, alignItems: 'center', marginBottom: 10, fontSize: 12, color: 'var(--mut)' }}><OnyxIcon emoji="🕐" size={15} /> {L('Sesión de operación (hora del servidor)', 'Trading session (server time)')}</div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {SESSIONS.map(([kk, nm, fh, fm, th, tm]) => {
            const on = activeSession === kk;
            return <button key={kk} onClick={() => applySession(fh, fm, th, tm)} style={{ fontSize: 13, padding: '7px 13px', borderRadius: 10, cursor: 'pointer', border: on ? '2px solid rgba(124,140,255,.85)' : '1px solid var(--bd)', background: on ? 'var(--soft-brand)' : 'transparent', color: on ? 'var(--brand,#5b63d3)' : 'var(--mut)', fontWeight: on ? 600 : 400 }}>{nm}</button>;
          })}
          <span style={{ fontSize: 13, padding: '7px 13px', borderRadius: 10, border: activeSession === 'custom' ? '2px solid rgba(124,140,255,.85)' : '1px solid var(--bd)', color: 'var(--mut)' }}>{L('Personalizado', 'Custom')} · {String(s.signalFromH).padStart(2, '0')}:{String(s.signalFromM).padStart(2, '0')}–{String(s.signalToH).padStart(2, '0')}:{String(s.signalToM).padStart(2, '0')}</span>
        </div>
        <div className="grid g3" style={{ gap: 12, marginTop: 12 }}>
          <Num k="signalFromH" t={L('Hora inicio', 'From (h)')} /><Num k="signalFromM" t={L('Min inicio', 'From (m)')} />
          <Num k="signalToH" t={L('Hora fin', 'To (h)')} /><Num k="signalToM" t={L('Min fin', 'To (m)')} />
        </div>
      </div>

      <Sec ic="🚪" title={L('Salidas y gestión', 'Exits & management')} tone={toneExits as any} sub={L('Cada objetivo lleva su unidad: $, %, pips o R. El bot la convierte a distancia de precio en tiempo real.', 'Each target has its own unit: $, %, pips or R. The bot converts it to a price distance in real time.')}>
        <ValU vk="slVal" uk="slUnit" t={L('Stop loss', 'Stop loss')} opts={U_SL} />
        <ValU vk="tp1Val" uk="tp1Unit" t={L('TP1 (parcial)', 'TP1 (partial)')} opts={U_TP} />
        <Num k="partialPct" t={L('% que cierra en TP1', '% closed at TP1')} step={5} />
        <ValU vk="runnerVal" uk="runnerUnit" t={L('Runner / TP final', 'Runner / final TP')} opts={U_RUN} />
        <ValU vk="trailVal" uk="trailUnit" t={L('Trailing', 'Trailing')} opts={U_TRAIL} />
        <Num k="beOffsetR" t={L('Break even (en R, 0=BE)', 'Break even (in R, 0=BE)')} step={0.1} />
        <Num k="timeStopBars" t={L('Time-stop (velas, 0=off)', 'Time-stop (bars, 0=off)')} />
        <div style={{ paddingTop: 22 }}><Chk k="useTrail" t={L('Activar trailing', 'Enable trailing')} /></div>
      </Sec>

      <Sec ic="🛡️" title={L('Riesgo', 'Risk')} tone={toneRisk as any} sub={L('Elige la unidad del riesgo y de los límites diarios. En % el tope de seguridad es 5% por operación.', 'Choose the unit for risk and daily limits. In %, the safety cap is 5% per trade.')}>
        <ValU vk="riskVal" uk="riskUnit" t={L('Riesgo por operación', 'Risk per trade')} opts={U_RISK} step={0.05} min={0.01} />
        <Num k="maxLots" t={L('Tope de lotes', 'Max lots')} step={0.01} />
        <ValU vk="dailyLossVal" uk="dailyLossUnit" t={L('Cap de pérdida diaria', 'Daily loss cap')} opts={U_RISK} />
        <ValU vk="dailyProfitVal" uk="dailyProfitUnit" t={L('Objetivo diario (0=off)', 'Daily target (0=off)')} opts={U_RISK} />
      </Sec>

      {/* Estimador */}
      <div className="card" style={{ marginBottom: 14 }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}><span className="card-ic"><OnyxIcon emoji="🧮" size={16} /></span> {L('Estimador rápido', 'Quick estimate')}</h3>
        <div className="grid g3" style={{ gap: 12, alignItems: 'end' }}>
          <div><span style={lbl}>{L('Balance de referencia ($)', 'Reference balance ($)')}</span><input type="number" value={bal} onChange={(e) => setBal(Number(e.target.value) || 0)} style={inp} /></div>
          <div className="stat" style={{ background: 'var(--bg2)', borderRadius: 10, padding: '8px 12px' }}><span style={lbl}>{L('Riesgo por operación', 'Risk per trade')}</span><b style={{ fontSize: 18 }}>${est.riskMoney.toLocaleString()}</b></div>
          <div className="stat" style={{ background: 'var(--bg2)', borderRadius: 10, padding: '8px 12px' }}><span style={lbl}>{L('Pérdida diaria máx.', 'Max daily loss')}</span><b style={{ fontSize: 18 }}>${est.dayMoney.toLocaleString()}</b></div>
          <div className="stat" style={{ background: 'var(--bg2)', borderRadius: 10, padding: '8px 12px' }}><span style={lbl}>R:R</span><b style={{ fontSize: 18 }}>{est.rrTxt}</b></div>
        </div>
      </div>

      {/* Semáforo de coherencia */}
      {issues.length > 0 && (
        <div className="card" style={{ marginBottom: 14, border: '1px solid rgba(240,190,90,.6)', background: 'rgba(240,190,90,.08)' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8, color: 'var(--amber,#854f0b)' }}><OnyxIcon emoji="⚠️" size={16} /> {L('Revisa esta configuración', 'Check this setup')}</h3>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.7 }}>{issues.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </div>
      )}

      <Sec ic="🏦" title={L('Reglas del fondeo (prop firm)', 'Prop-firm rules')} tone="ok">
        <Txt k="firmName" t={L('Nombre del fondeo', 'Firm name')} ph="FTMO" />
        <Sel k="ddType" t={L('Tipo de DD total', 'Total DD type')} opts={[[0, L('Trailing (desde el pico)', 'Trailing (from peak)')], [1, L('Estático (balance inicial)', 'Static (initial balance)')], [2, L('Trailing hasta BE, luego fijo', 'Trailing to BE, then fixed')]]} />
        <Num k="firmDailyLimitPct" t={L('Límite diario del firm (%)', 'Firm daily limit (%)')} step={0.5} />
        <Num k="firmTotalLimitPct" t={L('Límite total del firm (%)', 'Firm total limit (%)')} step={0.5} />
      </Sec>

      <Sec ic="🧯" title={L('Frenos del bot (por debajo del firm)', 'Bot brakes (below firm)')} tone="ok">
        <Num k="acctSoftStopPct" t={L('Freno suave diario (%)', 'Soft daily brake (%)')} step={0.5} />
        <Num k="acctDailyStopPct" t={L('Freno duro diario (%)', 'Hard daily brake (%)')} step={0.5} />
        <Num k="acctMaxDDPct" t={L('Freno total (%)', 'Total brake (%)')} step={0.5} />
      </Sec>

      <Sec ic="🏁" title={L('Objetivo de cuenta', 'Account target')} tone="ok">
        <Sel k="accountMode" t={L('Fase de la cuenta', 'Account phase')} opts={[[0, L('Fase 1 (reto)', 'Phase 1 (challenge)')], [1, L('Fase 2 (verificación)', 'Phase 2 (verification)')], [2, L('Real (fondeada)', 'Real (funded)')]]} />
        <Num k="initBalance" t={L('Balance inicial (0=auto)', 'Initial balance (0=auto)')} />
        <Num k="targetP1" t={L('Objetivo Fase 1 (%)', 'Phase 1 target (%)')} step={0.5} />
        <Num k="targetP2" t={L('Objetivo Fase 2 (%)', 'Phase 2 target (%)')} step={0.5} />
      </Sec>

      <Sec ic="🕐" title={L('Horario y noticias', 'Schedule & news')} tone="ok">
        <Num k="forceCloseHourNY" t={L('Cierre de sesión (hora)', 'Session close (h)')} />
        <Num k="forceCloseMinNY" t={L('Cierre de sesión (min)', 'Session close (m)')} />
        <Txt k="newsCurrencies" t={L('Monedas de noticias', 'News currencies')} ph="USD" />
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', paddingTop: 22 }}>
          <Chk k="useDayClose" t={L('Cerrar fin de sesión', 'Close at session end')} />
          <Chk k="noWeekend" t={L('Sin fin de semana', 'No weekend')} />
          <Chk k="useNewsFilter" t={L('Frenar en noticias', 'Pause on news')} />
        </div>
      </Sec>

      {/* Resumen + acciones */}
      <div className="card" style={{ marginBottom: 14 }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}><span className="card-ic"><OnyxIcon emoji="📋" size={16} /></span> {L('Resumen de tu bot', 'Your bot summary')}</h3>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12.5, background: 'var(--bg2)', borderRadius: 10, padding: 12, margin: 0, fontFamily: 'inherit', lineHeight: 1.6 }}>{summary}</pre>
        <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={saveChecked} disabled={busy}>{busy ? '…' : (id ? L('Guardar cambios', 'Save changes') : L('Guardar bot', 'Save bot'))}</button>
          <button className="btn btn-ghost" onClick={saveTpl}><OnyxIcon emoji="🗂️" size={14} /> {L('Guardar plantilla', 'Save template')}</button>
          <button className="btn btn-ghost" onClick={openGuide}><OnyxIcon emoji="📖" size={14} /> {L('Guía visual (PDF)', 'Visual guide (PDF)')}</button>
          {id && <a className="btn btn-ghost" href={`/api/bots/build?code=${id}`}>{L('EA (.mq5)', 'EA (.mq5)')} ↓</a>}
          {id && <a className="btn btn-ghost" href={`/api/bots/build?download=${id}`}>{L('Config (.set)', 'Config (.set)')} ↓</a>}
          {id && <button className="btn btn-ghost" onClick={nuevo}>{L('Nuevo bot', 'New bot')}</button>}
        </div>
        <p className="muted" style={{ fontSize: 11.5, marginTop: 10, lineHeight: 1.6 }}>{L('El .set configura tu EA base con estas reglas. Prueba SIEMPRE en DEMO antes de real. El código generado y su resultado son responsabilidad del trader; sin promesas de rentabilidad.', 'The .set configures your base EA with these rules. ALWAYS test on DEMO before going live. Generated code and its results are the trader\'s responsibility; no profit promises.')}</p>
      </div>

      {list.length > 0 && (
        <div className="card">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}><span className="card-ic"><OnyxIcon emoji="🗂️" size={16} /></span> {L('Mis bots', 'My bots')}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {list.map((b) => (
              <div key={b.id} className="row between" style={{ background: 'var(--bg2)', borderRadius: 10, padding: '10px 12px', flexWrap: 'wrap', gap: 8 }}>
                <div><b style={{ fontSize: 14 }}>{b.name}</b> <span className="muted" style={{ fontSize: 12 }}>· {String(b.platform).toUpperCase()} · {(b.spec?.symbol) || ''} · magic {b.magic}</span></div>
                <div className="row" style={{ gap: 6 }}>
                  <a className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 12 }} href={`/api/bots/build?guide=${b.id}&lang=${es ? 'es' : 'en'}`} target="_blank">{L('Guía', 'Guide')}</a>
                  <a className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 12 }} href={`/api/bots/build?code=${b.id}`}>.mq5 ↓</a>
                  <a className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 12 }} href={`/api/bots/build?download=${b.id}`}>.set ↓</a>
                  <button className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => edit(b)}>{L('Editar', 'Edit')}</button>
                  <button className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 12, color: 'var(--red)' }} onClick={() => del(b.id)}>{L('Borrar', 'Delete')}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Aviso de campos sin completar */}
      {showWarn && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 }} onClick={() => setShowWarn(false)}>
          <div className="card" style={{ maxWidth: 420, width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}><span className="card-ic" style={{ background: 'rgba(240,190,90,.18)' }}><OnyxIcon emoji="⚠️" size={16} /></span> {L('Campos sin completar', 'Unfinished fields')}</h3>
            <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>{L('Faltan estos campos. Puedes completarlos, dejarlos sin usar o desactivarlos.', 'These fields are missing. You can complete them, leave them unused or disable them.')}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
              {warn.map((w) => (
                <div key={w.key} className="row between" style={{ background: 'var(--bg2)', borderRadius: 10, padding: '8px 12px', gap: 8, flexWrap: 'wrap' }}>
                  <b style={{ fontSize: 13 }}>{w.label}</b>
                  <div className="row" style={{ gap: 6 }}>
                    <button className="btn btn-ghost" style={{ padding: '4px 9px', fontSize: 12 }} onClick={() => { setShowWarn(false); const el = document.querySelector(`[data-fld="${w.key}"]`) as HTMLElement; el?.scrollIntoView({ behavior: 'smooth', block: 'center' }); el?.focus(); }}>{L('Completar', 'Complete')}</button>
                    {w.opt && <button className="btn btn-ghost" style={{ padding: '4px 9px', fontSize: 12 }} onClick={() => setOff((p) => ({ ...p, [w.key]: true }))}>{L('Desactivar', 'Disable')}</button>}
                  </div>
                </div>
              ))}
            </div>
            <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowWarn(false)}>{L('Seguir editando', 'Keep editing')}</button>
              <button className="btn btn-primary" onClick={async () => { setShowWarn(false); await save(); }}>{L('Guardar de todas formas', 'Save anyway')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
