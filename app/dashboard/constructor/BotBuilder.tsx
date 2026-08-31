'use client';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useLang } from '@/lib/lang';
import { toast, toastErr } from '@/lib/toast';
import OnyxIcon from '@/app/components/OnyxIcon';
import { DEFAULT_SPEC, summarize, tfOptions, SYMBOL_HINTS, type BotSpec } from '@/lib/botSpec';

// Contexto para los controles: evita recrear componentes en cada render (lo que
// desmontaba los inputs y saltaba el scroll al inicio al escribir).
const BB = createContext<any>({ s: {}, set: () => {}, es: true });
const nz = (x: any) => typeof x === 'number' && x > 0;
const Lc = (es: boolean, a: string, b: string) => (es ? a : b);
const chipOf = (status: string, es: boolean) => status === 'off' ? { c: 'off', t: Lc(es, 'Desactivado', 'Disabled') } : status === 'warn' ? { c: 'warn', t: Lc(es, 'Sin definir', 'Undefined') } : { c: 'ok', t: Lc(es, 'Activo', 'Active') };

function Fld({ t, k, opts, type, step, min, ph, hint, list }: any) {
  const { s, set } = useContext(BB);
  return (<div><span className="bbx-lbl">{t}</span>
    {opts
      ? <select className="bbx-in bbx-sel" value={s[k]} onChange={(e) => set(k, isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value))}>{opts.map(([v, o]: any) => <option key={String(v)} value={v}>{o}</option>)}</select>
      : <input className="bbx-in" data-fld={k} type={type || 'text'} step={step} min={min} list={list} value={s[k]} placeholder={ph} onChange={(e) => set(k, type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)} />}
    {hint && <div className="bbx-hint">{hint}</div>}</div>);
}
function Toggle({ k, t }: any) { const { s, set } = useContext(BB); return <button type="button" className={'bbx-tg' + (s[k] ? ' on' : '')} onClick={() => set(k, !s[k])}><OnyxIcon emoji={s[k] ? '✅' : '⭕'} size={13} /> {t}</button>; }
function Switch({ on, onClick }: any) { return <button type="button" className={'bbx-sw' + (on ? ' on' : '')} onClick={onClick} aria-label="toggle"><span /></button>; }
function ParamU({ ic, t, vk, uk, opts, step = 0.1, min, tgl, hint }: any) {
  const { s, set, es } = useContext(BB); const dis = tgl ? !tgl.on : false;
  const status = dis ? 'off' : nz(s[vk]) ? 'ok' : 'warn'; const ch = chipOf(status, es);
  return (<div className={'bbx-pc bbx-pc-' + status}>
    <div className="bbx-pc-h"><span className="bbx-ic sm"><OnyxIcon emoji={ic} size={14} /></span><span className="bbx-pc-t">{t}</span><span className={'bbx-chip bbx-chip-' + ch.c}>{ch.t}</span>{tgl && <Switch on={tgl.on} onClick={tgl.toggle} />}</div>
    <div className="bbx-row">
      <input className="bbx-in" data-fld={vk} type="number" step={step} min={min} disabled={dis} style={{ flex: 1, minWidth: 0 }} value={s[vk]} onChange={(e) => set(vk, e.target.value === '' ? '' : Number(e.target.value))} />
      <select className="bbx-in bbx-sel" style={{ width: 96, flex: 'none' }} disabled={dis} value={s[uk]} onChange={(e) => set(uk, e.target.value)}>{opts.map(([v, o]: any) => <option key={v} value={v}>{o}</option>)}</select>
    </div>
    {hint && <div className="bbx-hint">{hint}</div>}</div>);
}
function ParamN({ ic, t, k, step = 1, min, tgl, hint }: any) {
  const { s, set, es } = useContext(BB); const dis = tgl ? !tgl.on : false;
  const status = dis ? 'off' : nz(s[k]) ? 'ok' : 'warn'; const ch = chipOf(status, es);
  return (<div className={'bbx-pc bbx-pc-' + status}>
    <div className="bbx-pc-h"><span className="bbx-ic sm"><OnyxIcon emoji={ic} size={14} /></span><span className="bbx-pc-t">{t}</span><span className={'bbx-chip bbx-chip-' + ch.c}>{ch.t}</span>{tgl && <Switch on={tgl.on} onClick={tgl.toggle} />}</div>
    <input className="bbx-in" data-fld={k} type="number" step={step} min={min} disabled={dis} value={s[k]} onChange={(e) => set(k, e.target.value === '' ? '' : Number(e.target.value))} />
    {hint && <div className="bbx-hint">{hint}</div>}</div>);
}
function Panel({ ic, title, sub, children }: any) {
  return (<div className="bbx-panel">
    <div className="bbx-panel-h"><span className="bbx-ic"><OnyxIcon emoji={ic} size={16} /></span><div><div>{title}</div>{sub && <div className="bbx-sub">{sub}</div>}</div></div>
    <div className="bbx-grid">{children}</div>
  </div>);
}

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
  const [view, setView] = useState('home'); // 'home' = tablero de tarjetas; o la clave de una sección
  const [warn, setWarn] = useState<{ key: string; label: string }[]>([]);
  const [showWarn, setShowWarn] = useState(false);
  const [creating, setCreating] = useState(false);       // animación "creando robot"
  const [cSecs, setCSecs] = useState(0);                  // countdown de la animación
  const [doneModal, setDoneModal] = useState<{ id: string; name: string; platform: string } | null>(null); // popup de instalación
  const [copied, setCopied] = useState('');              // URL copiada al portapapeles
  const [bal, setBal] = useState<number>(10000);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const set = (k: keyof BotSpec, v: any) => { setTouched((t) => ({ ...t, [k as string]: true })); setS((p) => ({ ...p, [k]: v })); };
  const touchAll = () => setTouched(Object.fromEntries(Object.keys(DEFAULT_SPEC).map((k) => [k, true])));
  const BUILD_SECS = 7;   // duración de la animación de creación (segundos)

  // Genera un magic ÚNICO de 7 dígitos, evitando los magics de robots ya guardados.
  // El magic identifica cada robot; si dos coinciden se mezclan sus operaciones.
  function genMagic(against: any[] = list): number {
    const used = new Set((against || []).map((b: any) => Number(b?.magic ?? b?.spec?.magic)).filter(Boolean));
    for (let i = 0; i < 60; i++) { const c = 1000000 + Math.floor(Math.random() * 8999999); if (!used.has(c)) return c; }
    return 1000000 + (Date.now() % 8999999);
  }

  useEffect(() => { load(); loadTpls(); setS((p) => ({ ...p, botLang: es ? 'es' : 'en' })); }, []);
  // Al abrir un robot NUEVO (sin id) le asignamos un magic único apenas carga la lista
  // de robots existentes, para que nunca choque con otro. Si el trader lo edita, se respeta.
  useEffect(() => { if (!id && list.length) setS((p) => (Number(p.magic) === DEFAULT_SPEC.magic ? { ...p, magic: genMagic(list) } : p)); }, [list]);
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

  // Crear robot: valida, muestra la animación "creando…" con countdown, guarda en paralelo
  // y al terminar abre el popup de instalación (advertencia + pasos + URLs del WebRequest).
  async function createBot() {
    const m = findMissing(); if (m.length) { setWarn(m); setShowWarn(true); return; }
    if (!s.name.trim()) { toastErr(L('Ponle un nombre a tu bot.', 'Give your bot a name.')); return; }
    setCreating(true); setCSecs(BUILD_SECS);
    const savedP = save();
    await new Promise<void>((res) => { let n = BUILD_SECS; const iv = setInterval(() => { n -= 1; setCSecs(n); if (n <= 0) { clearInterval(iv); res(); } }, 1000); });
    const bid = (await savedP) || id;
    setCreating(false);
    if (bid) setDoneModal({ id: bid, name: s.name || 'Bot', platform: s.platform });
  }
  async function saveTpl() {
    const name = prompt(L('Nombre de la plantilla:', 'Template name:'), s.name); if (!name) return;
    try { const r = await fetch('/api/bots/templates', { method: 'POST', body: JSON.stringify({ name, spec: s }) }); const j = await r.json(); if (!r.ok) { toastErr(j); return; } toast(L('Plantilla guardada.', 'Template saved.')); loadTpls(); } catch { toastErr(L('No se pudo guardar.', 'Could not save.')); }
  }
  function applyTpl(t: any) { setS({ ...DEFAULT_SPEC, ...(t.spec || {}), magic: genMagic() }); setId(''); touchAll(); window.scrollTo({ top: 0, behavior: 'smooth' }); toast(L('Plantilla cargada.', 'Template loaded.')); }
  async function delTpl(tid: string) { if (!confirm(L('¿Borrar esta plantilla?', 'Delete this template?'))) return; await fetch('/api/bots/templates?id=' + tid, { method: 'DELETE' }); loadTpls(); }
  function edit(b: any) { setS({ ...DEFAULT_SPEC, ...(b.spec || {}) }); setId(b.id); touchAll(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function nuevo() { setS({ ...DEFAULT_SPEC, magic: genMagic() }); setId(''); setTouched({}); }
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
  // Conversión hora servidor → hora local del trader (el bot siempre usa la del servidor).
  const GMT_OPTS: any = Array.from({ length: 27 }, (_, i) => { const g = i - 12; return [g, `GMT${g >= 0 ? '+' : ''}${g}`]; });
  const localGmt = -new Date().getTimezoneOffset() / 60;
  const hhmm = (h: number, m: number) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  const toLocal = (h: number, m: number) => { let t = h * 60 + m + (localGmt - (s.serverGmt || 0)) * 60; t = ((t % 1440) + 1440) % 1440; return hhmm(Math.floor(t / 60), Math.round(t % 60)); };

  // ---- Unidades ----
  const U_RISK: any = [['pct', '%'], ['money', '$']];
  // Mismo set de unidades en TODA la zona de salidas (SL, TP, runner, trailing).
  const U_EXIT: any = [['pips', 'pips'], ['rr', 'R (RR)'], ['pct', L('% precio', '% price')], ['money', '$'], ['atr', '× ATR']];
  const TFS = tfOptions(!es);

  const allReviewed = pct === 100;
  // Tarjetas del tablero: [clave, icono, título, subtítulo].
  const CARDS: [string, string, string, string][] = [
    ['general', '⚙️', L('General', 'General'), L('Nombre, símbolo, TF, idioma', 'Name, symbol, TF, language')],
    ['entry', '🎯', L('Entrada', 'Entry'), L('Gatillo, sesgo, sesión', 'Trigger, bias, session')],
    ['exits', '🚪', L('Salidas y gestión', 'Exits & management'), L('SL, TP, runner, trailing', 'SL, TP, runner, trailing')],
    ['risk', '🛡️', L('Riesgo', 'Risk'), L('Riesgo, cap diario, objetivo', 'Risk, daily cap, target')],
    ['firm', '🏦', L('Fondeo y frenos', 'Firm & brakes'), L('Firm, DD, objetivo de fase', 'Firm, DD, phase target')],
    ['schedule', '🕐', L('Horario y noticias', 'Schedule & news'), L('Sesión, cierre, noticias', 'Session, close, news')],
  ];
  const secStatus = (k: string) => k === 'general' ? (s.name?.trim() && s.symbol?.trim() ? 'ok' : 'warn') : k === 'exits' ? (nz(s.slVal) && nz(s.tp1Val) && nz(s.runnerVal) ? 'ok' : 'warn') : k === 'risk' ? (nz(s.riskVal) ? 'ok' : 'warn') : 'ok';
  const go = (v: string) => { setView(v); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  // Datos legibles para el resumen visual del bot.
  const uu = (x: string) => (({ pct: '%', money: '$', pips: 'pips', atr: '× ATR', rr: 'R', structure: L('estructura', 'structure') } as any)[x] || x);
  const trigLbl = ({ breakout_swing: L('Ruptura de swing + pullback', 'Swing breakout + pullback'), ma_cross: L('Cruce de medias', 'MA cross'), rsi: 'RSI', donchian: 'Donchian', time: L('Hora fija', 'Fixed time') } as any)[s.entryTrigger] || s.entryTrigger;
  const biasLbl = [L('Media', 'MA'), L('Estructura', 'Structure'), 'Donchian'][s.trendMode] || '';
  const phaseLbl = [L('Fase 1', 'Phase 1'), L('Fase 2', 'Phase 2'), L('Real', 'Real')][s.accountMode] || '';
  const ddLbl = [L('Trailing', 'Trailing'), L('Estático', 'Static'), 'Trailing→BE'][s.ddType] || '';
  const tgPct = s.accountMode === 0 ? s.targetP1 : s.accountMode === 1 ? s.targetP2 : 0;
  const sumPills = [
    `${L('Riesgo', 'Risk')} ${s.riskVal} ${uu(s.riskUnit)}`,
    `R:R ${est.rrTxt}`,
    `${L('Cap diario', 'Daily cap')} ${s.dailyLossVal} ${uu(s.dailyLossUnit)}`,
    `${s.firmName} · ${phaseLbl}`,
  ];
  const sumRows: [string, string, string][] = [
    ['🎯', L('Entrada', 'Entry'), `${trigLbl} · ${L('sesgo', 'bias')} ${biasLbl} ${s.trendTF}`],
    ['🛡️', L('Stop loss', 'Stop loss'), `${s.slVal} ${uu(s.slUnit)}`],
    ['🚪', L('Salidas', 'Exits'), `TP1 ${s.tp1Val} ${uu(s.tp1Unit)} (${s.partialPct}%) · runner ${s.runnerVal} ${uu(s.runnerUnit)} · ${s.useTrail ? `trailing ${s.trailVal} ${uu(s.trailUnit)}` : L('sin trailing', 'no trailing')}`],
    ['🏦', L('Fondeo y frenos', 'Firm & brakes'), `${s.firmName} · DD ${ddLbl} ${s.firmTotalLimitPct}% · ${L('frenos', 'brakes')} ${s.acctSoftStopPct}/${s.acctDailyStopPct}/${s.acctMaxDDPct}%`],
    ['🕐', L('Horario', 'Schedule'), `${hhmm(s.signalFromH, s.signalFromM)}–${hhmm(s.signalToH, s.signalToM)}${s.noWeekend ? L(' · sin fin de semana', ' · no weekend') : ''}${s.useNewsFilter ? L(' · frena en noticias', ' · pauses on news') : ''}`],
    ['🏁', L('Objetivo', 'Target'), `${phaseLbl}${tgPct ? ` · +${tgPct}%` : ''} · magic ${s.magic}`],
  ];

  return (
    <BB.Provider value={{ s, set, es }}>
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
      .bbx-hint{font-size:11px;color:var(--mut);margin-top:4px;line-height:1.45}
      .bbx-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(165px,1fr));gap:12px;margin-bottom:14px}
      .bbx-card{text-align:left;background:linear-gradient(180deg,rgba(34,37,54,.72),rgba(23,25,38,.72));border:1.5px solid rgba(255,255,255,.08);border-radius:14px;padding:15px;cursor:pointer;transition:.15s;font:inherit}
      .bbx-card:hover{transform:translateY(-2px);border-color:rgba(139,147,255,.6);box-shadow:0 0 24px rgba(139,147,255,.14)}
      .bbx-card-ok{border-color:rgba(139,147,255,.38)}
      .bbx-card-warn{border-color:rgba(242,194,101,.5);box-shadow:0 0 22px rgba(242,194,101,.12)}
      .bbx-card-h{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
      .bbx-card-t{font-size:14px;font-weight:600;color:var(--ink)}
      .bbx-card-s{font-size:11.5px;color:var(--mut);margin-top:2px;line-height:1.4}
      `}</style>

      {/* Hero */}
      <div className="bbx-hero">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h2 className="bbx-h2"><OnyxIcon emoji="🤖" size={22} /> {L('Crear robot', 'Create robot')}</h2>
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

      {/* Tablero de tarjetas */}
      {view === 'home' ? (
        <div className="bbx-cards">
          {CARDS.map(([k, ic, ti, su]) => { const st = secStatus(k); const ch = st === 'warn' ? { c: 'warn', t: L('Revisar', 'Review') } : { c: 'ok', t: L('Listo', 'Ready') };
            return (
              <button key={k} className={'bbx-card bbx-card-' + st} onClick={() => go(k)}>
                <div className="bbx-card-h"><span className="bbx-ic"><OnyxIcon emoji={ic} size={16} /></span><span style={{ color: 'var(--mut)', fontSize: 16 }}>›</span></div>
                <div className="bbx-card-t">{ti}</div><div className="bbx-card-s">{su}</div>
                <span className={'bbx-chip bbx-chip-' + ch.c} style={{ marginTop: 10, display: 'inline-block' }}>{ch.t}</span>
              </button>);
          })}
        </div>
      ) : (
      <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <button className="bbx-btn" onClick={() => go('home')}>← {L('Todas las secciones', 'All sections')}</button>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{CARDS.find((c) => c[0] === view)?.[2]}</span>
      </div>

      {view === 'general' && (
      <Panel ic="⚙️" title={L('General', 'General')}>
        <Fld t={L('Nombre de tu bot', 'Your bot name')} k="name" ph={L('Ej: Mi cazador de Londres', 'e.g. My London hunter')} />
        <Fld t={L('Plataforma', 'Platform')} k="platform" opts={[['mt5', 'MetaTrader 5'], ['mt4', 'MetaTrader 4'], ['ctrader', 'cTrader']]} />
        <Fld t={L('Instrumento', 'Instrument')} k="symbol" ph="XAUUSD" list="bbx-syms" hint={L('El bot encuentra el símbolo aunque tu broker use otro nombre o sufijo (GOLD, XAUUSD.m, etc.).', 'The bot finds the symbol even if your broker uses another name or suffix (GOLD, XAUUSD.m, etc.).')} />
        <datalist id="bbx-syms">{SYMBOL_HINTS.map((x) => <option key={x} value={x} />)}</datalist>
        {/* Magic con generador: se asigna uno único automáticamente y se puede regenerar. */}
        <div>
          <span className="bbx-lbl">{L('Magic (identificador)', 'Magic (id)')}</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
            <input className="bbx-in" data-fld="magic" type="number" min={1} style={{ flex: 1, minWidth: 0 }} value={s.magic} onChange={(e) => set('magic', e.target.value === '' ? '' : Number(e.target.value))} />
            <button type="button" className="bbx-btn" title={L('Generar un magic único al azar', 'Generate a unique random magic')} style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', padding: '0 12px' }} onClick={() => set('magic', genMagic())}><OnyxIcon emoji="🎲" size={14} glow={false} /> {L('Generar', 'Generate')}</button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: 4 }}>{L('Se asigna uno único automáticamente. Cámbialo si quieres uno específico.', 'A unique one is set automatically. Change it if you want a specific one.')}</div>
        </div>
        <Fld t={L('Temporalidad de entrada', 'Entry timeframe')} k="tf" opts={TFS} hint={L('Ritmo de las velas que analiza para entrar.', 'Candle rhythm it reads to enter.')} />
        <Fld t={L('Idioma del bot (panel y EA)', 'Bot language (panel & EA)')} k="botLang" opts={[['es', 'Español'], ['en', 'English']]} />
      </Panel>
      )}

      {view === 'entry' && (<>
      <Panel ic="🎯" title={L('Entrada', 'Entry')} sub={L('El bot ejecuta la entrada en la plataforma. Elige el gatillo, el sesgo y la sesión.', 'The bot executes the entry on the platform. Pick the trigger, bias and session.')}>
        <Fld t={L('Gatillo de entrada', 'Entry trigger')} k="entryTrigger" opts={[['breakout_swing', L('Ruptura de swing + pullback', 'Swing breakout + pullback')], ['ma_cross', L('Cruce de medias', 'MA cross')], ['rsi', 'RSI'], ['donchian', 'Donchian'], ['time', L('Hora fija', 'Fixed time')]]} />
        <Fld t={L('Sesgo / tendencia', 'Bias / trend')} k="trendMode" opts={[[0, L('Media', 'Moving average')], [1, L('Estructura (HH/HL)', 'Structure (HH/HL)')], [2, 'Donchian']]} />
        <Fld t={L('Temporalidad del sesgo', 'Bias timeframe')} k="trendTF" opts={TFS} hint={L('Marco mayor para leer la tendencia.', 'Higher timeframe to read the trend.')} />
        <Fld t={L('Tamaño del swing', 'Swing size')} k="microSwing" type="number" />
        <Fld t={L('Máx. ops/día (0=∞)', 'Max trades/day (0=∞)')} k="maxTradesPerDay" type="number" />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', paddingTop: 20 }}><Toggle k="allowLongs" t={L('Largos', 'Longs')} /><Toggle k="allowShorts" t={L('Cortos', 'Shorts')} /></div>
      </Panel>

      </>)}

      {view === 'exits' && (
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
      )}

      {view === 'risk' && (<>
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
      </>)}

      {view === 'firm' && (<>
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
      </>)}

      {view === 'schedule' && (<>
      <Panel ic="🕐" title={L('Horario', 'Schedule')}>
        {/* Bloque único a todo el ancho: 1) días  2) divisor  3) cierre + reglas de fin de semana. */}
        <div style={{ gridColumn: '1 / -1', display: 'grid', gap: 16 }}>
          {/* 1 · Días operables (rejilla pareja de 7). El trader elige qué días opera (bitmask). */}
          <div>
            <span className="bbx-lbl">{L('Días en que opera', 'Trading days')}</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 8, marginTop: 8 }}>
              {(L('Do,Lu,Ma,Mi,Ju,Vi,Sá', 'Su,Mo,Tu,We,Th,Fr,Sa').split(',')).map((lbl, d) => {
                const on = (((s.tradeDays ?? 62) >> d) & 1) === 1;
                return (
                  <button key={d} type="button" onClick={() => set('tradeDays', ((s.tradeDays ?? 62) ^ (1 << d)) || 62)}
                    title={[L('Domingo', 'Sunday'), L('Lunes', 'Monday'), L('Martes', 'Tuesday'), L('Miércoles', 'Wednesday'), L('Jueves', 'Thursday'), L('Viernes', 'Friday'), L('Sábado', 'Saturday')][d]}
                    style={{ textAlign: 'center', padding: '10px 0', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', color: on ? '#fff' : 'var(--mut)', background: on ? 'var(--brand)' : 'var(--card2, rgba(255,255,255,.03))', border: (on ? '1px solid var(--brand)' : '1px dashed var(--line)') }}>{lbl}</button>
                );
              })}
            </div>
            <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: 6 }}>{L('El bot solo busca entradas en los días marcados. El mercado abre el domingo y cierra el viernes; el sábado está cerrado.', 'The bot only seeks entries on the marked days. The market opens Sunday and closes Friday; Saturday is closed.')}</div>
          </div>

          <div style={{ height: 1, background: 'var(--line)' }} />

          {/* 1.5 · Horarios de operación (VARIAS sesiones/ventanas, hora del servidor). */}
          {(() => {
            const wins: any[] = (Array.isArray(s.windows) && s.windows.length) ? s.windows : [{ fh: s.signalFromH, fm: s.signalFromM, th: s.signalToH, tm: s.signalToM }];
            const setW = (a: any[]) => set('windows', a.length ? a.slice(0, 6) : [{ fh: 8, fm: 0, th: 20, tm: 0 }]);
            const upd = (i: number, patch: any) => setW(wins.map((w, j) => (j === i ? { ...w, ...patch } : w)));
            const num2 = (v: string) => (v === '' ? 0 : Math.max(0, Number(v)));
            return (
              <div>
                <div className="row between" style={{ alignItems: 'baseline' }}>
                  <span className="bbx-lbl">{L('Horarios de operación (hora del servidor)', 'Trading hours (server time)')}</span>
                  <span style={{ fontSize: 11, color: 'var(--mut)' }}>{L('Puedes añadir varias sesiones', 'You can add several sessions')}</span>
                </div>
                {/* Presets: cada uno AÑADE una sesión. */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '8px 0 10px' }}>
                  {SESSIONS.map(([kk, nm, fh, fm, th, tm]: any) => (
                    <button key={kk} type="button" className="bbx-ses" title={L('Añadir esta sesión', 'Add this session')} onClick={() => setW([...wins, { fh, fm, th, tm }])}>+ {nm}</button>
                  ))}
                </div>
                {/* Lista de ventanas: cada una editable + hora local + borrar. */}
                <div style={{ display: 'grid', gap: 8 }}>
                  {wins.map((w, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', border: '1px solid var(--line)', borderRadius: 10, padding: '8px 10px', background: 'var(--card2, rgba(255,255,255,.02))' }}>
                      <span style={{ fontSize: 12, color: 'var(--mut)', minWidth: 58 }}>{L('Sesión', 'Session')} {i + 1}</span>
                      <input className="bbx-in" type="number" min={0} max={23} value={w.fh} style={{ width: 64 }} onChange={(e) => upd(i, { fh: Math.min(23, num2(e.target.value)) })} />
                      <span style={{ color: 'var(--mut)' }}>:</span>
                      <input className="bbx-in" type="number" min={0} max={59} value={w.fm} style={{ width: 64 }} onChange={(e) => upd(i, { fm: Math.min(59, num2(e.target.value)) })} />
                      <span style={{ color: 'var(--mut)', padding: '0 2px' }}>→</span>
                      <input className="bbx-in" type="number" min={0} max={23} value={w.th} style={{ width: 64 }} onChange={(e) => upd(i, { th: Math.min(23, num2(e.target.value)) })} />
                      <span style={{ color: 'var(--mut)' }}>:</span>
                      <input className="bbx-in" type="number" min={0} max={59} value={w.tm} style={{ width: 64 }} onChange={(e) => upd(i, { tm: Math.min(59, num2(e.target.value)) })} />
                      <span style={{ fontSize: 11.5, color: '#8b93ff', marginLeft: 4 }}>{L('local', 'local')} {toLocal(w.fh, w.fm)}–{toLocal(w.th, w.tm)}</span>
                      {wins.length > 1 && <button type="button" className="bbx-btn" style={{ marginLeft: 'auto', padding: '4px 9px', fontSize: 12, color: 'var(--wn)' }} onClick={() => setW(wins.filter((_, j) => j !== i))}>✕</button>}
                    </div>
                  ))}
                </div>
                <div className="row" style={{ gap: 10, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
                  {wins.length < 6 && <button type="button" className="bbx-btn" onClick={() => setW([...wins, { fh: 8, fm: 0, th: 20, tm: 0 }])}><OnyxIcon emoji="➕" size={13} glow={false} /> {L('Añadir horario', 'Add window')}</button>}
                  <div style={{ minWidth: 220 }}><Fld t={L('GMT del servidor del bróker', 'Broker server GMT')} k="serverGmt" opts={GMT_OPTS} /></div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: 6 }}>{L('El bot busca entradas si la hora cae dentro de CUALQUIER sesión. El GMT sirve para convertir a tu hora local y para las noticias.', 'The bot seeks entries if the time falls inside ANY session. The GMT is used for your local time and the news filter.')}</div>
              </div>
            );
          })()}

          <div style={{ height: 1, background: 'var(--line)' }} />

          {/* 2 · Cierre de sesión (hora:min del servidor) + reglas de fin de semana, en una fila. */}
          <div>
            <span className="bbx-lbl">{L('Cierre de sesión (hora del servidor)', 'Session close (server time)')}</span>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
              <input className="bbx-in" data-fld="forceCloseHourNY" type="number" min={0} max={23} value={s.forceCloseHourNY} style={{ width: 84 }} onChange={(e) => set('forceCloseHourNY', e.target.value === '' ? '' : Number(e.target.value))} />
              <span style={{ color: 'var(--mut)' }}>:</span>
              <input className="bbx-in" data-fld="forceCloseMinNY" type="number" min={0} max={59} value={s.forceCloseMinNY} style={{ width: 84 }} onChange={(e) => set('forceCloseMinNY', e.target.value === '' ? '' : Number(e.target.value))} />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginLeft: 4 }}>
                <Toggle k="useDayClose" t={L('Cerrar al fin de sesión', 'Close at session end')} />
                <Toggle k="noWeekend" t={L('Sin fin de semana', 'No weekend')} />
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: 6 }}>{L('Hora del servidor a la que el bot cierra lo que tenga abierto.', 'Server time when the bot closes any open trades.')}</div>
          </div>
        </div>
      </Panel>

      {/* Noticias */}
      <div className="bbx-panel">
        <div className="bbx-panel-h"><span className="bbx-ic"><OnyxIcon emoji="📰" size={16} /></span><div><div>{L('Noticias (Forex Factory)', 'News (Forex Factory)')}</div><div className="bbx-sub">{L('El bot deja de abrir alrededor de noticias de alto impacto. Requiere permitir la URL en MetaTrader (Opciones → Asesores expertos → WebRequest para https://nfs.faireconomy.media).', 'The bot stops opening around high-impact news. Requires allowing the URL in MetaTrader (Options → Expert Advisors → WebRequest for https://nfs.faireconomy.media).')}</div></div></div>
        <div style={{ marginBottom: 12 }}><Toggle k="useNewsFilter" t={L('Frenar en noticias', 'Pause on news')} /></div>
        {s.useNewsFilter && (
          <div className="bbx-grid">
            <Fld t={L('Monedas', 'Currencies')} k="newsCurrencies" ph="USD,EUR" hint={L('Separadas por coma. Solo frena si la noticia es de estas monedas.', 'Comma-separated. Only pauses for these currencies.')} />
            <Fld t={L('Impacto', 'Impact')} k="newsImpact" opts={[['high', L('Solo alto', 'High only')], ['med', L('Alto + medio', 'High + medium')], ['all', L('Todos', 'All')]]} />
            <Fld t={L('Minutos antes', 'Minutes before')} k="newsBefore" type="number" hint={L('Deja de abrir estos minutos antes de la noticia.', 'Stops opening this many minutes before.')} />
            <Fld t={L('Minutos después', 'Minutes after')} k="newsAfter" type="number" hint={L('Sigue frenado estos minutos después.', 'Stays paused this many minutes after.')} />
          </div>
        )}
      </div>
      </>)}

      {/* Botón para volver al tablero desde una sección */}
      {view !== 'home' && (
        <div style={{ marginBottom: 14 }}><button className="bbx-btn primary" onClick={() => go('home')}>✓ {L('Listo, volver al tablero', 'Done, back to board')}</button></div>
      )}
      </>
      )}

      {/* Resumen + acciones */}
      <div className="bbx-panel">
        <div className="bbx-panel-h"><span className="bbx-ic"><OnyxIcon emoji="📋" size={16} /></span> {L('Resumen de tu bot', 'Your bot summary')}</div>
        <div style={{ background: 'linear-gradient(135deg,rgba(139,147,255,.14),rgba(255,255,255,.03))', border: '1px solid rgba(139,147,255,.3)', borderRadius: 13, padding: '15px 16px', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span className="bbx-ic" style={{ background: 'linear-gradient(135deg,#6f77ea,#5b63d3)', color: '#fff', boxShadow: '0 0 16px rgba(139,147,255,.4)' }}><OnyxIcon emoji="🤖" size={17} /></span>
            <div><div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>{s.name || L('Bot sin nombre', 'Unnamed bot')}</div><div style={{ fontSize: 12, color: 'var(--mut)' }}>{s.platform.toUpperCase()} · {s.symbol} · magic {s.magic}</div></div>
          </div>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 12 }}>
            {sumPills.map((p, i) => <span key={i} style={{ fontSize: 12, padding: '4px 11px', borderRadius: 99, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(139,147,255,.35)', color: '#c8ccff' }}>{p}</span>)}
          </div>
        </div>
        <div className="bbx-grid" style={{ gap: 8 }}>
          {sumRows.map(([ic, t, d], i) => (
            <div key={i} style={{ display: 'flex', gap: 10, background: 'var(--surface-2,rgba(255,255,255,.04))', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 12px' }}>
              <span style={{ flex: 'none' }}><OnyxIcon emoji={ic} size={16} /></span>
              <div><div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>{t}</div><div style={{ fontSize: 12, color: 'var(--mut)', lineHeight: 1.4 }}>{d}</div></div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <button className="bbx-btn primary" onClick={createBot} disabled={busy || creating} style={{ fontWeight: 700 }}><OnyxIcon emoji="🤖" size={14} glow={false} /> {L('Crear robot', 'Create robot')}</button>
          <button className="bbx-btn" onClick={saveChecked} disabled={busy}>{busy ? '…' : L('Solo guardar', 'Save only')}</button>
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

      {/* Animación "creando robot": círculo verde iluminado + countdown. No se puede cerrar. */}
      {creating && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(6,8,16,.72)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 80, padding: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
            <div className="bbxglow"><div className="bbxring" /></div>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#eaf6ef' }}>{L('Creando tu robot…', 'Creating your robot…')}</div>
            <div style={{ fontSize: 13, color: 'var(--mut)' }}>{cSecs > BUILD_SECS * 0.6 ? L('Leyendo tus reglas', 'Reading your rules') : cSecs > BUILD_SECS * 0.3 ? L('Escribiendo el motor', 'Writing the engine') : L('Empaquetando', 'Packaging')}</div>
            <div style={{ fontSize: 30, fontWeight: 600, color: '#22d68c', letterSpacing: 1 }}>00:{String(Math.max(0, cSecs)).padStart(2, '0')}</div>
            <div style={{ width: 230, height: 6, borderRadius: 99, background: 'rgba(255,255,255,.08)', overflow: 'hidden' }}><div style={{ width: `${Math.round((BUILD_SECS - cSecs) / BUILD_SECS * 100)}%`, height: '100%', background: '#22d68c', transition: 'width 1s linear' }} /></div>
          </div>
        </div>
      )}

      {/* Popup de instalación: advertencia + pasos + URLs del WebRequest + descargas. */}
      {doneModal && (() => {
        const plat = doneModal.platform;
        const isMT = plat === 'mt4' || plat === 'mt5';
        const ext = plat === 'mt4' ? '.mq4' : plat === 'ctrader' ? '.cs' : '.mq5';
        const editor = plat === 'ctrader' ? 'cTrader Automate' : 'MetaEditor';
        const SITE = (typeof window !== 'undefined' ? window.location.origin : 'https://www.onyxtradinglive.com');
        const urls = [SITE, 'https://nfs.faireconomy.media'];
        const copy = (u: string) => { try { navigator.clipboard?.writeText(u); } catch {} setCopied(u); setTimeout(() => setCopied(''), 1500); };
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(6,8,16,.62)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 80, padding: 16 }} onClick={() => setDoneModal(null)}>
            <div className="bbx" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
              <div className="bbx-panel" style={{ margin: 0, border: '1px solid rgba(34,214,140,.4)', boxShadow: '0 0 40px rgba(34,214,140,.15)' }}>
                <div className="row between" style={{ alignItems: 'center', marginBottom: 10 }}>
                  <div className="row" style={{ gap: 9, alignItems: 'center' }}><span className="bbx-ic" style={{ background: 'rgba(34,214,140,.16)', color: 'var(--green,#22d68c)' }}><OnyxIcon emoji="✅" size={16} /></span><b style={{ fontSize: 16 }}>{L('Tu robot está listo', 'Your robot is ready')}</b></div>
                  <div className="row" style={{ gap: 8, alignItems: 'center' }}><span style={{ fontSize: 11, background: 'rgba(139,147,255,.16)', color: '#8b93ff', padding: '3px 9px', borderRadius: 99 }}>{plat.toUpperCase()}</span><button className="bbx-btn" style={{ padding: '3px 9px' }} onClick={() => setDoneModal(null)}>✕</button></div>
                </div>

                <div style={{ background: 'rgba(242,194,101,.12)', border: '1px solid rgba(242,194,101,.4)', borderRadius: 10, padding: '9px 11px', fontSize: 12.5, color: 'var(--wn)', marginBottom: 12 }}>
                  <OnyxIcon emoji="⚠️" size={13} /> {L('Pruébalo primero en DEMO. Pega tu clave Onyx en InpApiKey (necesaria en demo y en real). El trading conlleva riesgo.', 'Test it on DEMO first. Paste your Onyx key in InpApiKey (required on demo and live). Trading involves risk.')}
                </div>

                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{L('Pasos', 'Steps')}</div>
                <ol style={{ margin: '0 0 12px', paddingLeft: 18, fontSize: 12.5, color: 'var(--mut)', lineHeight: 1.85 }}>
                  <li>{L(`Descarga el archivo y ábrelo en ${editor} → Compilar.`, `Download the file and open it in ${editor} → Compile.`)}</li>
                  <li>{L('Arrástralo al gráfico del par. Pega tu clave Onyx en', 'Drag it onto the pair chart. Paste your Onyx key in')} <code>InpApiKey</code>.</li>
                  {isMT
                    ? <li>{L('Permite las URLs de abajo (una sola vez) y activa AutoTrading.', 'Allow the URLs below (once) and enable AutoTrading.')}</li>
                    : <li>{L('En cTrader Automate, permite el acceso a internet del cBot e inícialo.', 'In cTrader Automate, allow the cBot internet access and start it.')}</li>}
                </ol>

                {isMT && (<>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{L('Permitir en MetaTrader (Opciones → Asesores expertos → WebRequest)', 'Allow in MetaTrader (Options → Expert Advisors → WebRequest)')}</div>
                  <div style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
                    {urls.map((u) => (
                      <div key={u} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,.04)', border: '1px solid var(--line)', borderRadius: 10, padding: '7px 10px' }}>
                        <code style={{ flex: 1, fontSize: 12, color: '#8b93ff', wordBreak: 'break-all' }}>{u}</code>
                        <button className="bbx-btn" style={{ padding: '3px 9px', fontSize: 12 }} onClick={() => copy(u)}>{copied === u ? L('Copiado ✓', 'Copied ✓') : L('Copiar', 'Copy')}</button>
                      </div>
                    ))}
                  </div>
                </>)}

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                  <a className="bbx-btn primary" href={`/api/bots/build?code=${doneModal.id}`} style={{ fontWeight: 700 }}><OnyxIcon emoji="⬇️" size={13} glow={false} /> {L('Descargar robot', 'Download robot')} ({ext})</a>
                  {isMT && <a className="bbx-btn" href={`/api/bots/build?download=${doneModal.id}`}>{L('Config', 'Config')} (.set) ↓</a>}
                  <button className="bbx-btn" onClick={openGuide}><OnyxIcon emoji="📖" size={13} /> {L('Guía PDF', 'PDF guide')}</button>
                </div>

                <div style={{ fontSize: 11.5, color: 'var(--mut)', lineHeight: 1.6 }}>{L('Para verlo enseguida en Mis robots, ve a “Añadir por magic” — tu robot ya aparece en la lista para registrarlo con un clic.', 'To see it right away in My robots, go to “Add by magic” — your robot already shows in the list to register it in one click.')}</div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
    </BB.Provider>
  );
}
