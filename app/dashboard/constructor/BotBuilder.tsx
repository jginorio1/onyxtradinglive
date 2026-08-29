'use client';
import { useEffect, useMemo, useState } from 'react';
import { useLang } from '@/lib/lang';
import { toast, toastErr } from '@/lib/toast';
import OnyxIcon from '@/app/components/OnyxIcon';
import { DEFAULT_SPEC, summarize, type BotSpec } from '@/lib/botSpec';

// Constructor de bots (Fase 1): el trader arma su bot por campos, le pone su NOMBRE
// propio, guarda la receta y descarga el .set de MT5 + el resumen. Tope de riesgo duro.
export default function BotBuilder() {
  const { lang } = useLang();
  const es = lang !== 'en';
  const L = (a: string, b: string) => (es ? a : b);
  const [s, setS] = useState<BotSpec>({ ...DEFAULT_SPEC });
  const [id, setId] = useState('');
  const [list, setList] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof BotSpec, v: any) => setS((p) => ({ ...p, [k]: v }));

  useEffect(() => { load(); }, []);
  async function load() { try { const r = await fetch('/api/bots/build'); const j = await r.json(); setList(j.bots || []); } catch {} }

  const summary = useMemo(() => summarize(s, !es), [s, es]);

  async function save() {
    if (!s.name.trim()) { toastErr(L('Ponle un nombre a tu bot.', 'Give your bot a name.')); return; }
    setBusy(true);
    try {
      const r = await fetch('/api/bots/build', { method: 'POST', body: JSON.stringify({ id: id || undefined, spec: s, lang: es ? 'es' : 'en' }) });
      const j = await r.json(); if (!r.ok) { toastErr(j); setBusy(false); return; }
      setId(j.id); toast(L('Bot guardado.', 'Bot saved.')); load();
    } catch { toastErr(L('No se pudo guardar.', 'Could not save.')); }
    setBusy(false);
  }
  function edit(b: any) { setS({ ...DEFAULT_SPEC, ...(b.spec || {}) }); setId(b.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function nuevo() { setS({ ...DEFAULT_SPEC }); setId(''); }
  async function del(bid: string) { if (!confirm(L('¿Borrar este bot?', 'Delete this bot?'))) return; await fetch('/api/bots/build?id=' + bid, { method: 'DELETE' }); if (id === bid) nuevo(); load(); }

  const lbl = { fontSize: 12, color: 'var(--mut)', display: 'block', marginBottom: 4 } as any;
  const inp = { margin: 0, width: '100%', fontSize: 13 } as any;
  const Sec = ({ ic, title, sub, children }: any) => (
    <div className="card" style={{ marginBottom: 14 }}>
      <h3 style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: sub ? 2 : 12 }}><span className="card-ic"><OnyxIcon emoji={ic} size={16} /></span> {title}</h3>
      {sub && <p className="muted" style={{ fontSize: 12, marginBottom: 12 }}>{sub}</p>}
      <div className="grid g3" style={{ gap: 12 }}>{children}</div>
    </div>
  );
  const Num = ({ k, t, step = 1, min }: any) => (<div><span style={lbl}>{t}</span><input type="number" step={step} min={min} value={(s as any)[k]} onChange={(e) => set(k, e.target.value === '' ? '' : Number(e.target.value))} style={inp} /></div>);
  const Txt = ({ k, t, ph }: any) => (<div><span style={lbl}>{t}</span><input value={(s as any)[k]} onChange={(e) => set(k, e.target.value)} placeholder={ph} style={inp} /></div>);
  const Sel = ({ k, t, opts }: any) => (<div><span style={lbl}>{t}</span><select value={(s as any)[k]} onChange={(e) => set(k, isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value))} style={inp}>{opts.map(([v, o]: any) => <option key={String(v)} value={v}>{o}</option>)}</select></div>);
  const Chk = ({ k, t }: any) => (<label className="row" style={{ gap: 8, cursor: 'pointer', alignItems: 'center' }}><input type="checkbox" checked={!!(s as any)[k]} onChange={(e) => set(k, e.target.checked)} style={{ width: 'auto', margin: 0 }} /> <span style={{ fontSize: 13 }}>{t}</span></label>);
  const TFS: any = [['M1', 'M1'], ['M5', 'M5'], ['M15', 'M15'], ['M30', 'M30'], ['H1', 'H1'], ['H4', 'H4'], ['D1', 'D1']];

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div className="card" style={{ marginBottom: 14, background: 'var(--soft-brand)', border: '1px solid rgba(124,140,255,.5)' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}><OnyxIcon emoji="🤖" size={22} /> {L('Constructor de bots', 'Bot builder')}</h2>
        <p className="muted" style={{ fontSize: 13, margin: '6px 0 0' }}>{L('Arma tu bot por campos y ponle tu propio nombre. Guarda la receta y descarga el .set para tu plataforma.', 'Build your bot with fields and give it your own name. Save the recipe and download the .set for your platform.')}</p>
      </div>

      <Sec ic="⚙️" title={L('General', 'General')}>
        <Txt k="name" t={L('Nombre de tu bot', 'Your bot name')} ph={L('Ej: Mi cazador de Londres', 'e.g. My London hunter')} />
        <Sel k="platform" t={L('Plataforma', 'Platform')} opts={[['mt5', 'MetaTrader 5'], ['mt4', 'MetaTrader 4'], ['ctrader', 'cTrader']]} />
        <Txt k="symbol" t={L('Instrumento', 'Instrument')} ph="XAUUSD" />
        <Num k="magic" t={L('Magic (identificador)', 'Magic (id)')} />
        <Sel k="tf" t={L('Temporalidad de entrada', 'Entry timeframe')} opts={TFS} />
      </Sec>

      <Sec ic="🎯" title={L('Entrada', 'Entry')} sub={L('El bot ejecuta la entrada en la plataforma. Elige el gatillo y el sesgo.', 'The bot executes the entry on the platform. Pick the trigger and bias.')}>
        <Sel k="entryTrigger" t={L('Gatillo de entrada', 'Entry trigger')} opts={[['breakout_swing', L('Ruptura de swing + pullback', 'Swing breakout + pullback')], ['ma_cross', L('Cruce de medias', 'MA cross')], ['rsi', 'RSI'], ['donchian', 'Donchian'], ['time', L('Hora fija', 'Fixed time')]]} />
        <Sel k="trendMode" t={L('Sesgo / tendencia', 'Bias / trend')} opts={[[0, L('Media', 'Moving average')], [1, L('Estructura (HH/HL)', 'Structure (HH/HL)')], [2, 'Donchian']]} />
        <Sel k="trendTF" t={L('Temporalidad del sesgo', 'Bias timeframe')} opts={TFS} />
        <Num k="microSwing" t={L('Tamaño del swing', 'Swing size')} />
        <Num k="maxTradesPerDay" t={L('Máx. ops/día (0=∞)', 'Max trades/day (0=∞)')} />
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', paddingTop: 22 }}><Chk k="allowLongs" t={L('Largos', 'Longs')} /><Chk k="allowShorts" t={L('Cortos', 'Shorts')} /></div>
        <Num k="signalFromH" t={L('Hora inicio señales', 'Signals from (h)')} />
        <Num k="signalToH" t={L('Hora fin señales', 'Signals to (h)')} />
      </Sec>

      <Sec ic="🚪" title={L('Salidas y gestión', 'Exits & management')}>
        <Num k="slBufferATR" t={L('SL: colchón (× ATR)', 'SL buffer (× ATR)')} step={0.1} />
        <Num k="tp1R" t={L('TP1 (en R)', 'TP1 (in R)')} step={0.1} />
        <Num k="partialPct" t={L('% parcial en TP1', '% partial at TP1')} />
        <Sel k="tpMode" t={L('Runner (objetivo)', 'Runner target')} opts={[[0, L('R fijo', 'Fixed R')], [1, L('Estructura', 'Structure')]]} />
        <Num k="runnerMaxR" t={L('Tope del runner (R)', 'Runner cap (R)')} step={0.5} />
        <Num k="trailATRcoef" t={L('Trailing (× ATR)', 'Trailing (× ATR)')} step={0.1} />
        <Num k="timeStopBars" t={L('Time-stop (velas, 0=off)', 'Time-stop (bars, 0=off)')} />
        <div style={{ paddingTop: 22 }}><Chk k="useTrail" t={L('Activar trailing', 'Enable trailing')} /></div>
      </Sec>

      <Sec ic="🛡️" title={L('Riesgo', 'Risk')} sub={L('Tope de seguridad: máximo 5% por operación desde el constructor.', 'Safety cap: max 5% per trade from the builder.')}>
        <Num k="riskPct" t={L('Riesgo por operación (%)', 'Risk per trade (%)')} step={0.05} min={0.01} />
        <Num k="maxLots" t={L('Tope de lotes', 'Max lots')} step={0.01} />
        <Num k="dailyLossCapPct" t={L('Cap de pérdida diaria (%)', 'Daily loss cap (%)')} step={0.1} />
      </Sec>

      <Sec ic="🏦" title={L('Reglas del fondeo (prop firm)', 'Prop-firm rules')}>
        <Txt k="firmName" t={L('Nombre del fondeo', 'Firm name')} ph="FTMO" />
        <Sel k="ddType" t={L('Tipo de DD total', 'Total DD type')} opts={[[0, L('Trailing (desde el pico)', 'Trailing (from peak)')], [1, L('Estático (balance inicial)', 'Static (initial balance)')], [2, L('Trailing hasta BE, luego fijo', 'Trailing to BE, then fixed')]]} />
        <Num k="firmDailyLimitPct" t={L('Límite diario del firm (%)', 'Firm daily limit (%)')} step={0.5} />
        <Num k="firmTotalLimitPct" t={L('Límite total del firm (%)', 'Firm total limit (%)')} step={0.5} />
      </Sec>

      <Sec ic="🧯" title={L('Frenos del bot (por debajo del firm)', 'Bot brakes (below firm)')}>
        <Num k="acctSoftStopPct" t={L('Freno suave diario (%)', 'Soft daily brake (%)')} step={0.5} />
        <Num k="acctDailyStopPct" t={L('Freno duro diario (%)', 'Hard daily brake (%)')} step={0.5} />
        <Num k="acctMaxDDPct" t={L('Freno total (%)', 'Total brake (%)')} step={0.5} />
      </Sec>

      <Sec ic="🏁" title={L('Objetivo de cuenta', 'Account target')}>
        <Sel k="accountMode" t={L('Fase de la cuenta', 'Account phase')} opts={[[0, L('Fase 1 (reto)', 'Phase 1 (challenge)')], [1, L('Fase 2 (verificación)', 'Phase 2 (verification)')], [2, L('Real (fondeada)', 'Real (funded)')]]} />
        <Num k="initBalance" t={L('Balance inicial (0=auto)', 'Initial balance (0=auto)')} />
        <Num k="targetP1" t={L('Objetivo Fase 1 (%)', 'Phase 1 target (%)')} step={0.5} />
        <Num k="targetP2" t={L('Objetivo Fase 2 (%)', 'Phase 2 target (%)')} step={0.5} />
      </Sec>

      <Sec ic="🕐" title={L('Horario y noticias', 'Schedule & news')}>
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
          <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? '…' : (id ? L('Guardar cambios', 'Save changes') : L('Guardar bot', 'Save bot'))}</button>
          {id && <a className="btn btn-ghost" href={`/api/bots/build?code=${id}`}>{L('Descargar EA (.mq5)', 'Download EA (.mq5)')} ↓</a>}
          {id && <a className="btn btn-ghost" href={`/api/bots/build?download=${id}`}>{L('Descargar config (.set)', 'Download config (.set)')} ↓</a>}
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
                  <a className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 12 }} href={`/api/bots/build?download=${b.id}`}>.set ↓</a>
                  <button className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => edit(b)}>{L('Editar', 'Edit')}</button>
                  <button className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 12, color: 'var(--red)' }} onClick={() => del(b.id)}>{L('Borrar', 'Delete')}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
