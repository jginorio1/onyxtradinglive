'use client';
import { toast } from '@/lib/toast';
import OnyxIcon from '@/app/components/OnyxIcon';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useLang } from '@/lib/lang';
import { errMsg } from '@/lib/i18nErrors';

// Colores de rol: master = morado, esclava = verde-azulado. Bien marcados.
const C_MASTER = 'var(--brand)';
const C_SLAVE = 'var(--green)';
const APP = 'https://www.onyxtradinglive.com';

const T: any = {
  es: {
    title: 'Copy trading', sub: 'Replica de una cuenta master a tus esclavas. Tú eres dueño de todas.',
    relNote: 'Las cuentas se conectan en “Cuentas”. Aquí, en Onyx Copy, configuras cómo se copian (modo, lote, riesgo).',
    lock: 'El copy trading está en el plan Elite.', lockCta: 'Ver planes →',
    warn: 'Copiar entre cuentas puede violar las reglas de tu prop firm. Eres responsable de cumplirlas.',
    howTitle: 'Cómo activar el copy trading', howHide: 'Ocultar', howShow: 'Ver guía',
    how1: 'Conecta al menos 2 cuentas', how1b: 'Una será la Master (manda) y las otras Esclavas (reciben). Se conectan en Cuentas (MetaTrader o cTrader).',
    how1link: 'Ir a Cuentas →',
    how2: 'Genera la clave Copy e instala la EA', how2b: 'Abajo, en “Claves Copy”, pulsa Instalar en cada cuenta: te abre el asistente con la EA, la URL y tu clave, y confirma en vivo cuando conecta.',
    how3: 'Crea el enlace Master → Esclava', how3b: 'En “Nuevo enlace” eliges la master, la esclava y el modo. Desde ese momento se copia. Puedes pausar/reanudar arriba o por Telegram.',
    needMore: 'Solo tienes 1 cuenta conectada. Conecta otra para poder crear un enlace de copia.',
    control: 'Control de copia', ctrlActive: 'Copia activa', ctrlPaused: 'Copia pausada',
    ctrlActiveSub: 'enlaces activos', ctrlPausedSub: 'nada se está replicando',
    pauseAll: 'Pausar todo', resumeAll: 'Reanudar', byAccount: 'Por cuenta',
    accActive: 'activa', accPaused: 'pausada', role_master: 'MASTER', role_slave: 'ESCLAVA', role_both: 'MASTER + ESCLAVA',
    remoteHint: 'Puedes pausar y reanudar desde el móvil o por Telegram (/copyoff · /copyon). Pausar es instantáneo; reanudar pide tu PIN.',
    pinTitle: 'PIN de copy', pinNone: 'Sin PIN — reanudar no pide confirmación.', pinSet: 'PIN activo — reanudar lo pedirá.',
    setPin: 'Poner PIN', changePin: 'Cambiar', removePin: 'Quitar',
    pinNew: 'Nuevo PIN (4–8 dígitos)', pinCur: 'PIN actual', pinSave: 'Guardar', pinCancel: 'Cancelar',
    resumeAsk: '¿Reanudar la copia en vivo?', resumeBody: 'Volverá a copiar las operaciones al instante. Escribe tu PIN para confirmar.',
    resume: 'Reanudar',
    slots: 'Esclavas', used: 'usadas', of: 'de', extra: 'extra', buyMore: 'Comprar esclava extra', slaveMo: '/mes cada una',
    addonNeed2: 'Conecta 2 cuentas (Master y Esclava) para copiar y poder comprar esclavas extra.',
    masters: 'Masters', buyMaster: 'Comprar master extra', masterMo: '/mes cada una',
    grpMaster: 'MASTER', ungrouped: 'Sin agrupar',
    dlTitle: 'Descargar el conector de copy', dlSub: 'MetaTrader (.mq5/.mq4) o cTrader (.cs). Master en la cuenta que manda, Esclava en las que reciben.',
    dlMasterDesc: 'La que manda las operaciones.', dlSlaveDesc: 'La que recibe y replica.',
    dlHint: 'El asistente “Instalar” te guía paso a paso con tu clave.',
    keys: 'Claves Copy', keysSub: 'Cada cuenta en copy usa su propia clave Copy, separada del Guardian.',
    genKey: 'Generar clave', revoke: 'Revocar', copyKey: 'Copiar', copied: '¡Copiado!',
    keyReady: 'Clave lista', noKey: 'Sin clave Copy', install: 'Instalar', keyWarn: 'Guárdala: no se vuelve a mostrar entera.',
    liveOn: 'Conectada',
    wizTitle: 'Instalar copy en', wizStep1: 'Descarga la EA', wizStep1b: 'Master (manda) o Esclava (recibe) según el rol de esta cuenta.',
    wizStep2: 'Permite WebRequest', wizStep2b: 'En MT5 → Herramientas → Opciones → Asesores Expertos, añade la URL:',
    wizStep3: 'Pega tu clave Copy', wizStep3b: 'En la EA, en el campo ApiKey pega esta clave:',
    wizWait: 'Esperando la primera señal de tu EA…', wizOk: '¡Conectada! Ya puedes copiar.', wizClose: 'Cerrar',
    dlMaster: 'EA Master (.mq5)', dlSlave: 'EA Esclava (.mq5)',
    wzPlat: '¿Tu MetaTrader es 4 o 5?', wzMt5: 'MetaTrader 5', wzMt4: 'MetaTrader 4',
    wzS1t: 'Descarga el archivo', wzS1d: 'Pulsa el botón. Se baja la EA a tu computadora.', wzDl: 'Descargar EA',
    wzS2t: 'Ponlo en MetaTrader', wzS2d: 'En MetaTrader: Archivo → Abrir carpeta de datos → __F__ → Experts. Pega ahí el archivo y reinicia MetaTrader.',
    wzS3t: 'Arrástralo a un gráfico', wzS3d: 'Abre cualquier gráfico y arrastra la EA encima. Marca “Permitir operaciones automáticas”.',
    wzS4t: 'Pega esta dirección', wzS4d: 'Marca “Permitir WebRequest para las URL siguientes” y pega esta línea:',
    wzS5t: 'Pega tu clave Copy', wzS5d: 'En el recuadro ApiKey pega tu clave y pulsa Aceptar.',
    wzCompT: 'Compílalo', wzCompD: 'Pulsa F4 (abre MetaEditor), abre el archivo Onyx y pulsa Compilar (F7). Debe decir 0 errores.',
    wzAlgoT: 'Enciende Algo Trading', wzAlgoD: 'Pulsa el botón verde “Algo Trading” de la barra de arriba. En el gráfico debe salir una carita sonriente.',
    wzMenuFile: 'Archivo', wzMenuData: 'Abrir carpeta de datos', wzMenuTools: 'Herramientas', wzMenuOpt: 'Opciones', wzMenuEA: 'Asesores Expertos',
    wzDropChart: 'Suéltalo en un gráfico', wzNav: 'Navegador', wzOk0: 'Debe decir: 0 errores, 0 advertencias',
    wzAllowAlgo: 'Marca “Permitir Algo Trading”', wzApiOnly: '← lo único que pegas', wzSrvNote: 'No toques la dirección del servidor: ya viene en la EA.',
    wzStuckT: 'Todavía no llega nada', wzStuckD: 'Casi siempre es una de estas. Revísalas en orden:',
    wzStuck: [
      { t: 'El botón Algo Trading no está verde', d: 'Es lo que falla el 80% de las veces.' },
      { t: 'Falta autorizar la dirección', d: 'Herramientas → Opciones → Asesores Expertos → “Permitir WebRequest”.' },
      { t: 'No compilaste la EA', d: 'Ábrela en MetaEditor y pulsa F7 (0 errores).' },
      { t: 'La clave se pegó mal', d: 'Copia otra vez tu clave Copy en el campo ApiKey.' },
    ],
    // --- cTrader (copy) ---
    wzPlatQ: '¿En qué plataforma va esta cuenta?', wzCt: 'cTrader',
    wzCtS2t: 'Abre Automate → New cBot', wzCtS2d: 'En cTrader Desktop: pestaña Automate → New cBot. Ponle un nombre y se abre el editor de código.',
    wzCtS3t: 'Pega el código y pulsa Build', wzCtS3d: 'Borra el ejemplo, pega el .cs descargado y pulsa Build (F6). Abajo debe decir “Build succeeded”.',
    wzCtS4t: 'Añádelo a un gráfico y pega tu clave', wzCtS4d: 'Abre cualquier gráfico. En los parámetros del cBot pega tu clave Copy en “Copy API key”. El API base ya viene puesto.',
    wzCtS5t: 'Acepta el acceso a red y pulsa Play', wzCtS5d: 'La primera vez acepta “Acceso completo” (red) y pulsa Play ▶. En unos segundos confirmará aquí abajo.',
    wzCtDl: 'Descargar cBot',
    wzCtStuck: [
      { t: 'El cBot no está en Play (▶)', d: 'Debe estar corriendo, no parado.' },
      { t: 'No aceptaste el “Acceso completo” (red)', d: 'Reinícialo y acepta el permiso de red.' },
      { t: 'El Build falló', d: 'Debe decir “Build succeeded”. Si hay errores, mándanoslos.' },
      { t: 'La clave se pegó mal', d: 'Pega tu clave Copy en el campo “Copy API key”.' },
    ],
    wzRetry: 'Comprobar ahora', wzChecking: 'Comprobando cada pocos segundos',
    links: 'Tus enlaces', newLink: 'Nuevo enlace', master: 'Master', slave: 'Esclava', mode: 'Modo',
    m_balance: 'Balance %', m_risk: 'Riesgo % (RR)', m_pips: 'Pips', m_fixed: 'Lote fijo ×',
    mult: 'Multiplicador', risk: 'Riesgo %', pip: 'Pips SL', maxLot: 'Lote máx', reverse: 'Invertir',
    add: 'Crear enlace', save: 'Guardar', del: 'Quitar', edit: 'Editar', on: 'Activo', off: 'Pausado', pick: 'Elige…',
    noAcc: 'Necesitas al menos 2 cuentas conectadas para copiar.',
    log: 'Replicación en vivo', noLog: 'Sin actividad todavía.',
    kcopied: 'copiado', kskipped: 'saltado (símbolo)', kerror: 'error',
    riskBlock: 'Controles de riesgo (opcional)', dailyLoss: 'Pérdida diaria máx %', maxDD: 'Drawdown máx %',
    maxSpread: 'Spread máx (pts)', sessFrom: 'Sesión desde (UTC)', sessTo: 'hasta', whitelist: 'Solo estos símbolos',
    whitelistPh: 'EURUSD, XAUUSD… (vacío = todos)', riskNote: 'La sesión y la lista de símbolos las aplica el servidor; el resto, la EA esclava.',
    mpTitle: 'Vas a elegir la cuenta Master', mpBody: 'La cuenta Master es la que MANDA: sus operaciones se copian a las esclavas. Elige la cuenta desde la que operas tú. Puedes tener varias masters (cada master extra es un add-on), cada una con sus propias esclavas.',
    mpWarn: 'Si tus esclavas son de prop firm, copiar entre cuentas puede violar sus reglas. Eres responsable de cumplirlas.',
    mpOk: 'Sí, es mi Master', mpNo: 'Cancelar',
  },
  en: {
    title: 'Copy trading', sub: 'Replicate from one master to your slave accounts. You own them all.',
    relNote: 'Accounts are connected under “Accounts”. Here, in Onyx Copy, you set how they copy (mode, lot, risk).',
    lock: 'Copy trading is on the Elite plan.', lockCta: 'See plans →',
    warn: 'Copying between accounts may violate your prop firm rules. You are responsible for compliance.',
    howTitle: 'How to activate copy trading', howHide: 'Hide', howShow: 'Show guide',
    how1: 'Connect at least 2 MT accounts', how1b: 'One is the Master (sends), the others Slaves (receive). Connect them under Accounts.',
    how1link: 'Go to Accounts →',
    how2: 'Generate the Copy key and install the EA', how2b: 'Below, in “Copy keys”, click Install on each account: it opens the wizard with the EA, the URL and your key, and confirms live when it connects.',
    how3: 'Create the Master → Slave link', how3b: 'In “New link” pick the master, the slave and the mode. From then on it copies. Pause/resume from the top or via Telegram.',
    needMore: 'You only have 1 connected account. Connect another to create a copy link.',
    control: 'Copy control', ctrlActive: 'Copy active', ctrlPaused: 'Copy paused',
    ctrlActiveSub: 'active links', ctrlPausedSub: 'nothing is replicating',
    pauseAll: 'Pause all', resumeAll: 'Resume', byAccount: 'By account',
    accActive: 'active', accPaused: 'paused', role_master: 'MASTER', role_slave: 'SLAVE', role_both: 'MASTER + SLAVE',
    remoteHint: 'Pause and resume from your phone or via Telegram (/copyoff · /copyon). Pausing is instant; resuming asks your PIN.',
    pinTitle: 'Copy PIN', pinNone: 'No PIN — resuming asks no confirmation.', pinSet: 'PIN on — resuming will ask for it.',
    setPin: 'Set PIN', changePin: 'Change', removePin: 'Remove',
    pinNew: 'New PIN (4–8 digits)', pinCur: 'Current PIN', pinSave: 'Save', pinCancel: 'Cancel',
    resumeAsk: 'Resume live copying?', resumeBody: 'It will copy trades again instantly. Enter your PIN to confirm.',
    resume: 'Resume',
    slots: 'Slaves', used: 'used', of: 'of', extra: 'extra', buyMore: 'Buy extra slave', slaveMo: '/mo each',
    addonNeed2: 'Connect 2 accounts (Master and Slave) to copy and to buy extra slaves.',
    masters: 'Masters', buyMaster: 'Buy extra master', masterMo: '/mo each',
    grpMaster: 'MASTER', ungrouped: 'Ungrouped',
    dlTitle: 'Download the copy connector', dlSub: 'MetaTrader (.mq5/.mq4) or cTrader (.cs). Master on the account that sends, Slave on those that receive.',
    dlMasterDesc: 'Sends the trades.', dlSlaveDesc: 'Receives and replicates.',
    dlHint: 'The “Install” wizard walks you through it with your key.',
    keys: 'Copy keys', keysSub: 'Each copy account uses its own Copy key, separate from Guardian.',
    genKey: 'Generate key', revoke: 'Revoke', copyKey: 'Copy', copied: 'Copied!',
    keyReady: 'Key ready', noKey: 'No Copy key', install: 'Install', keyWarn: 'Save it: it will not be shown in full again.',
    liveOn: 'Connected',
    wizTitle: 'Install copy on', wizStep1: 'Download the EA', wizStep1b: 'Master (sends) or Slave (receives) per this account role.',
    wizStep2: 'Allow WebRequest', wizStep2b: 'In MT5 → Tools → Options → Expert Advisors, add the URL:',
    wizStep3: 'Paste your Copy key', wizStep3b: 'In the EA ApiKey field, paste this key:',
    wizWait: 'Waiting for your EA’s first signal…', wizOk: 'Connected! You can copy now.', wizClose: 'Close',
    dlMaster: 'Master EA (.mq5)', dlSlave: 'Slave EA (.mq5)',
    wzPlat: 'Is your MetaTrader 4 or 5?', wzMt5: 'MetaTrader 5', wzMt4: 'MetaTrader 4',
    wzS1t: 'Download the file', wzS1d: 'Click the button. The EA downloads to your computer.', wzDl: 'Download EA',
    wzS2t: 'Put it in MetaTrader', wzS2d: 'In MetaTrader: File → Open Data Folder → __F__ → Experts. Drop the file there and restart MetaTrader.',
    wzS3t: 'Drag it onto a chart', wzS3d: 'Open any chart and drag the EA onto it. Tick “Allow algo trading”.',
    wzS4t: 'Paste this address', wzS4d: 'Tick “Allow WebRequest for listed URL” and paste this line:',
    wzS5t: 'Paste your Copy key', wzS5d: 'In the ApiKey box paste your key and click OK.',
    wzCompT: 'Compile it', wzCompD: 'Press F4 (opens MetaEditor), open the Onyx file and click Compile (F7). It must say 0 errors.',
    wzAlgoT: 'Turn on Algo Trading', wzAlgoD: 'Press the green “Algo Trading” button in the top bar. A smiley should appear on the chart.',
    wzMenuFile: 'File', wzMenuData: 'Open Data Folder', wzMenuTools: 'Tools', wzMenuOpt: 'Options', wzMenuEA: 'Expert Advisors',
    wzDropChart: 'Drop it on a chart', wzNav: 'Navigator', wzOk0: 'It should say: 0 errors, 0 warnings',
    wzAllowAlgo: 'Tick “Allow Algo Trading”', wzApiOnly: '← the only thing you paste', wzSrvNote: 'Do not touch the server address: it is already in the EA.',
    wzStuckT: 'Nothing has arrived yet', wzStuckD: 'It is almost always one of these. Check them in order:',
    wzStuck: [
      { t: 'The Algo Trading button is not green', d: 'This fails 80% of the time.' },
      { t: 'The address is not authorized', d: 'Tools → Options → Expert Advisors → “Allow WebRequest”.' },
      { t: 'You did not compile the EA', d: 'Open it in MetaEditor and press F7 (0 errors).' },
      { t: 'The key was pasted wrong', d: 'Copy your Copy key again into the ApiKey field.' },
    ],
    // --- cTrader (copy) ---
    wzPlatQ: 'Which platform is this account on?', wzCt: 'cTrader',
    wzCtS2t: 'Open Automate → New cBot', wzCtS2d: 'In cTrader Desktop: Automate tab → New cBot. Name it and the code editor opens.',
    wzCtS3t: 'Paste the code and press Build', wzCtS3d: 'Delete the sample, paste the downloaded .cs and press Build (F6). It should say “Build succeeded”.',
    wzCtS4t: 'Add it to a chart and paste your key', wzCtS4d: 'Open any chart. In the cBot parameters paste your Copy key into “Copy API key”. The API base is already set.',
    wzCtS5t: 'Accept network access and press Play', wzCtS5d: 'The first time accept “Full Access” (network) and press Play ▶. It will confirm below in a few seconds.',
    wzCtDl: 'Download cBot',
    wzCtStuck: [
      { t: 'The cBot is not on Play (▶)', d: 'It must be running, not stopped.' },
      { t: 'You did not accept “Full Access” (network)', d: 'Restart it and accept the network permission.' },
      { t: 'The Build failed', d: 'It should say “Build succeeded”. If there are errors, send them to us.' },
      { t: 'The key was pasted wrong', d: 'Paste your Copy key into the “Copy API key” field.' },
    ],
    wzRetry: 'Check now', wzChecking: 'Checking every few seconds',
    links: 'Your links', newLink: 'New link', master: 'Master', slave: 'Slave', mode: 'Mode',
    m_balance: 'Balance %', m_risk: 'Risk % (RR)', m_pips: 'Pips', m_fixed: 'Fixed lot ×',
    mult: 'Multiplier', risk: 'Risk %', pip: 'SL pips', maxLot: 'Max lot', reverse: 'Reverse',
    add: 'Create link', save: 'Save', del: 'Remove', edit: 'Edit', on: 'On', off: 'Paused', pick: 'Choose…',
    noAcc: 'You need at least 2 connected MT accounts to copy.',
    log: 'Live replication', noLog: 'No activity yet.',
    kcopied: 'copied', kskipped: 'skipped (symbol)', kerror: 'error',
    riskBlock: 'Risk controls (optional)', dailyLoss: 'Max daily loss %', maxDD: 'Max drawdown %',
    maxSpread: 'Max spread (pts)', sessFrom: 'Session from (UTC)', sessTo: 'to', whitelist: 'Only these symbols',
    whitelistPh: 'EURUSD, XAUUSD… (empty = all)', riskNote: 'Session and symbol list are enforced by the server; the rest by the slave EA.',
    mpTitle: 'You are choosing the Master account', mpBody: 'The Master account SENDS: its trades are copied to the slaves. Pick the account you trade from. You can run several masters (each extra master is an add-on), each with its own slaves.',
    mpWarn: 'If your slaves are prop-firm accounts, copying between accounts may break their rules. You are responsible for compliance.',
    mpOk: 'Yes, it’s my Master', mpNo: 'Cancel',
  },
};

function blankLink() {
  return { master_account_id: '', slave_account_id: '', mode: 'balance', multiplier: 1, risk_pct: 1, pip_risk: 20, max_lot: 50, reverse: false,
    daily_loss_pct: 0, max_drawdown_pct: 0, max_spread: 0, session_from: '', session_to: '', symbol_whitelist: [] };
}

export default function CopyClient() {
  const { lang } = useLang();
  const t = T[lang];
  const [d, setD] = useState<any>(null);
  const [ctrl, setCtrl] = useState<any>(null);
  const [ckeys, setCkeys] = useState<any[]>([]);
  const [log, setLog] = useState<any[]>([]);
  const [nl, setNl] = useState<any>(blankLink());
  const [showRisk, setShowRisk] = useState(false);
  const [showHow, setShowHow] = useState(true);
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<any>(null);
  const [wizard, setWizard] = useState<any>(null);
  const [revealKey, setRevealKey] = useState<string>('');
  const [copiedId, setCopiedId] = useState('');
  const [masterPopup, setMasterPopup] = useState<any>(null);
  const [pinModal, setPinModal] = useState<any>(null);

  const load = useCallback(() => fetch('/api/copy/links').then((r) => r.json()).then(setD).catch(() => setD({ inPlan: false })), []);
  const loadControl = useCallback(() => fetch('/api/copy/control').then((r) => r.ok ? r.json() : null).then((j) => j && setCtrl(j)).catch(() => {}), []);
  const loadKeys = useCallback(() => fetch('/api/copy/keys').then((r) => r.ok ? r.json() : null).then((j) => j && setCkeys(j.keys || [])).catch(() => {}), []);

  useEffect(() => { load(); loadControl(); loadKeys(); }, [load, loadControl, loadKeys]);
  useEffect(() => {
    const f = () => fetch('/api/copy/log').then((r) => r.ok ? r.json() : null).then((j) => j && setLog(j.log || [])).catch(() => {});
    f(); const iv = setInterval(() => { f(); loadControl(); }, 6000); return () => clearInterval(iv);
  }, [loadControl]);
  useEffect(() => { if (!wizard) return; const iv = setInterval(loadKeys, 4000); return () => clearInterval(iv); }, [wizard, loadKeys]);

  const accs: any[] = d?.accounts || [];
  const links: any[] = d?.links || [];
  const accById = (id: string) => accs.find((x) => x.id === id);
  const label = (id: string) => { const a = accById(id); return a ? (a.nickname || a.login) : id.slice(0, 6); };
  const modeLabel = (m: string) => ({ balance: t.m_balance, risk: t.m_risk, pips: t.m_pips, fixed: t.m_fixed } as any)[m] || m;

  const masterIds = new Set(links.map((l) => l.master_account_id));
  const slaveIds = new Set(links.map((l) => l.slave_account_id));
  const roleOf = (id: string) => { const m = masterIds.has(id), s = slaveIds.has(id); return m && s ? 'both' : m ? 'master' : s ? 'slave' : ''; };
  const roleColor = (r: string) => r === 'master' ? C_MASTER : r === 'slave' ? C_SLAVE : r === 'both' ? '#c9a4ff' : 'var(--mut)';
  const roleLabel = (r: string) => r === 'master' ? t.role_master : r === 'slave' ? t.role_slave : r === 'both' ? t.role_both : '';

  const keyOf = (login: any) => ckeys.find((k) => String(k.account_login) === String(login));
  const keyLive = (k: any) => k?.last_used_at && (Date.now() - new Date(k.last_used_at).getTime()) < 120000;

  async function save(payload: any) {
    setBusy(true);
    try {
      const r = await fetch('/api/copy/links', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await r.json();
      if (!r.ok) toast(errMsg(j, lang));
      else { load(); if (!payload.id) { setNl(blankLink()); setShowRisk(false); } setEdit(null); }
    } finally { setBusy(false); }
  }
  async function del(id: string) { await fetch('/api/copy/links', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) }); load(); }
  async function buyExtra(delta: number) {
    const next = Math.max(0, (d.extraSlaves || 0) + delta);
    const r = await fetch('/api/copy/addon', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ qty: next }) });
    const j = await r.json(); if (!r.ok) toast(errMsg(j, lang)); else load();
  }
  async function buyMaster(delta: number) {
    const next = Math.max(0, (d.extraMasters || 0) + delta);
    const r = await fetch('/api/copy/master-addon', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ qty: next }) });
    const j = await r.json(); if (!r.ok) toast(errMsg(j, lang)); else load();
  }

  async function control(action: string, opts: any = {}) {
    const r = await fetch('/api/copy/control', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, ...opts }) });
    const j = await r.json();
    if (!r.ok) { if (j.code === 'bad_pin') return false; toast(errMsg(j, lang)); return false; }
    loadControl(); return true;
  }
  function doPause(action: string, opts: any = {}) { control(action, opts); }
  function doResume(action: string, opts: any = {}) {
    if (ctrl?.hasPin) setPinModal({ mode: 'resume', run: (pin: string) => control(action, { ...opts, pin }) });
    else control(action, opts);
  }

  async function genKey(accountId: string) {
    const r = await fetch('/api/copy/keys', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ account_id: accountId }) });
    const j = await r.json(); if (!r.ok) { toast(errMsg(j, lang)); return null; }
    setRevealKey(j.key); loadKeys(); return j.key;
  }
  async function revokeKey(id: string) { await fetch('/api/copy/keys', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) }); loadKeys(); }
  function copyTx(txt: string, id: string) { navigator.clipboard?.writeText(txt); setCopiedId(id); setTimeout(() => setCopiedId(''), 1500); }

  async function openWizard(acc: any) {
    let k = keyOf(acc.login); let keyStr = revealKey && k ? revealKey : '';
    if (!k) { const nk = await genKey(acc.id); keyStr = nk || ''; }
    setWizard({ account: acc, role: roleOf(acc.id) || 'slave', key: keyStr });
  }

  if (!d) return <div className="wrap" style={{ maxWidth: 880, margin: '0 auto', padding: '40px 22px' }}><div className="muted">…</div></div>;

  const head = (
    <div style={{ marginBottom: 14 }}>
      <h1 style={{ fontSize: 22, marginBottom: 2 }}><OnyxIcon emoji="🔁" size={16} /> {t.title}</h1>
      <p className="muted" style={{ fontSize: 13.5, margin: 0 }}>{t.sub}</p>
      <p className="muted" style={{ fontSize: 12, margin: '4px 0 0', opacity: .85 }}><OnyxIcon emoji="ℹ" size={16} /> {t.relNote}</p>
    </div>
  );

  if (!d.inPlan) return (
    <div className="wrap" style={{ maxWidth: 640, margin: '0 auto', padding: '22px 22px 50px' }}>{head}
      <div className="card"><p className="muted" style={{ fontSize: 14, marginBottom: 10 }}>{t.lock}</p><Link className="btn btn-ghost" href="/pricing">{t.lockCta}</Link></div>
    </div>
  );

  const paused = !!ctrl?.paused;
  const linksActive = links.filter((l) => l.enabled).length;
  const copyAccs = (ctrl?.accounts || []).filter((a: any) => roleOf(a.id));

  const modeField = (o: any, set: (k: string, v: any) => void) => {
    if (o.mode === 'risk') return <label className="muted" style={{ fontSize: 12 }}>{t.risk}<input type="number" value={o.risk_pct} onChange={(e) => set('risk_pct', Number(e.target.value))} style={{ marginTop: 3 }} /></label>;
    if (o.mode === 'pips') return <label className="muted" style={{ fontSize: 12 }}>{t.pip}<input type="number" value={o.pip_risk} onChange={(e) => set('pip_risk', Number(e.target.value))} style={{ marginTop: 3 }} /></label>;
    return <label className="muted" style={{ fontSize: 12 }}>{t.mult}<input type="number" step="0.1" value={o.multiplier} onChange={(e) => set('multiplier', Number(e.target.value))} style={{ marginTop: 3 }} /></label>;
  };

  const riskFields = (o: any, set: (k: string, v: any) => void) => (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10, marginTop: 8 }}>
      <label className="muted" style={{ fontSize: 12 }}>{t.dailyLoss}<input type="number" value={o.daily_loss_pct} onChange={(e) => set('daily_loss_pct', Number(e.target.value))} style={{ marginTop: 3 }} /></label>
      <label className="muted" style={{ fontSize: 12 }}>{t.maxDD}<input type="number" value={o.max_drawdown_pct} onChange={(e) => set('max_drawdown_pct', Number(e.target.value))} style={{ marginTop: 3 }} /></label>
      <label className="muted" style={{ fontSize: 12 }}>{t.maxSpread}<input type="number" value={o.max_spread} onChange={(e) => set('max_spread', Number(e.target.value))} style={{ marginTop: 3 }} /></label>
      <label className="muted" style={{ fontSize: 12 }}>{t.sessFrom}<input type="time" value={o.session_from} onChange={(e) => set('session_from', e.target.value)} style={{ marginTop: 3 }} /></label>
      <label className="muted" style={{ fontSize: 12 }}>{t.sessTo}<input type="time" value={o.session_to} onChange={(e) => set('session_to', e.target.value)} style={{ marginTop: 3 }} /></label>
      <label className="muted" style={{ fontSize: 12, gridColumn: '1 / -1' }}>{t.whitelist}
        <input value={(o.symbol_whitelist || []).join(', ')} placeholder={t.whitelistPh}
          onChange={(e) => set('symbol_whitelist', e.target.value.split(',').map((s: string) => s.trim().toUpperCase()).filter(Boolean))} style={{ marginTop: 3 }} />
      </label>
      <p className="muted" style={{ fontSize: 11, gridColumn: '1 / -1', margin: 0 }}>{t.riskNote}</p>
    </div>
  );

  return (
    <div className="wrap" style={{ maxWidth: 880, margin: '0 auto', padding: '22px 22px 50px' }}>{head}
      <div className="card" style={{ marginBottom: 12, border: '1px solid var(--amber)', background: 'rgba(255,192,77,.06)' }}>
        <span style={{ fontSize: 12.5, color: 'var(--amber)' }}><OnyxIcon emoji="⚠" size={16} /> {t.warn}</span>
      </div>

      {/* CÓMO ACTIVAR / GUÍA DE INSTALACIÓN */}
      <div className="card" style={{ marginBottom: 12, border: '1px solid var(--accent,#6c7bff)', background: 'linear-gradient(180deg,rgba(108,123,255,.08),transparent)' }}>
        <div className="row between" style={{ alignItems: 'center', gap: 8 }}>
          <b style={{ fontSize: 14 }}><OnyxIcon emoji="🚀" size={16} /> {t.howTitle}</b>
          <button className="btn btn-ghost" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => setShowHow(!showHow)}>{showHow ? t.howHide : t.howShow}</button>
        </div>
        {showHow && (
          <div style={{ marginTop: 10 }}>
            <HowStep n={1} title={t.how1} body={t.how1b} accs={accs.length} extra={<Link href="/dashboard/keys" style={{ fontSize: 12, color: 'var(--accent,#8a97ff)' }}>{t.how1link}</Link>} />
            <HowStep n={2} title={t.how2} body={t.how2b} />
            <HowStep n={3} title={t.how3} body={t.how3b} />
            {accs.length === 1 && <div style={{ marginTop: 6, fontSize: 12, color: 'var(--amber)' }}><OnyxIcon emoji="⚠" size={16} /> {t.needMore}</div>}
          </div>
        )}
      </div>

      {/* CONTROL REMOTO · solo cuando ya hay al menos un enlace que controlar */}
      {links.length > 0 && (
      <div className="card" style={{ marginBottom: 12, border: `1px solid ${paused ? 'var(--red)' : 'var(--green)'}`, background: paused ? 'rgba(255,90,90,.05)' : 'linear-gradient(180deg,rgba(52,226,160,.06),transparent)' }}>
        <div className="row between" style={{ flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <div className="row" style={{ gap: 11, alignItems: 'center' }}>
            <span style={{ width: 40, height: 40, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, background: paused ? 'rgba(255,90,90,.15)' : 'rgba(52,226,160,.15)' }}>{paused ? '⏸' : '▶'}</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{paused ? t.ctrlPaused : t.ctrlActive}</div>
              <div className="muted" style={{ fontSize: 11.5 }}>{paused ? t.ctrlPausedSub : `${linksActive} ${t.ctrlActiveSub}`}</div>
            </div>
          </div>
          {paused
            ? <button className="btn btn-primary" onClick={() => doResume('resume_all')}>▶ {t.resumeAll}</button>
            : <button className="btn btn-danger" onClick={() => doPause('pause_all')}><OnyxIcon emoji="✋" size={16} /> {t.pauseAll}</button>}
        </div>

        {copyAccs.length > 0 && (
          <div style={{ marginTop: 12, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{t.byAccount}</div>
            {copyAccs.map((a: any) => {
              const r = roleOf(a.id);
              return (
                <div key={a.id} className="row between" style={{ padding: '7px 0', gap: 8, flexWrap: 'wrap' }}>
                  <span className="row" style={{ gap: 8, alignItems: 'center' }}>
                    <span className="pill" style={{ fontSize: 9.5, color: roleColor(r), background: roleColor(r) + '22' }}>{roleLabel(r)}</span>
                    <span style={{ fontSize: 13 }}>{a.nickname || a.login}</span>
                    <span className="muted" style={{ fontSize: 11, color: a.copy_paused ? 'var(--mut)' : 'var(--green)' }}>{a.copy_paused ? t.accPaused : t.accActive}</span>
                  </span>
                  <button className="btn btn-ghost" style={{ padding: '3px 11px', fontSize: 12 }}
                    onClick={() => a.copy_paused ? doResume('resume_account', { accountId: a.id }) : doPause('pause_account', { accountId: a.id })}>
                    {a.copy_paused ? '▶ ' + t.on : '⏸ ' + t.off}
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <p className="muted" style={{ fontSize: 11, marginTop: 10, marginBottom: 0 }}><OnyxIcon emoji="🔒" size={16} /> {t.remoteHint}</p>
      </div>
      )}

      {/* PIN de copy · solo tiene sentido cuando ya hay copia configurada */}
      {links.length > 0 && (
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="row between" style={{ flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <div>
            <b style={{ fontSize: 13.5 }}><OnyxIcon emoji="🔐" size={16} /> {t.pinTitle}</b>
            <div className="muted" style={{ fontSize: 11.5 }}>{ctrl?.hasPin ? t.pinSet : t.pinNone}</div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-ghost" style={{ padding: '4px 12px', fontSize: 12.5 }} onClick={() => setPinModal({ mode: 'set', has: ctrl?.hasPin })}>{ctrl?.hasPin ? t.changePin : t.setPin}</button>
            {ctrl?.hasPin && <button className="btn btn-ghost" style={{ padding: '4px 12px', fontSize: 12.5 }} onClick={() => setPinModal({ mode: 'set', has: true, clear: true })}>{t.removePin}</button>}
          </div>
        </div>
      </div>
      )}

      {/* Cupo de esclavas y masters */}
      <div className="card" style={{ marginBottom: 12 }}>
        {/* Esclavas */}
        <div className="row between" style={{ flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 13 }}>{t.slots}: <b>{links.length}</b> {t.used} {t.of} <b>{d.unlimitedSlaves ? '∞' : d.maxSlaves}</b>{!d.unlimitedSlaves && d.extraSlaves ? <span className="muted"> ({d.baseSlaves}+{d.extraSlaves} {t.extra})</span> : ''}</span>
          {!d.unlimitedSlaves && d.addon?.enabled && accs.length >= 2 && (
            <span className="row" style={{ gap: 8, alignItems: 'center' }}>
              <button className="btn btn-ghost" style={{ padding: '4px 11px', fontSize: 13 }} onClick={() => buyExtra(-1)} disabled={!d.extraSlaves}>−</button>
              <span style={{ minWidth: 16, textAlign: 'center' }}>{d.extraSlaves || 0}</span>
              <button className="btn btn-primary" style={{ padding: '5px 12px', fontSize: 12 }} onClick={() => buyExtra(1)}>+ {t.buyMore} <span style={{ opacity: .85 }}>${d.addon.price}{t.slaveMo}</span></button>
            </span>
          )}
        </div>
        {/* Masters */}
        <div className="row between" style={{ flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
          <span style={{ fontSize: 13 }}><span className="pill" style={{ fontSize: 9, color: C_MASTER, background: C_MASTER + '22', marginRight: 6 }}>{t.grpMaster}</span>{t.masters}: <b>{d.usedMasters || 0}</b> {t.used} {t.of} <b>{d.unlimitedMasters ? '∞' : d.maxMasters}</b>{!d.unlimitedMasters && d.extraMasters ? <span className="muted"> ({d.baseMasters}+{d.extraMasters} {t.extra})</span> : ''}</span>
          {!d.unlimitedMasters && d.masterAddon?.enabled && accs.length >= 2 && (
            <span className="row" style={{ gap: 8, alignItems: 'center' }}>
              <button className="btn btn-ghost" style={{ padding: '4px 11px', fontSize: 13 }} onClick={() => buyMaster(-1)} disabled={!d.extraMasters}>−</button>
              <span style={{ minWidth: 16, textAlign: 'center' }}>{d.extraMasters || 0}</span>
              <button className="btn btn-primary" style={{ padding: '5px 12px', fontSize: 12, background: C_MASTER }} onClick={() => buyMaster(1)}>+ {t.buyMaster} <span style={{ opacity: .85 }}>${d.masterAddon.price}{t.masterMo}</span></button>
            </span>
          )}
        </div>
        {((!d.unlimitedSlaves && d.addon?.enabled) || (!d.unlimitedMasters && d.masterAddon?.enabled)) && accs.length < 2 && (
          <div className="muted" style={{ fontSize: 11.5, marginTop: 8, color: 'var(--amber)' }}><OnyxIcon emoji="🔒" size={16} /> {t.addonNeed2}</div>
        )}
      </div>

      {accs.length < 2 && <div className="card" style={{ marginBottom: 12 }}><p className="muted" style={{ fontSize: 13, margin: 0 }}>{t.noAcc}</p></div>}

      {/* DESCARGAR LA EA (siempre visible) */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="row" style={{ gap: 8, alignItems: 'center' }}><span style={{ fontSize: 15 }}><OnyxIcon emoji="⬇" size={16} /></span><b style={{ fontSize: 14 }}>{t.dlTitle}</b></div>
        <p className="muted" style={{ fontSize: 12, marginTop: 2, marginBottom: 10 }}>{t.dlSub}</p>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 10 }}>
          <div style={{ border: `1px solid ${C_MASTER}44`, borderRadius: 10, padding: 12 }}>
            <span className="pill" style={{ fontSize: 9.5, color: C_MASTER, background: C_MASTER + '22' }}>{t.role_master}</span>
            <div className="muted" style={{ fontSize: 12, margin: '7px 0 9px' }}>{t.dlMasterDesc}</div>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              <a className="btn btn-ghost" style={{ fontSize: 12, padding: '5px 11px' }} href="/ea/OnyxCopyMaster.mq5" download><OnyxIcon emoji="⬇" size={16} /> MT5 (.mq5)</a>
              <a className="btn btn-ghost" style={{ fontSize: 12, padding: '5px 11px' }} href="/ea/OnyxCopyMaster.mq4" download><OnyxIcon emoji="⬇" size={16} /> MT4 (.mq4)</a>
              <a className="btn btn-ghost" style={{ fontSize: 12, padding: '5px 11px' }} href="/ctrader/OnyxCopyMaster.cs" download><OnyxIcon emoji="⬇" size={16} /> cTrader (.cs)</a>
            </div>
          </div>
          <div style={{ border: `1px solid ${C_SLAVE}44`, borderRadius: 10, padding: 12 }}>
            <span className="pill" style={{ fontSize: 9.5, color: C_SLAVE, background: C_SLAVE + '22' }}>{t.role_slave}</span>
            <div className="muted" style={{ fontSize: 12, margin: '7px 0 9px' }}>{t.dlSlaveDesc}</div>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              <a className="btn btn-ghost" style={{ fontSize: 12, padding: '5px 11px' }} href="/ea/OnyxCopySlave.mq5" download><OnyxIcon emoji="⬇" size={16} /> MT5 (.mq5)</a>
              <a className="btn btn-ghost" style={{ fontSize: 12, padding: '5px 11px' }} href="/ea/OnyxCopySlave.mq4" download><OnyxIcon emoji="⬇" size={16} /> MT4 (.mq4)</a>
              <a className="btn btn-ghost" style={{ fontSize: 12, padding: '5px 11px' }} href="/ctrader/OnyxCopySlave.cs" download><OnyxIcon emoji="⬇" size={16} /> cTrader (.cs)</a>
            </div>
          </div>
        </div>
        <p className="muted" style={{ fontSize: 11, marginTop: 9, marginBottom: 0 }}><OnyxIcon emoji="💡" size={16} /> {t.dlHint}</p>
      </div>

      {/* CLAVES COPY + INSTALAR */}
      {accs.length > 0 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <b style={{ fontSize: 14 }}>🔑 {t.keys}</b>
          <p className="muted" style={{ fontSize: 12, marginTop: 2, marginBottom: 8 }}>{t.keysSub}</p>
          {accs.map((a) => {
            const r = roleOf(a.id); const k = keyOf(a.login); const live = keyLive(k);
            return (
              <div key={a.id} className="row between" style={{ borderTop: '1px solid var(--line)', padding: '10px 0', gap: 10, flexWrap: 'wrap' }}>
                <span className="row" style={{ gap: 8, alignItems: 'center' }}>
                  {r && <span className="pill" style={{ fontSize: 9.5, color: roleColor(r), background: roleColor(r) + '22' }}>{roleLabel(r)}</span>}
                  <b style={{ fontSize: 13 }}>{a.nickname || a.login}</b>
                  {k
                    ? <span className="row" style={{ gap: 5, alignItems: 'center', fontSize: 11.5, color: live ? 'var(--green)' : 'var(--amber)' }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: live ? 'var(--green)' : 'var(--amber)' }} />{live ? t.liveOn : t.keyReady}</span>
                    : <span className="muted" style={{ fontSize: 11.5 }}>{t.noKey}</span>}
                </span>
                <div className="row" style={{ gap: 8 }}>
                  {k && <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => revokeKey(k.id)}>{t.revoke}</button>}
                  <button className="btn btn-primary" style={{ padding: '4px 12px', fontSize: 12 }} onClick={() => openWizard(a)}><OnyxIcon emoji="⬇" size={16} /> {t.install}</button>
                </div>
              </div>
            );
          })}
          {revealKey && (
            <div style={{ marginTop: 10, background: 'rgba(255,255,255,.03)', border: '1px dashed var(--line)', borderRadius: 8, padding: 10 }}>
              <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>{t.keyWarn}</div>
              <div className="row between" style={{ gap: 8, flexWrap: 'wrap' }}>
                <code style={{ fontSize: 12.5, wordBreak: 'break-all' }}>{revealKey}</code>
                <button className="btn btn-ghost" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => copyTx(revealKey, 'reveal')}>{copiedId === 'reveal' ? t.copied : t.copyKey}</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ENLACES */}
      <div className="card" style={{ marginBottom: 12 }}>
        <b style={{ fontSize: 14 }}>{t.links}</b>
        {!links.length && <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>—</p>}
        {/* Agrupados por cuenta Master */}
        {(() => {
          const order: string[] = [];
          const byMaster: Record<string, any[]> = {};
          links.forEach((l: any) => { if (!byMaster[l.master_account_id]) { byMaster[l.master_account_id] = []; order.push(l.master_account_id); } byMaster[l.master_account_id].push(l); });
          return order.map((mid, gi) => (
            <div key={mid} style={{ borderTop: gi ? '1px solid var(--line)' : '1px solid var(--line)', paddingTop: 11, marginTop: gi ? 6 : 10 }}>
              <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 4 }}>
                <span className="pill" style={{ fontSize: 9, color: C_MASTER, background: C_MASTER + '22' }}>{t.grpMaster}</span>
                <b style={{ fontSize: 13.5 }}>{label(mid)}</b>
                <span className="muted" style={{ fontSize: 11 }}>· {byMaster[mid].length}</span>
              </div>
              {byMaster[mid].map((l: any) => (
                <div key={l.id} className="row between" style={{ padding: '8px 0 8px 16px', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 13 }}>
                    <span className="muted" style={{ marginRight: 4 }}>↳</span>
                    <span className="pill" style={{ fontSize: 9, color: C_SLAVE, background: C_SLAVE + '22', marginRight: 4 }}>{t.role_slave}</span>
                    <b>{label(l.slave_account_id)}</b>
                    <div className="muted" style={{ fontSize: 11.5, marginTop: 2, marginLeft: 16 }}>{modeLabel(l.mode)}{l.reverse ? ' · ⇄' : ''} · máx {l.max_lot}
                      {l.daily_loss_pct ? ` · DL ${l.daily_loss_pct}%` : ''}{l.session_from && l.session_to ? ` · ${l.session_from}-${l.session_to}` : ''}{(l.symbol_whitelist || []).length ? ` · ${l.symbol_whitelist.length} símb.` : ''}</div>
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => save({ ...linkPayload(l), enabled: !l.enabled })}>
                      {l.enabled ? '⏸ ' + t.off : '▶ ' + t.on}
                    </button>
                    <span className="pill" style={l.enabled ? { color: 'var(--soft-green)', background: 'rgba(52,226,160,.15)' } : { color: 'var(--mut)' }}>{l.enabled ? t.on : t.off}</span>
                    <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setEdit({ ...blankLink(), ...l, symbol_whitelist: l.symbol_whitelist || [], session_from: l.session_from || '', session_to: l.session_to || '' })}>{t.edit}</button>
                    <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => del(l.id)}>{t.del}</button>
                  </div>
                </div>
              ))}
            </div>
          ));
        })()}
      </div>

      {/* Nuevo enlace */}
      {accs.length >= 2 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <b style={{ fontSize: 14 }}>{t.newLink}</b>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginTop: 10, alignItems: 'end' }}>
            <label className="muted" style={{ fontSize: 12 }}><span style={{ color: C_MASTER }}>● </span>{t.master}
              <select value={nl.master_account_id}
                onChange={(e) => { const v = e.target.value; if (v && v !== nl.master_account_id) setMasterPopup({ value: v, onConfirm: () => { setNl({ ...nl, master_account_id: v }); setMasterPopup(null); } }); else setNl({ ...nl, master_account_id: v }); }}
                style={{ marginTop: 3, borderColor: nl.master_account_id ? C_MASTER : undefined }}>
                <option value="">{t.pick}</option>{accs.map((a) => <option key={a.id} value={a.id}>{a.nickname || a.login}</option>)}
              </select>
            </label>
            <label className="muted" style={{ fontSize: 12 }}><span style={{ color: C_SLAVE }}>● </span>{t.slave}
              <select value={nl.slave_account_id} onChange={(e) => setNl({ ...nl, slave_account_id: e.target.value })} style={{ marginTop: 3, borderColor: nl.slave_account_id ? C_SLAVE : undefined }}>
                <option value="">{t.pick}</option>{accs.filter((a) => a.id !== nl.master_account_id && !slaveIds.has(a.id) && !masterIds.has(a.id)).map((a) => <option key={a.id} value={a.id}>{a.nickname || a.login}</option>)}
              </select>
            </label>
            <label className="muted" style={{ fontSize: 12 }}>{t.mode}
              <select value={nl.mode} onChange={(e) => setNl({ ...nl, mode: e.target.value })} style={{ marginTop: 3 }}>
                <option value="balance">{t.m_balance}</option><option value="risk">{t.m_risk}</option><option value="pips">{t.m_pips}</option><option value="fixed">{t.m_fixed}</option>
              </select>
            </label>
            {modeField(nl, (k, v) => setNl({ ...nl, [k]: v }))}
            <label className="muted" style={{ fontSize: 12 }}>{t.maxLot}<input type="number" step="0.01" value={nl.max_lot} onChange={(e) => setNl({ ...nl, max_lot: Number(e.target.value) })} style={{ marginTop: 3 }} /></label>
            <label className="muted row" style={{ fontSize: 12, gap: 8, alignItems: 'center', marginTop: 18 }}><input type="checkbox" checked={nl.reverse} onChange={(e) => setNl({ ...nl, reverse: e.target.checked })} style={{ width: 'auto', margin: 0 }} /> {t.reverse}</label>
          </div>
          <button className="btn btn-ghost" style={{ marginTop: 10, padding: '3px 10px', fontSize: 12 }} onClick={() => setShowRisk(!showRisk)}>{showRisk ? '▾ ' : '▸ '}{t.riskBlock}</button>
          {showRisk && riskFields(nl, (k, v) => setNl({ ...nl, [k]: v }))}
          <div><button className="btn btn-primary" style={{ marginTop: 12 }} disabled={busy || !nl.master_account_id || !nl.slave_account_id} onClick={() => save(nl)}>{t.add}</button></div>
        </div>
      )}

      {/* Log en vivo */}
      <div className="card">
        <b style={{ fontSize: 14 }}>{t.log}</b>
        {!log.length && <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>{t.noLog}</p>}
        {log.map((e, i) => {
          const c = e.kind === 'copied' ? 'var(--green)' : e.kind === 'skipped' ? 'var(--amber)' : 'var(--red)';
          const k = e.kind === 'copied' ? t.kcopied : e.kind === 'skipped' ? t.kskipped : t.kerror;
          return (
            <div key={i} className="row between" style={{ borderTop: '1px solid var(--line)', padding: '8px 0', fontSize: 12.5, gap: 8, flexWrap: 'wrap' }}>
              <span className="row" style={{ gap: 8 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: c }} /><b>{e.symbol || '—'}</b> <span style={{ color: c }}>{k}</span></span>
              <span className="muted">{e.latency_ms ? e.latency_ms + ' ms · ' : ''}{new Date(e.created_at).toLocaleTimeString()}</span>
            </div>
          );
        })}
      </div>

      {/* MODALES */}
      {masterPopup && (
        <Modal onClose={() => setMasterPopup(null)}>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6, color: C_MASTER }}>● {t.mpTitle}</div>
          <p className="muted" style={{ fontSize: 13, lineHeight: 1.6, margin: '0 0 10px' }}>{t.mpBody}</p>
          <div style={{ background: 'rgba(255,192,77,.08)', border: '1px solid var(--amber)', borderRadius: 8, padding: 10, fontSize: 12, color: 'var(--amber)', marginBottom: 14 }}><OnyxIcon emoji="⚠" size={16} /> {t.mpWarn}</div>
          <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => setMasterPopup(null)}>{t.mpNo}</button>
            <button className="btn btn-primary" onClick={masterPopup.onConfirm}>{t.mpOk}</button>
          </div>
        </Modal>
      )}

      {pinModal && (
        <PinModal t={t} mode={pinModal.mode} clear={pinModal.clear} hasPin={pinModal.has}
          onClose={() => setPinModal(null)}
          onResume={async (pin: string) => { const ok = await pinModal.run(pin); if (ok) setPinModal(null); return ok; }}
          onSetPin={async (payload: any) => {
            const r = await fetch('/api/copy/pin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
            const j = await r.json(); if (!r.ok) return j.error || 'Error'; loadControl(); setPinModal(null); return '';
          }} />
      )}

      {edit && (
        <Modal onClose={() => setEdit(null)} wide>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>{t.edit}: <b>{label(edit.master_account_id)}</b> → <b>{label(edit.slave_account_id)}</b></div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, alignItems: 'end' }}>
            <label className="muted" style={{ fontSize: 12 }}>{t.mode}
              <select value={edit.mode} onChange={(e) => setEdit({ ...edit, mode: e.target.value })} style={{ marginTop: 3 }}>
                <option value="balance">{t.m_balance}</option><option value="risk">{t.m_risk}</option><option value="pips">{t.m_pips}</option><option value="fixed">{t.m_fixed}</option>
              </select>
            </label>
            {modeField(edit, (k, v) => setEdit({ ...edit, [k]: v }))}
            <label className="muted" style={{ fontSize: 12 }}>{t.maxLot}<input type="number" step="0.01" value={edit.max_lot} onChange={(e) => setEdit({ ...edit, max_lot: Number(e.target.value) })} style={{ marginTop: 3 }} /></label>
            <label className="muted row" style={{ fontSize: 12, gap: 8, alignItems: 'center', marginTop: 18 }}><input type="checkbox" checked={edit.reverse} onChange={(e) => setEdit({ ...edit, reverse: e.target.checked })} style={{ width: 'auto', margin: 0 }} /> {t.reverse}</label>
          </div>
          <div style={{ marginTop: 10, borderTop: '1px solid var(--line)', paddingTop: 8 }}>
            <div className="muted" style={{ fontSize: 12, marginBottom: 2 }}>{t.riskBlock}</div>
            {riskFields(edit, (k, v) => setEdit({ ...edit, [k]: v }))}
          </div>
          <div className="row" style={{ gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
            <button className="btn btn-ghost" onClick={() => setEdit(null)}>{t.pinCancel}</button>
            <button className="btn btn-primary" disabled={busy} onClick={() => save(linkPayload(edit))}>{t.save}</button>
          </div>
        </Modal>
      )}

      {wizard && (
        <Modal onClose={() => setWizard(null)} wide>
          <WizardBody t={t} wizard={wizard} app={APP} live={keyLive(keyOf(wizard.account.login))}
            onCopy={(k: string) => copyTx(k, 'wiz')} copied={copiedId === 'wiz'} onCheck={loadKeys} />
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
            <button className="btn btn-ghost" onClick={() => setWizard(null)}>{t.wizClose}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function linkPayload(l: any) {
  return {
    id: l.id, master_account_id: l.master_account_id, slave_account_id: l.slave_account_id,
    mode: l.mode, multiplier: l.multiplier, risk_pct: l.risk_pct, pip_risk: l.pip_risk, max_lot: l.max_lot, reverse: l.reverse,
    enabled: l.enabled, daily_loss_pct: l.daily_loss_pct || 0, max_drawdown_pct: l.max_drawdown_pct || 0,
    max_spread: l.max_spread || 0, session_from: l.session_from || '', session_to: l.session_to || '',
    symbol_whitelist: l.symbol_whitelist || [],
  };
}

function Modal({ children, onClose, wide }: any) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ maxWidth: wide ? 560 : 420, width: '100%', maxHeight: '88vh', overflowY: 'auto' }}>{children}</div>
    </div>
  );
}

function PinModal({ t, mode, clear, hasPin, onClose, onResume, onSetPin }: any) {
  const [pin, setPin] = useState('');
  const [cur, setCur] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true); setErr('');
    try {
      if (mode === 'resume') { const ok = await onResume(pin); if (!ok) setErr('PIN'); }
      else {
        const payload: any = {};
        if (hasPin) payload.current = cur;
        if (clear) payload.clear = true; else payload.pin = pin;
        const e = await onSetPin(payload); if (e) setErr(e);
      }
    } finally { setBusy(false); }
  }

  return (
    <Modal onClose={onClose}>
      {mode === 'resume' ? (
        <>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>▶ {t.resumeAsk}</div>
          <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.6, margin: '0 0 12px' }}>{t.resumeBody}</p>
          <input autoFocus type="password" inputMode="numeric" placeholder="••••••" value={pin} onChange={(e) => setPin(e.target.value)}
            style={{ width: 140, letterSpacing: 6, textAlign: 'center', marginBottom: 10 }} />
        </>
      ) : (
        <>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}><OnyxIcon emoji="🔐" size={16} /> {clear ? t.removePin : (hasPin ? t.changePin : t.setPin)}</div>
          {hasPin && <label className="muted" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>{t.pinCur}<input type="password" inputMode="numeric" value={cur} onChange={(e) => setCur(e.target.value)} style={{ marginTop: 3 }} /></label>}
          {!clear && <label className="muted" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>{t.pinNew}<input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} style={{ marginTop: 3 }} /></label>}
        </>
      )}
      {err && <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 8 }}>{err === 'PIN' ? 'PIN incorrecto.' : err}</div>}
      <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost" onClick={onClose}>{t.pinCancel}</button>
        <button className="btn btn-primary" disabled={busy} onClick={submit}>{mode === 'resume' ? t.resume : t.pinSave}</button>
      </div>
    </Modal>
  );
}

function WizardBody({ t, wizard, app, live, onCopy, copied, onCheck }: any) {
  const [plat, setPlat] = useState<'mt5' | 'mt4' | 'ctrader'>('mt5');
  const [elapsed, setElapsed] = useState(0);
  const isMaster = wizard.role === 'master' || wizard.role === 'both';
  const isCt = plat === 'ctrader';
  const color = isMaster ? C_MASTER : C_SLAVE;
  const roleTx = isMaster ? t.role_master : t.role_slave;
  const ext = plat === 'mt5' ? 'mq5' : plat === 'mt4' ? 'mq4' : 'cs';
  const folder = plat === 'mt5' ? 'MQL5' : 'MQL4';
  const dlBase = isMaster ? 'OnyxCopyMaster' : 'OnyxCopySlave';
  const dlName = dlBase + '.' + ext;
  const dlHref = isCt ? `/ctrader/${dlName}` : `/ea/${dlName}`;
  const stuckList = isCt ? t.wzCtStuck : t.wzStuck;

  // Cuenta el tiempo esperando la señal → ayuda a los ~75 s si no conecta.
  useEffect(() => {
    if (live) return;
    const iv = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(iv);
  }, [live]);
  const stuck = !live && elapsed > 75;

  // Piezas visuales (mismo estilo que el asistente de Guardian).
  const chip: any = { display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--card2,rgba(255,255,255,.05))', border: '1px solid var(--line)', borderRadius: 8, padding: '4px 8px', fontSize: 11.5 };
  const box: any = { border: '1px solid var(--line)', borderRadius: 10, background: 'rgba(255,255,255,.02)', padding: 11, marginTop: 8 };
  const arrow = <span style={{ color: 'var(--mut)' }}>→</span>;
  const tick = <span style={{ width: 15, height: 15, borderRadius: 4, background: 'var(--green)', color: '#04120c', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, flex: 'none' }}>✓</span>;

  const platBtn = (p: 'mt5' | 'mt4' | 'ctrader', label: string) => (
    <button onClick={() => setPlat(p)} className="btn"
      style={{ flex: 1, fontSize: 13, padding: '9px 0', border: plat === p ? '2px solid var(--accent,#6c7bff)' : '1px solid var(--line)', background: plat === p ? 'rgba(108,123,255,.12)' : 'transparent', color: plat === p ? 'var(--soft-brand)' : 'var(--mut)' }}>{label}</button>
  );
  const copyRow = (val: string) => (
    <div className="row between" style={{ gap: 8, background: 'rgba(255,255,255,.03)', border: '1px solid var(--line)', borderRadius: 8, padding: '7px 10px', flexWrap: 'wrap', marginTop: 8 }}>
      <code style={{ fontSize: 12, wordBreak: 'break-all' }}>{val}</code>
      <button className="btn btn-ghost" style={{ padding: '2px 9px', fontSize: 11.5 }} onClick={() => onCopy(val)}>{copied ? t.copied : t.copyKey}</button>
    </div>
  );

  return (
    <div>
      <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 4 }}>
        <span className="pill" style={{ fontSize: 10, color, background: color + '22' }}>{roleTx}</span>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{t.wizTitle} {wizard.account.nickname || wizard.account.login}</div>
      </div>

      {/* Paso 1: plataforma */}
      <div className="muted" style={{ fontSize: 12, margin: '10px 0 6px' }}>1 · {t.wzPlatQ}</div>
      <div className="row" style={{ gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>{platBtn('mt5', t.wzMt5)}{platBtn('mt4', t.wzMt4)}{platBtn('ctrader', t.wzCt)}</div>

      {/* 2 · Descargar (el archivo depende de la plataforma) */}
      <Step n={2} title={t.wzS1t}>
        <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{t.wzS1d}</div>
        <a className="btn btn-primary" style={{ fontSize: 12.5, padding: '6px 13px' }} href={dlHref} download><OnyxIcon emoji="⬇" size={16} /> {isCt ? t.wzCtDl : t.wzDl} · {dlName}</a>
      </Step>

      {isCt ? (
        <>
          {/* 3 · Automate → New cBot */}
          <Step n={3} title={t.wzCtS2t}>
            <div className="muted" style={{ fontSize: 12 }}>{t.wzCtS2d}</div>
            <div style={box}>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={chip}>Automate</span>{arrow}<span style={chip}>＋ New cBot</span>{arrow}<span style={chip}>{dlBase}</span>
              </div>
            </div>
          </Step>

          {/* 4 · Pegar y Build */}
          <Step n={4} title={t.wzCtS3t}>
            <div className="muted" style={{ fontSize: 12 }}>{t.wzCtS3d}</div>
            <div style={box}>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
                <span style={chip}>{t.wzMenuFile ? '📄' : ''} .cs</span>{arrow}<span style={chip}>🔨 Build (F6)</span>
              </div>
              <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center', background: 'rgba(52,226,160,.10)', border: '1px solid var(--green)', borderRadius: 8, padding: '5px 9px' }}>
                {tick}<span style={{ fontSize: 11.5, color: 'var(--green)' }}>Build succeeded</span>
              </div>
            </div>
          </Step>

          {/* 5 · Gráfico + clave */}
          <Step n={5} title={t.wzCtS4t}>
            <div className="muted" style={{ fontSize: 12 }}>{t.wzCtS4d}</div>
            <div style={box}>
              <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, minWidth: 60, color: 'var(--green)', fontWeight: 600 }}>Copy API key</span>
                <span style={{ fontSize: 11, color: 'var(--green)' }}>{t.wzApiOnly}</span>
              </div>
              {wizard.key ? copyRow(wizard.key) : <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>—</div>}
              <div className="muted" style={{ fontSize: 11, marginTop: 8 }}><OnyxIcon emoji="ℹ" size={16} /> {t.wzSrvNote}</div>
            </div>
          </Step>

          {/* 6 · Acceso a red + Play */}
          <Step n={6} title={t.wzCtS5t}>
            <div className="muted" style={{ fontSize: 12 }}>{t.wzCtS5d}</div>
            <div style={box}>
              <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 8 }}>{tick}<span style={{ fontSize: 11.5 }}>{t.wzCt} · "Acceso completo" / "Full Access"</span></div>
              <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', background: 'rgba(52,226,160,.12)', color: 'var(--green)', borderRadius: 6, padding: '5px 9px', fontSize: 12 }}>▶ Play</span>
            </div>
          </Step>
        </>
      ) : (
        <>
          {/* 3 · Carpeta */}
          <Step n={3} title={t.wzS2t}>
            <div className="muted" style={{ fontSize: 12 }}>{t.wzS2d.replace('__F__', folder)}</div>
            <div style={box}>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={chip}>{t.wzMenuFile}</span>{arrow}<span style={chip}>{t.wzMenuData}</span>{arrow}<span style={chip}><OnyxIcon emoji="📁" size={16} /> {folder}</span>{arrow}<span style={chip}><OnyxIcon emoji="📁" size={16} /> Experts</span>
              </div>
            </div>
          </Step>

          {/* 4 · Compilar */}
          <Step n={4} title={t.wzCompT}>
            <div className="muted" style={{ fontSize: 12 }}>{t.wzCompD}</div>
            <div style={box}>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
                <span style={chip}>⌨️ F4</span>{arrow}<span style={chip}>MetaEditor</span>{arrow}<span style={chip}>▶️ {plat === 'mt5' ? 'Compilar' : 'Compile'} (F7)</span>
              </div>
              <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center', background: 'rgba(52,226,160,.10)', border: '1px solid var(--green)', borderRadius: 8, padding: '5px 9px' }}>
                {tick}<span style={{ fontSize: 11.5, color: 'var(--green)' }}>{t.wzOk0}</span>
              </div>
            </div>
          </Step>

          {/* 5 · Arrastrar al gráfico */}
          <Step n={5} title={t.wzS3t}>
            <div className="muted" style={{ fontSize: 12 }}>{t.wzS3d}</div>
            <div style={box}>
              <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: 130, border: '1px solid var(--line)', borderRadius: 8, padding: 8, background: 'var(--card2,rgba(255,255,255,.03))' }}>
                  <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>{t.wzNav}</div>
                  <div style={{ fontSize: 12 }}><OnyxIcon emoji="📁" size={16} /> {t.wzMenuEA}</div>
                  <div style={{ fontSize: 12, color, paddingLeft: 12 }}><OnyxIcon emoji="🤖" size={16} /> {dlBase}</div>
                </div>
                {arrow}
                <div style={{ flex: 1, minWidth: 130, border: '1px dashed var(--line)', borderRadius: 8, padding: 8, textAlign: 'center', color: 'var(--mut)', fontSize: 12 }}><OnyxIcon emoji="📈" size={16} /> {t.wzDropChart}</div>
              </div>
              <div className="row" style={{ gap: 8, alignItems: 'center', marginTop: 8 }}>{tick}<span style={{ fontSize: 11.5 }}>{t.wzAllowAlgo}</span></div>
            </div>
          </Step>

          {/* 6 · WebRequest */}
          <Step n={6} title={t.wzS4t}>
            <div style={box}>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
                <span style={chip}>{t.wzMenuTools}</span>{arrow}<span style={chip}>{t.wzMenuOpt}</span>{arrow}<span style={chip}>{t.wzMenuEA}</span>
              </div>
              <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>{tick}<span style={{ fontSize: 11.5 }}>{t.wzS4d}</span></div>
              {copyRow(app)}
            </div>
          </Step>

          {/* 7 · Clave Copy */}
          <Step n={7} title={t.wzS5t}>
            <div className="muted" style={{ fontSize: 12 }}>{t.wzS5d}</div>
            <div style={box}>
              <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, minWidth: 60, color: 'var(--green)', fontWeight: 600 }}>ApiKey</span>
                <span style={{ fontSize: 11, color: 'var(--green)' }}>{t.wzApiOnly}</span>
              </div>
              {wizard.key ? copyRow(wizard.key) : <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>—</div>}
              <div className="muted" style={{ fontSize: 11, marginTop: 8 }}><OnyxIcon emoji="ℹ" size={16} /> {t.wzSrvNote}</div>
            </div>
          </Step>

          {/* 8 · Algo Trading */}
          <Step n={8} title={t.wzAlgoT}>
            <div className="muted" style={{ fontSize: 12 }}>{t.wzAlgoD}</div>
            <div style={box}>
              <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', background: 'rgba(52,226,160,.12)', color: 'var(--green)', borderRadius: 6, padding: '5px 9px', fontSize: 12 }}>▶️ Algo Trading</span>
              <span style={{ fontSize: 12, marginLeft: 10 }}><span style={{ color: 'var(--green)' }}><OnyxIcon emoji="☺" size={16} /></span> = {plat === 'mt5' ? 'activo' : 'active'}</span>
            </div>
          </Step>
        </>
      )}

      {/* Confirmación en vivo */}
      <div style={{ marginTop: 12, borderRadius: 10, padding: 12, textAlign: 'center', background: live ? 'rgba(52,226,160,.1)' : 'rgba(255,192,77,.07)', border: `1px solid ${live ? 'var(--green)' : 'var(--amber)'}` }}>
        {live
          ? <span style={{ color: 'var(--green)', fontSize: 13.5, fontWeight: 600 }}>✓ {t.wizOk}</span>
          : <span style={{ color: 'var(--amber)', fontSize: 13 }}>◔ {t.wizWait} · {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}</span>}
      </div>

      {/* Ayuda cuando no llega nada */}
      {stuck && (
        <div style={{ marginTop: 12, padding: '13px 15px', background: 'rgba(245,158,11,.06)', border: '1px solid var(--amber)', borderRadius: 10 }}>
          <div style={{ color: 'var(--amber)', fontWeight: 600, marginBottom: 3, fontSize: 13.5 }}>{t.wzStuckT}</div>
          <div className="muted" style={{ fontSize: 12.5, marginBottom: 8 }}>{t.wzStuckD}</div>
          {stuckList.map((x: any, i: number) => (
            <div key={i} className="row" style={{ gap: 10, alignItems: 'flex-start', borderTop: '1px solid var(--line)', padding: '8px 0' }}>
              <span className="muted" style={{ fontSize: 12 }}>{i + 1}</span>
              <div><div style={{ fontSize: 12.5 }}>{x.t}</div><div className="muted" style={{ fontSize: 11.5 }}>{x.d}</div></div>
            </div>
          ))}
          <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 12, marginTop: 10 }} onClick={onCheck}>{t.wzRetry}</button>
        </div>
      )}
    </div>
  );
}

function HowStep({ n, title, body, extra, accs }: any) {
  const done = n === 1 && accs >= 2;
  return (
    <div className="row" style={{ gap: 10, alignItems: 'flex-start', marginBottom: 9 }}>
      <span style={{ flex: 'none', width: 22, height: 22, borderRadius: '50%', background: done ? 'var(--green)' : 'var(--accent,#6c7bff)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600 }}>{done ? '✓' : n}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{title}</div>
        <div className="muted" style={{ fontSize: 12, marginTop: 1, lineHeight: 1.5 }}>{body} {extra}</div>
      </div>
    </div>
  );
}

function Step({ n, title, children }: any) {
  return (
    <div className="row" style={{ gap: 10, alignItems: 'flex-start', marginBottom: 12 }}>
      <span style={{ flex: 'none', width: 24, height: 24, borderRadius: '50%', background: 'var(--accent,#6c7bff)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 600 }}>{n}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 3 }}>{title}</div>
        {children}
      </div>
    </div>
  );
}
