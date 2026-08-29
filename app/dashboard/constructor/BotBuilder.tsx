'use client';
import { useEffect, useMemo, useState } from 'react';
import { useLang } from '@/lib/lang';
import { toast, toastErr } from '@/lib/toast';
import OnyxIcon from '@/app/components/OnyxIcon';
import { DEFAULT_SPEC, summarize, TF_LIST, type BotSpec } from '@/lib/botSpec';

// Constructor "cabina": tarjetas iluminadas con glow, chips de estado, sesión en
// píldoras, aviso de incompletos, estimador, semáforo de coherencia y plantillas.
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
  const [warn, setWarn] = useState<{ key: string; label: string }[]>([]);
  const [showWarn, setShowWarn] = useState(false);
  const [bal, setBal] = useState<number>(10000);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const set = (k: keyof BotSpec, v: any) => { setTouched((t) => ({ ...t, [k as string]: true })); setS((p) => ({ ...p, [k]: v })); };
  const touchAll = () => setTouched(Object.fromEntries(Object.keys(DEFAULT_SPEC).map((k) => [k, true])));

  useEffect(() => { load(); loadTpls(); setS((p) => ({ ...p, botLang: es ? 'es' : 'en' })); }, []);
  async function load() { try { const r = await fetch('/api/bots/build'); const j = await r.json(); setList(j.bots || []); } catch {} }
  async function loadTpls() { try { const r = await fetch('/api/bots/templates'); const j = await r.json(); setTpls(j.templates || []); } catch {} }

  const summary = useMemo(() => summarize(s, !es), [s, es]);
  const nz = (x: any) => typeof x === 'number' && x > 0;

  // Campos obligatorios del bot (sin estos no opera). Los opcionales tienen su switch.
  const REQ: { key: keyof BotSpec; label: string }[] = [
    { key: 'name', label: L('Nombre del bot', 'Bot name') },
    { key: 'symbol', label: L('Instrumento', 'Instrument') },
    { key: 'slVal', label: L('Stop loss', 'Stop loss') },
    { key: 'tp1Val', label: 'TP1' },
    { key: 'runnerVal', label: L('Runner / TP final', 'Runner / final TP') },
    { key: 'riskVal', label: L('Riesgo por operación', 'Risk per trade') },
  ];
  const isEmpty = (key: keyof BotSpec) => { const v = (s as any)[key]; return v === '' || v == null || (typeof v === 'number' && !(v > 0) && key !== 'name' && key !== 'symbol') || (typeof v === 'string' && !v.trim()); };
  function findMissing() { return REQ.filter((r) => isEmpty(r.key)).map((r) => ({ key: r.key as string, label: r.label })); }
  // Progreso = campos obligatorios que TÚ has revisado y son válidos (arranca en 0).
  const reviewed = REQ.filter((r) => touched[r.key as string] && !isEmpty(r.key)).length;
  const pct = Math.round(100 * reviewed / REQ.length);
  const missCount = findMissing().length;

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
  async function saveChecked() { const m = findMissing(); if (m.length) { setWarn(m); setShowWarn(true); return; } await save(); }
  async function saveTpl() {
    const name = prompt(L('Nombre de la plantilla:', 'Template name:'), s.name); if (!name) return;
    try { const r = await fetch('/api/bots/templates', { method: 'POST', body: JSON.stringify({ name, spec: s }) }); const j = await r.json(); if (!r.ok) { toastErr(j); return; } toast(L('Plantilla guardada.', 'Template saved.')); loadTpls(); } catch { toastErr(L('No se pudo guardar.', 'Could not save.')); }
  }
  function applyTpl(t: any) { setS({ ...DEFAULT_SPEC, ...(t.spec || {}) }); setId(''); touchAll(); window.scrollTo({ top: 0, behavior: 'smooth' }); toast(L('Plantilla cargada.', 'Template loaded.')); }
  async function delTpl(tid: string) { if (!confirm(L('¿Borrar esta plantilla?', 'Delete this template?'))) return; await fetch('/api/bots/templates?id=' + tid, { method: 'DELETE' }); loadTpls(); }
  function edit(b: any) { setS({ ...DEFAULT_SPEC, ...(b.spec || {}) }); setId(b.id); touchAll(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function nuevo() { setS({ ...DEFAULT_SPEC }); setId(''); setTouched({}); }
  async function del(bid: string) { if (!confirm(L('¿Borrar este bot?', 'Delete this bot?'))) return; await fetch('/api/bots/build?id=' + bid, { method: 'DELETE' }); if (id === bid) nuevo(); load(); }
  async function openGuide() { let bid = id; if (!bid) { bid = (await save()) || ''; } if (bid) window.open(`/api/bots/build?guide=${bid}&lang=${es ? 'es' : 'en'}`, '_blank'); }

  const SESSIONS: [string, string, number, number, number, number][] = [
    ['ldn', L('Londres', 'London'), 8, 0, 17, 0],
    ['ny', L('Nueva York', 'New York'), 13, 0, 22, 0],
    ['asia', L('Asia', 'Asia'), 0, 0, 9, 0],
    ['ovl', L('Solape LDN/NY', 'LDN/NY overlap'), 13, 0, 17, 0],
  ];
  const activeSession = SESSIONS.find(([, , fh, fm, th, tm]) => s.signalFromH === fh && s.signalFromM === fm && s.signalToH === th && s.signalToM === tm)?.[0] || 'custom';
  function applySession(fh: number, fm: number, th: number, tm: number) { setS((p) => ({ ...p, signalFromH: fh, signalFromM: fm, signalToH: th, signalToM: tm })); }

  // ---- Controles ----
  const In = ({ k, ph, type = 'text', step, min }: any) => (<input className="bbx-in" data-fld={k} type={type} step={step} min={min} value={(s as any)[k]} placeholder={ph} onChange={(e) => set(k, type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)} />);
  const Sel = ({ k, opts }: any) => (<select className="bbx-in bbx-sel" value={(s as any)[k]} onChange={(e) => set(k, isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value))}>{opts.map(([v, o]: any) => <option key={String(v)} value={v}>{o}</option>)}</select>);
  const Fld = ({ t, k, opts, type, step, min, ph }: any) => (<div><span className="bbx-lbl">{t}</span>{opts ? <Sel k={k} opts={opts} /> : <In k={k} type={type || 'text'} step={step} min={min} ph={ph} />}</div>);
  const Toggle = ({ k, t }: any) => (<button type="button" className={'bbx-tg' + ((s as any)[k] ? ' on' : '')} onClick={() => set(k, !(s as any)[k])}><OnyxIcon emoji={(s as any)[k] ? '✅' : '⭕'} size={13} /> {t}</button>);
  const Switch = ({ on, onClick }: any) => (<button type="button" className={'bbx-sw' + (on ? ' on' : '')} onClick={onClick} aria-label="toggle"><span /></button>);

  const U_RISK: any = [['pct', '%'], ['money', '$']];
  // Mismo set de unidades en TODA la zona de salidas (SL, TP, runner, trailing).
  const U_EXIT: any = [['pips', 'pips'], ['rr', 'R (RR)'], ['pct', L('% precio', '% price')], ['money', '$'], ['atr', '× ATR']];

  const chip = (status: string) => status === 'off' ? { c: 'off', t: L('Desactivado', 'Disabled') } : status === 'warn' ? { c: 'warn', t: L('Sin definir', 'Undefined') } : { c: 'ok', t: L('Activo', 'Active') };
  // Tarjeta iluminada con valor + unidad. tgl = {on, toggle} para activar/desactivar.
  const ParamU = ({ ic, t, vk, uk, opts, step = 0.1, min, tgl }: any) => {
    const dis = tgl ? !tgl.on : false;
    const status = dis ? 'off' : nz((s as any)[vk]) ? 'ok' : 'warn';
    const ch = chip(status);
    return (
      <div className={'bbx-pc bbx-pc-' + status}>
        <div className="bbx-pc-h"><span className="bbx-ic sm"><OnyxIcon emoji={ic} size={14} /></span><span className="bbx-pc-t">{t}</span><span className={'bbx-chip bbx-chip-' + ch.c}>{ch.t}</span>{tgl && <Switch on={tgl.on} onClick={tgl.toggle} />}</div>
        <div className="bbx-row">
          <input className="bbx-in" data-fld={vk} type="number" step={step} min={min} disabled={dis} style={{ flex: 1, minWidth: 0 }} value={(s as any)[vk]} onChange={(e) => set(vk, e.target.value === '' ? '' : Number(e.target.value))} />
          <select className="bbx-in bbx-sel" style={{ width: 96, flex: 'none' }} disabled={dis} value={(s as any)[uk]} onChange={(e) => set(uk, e.target.value)}>{opts.map(([v, o]: any) => <option key={v} value={v}>{o}</option>)}</select>
        </div>
      </div>
    );
  };
  // Tarjeta iluminada de un parámetro numérico simple. tgl opcional.
  const ParamN = ({ ic, t, k, step = 1, min, tgl }: any) => {
    const dis = tgl ? !tgl.on : false;
    const status = dis ? 'off' : nz((s as any)[k]) ? 'ok' : 'warn';
    const ch = chip(status);
    return (
      <div className={'bbx-pc bbx-pc-' + status}>
        <div className="bbx-pc-h"><span className="bbx-ic sm"><OnyxIcon emoji={ic} size={14} /></span><span className="bbx-pc-t">{t}</span><span className={'bbx-chip bbx-chip-' + ch.c}>{ch.t}</span>{tgl && <Switch on={tgl.on} onClick={tgl.toggle} />}</div>
        <input className="bbx-in" data-fld={k} type="number" step={step} min={min} disabled={dis} value={(s as any)[k]} onChange={(e) => set(k, e.target.value === '' ? '' : Number(e.target.value))} />
      </div>
    );
  };
  const Panel = ({ ic, title, sub, children }: any) => (
    <div className="bbx-panel">
      <div className="bbx-panel-h"><span className="bbx-ic"><OnyxIcon emoji={ic} size={16} /></span><div><div>{title}</div>{sub && <div className="bbx-sub">{sub}</div>}</div></div>
      <div className="bbx-grid">{children}</div>
    </div>
  );

  const allReviewed = pct === 100;

  return (
    <div className="bbx" style={{ maxWidth: big ? 1500 : 1120, margin: '0 auto' }}>
      <style>{`
      .bbx{--ac:#8b93ff;--ac2:#5b63d3;--ok:#5fe0aa;--wn:#f2c265;--ink:#eef0fa;--mut:#98a0b8;--line:rgba(255,255,255,.09)}
      .bbx *{box-sizing:border-box}
      .bbx-panel{background:linear-gradient(180deg,rgba(34,37,54,.72),rgba(23,25,38,.72));border:1px solid rgba(139,147,255,.20);border-radius:16px;padding:16px 18px;margin-bottom:14px;box-shadow:0 12px 34px rgba(0,0,0,.30)}
      .bbx-panel-h{display:flex;align-items:center;gap:11px;font-size:15px;font-weight:600;color:var(--ink);margin-bottom:14px}
      .bbx-sub{font-size:12px;color:var(--mut);font-weight:400;margin-top:2px;max-width:640px}
      .bbx-ic{width:32px;height:32px;border-radius:10px;background:rgba(139,147,255,.16);display:flex;align-items:center;justify-content:center;color:#b9beff;box-shadow:inset 0 0 16px rgba(139,147,255,.22);flex:none}
      .bbx-ic.sm{width:26px;height:26px;border-radius:8px}
      .bbx-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px}
      .bbx-lbl{display:block;font-size:11.5px;color:var(--mut);margin-bottom:5px}
      .bbx-in{width:100%;background:rgba(255,255,255,.05);border:1px solid var(--line);color:var(--ink);border-radius:9px;padding:8px 11px;font-size:13px;outline:none;transition:border .15s,box-shadow .15s;height:36px}
      .bbx-in:focus{border-color:rgba(139,147,255,.75);box-shadow:0 0 0 3px rgba(139,147,255,.20)}
      .bbx-sel{appearance:none;-webkit-appearance:none;cursor:pointer;background-image:linear-gradient(45deg,transparent 50%,var(--mut) 50%),linear-gradient(135deg,var(--mut) 50%,transparent 50%);background-position:calc(100% - 15px) 15px,calc(100% - 10px) 15px;background-size:5px 5px,5px 5px;background-repeat:no-repeat;padding-right:26px}
      .bbx-sel option{background:#1b1d2b;color:var(--ink)}
      .bbx-row{display:flex;gap:6px}
      .bbx-pc{background:linear-gradient(180deg,rgba(36,39,58,.78),rgba(25,27,42,.78));border:1.5px solid rgba(255,255,255,.08);border-radius:13px;padding:12px 13px;transition:.18s}
      .bbx-pc-ok{border-color:rgba(139,147,255,.55);box-shadow:0 0 22px rgba(139,147,255,.15)}
      .bbx-pc-warn{border-color:rgba(242,194,101,.5);box-shadow:0 0 22px rgba(242,194,101,.13)}
      .bbx-pc-off{opacity:.52}
      .bbx-pc-h{display:flex;align-items:center;gap:8px;margin-bottom:10px}
      .bbx-pc-t{font-size:12.5px;font-weight:600;color:var(--ink);flex:1;line-height:1.2}
      .bbx-chip{font-size:10px;padding:2px 8px;border-radius:99px;font-weight:600;white-space:nowrap}
      .bbx-chip-ok{background:rgba(45,210,150,.16);color:var(--ok)}
      .bbx-chip-warn{background:rgba(242,194,101,.16);color:var(--wn)}
      .bbx-chip-off{background:rgba(255,255,255,.07);color:var(--mut)}
      .bbx-tg{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;padding:7px 12px;border-radius:9px;border:1px solid var(--line);background:rgba(255,255,255,.04);color:var(--mut);cursor:pointer;transition:.15s}
      .bbx-tg.on{border-color:rgba(139,147,255,.6);background:rgba(139,147,255,.14);color:#c8ccff;box-shadow:0 0 14px rgba(139,147,255,.2)}
      .bbx-hero{background:linear-gradient(135deg,rgba(60,52,137,.55),rgba(91,99,211,.32));border:1px solid rgba(139,147,255,.4);border-radius:16px;padding:18px 20px;margin-bottom:14px;box-shadow:0 12px 34px rgba(50,40,120,.28)}
      .bbx-h2{margin:0;font-size:18px;font-weight:700;color:#fff;display:flex;align-items:center;gap:10px}
      .bbx-prog{height:8px;border-radius:99px;background:rgba(255,255,255,.07);overflow:hidden}
      .bbx-prog>i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#8b93ff,#5b63d3);box-shadow:0 0 16px rgba(139,147,255,.65);transition:width .3s}
      .bbx-prog.full>i{background:linear-gradient(90deg,#5fe0aa,#1d9e75);box-shadow:0 0 16px rgba(45,210,150,.6)}
      .bbx-ses{font-size:13px;padding:7px 14px;border-radius:10px;border:1px solid var(--line);color:var(--mut);background:transparent;cursor:pointer;transition:.15s}
      .bbx-ses.on{border-color:rgba(139,147,255,.75);background:rgba(139,147,255,.15);color:#cdd1ff;box-shadow:0 0 18px rgba(139,147,255,.3)}
      .bbx-btn{display:inline-flex;align-items:center;gap:7px;font-size:13px;font-weight:600;padding:9px 15px;border-radius:10px;cursor:pointer;border:1px solid var(--line);background:rgba(255,255,255,.05);color:#e2e5f4;transition:.15s}
      .bbx-btn:hover{background:rgba(255,255,255,.09)}
      .bbx-btn.primary{background:linear-gradient(90deg,#6f77ea,#5b63d3);border:none;color:#fff;box-shadow:0 8px 22px rgba(91,99,211,.4)}
      .bbx-metric{background:rgba(255,255,255,.04);border:1px solid var(--line);border-radius:11px;padding:9px 13px}
      .bbx-metric b{font-size:19px;color:var(--ink);display:block;margin-top:2px}
      .bbx-tplchip{display:inline-flex;align-items:center;gap:2px;background:rgba(255,255,255,.05);border:1px solid var(--line);border-radius:99px;padding:3px 4px 3px 6px}
      .bbx-tplchip button{border:none;background:none;cursor:pointer}
      .bbx-sw{width:34px;height:19px;border-radius:99px;background:rgba(255,255,255,.14);border:none;cursor:pointer;position:relative;transition:.15s;flex:none;padding:0}
      .bbx-sw.on{background:linear-gradient(90deg,#6f77ea,#5b63d3);box-shadow:0 0 12px rgba(139,147,255,.5)}
      .bbx-sw span{position:absolute;top:2px;left:2px;width:15px;height:15px;border-radius:50%;background:#fff;transition:.15s}
      .bbx-sw.on span{left:17px}
      .bbx-in:disabled{opacity:.45;cursor:not-allowed}
      `}</style>

      {/* Hero */}
      <div className="bbx-hero">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h2 className="bbx-h2"><OnyxIcon emoji="🤖" size={22} /> {L('Constructor de bots', 'Bot builder')}</h2>
            <p style={{ fontSize: 13, margin: '6px 0 0', color: 'rgba(255,255,255,.82)' }}>{L('Arma tu bot por campos, elige qué usar y descarga EA, config y guía.', 'Build your bot by fields, choose what to use, and download EA, config and guide.')}</p>
          </div>
          <button className="bbx-btn" onClick={() => setBig((v) => !v)}><OnyxIcon emoji={big ? '🗕' : '🗖'} size={14} /> {big ? L('Reducir', 'Shrink') : L('Pantalla ancha', 'Wide screen')}</button>
        </div>
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12.5, color: '#fff' }}><span style={{ fontWeight: 600 }}>{L('Revisado', 'Reviewed')} {pct}%</span><span style={{ color: 'rgba(255,255,255,.8)' }}>{missCount ? L(`${missCount} campo(s) sin definir`, `${missCount} field(s) undefined`) : allReviewed ? L('Todo listo', 'All set') : L('Revisa y ajusta tus campos', 'Review and adjust your fields')}</span></div>
          <div className={'bbx-prog' + (allReviewed ? ' full' : '')}><i style={{ width: pct + '%' }} /></div>
        </div>
      </div>

      {/* Plantillas */}
      {tpls.length > 0 && (
        <div className="bbx-panel" style={{ padding: '13px 16px' }}>
          <div className="bbx-panel-h" style={{ marginBottom: 10, fontSize: 13.5 }}><span className="bbx-ic sm"><OnyxIcon emoji="🗂️" size={14} /></span> {L('Mis plantillas', 'My templates')}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {tpls.map((t) => (
              <span key={t.id} className="bbx-tplchip">
                <button style={{ color: '#dfe2f0', fontSize: 12.5, padding: '3px 6px' }} onClick={() => applyTpl(t)}>{t.name}</button>
                <button aria-label="del" style={{ color: 'var(--wn)', fontSize: 12, padding: '2px 6px' }} onClick={() => delTpl(t.id)}>✕</button>
              </span>
            ))}
          </div>
        </div>
      )}

      <Panel ic="⚙️" title={L('General', 'General')}>
        <Fld t={L('Nombre de tu bot', 'Your bot name')} k="name" ph={L('Ej: Mi cazador de Londres', 'e.g. My London hunter')} />
        <Fld t={L('Plataforma', 'Platform')} k="platform" opts={[['mt5', 'MetaTrader 5'], ['mt4', 'MetaTrader 4'], ['ctrader', 'cTrader']]} />
        <Fld t={L('Instrumento', 'Instrument')} k="symbol" ph="XAUUSD" />
        <Fld t={L('Magic (identificador)', 'Magic (id)')} k="magic" type="number" />
        <Fld t={L('Temporalidad de entrada', 'Entry timeframe')} k="tf" opts={TF_LIST} />
        <Fld t={L('Idioma del bot (panel y EA)', 'Bot language (panel & EA)')} k="botLang" opts={[['es', 'Español'], ['en', 'English']]} />
      </Panel>

      <Panel ic="🎯" title={L('Entrada', 'Entry')} sub={L('El bot ejecuta la entrada en la plataforma. Elige el gatillo, el sesgo y la sesión.', 'The bot executes the entry on the platform. Pick the trigger, bias and session.')}>
        <Fld t={L('Gatillo de entrada', 'Entry trigger')} k="entryTrigger" opts={[['breakout_swing', L('Ruptura de swing + pullback', 'Swing breakout + pullback')], ['ma_cross', L('Cruce de medias', 'MA cross')], ['rsi', 'RSI'], ['donchian', 'Donchian'], ['time', L('Hora fija', 'Fixed time')]]} />
        <Fld t={L('Sesgo / tendencia', 'Bias / trend')} k="trendMode" opts={[[0, L('Media', 'Moving average')], [1, L('Estructura (HH/HL)', 'Structure (HH/HL)')], [2, 'Donchian']]} />
        <Fld t={L('Temporalidad del sesgo', 'Bias timeframe')} k="trendTF" opts={TF_LIST} />
        <Fld t={L('Tamaño del swing', 'Swing size')} k="microSwing" type="number" />
        <Fld t={L('Máx. ops/día (0=∞)', 'Max trades/day (0=∞)')} k="maxTradesPerDay" type="number" />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', paddingTop: 20 }}><Toggle k="allowLongs" t={L('Largos', 'Longs')} /><Toggle k="allowShorts" t={L('Cortos', 'Shorts')} /></div>
      </Panel>

      {/* Sesión */}
      <div className="bbx-panel">
        <div className="bbx-panel-h" style={{ marginBottom: 12 }}><span className="bbx-ic"><OnyxIcon emoji="🕐" size={16} /></span><div><div>{L('Sesión de operación', 'Trading session')}</div><div className="bbx-sub">{L('Hora del servidor de tu bróker.', 'Your broker\'s server time.')}</div></div></div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {SESSIONS.map(([kk, nm, fh, fm, th, tm]) => <button key={kk} className={'bbx-ses' + (activeSession === kk ? ' on' : '')} onClick={() => applySession(fh, fm, th, tm)}>{nm}</button>)}
          <span className={'bbx-ses' + (activeSession === 'custom' ? ' on' : '')}>{L('Personalizado', 'Custom')} · {String(s.signalFromH).padStart(2, '0')}:{String(s.signalFromM).padStart(2, '0')}–{String(s.signalToH).padStart(2, '0')}:{String(s.signalToM).padStart(2, '0')}</span>
        </div>
        <div className="bbx-grid">
          <Fld t={L('Hora inicio', 'From (h)')} k="signalFromH" type="number" /><Fld t={L('Min inicio', 'From (m)')} k="signalFromM" type="number" />
          <Fld t={L('Hora fin', 'To (h)')} k="signalToH" type="number" /><Fld t={L('Min fin', 'To (m)')} k="signalToM" type="number" />
        </div>
      </div>

      {/* Salidas — tarjetas iluminadas */}
      <div className="bbx-panel">
        <div className="bbx-panel-h"><span className="bbx-ic"><OnyxIcon emoji="🚪" size={16} /></span><div><div>{L('Salidas y gestión', 'Exits & management')}</div><div className="bbx-sub">{L('Mismas unidades en todos: pips, R, %, $ o × ATR. El bot las convierte a distancia de precio en tiempo real. Usa el interruptor para activar o desactivar lo opcional.', 'Same units everywhere: pips, R, %, $ or × ATR. The bot converts them to a price distance in real time. Use the switch to enable or disable optional items.')}</div></div></div>
        <div className="bbx-grid">
          <ParamU ic="🛡️" t={L('Stop loss', 'Stop loss')} vk="slVal" uk="slUnit" opts={U_EXIT} />
          <ParamU ic="🎯" t={L('TP1 (parcial)', 'TP1 (partial)')} vk="tp1Val" uk="tp1Unit" opts={U_EXIT} />
          <ParamN ic="✂️" t={L('% que cierra en TP1', '% closed at TP1')} k="partialPct" step={5} />
          <ParamU ic="🏃" t={L('Runner / TP final', 'Runner / final TP')} vk="runnerVal" uk="runnerUnit" opts={U_EXIT} />
          <ParamU ic="📈" t={L('Trailing', 'Trailing')} vk="trailVal" uk="trailUnit" opts={U_EXIT} tgl={{ on: s.useTrail, toggle: () => set('useTrail', !s.useTrail) }} />
          <ParamN ic="⚖️" t={L('Break even (en R, 0=BE)', 'Break even (in R, 0=BE)')} k="beOffsetR" step={0.1} />
          <ParamN ic="⏱️" t={L('Time-stop (velas)', 'Time-stop (bars)')} k="timeStopBars" tgl={{ on: nz(s.timeStopBars), toggle: () => set('timeStopBars', nz(s.timeStopBars) ? 0 : 12) }} />
        </div>
      </div>

      {/* Riesgo — tarjetas iluminadas */}
      <div className="bbx-panel">
        <div className="bbx-panel-h"><span className="bbx-ic"><OnyxIcon emoji="🛡️" size={16} /></span><div><div>{L('Riesgo', 'Risk')}</div><div className="bbx-sub">{L('Elige la unidad del riesgo y de los límites diarios. En % el tope de seguridad es 5% por operación.', 'Choose the unit for risk and daily limits. In %, the safety cap is 5% per trade.')}</div></div></div>
        <div className="bbx-grid">
          <ParamU ic="💠" t={L('Riesgo por operación', 'Risk per trade')} vk="riskVal" uk="riskUnit" opts={U_RISK} step={0.05} min={0.01} />
          <ParamN ic="📦" t={L('Tope de lotes', 'Max lots')} k="maxLots" step={0.01} />
          <ParamU ic="🧯" t={L('Cap de pérdida diaria', 'Daily loss cap')} vk="dailyLossVal" uk="dailyLossUnit" opts={U_RISK} tgl={{ on: nz(s.dailyLossVal), toggle: () => set('dailyLossVal', nz(s.dailyLossVal) ? 0 : 1.5) }} />
          <ParamU ic="🎁" t={L('Objetivo diario', 'Daily target')} vk="dailyProfitVal" uk="dailyProfitUnit" opts={U_RISK} tgl={{ on: nz(s.dailyProfitVal), toggle: () => set('dailyProfitVal', nz(s.dailyProfitVal) ? 0 : 2) }} />
        </div>
      </div>

      {/* Estimador */}
      <div className="bbx-panel">
        <div className="bbx-panel-h"><span className="bbx-ic"><OnyxIcon emoji="🧮" size={16} /></span> {L('Estimador rápido', 'Quick estimate')}</div>
        <div className="bbx-grid" style={{ alignItems: 'end' }}>
          <div><span className="bbx-lbl">{L('Balance de referencia ($)', 'Reference balance ($)')}</span><input className="bbx-in" type="number" value={bal} onChange={(e) => setBal(Number(e.target.value) || 0)} /></div>
          <div className="bbx-metric"><span className="bbx-lbl">{L('Riesgo por operación', 'Risk per trade')}</span><b>${est.riskMoney.toLocaleString()}</b></div>
          <div className="bbx-metric"><span className="bbx-lbl">{L('Pérdida diaria máx.', 'Max daily loss')}</span><b>${est.dayMoney.toLocaleString()}</b></div>
          <div className="bbx-metric"><span className="bbx-lbl">R:R</span><b>{est.rrTxt}</b></div>
        </div>
      </div>

      {/* Semáforo */}
      {issues.length > 0 && (
        <div className="bbx-panel" style={{ border: '1px solid rgba(242,194,101,.5)', boxShadow: '0 0 24px rgba(242,194,101,.14)' }}>
          <div className="bbx-panel-h" style={{ color: 'var(--wn)' }}><span className="bbx-ic" style={{ background: 'rgba(242,194,101,.16)', color: 'var(--wn)', boxShadow: 'inset 0 0 16px rgba(242,194,101,.2)' }}><OnyxIcon emoji="⚠️" size={16} /></span> {L('Revisa esta configuración', 'Check this setup')}</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.7, color: 'var(--ink)' }}>{issues.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </div>
      )}

      <Panel ic="🏦" title={L('Reglas del fondeo (prop firm)', 'Prop-firm rules')}>
        <Fld t={L('Nombre del fondeo', 'Firm name')} k="firmName" ph="FTMO" />
        <Fld t={L('Tipo de DD total', 'Total DD type')} k="ddType" opts={[[0, L('Trailing (desde el pico)', 'Trailing (from peak)')], [1, L('Estático (balance inicial)', 'Static (initial balance)')], [2, L('Trailing hasta BE, luego fijo', 'Trailing to BE, then fixed')]]} />
        <Fld t={L('Límite diario del firm (%)', 'Firm daily limit (%)')} k="firmDailyLimitPct" type="number" step={0.5} />
        <Fld t={L('Límite total del firm (%)', 'Firm total limit (%)')} k="firmTotalLimitPct" type="number" step={0.5} />
      </Panel>

      <Panel ic="🧯" title={L('Frenos del bot (por debajo del firm)', 'Bot brakes (below firm)')}>
        <Fld t={L('Freno suave diario (%)', 'Soft daily brake (%)')} k="acctSoftStopPct" type="number" step={0.5} />
        <Fld t={L('Freno duro diario (%)', 'Hard daily brake (%)')} k="acctDailyStopPct" type="number" step={0.5} />
        <Fld t={L('Freno total (%)', 'Total brake (%)')} k="acctMaxDDPct" type="number" step={0.5} />
      </Panel>

      <Panel ic="🏁" title={L('Objetivo de cuenta', 'Account target')}>
        <Fld t={L('Fase de la cuenta', 'Account phase')} k="accountMode" opts={[[0, L('Fase 1 (reto)', 'Phase 1 (challenge)')], [1, L('Fase 2 (verificación)', 'Phase 2 (verification)')], [2, L('Real (fondeada)', 'Real (funded)')]]} />
        <Fld t={L('Balance inicial (0=auto)', 'Initial balance (0=auto)')} k="initBalance" type="number" />
        <Fld t={L('Objetivo Fase 1 (%)', 'Phase 1 target (%)')} k="targetP1" type="number" step={0.5} />
        <Fld t={L('Objetivo Fase 2 (%)', 'Phase 2 target (%)')} k="targetP2" type="number" step={0.5} />
      </Panel>

      <Panel ic="🕐" title={L('Horario y noticias', 'Schedule & news')}>
        <Fld t={L('Cierre de sesión (hora)', 'Session close (h)')} k="forceCloseHourNY" type="number" />
        <Fld t={L('Cierre de sesión (min)', 'Session close (m)')} k="forceCloseMinNY" type="number" />
        <Fld t={L('Monedas de noticias', 'News currencies')} k="newsCurrencies" ph="USD" />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 20 }}>
          <Toggle k="useDayClose" t={L('Cerrar fin de sesión', 'Close at session end')} />
          <Toggle k="noWeekend" t={L('Sin fin de semana', 'No weekend')} />
          <Toggle k="useNewsFilter" t={L('Frenar en noticias', 'Pause on news')} />
        </div>
      </Panel>

      {/* Resumen + acciones */}
      <div className="bbx-panel">
        <div className="bbx-panel-h"><span className="bbx-ic"><OnyxIcon emoji="📋" size={16} /></span> {L('Resumen de tu bot', 'Your bot summary')}</div>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12.5, background: 'rgba(0,0,0,.28)', border: '1px solid var(--line)', borderRadius: 11, padding: 13, margin: 0, fontFamily: 'inherit', lineHeight: 1.6, color: 'var(--ink)' }}>{summary}</pre>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <button className="bbx-btn primary" onClick={saveChecked} disabled={busy}>{busy ? '…' : (id ? L('Guardar cambios', 'Save changes') : L('Guardar bot', 'Save bot'))}</button>
          <button className="bbx-btn" onClick={saveTpl}><OnyxIcon emoji="🗂️" size={14} /> {L('Guardar plantilla', 'Save template')}</button>
          <button className="bbx-btn" onClick={openGuide}><OnyxIcon emoji="📖" size={14} /> {L('Guía visual (PDF)', 'Visual guide (PDF)')}</button>
          {id && <a className="bbx-btn" href={`/api/bots/build?code=${id}`}>{L('EA (.mq5)', 'EA (.mq5)')} ↓</a>}
          {id && <a className="bbx-btn" href={`/api/bots/build?download=${id}`}>{L('Config (.set)', 'Config (.set)')} ↓</a>}
          {id && <button className="bbx-btn" onClick={nuevo}>{L('Nuevo bot', 'New bot')}</button>}
        </div>
        <p style={{ fontSize: 11.5, marginTop: 10, lineHeight: 1.6, color: 'var(--mut)' }}>{L('El .set configura tu EA base con estas reglas. Prueba SIEMPRE en DEMO antes de real. El código generado y su resultado son responsabilidad del trader; sin promesas de rentabilidad.', 'The .set configures your base EA with these rules. ALWAYS test on DEMO before going live. Generated code and its results are the trader\'s responsibility; no profit promises.')}</p>
      </div>

      {list.length > 0 && (
        <div className="bbx-panel">
          <div className="bbx-panel-h"><span className="bbx-ic"><OnyxIcon emoji="🗂️" size={16} /></span> {L('Mis bots', 'My bots')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {list.map((b) => (
              <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,.04)', border: '1px solid var(--line)', borderRadius: 11, padding: '10px 13px', flexWrap: 'wrap', gap: 8 }}>
                <div><b style={{ fontSize: 14, color: 'var(--ink)' }}>{b.name}</b> <span style={{ fontSize: 12, color: 'var(--mut)' }}>· {String(b.platform).toUpperCase()} · {(b.spec?.symbol) || ''} · magic {b.magic}</span></div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <a className="bbx-btn" style={{ padding: '5px 10px', fontSize: 12 }} href={`/api/bots/build?guide=${b.id}&lang=${es ? 'es' : 'en'}`} target="_blank">{L('Guía', 'Guide')}</a>
                  <a className="bbx-btn" style={{ padding: '5px 10px', fontSize: 12 }} href={`/api/bots/build?code=${b.id}`}>.mq5 ↓</a>
                  <a className="bbx-btn" style={{ padding: '5px 10px', fontSize: 12 }} href={`/api/bots/build?download=${b.id}`}>.set ↓</a>
                  <button className="bbx-btn" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => edit(b)}>{L('Editar', 'Edit')}</button>
                  <button className="bbx-btn" style={{ padding: '5px 10px', fontSize: 12, color: 'var(--wn)' }} onClick={() => del(b.id)}>{L('Borrar', 'Delete')}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Aviso de incompletos */}
      {showWarn && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(6,8,16,.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 }} onClick={() => setShowWarn(false)}>
          <div className="bbx" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 430, width: '100%' }}>
            <div className="bbx-panel" style={{ margin: 0, border: '1px solid rgba(242,194,101,.5)', boxShadow: '0 0 40px rgba(242,194,101,.18)' }}>
              <div className="bbx-panel-h"><span className="bbx-ic" style={{ background: 'rgba(242,194,101,.16)', color: 'var(--wn)' }}><OnyxIcon emoji="⚠️" size={16} /></span> {L('Campos sin completar', 'Unfinished fields')}</div>
              <p style={{ fontSize: 13, marginTop: 0, marginBottom: 12, color: 'var(--mut)' }}>{L('Faltan estos campos. Puedes completarlos, desactivarlos o guardar de todas formas.', 'These fields are missing. You can complete them, disable them or save anyway.')}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                {warn.map((w) => (
                  <div key={w.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,.04)', border: '1px solid var(--line)', borderRadius: 10, padding: '8px 12px', gap: 8, flexWrap: 'wrap' }}>
                    <b style={{ fontSize: 13, color: 'var(--ink)' }}>{w.label}</b>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="bbx-btn" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => { setShowWarn(false); const el = document.querySelector(`[data-fld="${w.key}"]`) as HTMLElement; el?.scrollIntoView({ behavior: 'smooth', block: 'center' }); el?.focus(); }}>{L('Completar', 'Complete')}</button>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="bbx-btn" onClick={() => setShowWarn(false)}>{L('Seguir editando', 'Keep editing')}</button>
                <button className="bbx-btn primary" onClick={async () => { setShowWarn(false); await save(); }}>{L('Guardar de todas formas', 'Save anyway')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
