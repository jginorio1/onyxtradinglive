import { type BotSpec, unitLabel } from '@/lib/botSpec';

// Guía visual personalizada del bot: portada con el nombre del trader y del bot,
// estrategia explicada, para qué sirve cada parámetro, e instalación paso a paso.
// Devuelve un documento HTML autónomo (imprimible a PDF desde el navegador).

const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const P = (es: boolean, a: string, b: string) => (es ? a : b);

const TRIG: Record<string, [string, string]> = {
  breakout_swing: ['ruptura de un swing reciente con confirmación de vela', 'a recent swing breakout confirmed by the candle'],
  ma_cross: ['el cruce de dos medias móviles', 'a cross of two moving averages'],
  rsi: ['el RSI saliendo de sobreventa o sobrecompra', 'RSI leaving oversold or overbought'],
  donchian: ['la ruptura del canal Donchian', 'a Donchian channel breakout'],
  time: ['una hora fija del día', 'a fixed time of day'],
};
const TREND = [['una media móvil', 'a moving average'], ['la estructura del precio (máximos y mínimos crecientes o decrecientes)', 'price structure (higher/lower highs and lows)'], ['el canal Donchian', 'the Donchian channel']];
const DD = [['trailing (se mide desde el punto más alto que alcanzó la cuenta)', 'trailing (measured from the account\'s highest point)'], ['estático (se mide desde el balance inicial)', 'static (measured from the initial balance)'], ['trailing hasta break-even y luego fijo', 'trailing until break-even, then fixed']];
const PHASE = [['Fase 1 (reto)', 'Phase 1 (challenge)'], ['Fase 2 (verificación)', 'Phase 2 (verification)'], ['Real (fondeada)', 'Real (funded)']];

function tfLabel(tf: string): string {
  const m: Record<string, string> = { M1: '1 min', M2: '2 min', M3: '3 min', M4: '4 min', M5: '5 min', M6: '6 min', M10: '10 min', M12: '12 min', M15: '15 min', M20: '20 min', M30: '30 min', H1: '1 h', H2: '2 h', H3: '3 h', H4: '4 h', H6: '6 h', H8: '8 h', H12: '12 h', D1: '1 día', W1: '1 semana', MN1: '1 mes' };
  return m[tf] || tf;
}
function rr(s: BotSpec): string {
  if (s.tp1Unit === 'rr') return `1 : ${s.tp1Val}`;
  if (s.runnerUnit === 'rr') return `1 : ${s.runnerVal}`;
  return '—';
}

// Filas "para qué sirve cada parámetro".
function paramRows(s: BotSpec, es: boolean): [string, string, string][] {
  const u = (x: string) => unitLabel(x, !es);
  const rows: [string, string, string][] = [
    [P(es, 'Instrumento', 'Instrument'), s.symbol, P(es, 'El par o activo donde opera el bot.', 'The pair or asset the bot trades.')],
    [P(es, 'Temporalidad', 'Timeframe'), tfLabel(s.tf), P(es, 'El ritmo de las velas que analiza para entrar.', 'The candle rhythm it reads to enter.')],
    [P(es, 'Riesgo por operación', 'Risk per trade'), `${s.riskVal} ${u(s.riskUnit)}`, P(es, 'Cuánto arriesga en cada entrada; de aquí calcula el tamaño del lote.', 'How much it risks per entry; it sizes the lot from this.')],
    [P(es, 'Stop loss', 'Stop loss'), `${s.slVal} ${u(s.slUnit)}`, P(es, 'Dónde acepta perder y cierra la operación para protegerte.', 'Where it accepts a loss and closes to protect you.')],
    [P(es, 'TP1 (parcial)', 'TP1 (partial)'), `${s.tp1Val} ${u(s.tp1Unit)} · ${s.partialPct}%`, P(es, 'Primer objetivo: cierra una parte y asegura ganancia.', 'First target: closes part and locks in profit.')],
    [P(es, 'Runner / TP final', 'Runner / final TP'), s.runnerUnit === 'structure' ? u('structure') : `${s.runnerVal} ${u(s.runnerUnit)}`, P(es, 'Deja correr el resto para buscar una ganancia mayor.', 'Lets the rest run for a bigger gain.')],
    [P(es, 'Trailing', 'Trailing'), s.useTrail ? `${s.trailVal} ${u(s.trailUnit)}` : P(es, 'apagado', 'off'), P(es, 'Va subiendo el stop detrás del precio para no devolver ganancia.', 'Trails the stop behind price so you don\'t give profit back.')],
    [P(es, 'Cap de pérdida diaria', 'Daily loss cap'), `${s.dailyLossVal} ${u(s.dailyLossUnit)}`, P(es, 'Si pierde esto en un día, deja de operar hasta el día siguiente.', 'If it loses this in a day, it stops until the next day.')],
  ];
  if (s.dailyProfitVal > 0) rows.push([P(es, 'Objetivo diario', 'Daily target'), `${s.dailyProfitVal} ${u(s.dailyProfitUnit)}`, P(es, 'Al alcanzar esta ganancia deja de abrir para no devolverla.', 'Once it reaches this profit it stops opening to keep it.')]);
  rows.push([P(es, 'Fondeo', 'Prop firm'), `${s.firmName} · ${s.firmTotalLimitPct}%`, P(es, `Respeta el límite total del reto. Tipo de DD: ${DD[s.ddType][es ? 0 : 1]}.`, `Respects the firm\'s total limit. DD type: ${DD[s.ddType][es ? 0 : 1]}.`)]);
  rows.push([P(es, 'Frenos del bot', 'Bot brakes'), `${s.acctSoftStopPct}% / ${s.acctDailyStopPct}% / ${s.acctMaxDDPct}%`, P(es, 'Freno suave, freno duro diario y freno total, por debajo del límite del firm.', 'Soft, hard-daily and total brakes, below the firm limit.')]);
  const tg = s.accountMode === 0 ? s.targetP1 : s.accountMode === 1 ? s.targetP2 : 0;
  rows.push([P(es, 'Objetivo de cuenta', 'Account target'), `${PHASE[s.accountMode][es ? 0 : 1]}${tg ? ` · +${tg}%` : ''}`, P(es, 'Cuando llega a la meta de la fase, deja de abrir operaciones.', 'When it hits the phase target, it stops opening trades.')]);
  rows.push([P(es, 'Horario', 'Hours'), `${pad(s.signalFromH)}:${pad(s.signalFromM)}–${pad(s.signalToH)}:${pad(s.signalToM)}`, P(es, 'Solo busca entradas dentro de esta ventana.', 'It only looks for entries inside this window.')]);
  return rows;
}
function pad(n: number) { return String(n).padStart(2, '0'); }

// Pasos de instalación por plataforma.
function installSteps(s: BotSpec, es: boolean): [string, string][] {
  const P5 = s.platform;
  if (P5 === 'ctrader') return [
    [P(es, 'Descarga el archivo', 'Download the file'), P(es, 'Descarga el cBot (.cs) de tu bot desde Onyx.', 'Download your bot\'s cBot (.cs) from Onyx.')],
    [P(es, 'Abre cTrader Automate', 'Open cTrader Automate'), P(es, 'Ve a la pestaña Automate y crea un cBot nuevo; pega el código.', 'Go to the Automate tab and create a new cBot; paste the code.')],
    [P(es, 'Compila (Build)', 'Build'), P(es, 'Pulsa Build y espera que compile sin errores.', 'Press Build and wait for it to compile with no errors.')],
    [P(es, 'Añádelo al gráfico', 'Add it to the chart'), P(es, `Abre el gráfico de ${esc(s.symbol)} en ${tfLabel(s.tf)} y añade el cBot con los parámetros.`, `Open the ${esc(s.symbol)} chart at ${tfLabel(s.tf)} and add the cBot with the parameters.`)],
    [P(es, 'Dale Play', 'Press Play'), P(es, 'Pulsa Play para que empiece a operar.', 'Press Play so it starts trading.')],
    [P(es, 'Prueba en DEMO', 'Test on DEMO'), P(es, 'Úsalo primero en una cuenta demo antes de real.', 'Run it on a demo account first, before real.')],
  ];
  const folder = P5 === 'mt4' ? 'MQL4/Experts' : 'MQL5/Experts';
  const ext = P5 === 'mt4' ? '.mq4' : '.mq5';
  return [
    [P(es, 'Descarga los archivos', 'Download the files'), P(es, `Descarga el EA (${ext}) y la config (.set) de tu bot desde Onyx.`, `Download your bot\'s EA (${ext}) and config (.set) from Onyx.`)],
    [P(es, `Cópialo en ${folder}`, `Copy it to ${folder}`), P(es, `En la plataforma abre Archivo → Abrir carpeta de datos y pega el EA en ${folder}.`, `In the platform open File → Open Data Folder and paste the EA into ${folder}.`)],
    [P(es, 'Compila con F7', 'Compile with F7'), P(es, 'Abre MetaEditor, abre el EA y pulsa F7 para compilar sin errores.', 'Open MetaEditor, open the EA and press F7 to compile with no errors.')],
    [P(es, 'Arrástralo al gráfico', 'Drag it onto the chart'), P(es, `Abre el gráfico de ${esc(s.symbol)} en ${tfLabel(s.tf)} y arrastra el EA; en la ventana carga tu archivo .set.`, `Open the ${esc(s.symbol)} chart at ${tfLabel(s.tf)} and drag the EA; in the dialog load your .set file.`)],
    [P(es, 'Activa AutoTrading', 'Enable AutoTrading'), P(es, 'Pulsa el botón AutoTrading (arriba) para que quede verde.', 'Click the AutoTrading button (top) so it turns green.')],
    [P(es, 'Prueba en DEMO', 'Test on DEMO'), P(es, 'Pruébalo en el Probador de estrategias y en una cuenta demo antes de real.', 'Test it in the Strategy Tester and on a demo account before going live.')],
  ];
}

export function buildGuideHTML(s: BotSpec, trader: string, es = true): string {
  const u = (x: string) => unitLabel(x, !es);
  const bias = TREND[s.trendMode][es ? 0 : 1];
  const trig = (TRIG[s.entryTrigger] || TRIG.ma_cross)[es ? 0 : 1];
  const dir = s.allowLongs && s.allowShorts ? P(es, 'compras y ventas', 'longs and shorts') : s.allowLongs ? P(es, 'solo compras', 'longs only') : P(es, 'solo ventas', 'shorts only');
  const strategy = P(es,
    `Tu bot “${esc(s.name)}” opera en ${esc(s.symbol)} usando velas de ${tfLabel(s.tf)}. Primero mira la tendencia con ${bias} en ${tfLabel(s.trendTF)} para decidir el sesgo. Cuando el precio confirma ${trig} a favor de ese sesgo, entra al mercado (${dir}). Ya dentro, gestiona la operación: cierra una parte en el primer objetivo (TP1) para asegurar ganancia, deja correr el resto y, si activaste el trailing, va subiendo el stop detrás del precio. Cada día respeta un tope de pérdida y los frenos de la cuenta, para cuidar tu fondeo.`,
    `Your bot “${esc(s.name)}” trades ${esc(s.symbol)} on ${tfLabel(s.tf)} candles. It first reads the trend using ${bias} on ${tfLabel(s.trendTF)} to set its bias. When price confirms ${trig} in favor of that bias, it enters (${dir}). Once in, it manages the trade: it closes part at the first target (TP1) to lock in profit, lets the rest run, and — if trailing is on — trails the stop behind price. Every day it respects a loss cap and the account brakes to protect your funding.`);
  const rows = paramRows(s, es);
  const steps = installSteps(s, es);
  const pill = (t: string) => `<span class="pill">${esc(t)}</span>`;
  const plat = s.platform.toUpperCase();

  return `<!doctype html><html lang="${es ? 'es' : 'en'}"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(s.name)} — ${P(es, 'Guía', 'Guide')}</title>
<style>
  :root{--ink:#12141a;--mut:#5b6270;--bd:#e6e8ee;--brand:#5b63d3;--brandbg:#eef0fe;--ok:#1d9e75;--okbg:#e1f5ee;--warn:#ba7517;--card:#fff;--bg:#f6f7fb}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.65 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
  .wrap{max-width:820px;margin:0 auto;padding:28px 20px 60px}
  .cover{background:linear-gradient(135deg,#3c3489,#5b63d3);color:#fff;border-radius:18px;padding:30px 28px;margin-bottom:22px}
  .kicker{font-size:12px;letter-spacing:.14em;opacity:.85;margin-bottom:12px}
  .cover h1{margin:0;font-size:30px;font-weight:700;line-height:1.15}
  .cover .for{margin-top:8px;font-size:15px;opacity:.95}
  .pills{margin-top:16px;display:flex;flex-wrap:wrap;gap:8px}
  .pill{background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.28);border-radius:99px;padding:5px 12px;font-size:13px}
  h2{font-size:18px;margin:26px 0 12px;display:flex;align-items:center;gap:9px}
  h2 .n{width:26px;height:26px;border-radius:8px;background:var(--brandbg);color:var(--brand);display:inline-flex;align-items:center;justify-content:center;font-size:14px;font-weight:700}
  .card{background:var(--card);border:1px solid var(--bd);border-radius:14px;padding:18px 20px}
  .flow{display:flex;gap:8px;flex-wrap:wrap}
  .flow .step{flex:1;min-width:150px;background:var(--card);border:1px solid var(--bd);border-radius:12px;padding:12px 14px}
  .flow .step b{color:var(--brand);font-size:12px}
  table{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--bd);border-radius:14px;overflow:hidden}
  td{padding:11px 14px;border-top:1px solid var(--bd);vertical-align:top;font-size:14px}
  tr:first-child td{border-top:none}
  td.k{font-weight:600;white-space:nowrap;width:34%}
  td.v{color:var(--brand);font-weight:600;white-space:nowrap;width:20%}
  td.d{color:var(--mut)}
  ol.steps{list-style:none;counter-reset:s;margin:0;padding:0}
  ol.steps li{counter-increment:s;background:var(--card);border:1px solid var(--bd);border-radius:12px;padding:12px 14px 12px 52px;position:relative;margin-bottom:10px}
  ol.steps li::before{content:counter(s);position:absolute;left:14px;top:12px;width:26px;height:26px;border-radius:8px;background:var(--brandbg);color:var(--brand);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px}
  ol.steps li b{display:block;margin-bottom:2px}
  ol.steps li span{color:var(--mut);font-size:13.5px}
  .note{background:var(--okbg);border:1px solid #9fe1cb;color:#0f6e56;border-radius:12px;padding:12px 14px;font-size:13.5px;margin-top:16px}
  .warn{background:#faeeda;border:1px solid #fac775;color:#854f0b;border-radius:12px;padding:12px 14px;font-size:13px;margin-top:12px}
  .print{position:fixed;top:16px;right:16px;background:var(--brand);color:#fff;border:none;border-radius:10px;padding:10px 16px;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 4px 14px rgba(91,99,211,.4)}
  .foot{text-align:center;color:var(--mut);font-size:12px;margin-top:28px}
  @media print{.print{display:none}body{background:#fff}.wrap{max-width:none;padding:0}.cover{border-radius:0}}
</style></head><body>
<button class="print" onclick="window.print()">${P(es, 'Descargar PDF', 'Download PDF')}</button>
<div class="wrap">
  <div class="cover">
    <div class="kicker">${P(es, 'GUÍA DEL BOT · ONYX', 'BOT GUIDE · ONYX')}</div>
    <h1>${esc(s.name)}</h1>
    <div class="for">${P(es, 'Preparada para', 'Prepared for')} <b>${esc(trader || (es ? 'ti' : 'you'))}</b> · ${plat} · ${esc(s.symbol)}</div>
    <div class="pills">${pill(P(es, `Sesgo ${TREND[s.trendMode][es ? 0 : 1].split('(')[0].trim()}`, `Bias ${TREND[s.trendMode][es ? 0 : 1]}`))}${pill(`${P(es, 'Riesgo', 'Risk')} ${s.riskVal} ${u(s.riskUnit)}`)}${pill(`R:R ${rr(s)}`)}${pill(`${tfLabel(s.tf)}`)}</div>
  </div>

  <h2><span class="n">1</span>${P(es, 'Cómo opera tu bot', 'How your bot works')}</h2>
  <div class="card">${esc(strategy)}</div>
  <div class="flow" style="margin-top:12px">
    <div class="step"><b>${P(es, '1 · Sesgo', '1 · Bias')}</b><div>${P(es, `Mira la tendencia en ${tfLabel(s.trendTF)} con ${TREND[s.trendMode][0]}`, `Reads the trend on ${tfLabel(s.trendTF)} using ${TREND[s.trendMode][1]}`)}</div></div>
    <div class="step"><b>${P(es, '2 · Gatillo', '2 · Trigger')}</b><div>${P(es, `Entra con ${trig}`, `Enters on ${trig}`)}</div></div>
    <div class="step"><b>${P(es, '3 · Gestión', '3 · Management')}</b><div>${P(es, `TP1 ${s.tp1Val} ${u(s.tp1Unit)} + ${s.useTrail ? 'trailing' : P(es, 'runner', 'runner')}`, `TP1 ${s.tp1Val} ${u(s.tp1Unit)} + ${s.useTrail ? 'trailing' : 'runner'}`)}</div></div>
  </div>

  <h2><span class="n">2</span>${P(es, 'Para qué sirve cada parámetro', 'What each parameter is for')}</h2>
  <table><tbody>${rows.map(([k, v, d]) => `<tr><td class="k">${esc(k)}</td><td class="v">${esc(v)}</td><td class="d">${esc(d)}</td></tr>`).join('')}</tbody></table>

  <h2><span class="n">3</span>${P(es, `Instalación en ${plat}, paso a paso`, `Install on ${plat}, step by step`)}</h2>
  <ol class="steps">${steps.map(([t, d]) => `<li><b>${esc(t)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
  <div class="note">${P(es, 'Consejo: deja el bot corriendo unos días en DEMO y revisa que abra y cierre como esperas antes de pasarlo a real.', 'Tip: let the bot run a few days on DEMO and check it opens and closes as expected before going live.')}</div>
  <div class="warn">${P(es, 'Aviso: el trading conlleva riesgo. Esta guía describe tu configuración; no promete resultados. Compila y prueba siempre en demo. La operación es responsabilidad del trader.', 'Notice: trading carries risk. This guide describes your setup; it does not promise results. Always compile and test on demo. Trading is the trader\'s responsibility.')}</div>

  <div class="foot">${P(es, 'Generado por Onyx Bot Builder', 'Generated by Onyx Bot Builder')} · ${esc(s.name)}</div>
</div></body></html>`;
}
