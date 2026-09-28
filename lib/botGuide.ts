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

// Bloque de instalación de UNA plataforma: título, pasos detallados y (para MT) las URLs de WebRequest.
type PlatBlock = { key: string; label: string; sub: string; steps: [string, string][]; urls?: string[] };

function mtBlock(s: BotSpec, es: boolean, mt4: boolean, site: string): PlatBlock {
  const folder = mt4 ? 'MQL4\\Experts' : 'MQL5\\Experts';
  const ext = mt4 ? '.mq4' : '.mq5';
  const name = mt4 ? 'MetaTrader 4' : 'MetaTrader 5';
  const sym = esc(s.symbol); const tf = tfLabel(s.tf);
  return {
    key: mt4 ? 'mt4' : 'mt5', label: name,
    sub: P(es, `Para cuentas y brokers que usan ${name}.`, `For accounts and brokers using ${name}.`),
    urls: [site, 'https://nfs.faireconomy.media'],
    steps: [
      [P(es, `1) Descarga los archivos (${ext} y .set)`, `1) Download the files (${ext} and .set)`),
       P(es, `En Onyx, en la ventana “Tu robot está listo”, pulsa “Descargar robot (${ext})” y también “Config (.set)”. Guárdalos donde los encuentres fácil (por ejemplo, el Escritorio).`, `In Onyx, on the “Your robot is ready” window, click “Download robot (${ext})” and also “Config (.set)”. Save them somewhere easy to find (e.g. the Desktop).`)],
      [P(es, '2) Abre la carpeta de datos de la plataforma', '2) Open the platform data folder'),
       P(es, `Abre ${name}. Arriba ve a Archivo → Abrir carpeta de datos. Se abre una ventana del explorador de archivos.`, `Open ${name}. At the top go to File → Open Data Folder. A file-explorer window opens.`)],
      [P(es, `3) Copia el robot en ${folder}`, `3) Copy the robot into ${folder}`),
       P(es, `Dentro de esa ventana entra en la carpeta ${folder} y pega ahí el archivo ${ext}. Puedes crear una subcarpeta “Onyx” para tenerlo ordenado.`, `Inside that window open the ${folder} folder and paste the ${ext} file there. You can make an “Onyx” subfolder to keep it tidy.`)],
      [P(es, '4) Actualiza el Navegador', '4) Refresh the Navigator'),
       P(es, `Vuelve a ${name}. En el panel “Navegador” (izquierda), clic derecho sobre “Asesores Expertos” → Actualizar. Ahora deberías ver tu robot en la lista.`, `Back in ${name}, in the “Navigator” panel (left), right-click “Expert Advisors” → Refresh. You should now see your robot in the list.`)],
      [P(es, '5) Compila con F7 (0 errores)', '5) Compile with F7 (0 errors)'),
       P(es, 'Haz doble clic en el robot: se abre MetaEditor. Pulsa F7 (Compilar). Abajo debe decir “0 errores, 0 advertencias”. Si hay errores, cópialos y pásamelos.', 'Double-click the robot: MetaEditor opens. Press F7 (Compile). At the bottom it must say “0 errors, 0 warnings”. If there are errors, copy them and send them to me.')],
      [P(es, '6) Permite las URLs (WebRequest)', '6) Allow the URLs (WebRequest)'),
       P(es, 'En la plataforma ve a Herramientas → Opciones → pestaña “Asesores Expertos”. Marca “Permitir WebRequest para las siguientes URL” y añade las dos URLs de abajo (una por línea). Pulsa Aceptar. Esto permite la activación de tu clave Onyx y el filtro de noticias.', 'In the platform go to Tools → Options → “Expert Advisors” tab. Tick “Allow WebRequest for listed URL” and add the two URLs below (one per line). Click OK. This lets your Onyx key activate and the news filter work.')],
      [P(es, `7) Abre el gráfico de ${sym} en ${tf}`, `7) Open the ${sym} chart at ${tf}`),
       P(es, `Abre el gráfico del par ${sym} y ponlo en la temporalidad ${tf} (arriba, la barra de periodos). El robot opera el símbolo del gráfico donde lo pongas.`, `Open the ${sym} chart and set it to the ${tf} timeframe (top periods bar). The robot trades the symbol of the chart you place it on.`)],
      [P(es, '8) Arrastra el robot y carga tu .set', '8) Drag the robot and load your .set'),
       P(es, 'Desde el Navegador, arrastra el robot encima del gráfico. Se abre una ventana; en la pestaña “Parámetros de entrada” pulsa “Cargar” y elige tu archivo .set (así quedan puestos todos tus valores).', 'From the Navigator, drag the robot onto the chart. A window opens; on the “Inputs” tab click “Load” and pick your .set file (this fills in all your values).')],
      [P(es, '9) Pega tu clave Onyx en InpApiKey', '9) Paste your Onyx key in InpApiKey'),
       P(es, 'En esa misma lista de parámetros busca “InpApiKey” y pega tu clave de Onyx. Es obligatoria SIEMPRE, tanto en demo como en real (las cuentas de fondeo también corren en demo). Sin clave válida el robot no abre operaciones.', 'In that same parameter list find “InpApiKey” and paste your Onyx key. It is ALWAYS required, on demo and live (funded accounts also run on demo). Without a valid key the robot won’t open trades.')],
      [P(es, '10) Activa el AutoTrading', '10) Enable AutoTrading'),
       P(es, 'En la ventana, marca “Permitir trading algorítmico” y pulsa Aceptar. Luego pulsa el botón “AutoTrading” de la barra superior hasta que quede verde. En la esquina del gráfico verás una carita 😀 y el panel del robot.', 'In the window, tick “Allow Algo Trading” and click OK. Then press the top-bar “AutoTrading” button until it turns green. In the chart corner you’ll see a smiley 😀 and the robot’s panel.')],
      [P(es, '11) Prueba en DEMO unos días', '11) Test on DEMO for a few days'),
       P(es, 'Déjalo en una cuenta demo primero. Revisa el panel del robot en el gráfico y la pestaña “Expertos”/“Diario” abajo para ver qué hace. Cuando estés seguro, pásalo a real.', 'Run it on a demo account first. Check the robot panel on the chart and the “Experts”/“Journal” tab below to see what it does. When you’re confident, move it to live.')],
    ],
  };
}

function ctBlock(s: BotSpec, es: boolean): PlatBlock {
  const sym = esc(s.symbol); const tf = tfLabel(s.tf);
  return {
    key: 'ctrader', label: 'cTrader',
    sub: P(es, 'Para cuentas y brokers que usan cTrader (cBot en C#).', 'For accounts and brokers using cTrader (C# cBot).'),
    steps: [
      [P(es, '1) Descarga el archivo .cs', '1) Download the .cs file'),
       P(es, 'En Onyx, en la ventana “Tu robot está listo”, pulsa “Descargar robot (.cs)”. En cTrader no se usa archivo .set: los valores ya vienen dentro del código.', 'In Onyx, on the “Your robot is ready” window, click “Download robot (.cs)”. cTrader doesn’t use a .set file: your values are baked into the code.')],
      [P(es, '2) Abre la pestaña Automate', '2) Open the Automate tab'),
       P(es, 'Abre cTrader y arriba pulsa la pestaña “Automate” (el icono del robot / código).', 'Open cTrader and at the top click the “Automate” tab (the robot / code icon).')],
      [P(es, '3) Crea un cBot nuevo', '3) Create a new cBot'),
       P(es, 'En la lista de cBots pulsa el “+” (New cBot). Se abre el editor de código con un ejemplo.', 'In the cBots list press “+” (New cBot). The code editor opens with a sample.')],
      [P(es, '4) Pega TODO el código', '4) Paste ALL the code'),
       P(es, 'Selecciona y borra el código de ejemplo, abre tu archivo .cs con el Bloc de notas, copia todo y pégalo en el editor de cTrader.', 'Select and delete the sample code, open your .cs file with Notepad, copy everything and paste it into the cTrader editor.')],
      [P(es, '5) Compila (Build)', '5) Build'),
       P(es, 'Pulsa “Build” (o F6). Abajo debe decir “Build succeeded” sin errores. Si hay errores, cópialos y pásamelos.', 'Press “Build” (or F6). At the bottom it must say “Build succeeded” with no errors. If there are errors, copy them and send them to me.')],
      [P(es, `6) Abre el gráfico de ${sym} en ${tf}`, `6) Open the ${sym} chart at ${tf}`),
       P(es, `Abre el gráfico del símbolo ${sym} en la temporalidad ${tf}. El cBot opera el símbolo del gráfico donde lo añadas.`, `Open the ${sym} chart at the ${tf} timeframe. The cBot trades the symbol of the chart you add it to.`)],
      [P(es, '7) Añade el cBot al gráfico', '7) Add the cBot to the chart'),
       P(es, 'En el gráfico, en el panel de abajo, elige tu cBot en la lista y pulsa “Add” (o desde Automate selecciónalo y añádelo al gráfico).', 'On the chart, in the bottom panel, pick your cBot from the list and press “Add” (or from Automate select it and add it to the chart).')],
      [P(es, '8) Pega tu clave en “Onyx API Key”', '8) Paste your key in “Onyx API Key”'),
       P(es, 'En los parámetros del cBot busca “Onyx API Key” y pega tu clave de Onyx. Es obligatoria SIEMPRE (demo y real; el fondeo también es demo). El resto de valores ya vienen fijados.', 'In the cBot parameters find “Onyx API Key” and paste your Onyx key. It is ALWAYS required (demo and live; funding is demo too). The rest of the values are already set.')],
      [P(es, '9) Permite el acceso a internet', '9) Allow internet access'),
       P(es, 'La primera vez, cTrader pedirá permiso de “Full Access” / acceso a internet: acéptalo. Es necesario para activar tu clave Onyx y para el filtro de noticias.', 'The first time, cTrader will ask for “Full Access” / internet permission: accept it. It’s needed to activate your Onyx key and for the news filter.')],
      [P(es, '10) Dale Play', '10) Press Play'),
       P(es, 'Pulsa el botón “Play” del cBot. Empezará a operar según tus reglas. En el gráfico verás el panel del robot con su estado.', 'Press the cBot’s “Play” button. It will start trading by your rules. On the chart you’ll see the robot panel with its status.')],
      [P(es, '11) Prueba en DEMO unos días', '11) Test on DEMO for a few days'),
       P(es, 'Úsalo primero en una cuenta demo. Mira el texto del panel en el gráfico para confirmar que hace lo esperado antes de pasarlo a real.', 'Run it on a demo account first. Watch the panel text on the chart to confirm it does what you expect before going live.')],
    ],
  };
}

// Los tres bloques, con la plataforma elegida del bot primero.
function installBlocks(s: BotSpec, es: boolean, site: string): PlatBlock[] {
  const all = [mtBlock(s, es, false, site), mtBlock(s, es, true, site), ctBlock(s, es)];
  const own = s.platform === 'mt4' ? 'mt4' : s.platform === 'ctrader' ? 'ctrader' : 'mt5';
  return all.sort((a, b) => (a.key === own ? -1 : b.key === own ? 1 : 0));
}

export function buildGuideHTML(s: BotSpec, trader: string, es = true, site = 'https://www.onyxtradinglive.com'): string {
  const u = (x: string) => unitLabel(x, !es);
  const bias = TREND[s.trendMode][es ? 0 : 1];
  const trig = (TRIG[s.entryTrigger] || TRIG.ma_cross)[es ? 0 : 1];
  const dir = s.allowLongs && s.allowShorts ? P(es, 'compras y ventas', 'longs and shorts') : s.allowLongs ? P(es, 'solo compras', 'longs only') : P(es, 'solo ventas', 'shorts only');
  const strategy = P(es,
    `Tu bot “${esc(s.name)}” opera en ${esc(s.symbol)} usando velas de ${tfLabel(s.tf)}. Primero mira la tendencia con ${bias} en ${tfLabel(s.trendTF)} para decidir el sesgo. Cuando el precio confirma ${trig} a favor de ese sesgo, entra al mercado (${dir}). Ya dentro, gestiona la operación: cierra una parte en el primer objetivo (TP1) para asegurar ganancia, deja correr el resto y, si activaste el trailing, va subiendo el stop detrás del precio. Cada día respeta un tope de pérdida y los frenos de la cuenta, para cuidar tu fondeo.`,
    `Your bot “${esc(s.name)}” trades ${esc(s.symbol)} on ${tfLabel(s.tf)} candles. It first reads the trend using ${bias} on ${tfLabel(s.trendTF)} to set its bias. When price confirms ${trig} in favor of that bias, it enters (${dir}). Once in, it manages the trade: it closes part at the first target (TP1) to lock in profit, lets the rest run, and — if trailing is on — trails the stop behind price. Every day it respects a loss cap and the account brakes to protect your funding.`);
  const rows = paramRows(s, es);
  const blocks = installBlocks(s, es, site);
  const pill = (t: string) => `<span class="pill">${esc(t)}</span>`;
  const plat = s.platform.toUpperCase();
  const ownKey = s.platform === 'mt4' ? 'mt4' : s.platform === 'ctrader' ? 'ctrader' : 'mt5';

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
  .platblock{margin:0 0 18px;padding:16px 18px;border:1px solid var(--bd);border-radius:14px;background:var(--card)}
  .platblock.own{border-color:var(--brand);box-shadow:0 0 0 3px var(--brandbg)}
  .plathead{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--bd)}
  .platname{font-size:17px;font-weight:700}
  .platbadge{background:var(--brand);color:#fff;border-radius:99px;padding:3px 10px;font-size:11px;font-weight:700;letter-spacing:.02em}
  .platsub{color:var(--mut);font-size:13px;flex-basis:100%}
  .urlbox{margin-top:12px;background:#f0f2fb;border:1px solid #d6dbf5;border-radius:12px;padding:12px 14px}
  .urlt{font-size:12.5px;font-weight:600;color:var(--brand);margin-bottom:8px}
  .urlbox code{display:block;background:#fff;border:1px solid var(--bd);border-radius:8px;padding:8px 10px;font-size:13px;color:#3a3f8f;word-break:break-all;margin-bottom:6px}
  .urlbox code:last-child{margin-bottom:0}
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

  <h2><span class="n">3</span>${P(es, 'Instalación paso a paso', 'Install step by step')}</h2>
  <div class="note" style="margin-top:0;margin-bottom:14px">${P(es, `Tu robot está hecho para <b>${plat}</b>, así que esa plataforma va primero. Abajo tienes también las otras dos por si cambias de broker. Los pasos son los mismos para cualquier robot que crees.`, `Your robot is built for <b>${plat}</b>, so that platform comes first. Below you also have the other two in case you switch brokers. The steps are the same for any robot you create.`)}</div>
  ${blocks.map((bl) => `
  <div class="platblock${bl.key === ownKey ? ' own' : ''}">
    <div class="plathead">
      <span class="platname">${esc(bl.label)}</span>
      ${bl.key === ownKey ? `<span class="platbadge">${P(es, 'tu plataforma', 'your platform')}</span>` : ''}
      <span class="platsub">${esc(bl.sub)}</span>
    </div>
    <ol class="steps">${bl.steps.map(([t, d]) => `<li><b>${esc(t)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
    ${bl.urls ? `<div class="urlbox"><div class="urlt">${P(es, 'URLs para el WebRequest (paso 6) — cópialas tal cual:', 'WebRequest URLs (step 6) — copy them exactly:')}</div>${bl.urls.map((x) => `<code>${esc(x)}</code>`).join('')}</div>` : ''}
  </div>`).join('')}
  <div class="note">${P(es, 'Consejo: deja el robot corriendo unos días en DEMO y revisa que abra y cierre como esperas antes de pasarlo a real. Recuerda: el mercado abre el domingo por la tarde y cierra el viernes.', 'Tip: let the robot run a few days on DEMO and check it opens and closes as expected before going live. Remember: the market opens Sunday afternoon and closes Friday.')}</div>
  <div class="warn">${P(es, 'Aviso: el trading conlleva riesgo. Esta guía describe tu configuración; no promete resultados. Compila y prueba siempre en demo. La operación es responsabilidad del trader.', 'Notice: trading carries risk. This guide describes your setup; it does not promise results. Always compile and test on demo. Trading is the trader\'s responsibility.')}</div>

  <div class="foot">${P(es, 'Generado por Onyx Bot Builder', 'Generated by Onyx Bot Builder')} · ${esc(s.name)}</div>
</div></body></html>`;
}
