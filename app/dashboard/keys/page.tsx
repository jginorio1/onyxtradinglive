'use client';
import { dictFor } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import { fmtDate, fmtDateTime } from '@/lib/fmtDate';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/lang';
import Link from 'next/link';
import { ACC_TYPES } from '@/lib/accountMeta';
import { errMsg } from '@/lib/i18nErrors';
import InstallWizard, { WIZ } from './InstallWizard';
import QrPop from '@/app/components/QrPop';
import { useCatalog } from '@/lib/useCatalog';

type Lang = 'es' | 'en';

const K = {
  es: {
    nav_dash: 'Panel', nav_connect: 'Conectar cuenta', nav_plan: 'Plan', signout: 'Salir',
    h1: 'Conecta tu cuenta a Onyx',
    intro: 'Elige tu plataforma y sigue el paso a paso. El conector ya trae tu servidor configurado: solo pegas tu clave.',
    step2: 'Elige tu archivo',
    dlNote: 'Los dos hacen lo mismo. Solo cambia la plataforma para la que están escritos.',
    eaMt5: 'Onyx EA · MT5', eaMt4: 'Onyx EA · MT4',
    recommended: 'Más usado', newBadge: 'Nuevo',
    mt5Does: ['Registra tus operaciones en el diario', 'Break even, trailing y cierres parciales', 'Tu plan de trading, límites y noticias'],
    mt4Does: ['Registra tus operaciones en el diario', 'Break even, trailing y cierres parciales', 'Tu plan de trading, límites y noticias'],
    mt4Note: 'En MT4, al cerrar parte de una operación el resto cambia de número. Está resuelto, pero avísanos si ves algo raro.',
    oldT: 'Necesito el conector antiguo (solo diario)',
    oldD: 'Solo envía operaciones al diario, sin gestionar nada. Únicamente si el EA nuevo te da problemas.',
    dlMt5: 'Descargar para MT5', dlMt4: 'Descargar para MT4',
    step3: 'Instálalo paso a paso',
    stepsD: 'Los pasos se van marcando solos según avanzas.',
    folderPath: 'MQL5/Experts  (o MQL4/Experts en MT4)',
    allDone: 'Listo. Tu MetaTrader está reportando a Onyx.',
    steps: [
      { t: '1. Descarga el archivo Onyx', d: 'Usa el botón de arriba: MT5 si tu plataforma es MetaTrader 5, MT4 si es MetaTrader 4. Se guarda en tu carpeta de Descargas.', viz: 'download' },
      { t: '2. Mételo en la carpeta Experts', d: 'Abre MetaTrader. Arriba: Archivo → Abrir carpeta de datos. Entra a MQL5 y luego a Experts, y pega ahí el archivo que descargaste.', copy: 'folder', viz: 'folder' },
      { t: '3. Compílalo (MetaEditor ya viene incluido)', d: 'No lo descargas aparte. Dentro de MetaTrader pulsa la tecla F4: se abre MetaEditor. Abre el archivo Onyx y pulsa Compilar (F7). Abajo debe decir "0 errores".', viz: 'compile' },
      { t: '4. Arrastra Onyx a un gráfico', d: 'En el panel Navegador (a la izquierda), abre Asesores Expertos, y arrastra Onyx Connect sobre cualquier gráfico abierto. Con un solo gráfico basta.', viz: 'drag' },
      { t: '5. Marca la casilla y pega tu clave', d: 'Al soltarlo se abre una ventana. Marca "Permitir Algo Trading" y, en la pestaña de parámetros, pega tu ApiKey. La dirección del servidor ya viene puesta: no la toques. Luego OK.', copy: 'url', viz: 'fields' },
      { t: '6. Autoriza la dirección web', d: 'Arriba: Herramientas → Opciones → Asesores Expertos. Marca "Permitir WebRequest" y añade la dirección de abajo (escríbela y pulsa Enter). Sin esto, Onyx no puede hablar con tu cuenta.', copy: 'domain', viz: 'webrequest' },
      { t: '7. Enciende Algo Trading', d: 'Pulsa el botón Algo Trading de la barra de arriba: se pone verde. En la esquina del gráfico debe salir una carita sonriente. En unos segundos aquí abajo dirá "Conectado".', viz: 'algo' },
    ],
    // --- Selector de plataforma ---
    platT: 'Elige tu plataforma', platD: 'Selecciona dónde operas. El paso a paso cambia según la plataforma.',
    platforms: [
      { key: 'mt5', name: 'MetaTrader 5', badge: 'Más usado', kind: 'mt' },
      { key: 'mt4', name: 'MetaTrader 4', badge: 'Nuevo', kind: 'mt' },
      { key: 'ctrader', name: 'cTrader', badge: 'cBot', kind: 'ctrader' },
      { key: 'matchtrader', name: 'MatchTrader', badge: 'Pronto', kind: 'soon' },
    ],
    dlCardT: 'Descarga el conector',
    ctDoes: ['Sincroniza tus operaciones al diario', 'Break even, trailing y cierres parciales', 'Tu plan, límites y bloqueo fuera de plan'],
    mtNoteMt4: 'En MT4, al cerrar parte de una operación el resto cambia de número. Está resuelto, pero avísanos si ves algo raro.',
    ctFileName: 'OnyxConnect.cs · cBot de cTrader',
    ctGuide: 'Ver guía completa de cTrader',
    soonT: 'MatchTrader llega pronto', soonD: 'La conexión de MatchTrader depende de la API de tu bróker. Estamos habilitándola. Mientras tanto, si tu bróker también ofrece MT5, MT4 o cTrader, usa esa.',
    stepsCt: [
      { t: '1. Descarga el cBot Onyx (.cs)', d: 'Usa el botón de arriba. Se guarda en tu carpeta de Descargas. Es un archivo de texto con el código del cBot.', viz: 'ct-download' },
      { t: '2. Abre cTrader → Automate → New cBot', d: 'En cTrader Desktop, arriba, entra en Automate. Pulsa New cBot y ponle un nombre (ej: OnyxConnect). Se abre el editor de código.', viz: 'ct-new' },
      { t: '3. Pega el código y pulsa Build', d: 'Borra el código de ejemplo, abre el .cs que descargaste, copia todo y pégalo. Pulsa Build (o F6). Abajo debe decir "Build succeeded".', viz: 'ct-build' },
      { t: '4. Añádelo a un gráfico y pega tu clave', d: 'Abre cualquier gráfico. En los parámetros del cBot pega tu API key. El Server URL ya viene puesto: no lo toques.', copy: 'url', viz: 'ct-fields' },
      { t: '5. Acepta el acceso a red y pulsa Play', d: 'La primera vez cTrader pide permiso de "Acceso completo" (para hablar con Onyx): acéptalo. Pulsa Play ▶. En unos segundos aquí abajo dirá "Conectado".', viz: 'ct-run' },
    ],
    stuckCt: [
      { t: 'El cBot no está en Play (▶)', d: 'Es lo que falla casi siempre. Debe estar corriendo, no parado.' },
      { t: 'No aceptaste el "Acceso completo" (red)', d: 'Sin permiso de red, el cBot no puede hablar con Onyx. Reinícialo y acepta.' },
      { t: 'El Build no terminó bien', d: 'Abajo debe decir "Build succeeded". Si hay errores, mándanoslos.' },
      { t: 'La clave se pegó mal', d: 'Vuelve a los parámetros del cBot y pega la API key otra vez.' },
    ],
    stuckMt: [
      { t: 'El botón AlgoTrading no está verde', d: 'Es lo que falla el 80% de las veces.' },
      { t: 'Falta autorizar la URL', d: 'Herramientas → Opciones → Asesores Expertos → "Permitir WebRequest".' },
      { t: 'En el gráfico no sale la carita sonriente', d: 'Si hay una cruz, el EA no está activo en ese gráfico.' },
      { t: 'La clave se pegó mal', d: 'Vuelve al paso de los campos y cópiala otra vez.' },
    ],
    connMt: { waitD: 'Enciende AlgoTrading (el botón verde de arriba). Suele tardar menos de un minuto.', staleHint: 'Abre MetaTrader, pon el EA en un gráfico y activa AlgoTrading para que vuelva a sincronizar.' },
    connCt: { waitD: 'Pon el cBot en Play ▶ y acepta el permiso de red. Suele tardar unos segundos.', staleHint: 'Abre cTrader, añade el cBot a un gráfico y pulsa Play ▶ para que vuelva a sincronizar.' },
    step1: '1 · Conecta una cuenta', newKey: '+ Crear clave para esta cuenta', created: '✅ Clave creada. Cópiala y pégala en el connector:',
    slots: 'Cuentas conectadas', of: 'de', unlimited: 'ilimitadas', unlimitedTxt: 'Tu plan permite cuentas ilimitadas.',
    left: 'Te quedan', left2: 'cuenta(s) por conectar.', full: 'Has llegado al límite de tu plan.',
    formHint: 'Cada clave pertenece a una sola cuenta. Si dejas el número vacío, se atará sola en la primera sincronización.',
    fNick: 'Apodo', fType: 'Tipo de cuenta', fFirm: 'Prop firm o bróker', fLogin: 'Número de cuenta', fLoginPh: 'opcional', fSize: 'Tamaño de la cuenta',
    fFirmHint: '¿No está en la lista? Escríbelo tal cual, se guarda igual.',
    fNickHint: 'Para reconocerla de un vistazo. Ej: FTMO 100K fase 1',
    fSizeHint: 'El capital de la cuenta, sin puntos. Ej: 100000',
    missT: 'Falta por rellenar:', missNick: 'el apodo', missFirm: 'la prop firm o bróker', missSize: 'el tamaño de la cuenta',
    limitT: 'Llegaste al límite de tu plan', limitD: 'Revoca una clave para liberar un cupo, o mejora tu plan para conectar más cuentas.', limitCta: 'Ver planes →',
    addBuy: 'Añadir 1 cuenta extra', addMo: '/mes', addOr: 'o', addManage: 'Gestionar en Mi cuenta →',
    waiting: 'esperando sync', acct: 'Cuenta', notBound: 'Sin atar todavía', lastSync: 'sync',
    copy: 'Copiar', copied: '✓ Copiado',
    apiKeyHint: 'tu clave de arriba (o una de la lista de abajo)',
    yourKeys: 'Tus API keys', active: 'activa', revoked: 'revocada', revoke: 'Revocar', noKeys: 'Aún no tienes API keys. Genera una arriba.',
    errKey: 'No se pudo crear la key: ', errNet: 'Error de red: ', confirmRevoke: '¿Revocar esta API key? La cuenta que la use dejará de sincronizar.',
  },
  en: {
    nav_dash: 'Dashboard', nav_connect: 'Connect account', nav_plan: 'Plan', signout: 'Sign out',
    h1: 'Connect your account to Onyx',
    intro: 'Choose your platform and follow the step-by-step. The connector already has your server set: you only paste your key.',
    step2: 'Pick your file',
    dlNote: 'Both do the same. Only the platform they are written for changes.',
    eaMt5: 'Onyx EA · MT5', eaMt4: 'Onyx EA · MT4',
    recommended: 'Most used', newBadge: 'New',
    mt5Does: ['Logs your trades to the journal', 'Break even, trailing and partial closes', 'Your trading plan, limits and news'],
    mt4Does: ['Logs your trades to the journal', 'Break even, trailing and partial closes', 'Your trading plan, limits and news'],
    mt4Note: 'On MT4, closing part of a trade changes the ticket of the rest. It is handled, but tell us if you see anything odd.',
    oldT: 'I need the old connector (journal only)',
    oldD: 'It only sends trades to the journal, it manages nothing. Use it only if the new EA gives you trouble.',
    dlMt5: 'Download for MT5', dlMt4: 'Download for MT4',
    step3: 'Install it step by step',
    stepsD: 'Steps tick themselves off as you go.',
    folderPath: 'MQL5/Experts  (or MQL4/Experts on MT4)',
    allDone: 'Done. Your MetaTrader is reporting to Onyx.',
    steps: [
      { t: '1. Download the Onyx file', d: 'Use the button above: MT5 if your platform is MetaTrader 5, MT4 if it is MetaTrader 4. It saves to your Downloads folder.', viz: 'download' },
      { t: '2. Put it in the Experts folder', d: 'Open MetaTrader. Top menu: File → Open Data Folder. Go into MQL5, then Experts, and paste the file you downloaded there.', copy: 'folder', viz: 'folder' },
      { t: '3. Compile it (MetaEditor is built in)', d: 'You do not download it separately. Inside MetaTrader press F4: MetaEditor opens. Open the Onyx file and click Compile (F7). It should say "0 errors".', viz: 'compile' },
      { t: '4. Drag Onyx onto a chart', d: 'In the Navigator panel (left side), open Expert Advisors and drag Onyx Connect onto any open chart. One chart is enough.', viz: 'drag' },
      { t: '5. Tick the box and paste your key', d: 'A window opens. Tick "Allow Algo Trading" and, in the inputs tab, paste your ApiKey. The server address is already set: do not change it. Then OK.', copy: 'url', viz: 'fields' },
      { t: '6. Authorize the web address', d: 'Top menu: Tools → Options → Expert Advisors. Tick "Allow WebRequest" and add the address below (type it and press Enter). Without this, Onyx cannot talk to your account.', copy: 'domain', viz: 'webrequest' },
      { t: '7. Turn on Algo Trading', d: 'Press the Algo Trading button in the top bar: it turns green. A smiley face should appear in the chart corner. In a few seconds it will say "Connected" below.', viz: 'algo' },
    ],
    // --- Platform selector ---
    platT: 'Choose your platform', platD: 'Pick where you trade. The step-by-step changes per platform.',
    platforms: [
      { key: 'mt5', name: 'MetaTrader 5', badge: 'Most used', kind: 'mt' },
      { key: 'mt4', name: 'MetaTrader 4', badge: 'New', kind: 'mt' },
      { key: 'ctrader', name: 'cTrader', badge: 'cBot', kind: 'ctrader' },
      { key: 'matchtrader', name: 'MatchTrader', badge: 'Soon', kind: 'soon' },
    ],
    dlCardT: 'Download the connector',
    ctDoes: ['Syncs your trades to the journal', 'Break even, trailing and partial closes', 'Your plan, limits and out-of-plan block'],
    mtNoteMt4: 'On MT4, closing part of a trade changes the ticket of the rest. It is handled, but tell us if you see anything odd.',
    ctFileName: 'OnyxConnect.cs · cTrader cBot',
    ctGuide: 'See full cTrader guide',
    soonT: 'MatchTrader is coming soon', soonD: 'MatchTrader connection depends on your broker API. We are enabling it. Meanwhile, if your broker also offers MT5, MT4 or cTrader, use that.',
    stepsCt: [
      { t: '1. Download the Onyx cBot (.cs)', d: 'Use the button above. It saves to your Downloads folder. It is a text file with the cBot code.', viz: 'ct-download' },
      { t: '2. Open cTrader → Automate → New cBot', d: 'In cTrader Desktop, go to Automate. Click New cBot and name it (e.g. OnyxConnect). The code editor opens.', viz: 'ct-new' },
      { t: '3. Paste the code and press Build', d: 'Delete the sample code, open the .cs you downloaded, copy all and paste it. Press Build (or F6). It should say "Build succeeded".', viz: 'ct-build' },
      { t: '4. Add it to a chart and paste your key', d: 'Open any chart. In the cBot parameters paste your API key. The Server URL is already set: do not touch it.', copy: 'url', viz: 'ct-fields' },
      { t: '5. Accept network access and press Play', d: 'The first time cTrader asks for "Full Access" (to talk to Onyx): accept it. Press Play ▶. In a few seconds it will say "Connected" below.', viz: 'ct-run' },
    ],
    stuckCt: [
      { t: 'The cBot is not on Play (▶)', d: 'This is what fails most. It must be running, not stopped.' },
      { t: 'You did not accept "Full Access" (network)', d: 'Without network permission, the cBot cannot talk to Onyx. Restart it and accept.' },
      { t: 'The Build did not finish OK', d: 'It should say "Build succeeded". If there are errors, send them to us.' },
      { t: 'The key was pasted wrong', d: 'Go back to the cBot parameters and paste the API key again.' },
    ],
    connMt: { waitD: 'Turn on AlgoTrading (the green button at the top). It usually takes under a minute.', staleHint: 'Open MetaTrader, put the EA on a chart and turn on AlgoTrading so it syncs again.' },
    connCt: { waitD: 'Put the cBot on Play ▶ and accept the network prompt. It usually takes a few seconds.', staleHint: 'Open cTrader, add the cBot to a chart and press Play ▶ so it syncs again.' },
    step1: '1 · Connect an account', newKey: '+ Create key for this account', created: '✅ Key created. Copy it and paste it into the connector:',
    slots: 'Connected accounts', of: 'of', unlimited: 'unlimited', unlimitedTxt: 'Your plan allows unlimited accounts.',
    left: 'You have', left2: 'account(s) left to connect.', full: 'You reached your plan limit.',
    formHint: 'Each key belongs to a single account. Leave the number empty and it will bind itself on the first sync.',
    fNick: 'Nickname', fType: 'Account type', fFirm: 'Prop firm or broker', fLogin: 'Account number', fLoginPh: 'optional', fSize: 'Account size',
    fFirmHint: 'Not in the list? Just type it, it will be saved.',
    fNickHint: 'So you recognise it at a glance. Eg: FTMO 100K phase 1',
    fSizeHint: 'Account capital, no dots. Eg: 100000',
    missT: 'Still missing:', missNick: 'the nickname', missFirm: 'the prop firm or broker', missSize: 'the account size',
    limitT: 'You reached your plan limit', limitD: 'Revoke a key to free a slot, or upgrade your plan to connect more accounts.', limitCta: 'See plans →',
    addBuy: 'Add 1 extra account', addMo: '/mo', addOr: 'or', addManage: 'Manage in My account →',
    waiting: 'waiting for sync', acct: 'Account', notBound: 'Not bound yet', lastSync: 'sync',
    copy: 'Copy', copied: '✓ Copied',
    apiKeyHint: 'your key from above (or one from the list below)',
    yourKeys: 'Your API keys', active: 'active', revoked: 'revoked', revoke: 'Revoke', noKeys: 'You have no API keys yet. Generate one above.',
    errKey: 'Could not create the key: ', errNet: 'Network error: ', confirmRevoke: 'Revoke this API key? The account using it will stop syncing.',
  },
};

const FIRMS = [
  // Prop firms
  'FTMO', 'The5ers', 'FundingPips', 'FundedNext', 'Alpha Capital', 'MyFundedFX', 'E8 Markets',
  'Funded Trading Plus', 'Blue Guardian', 'Goat Funded Trader', 'Maven', 'Apex Trader Funding',
  // Brokers
  'OANDA', 'Axi', 'IC Markets', 'Pepperstone', 'Exness', 'XM', 'FxPro', 'Vantage', 'Tickmill',
  'Admiral Markets', 'Darwinex', 'RoboForex', 'Eightcap', 'ThinkMarkets',
];
const lbl = { fontSize: 12, color: 'var(--mut)', display: 'block' } as any;

// Fila de "copiar al portapapeles" que se repite en varios pasos
function CopyRow({ label, value, tag, copy, copied, t }: any) {
  return (
    <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
      {label && <span className="muted" style={{ fontSize: 12, width: 92, flex: 'none' }}>{label}</span>}
      <code style={{ flex: 1, minWidth: 160, wordBreak: 'break-all' }}>{value || '...'}</code>
      <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 12 }}
        onClick={() => copy(value, tag)}>{copied === tag ? t.copied : t.copy}</button>
    </div>
  );
}

export default function KeysPage() {
  const [keys, setKeys] = useState<any[]>([]);
  const [usage, setUsage] = useState<any>(null);
  const [addon, setAddon] = useState<any>(null);
  const [f, setF] = useState<any>({ label: '', acc_type: 'own', broker: '', account_login: '', acc_size: '' });
  const [newKey, setNewKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState('');
  const [origin, setOrigin] = useState('');
  const { lang, setLang } = useLang();
  const t = dictFor(K, lang);
  const firmItems = useCatalog('firm'); // prop firms / brokers del catálogo del admin
  const atLimit = !!usage && !usage.unlimited && usage.used >= usage.max;

  // Campos obligatorios: sin ellos no dejamos crear la clave
  const missing: string[] = [];
  if (!String(f.label || '').trim()) missing.push(t.missNick);
  if (!String(f.broker || '').trim()) missing.push(t.missFirm);
  if ((f.acc_type === 'challenge' || f.acc_type === 'funded') && !String(f.acc_size || '').trim()) missing.push(t.missSize);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  const apiUrl = origin + '/api/v1/sync';

  // ---- Estado de los pasos de instalación ----
  // No adivinamos: solo marcamos lo que podemos comprobar de verdad.
  //   · la descarga, porque la pulsó aquí (se recuerda en el navegador)
  //   · el resto, cuando el EA sincroniza — eso demuestra que todo lo anterior salió bien
  const [downloaded, setDownloaded] = useState(false);
  const [addingKey, setAddingKey] = useState(false);   // fase 1: mostrar el formulario aunque ya haya clave
  useEffect(() => {
    try { setDownloaded(localStorage.getItem('onyx_ea_dl') === '1'); } catch {}
  }, []);
  function markDone(what: string) {
    if (what === 'dl') { setDownloaded(true); try { localStorage.setItem('onyx_ea_dl', '1'); } catch {} }
  }

  // ---- Plataforma elegida (persistida) ----
  const [plat, setPlat] = useState('mt5');
  useEffect(() => { try {
    const q = new URLSearchParams(window.location.search).get('platform');
    if (q) { setPlat(q); localStorage.setItem('onyx_plat', q); return; }
    const p = localStorage.getItem('onyx_plat'); if (p) setPlat(p);
  } catch {} }, []);
  function pickPlat(k: string) { setPlat(k); try { localStorage.setItem('onyx_plat', k); } catch {} }
  const activePlat = (t.platforms || []).find((p: any) => p.key === plat) || t.platforms[0];
  const kind = activePlat.kind; // 'mt' | 'ctrader' | 'soon'

  // Datos que dependen de la plataforma para pasar al asistente
  const platData = (() => {
    if (kind === 'ctrader') {
      return {
        steps: t.stepsCt, stuck: t.stuckCt,
        dl: [{ href: '/ctrader/OnyxConnect.cs', label: 'cTrader (.cs)', primary: true }],
        conn: { name: 'cTrader', waitD: t.connCt.waitD, staleHint: t.connCt.staleHint },
        does: t.ctDoes, fileName: t.ctFileName, note: '',
      };
    }
    // MetaTrader (mt5 / mt4)
    const isMt4 = plat === 'mt4';
    return {
      steps: t.steps, stuck: t.stuckMt,
      dl: [{ href: isMt4 ? '/OnyxConnect_MT4.mq4' : '/OnyxConnect_MT5.mq5', label: isMt4 ? t.dlMt4 : t.dlMt5, primary: true }],
      conn: { name: activePlat.name, waitD: t.connMt.waitD, staleHint: t.connMt.staleHint },
      does: t.mt5Does, fileName: isMt4 ? 'OnyxConnect_MT4.mq4 · v2.00' : 'OnyxConnect_MT5.mq5 · v2.00',
      note: isMt4 ? t.mtNoteMt4 : '',
    };
  })();



  async function load() {
    const r = await fetch('/api/keys');
    const j = await r.json();
    setKeys(j.keys || []);
    setUsage(j.usage || null);
    setAddon(j.addon || null);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    setLoading(true); setNewKey('');
    try {
      const body = { ...f, label: (f.label || '').trim() || (f.broker ? f.broker : 'Mi cuenta') };
      const r = await fetch('/api/keys', { method: 'POST', body: JSON.stringify(body) });
      const j = await r.json();
      if (j.key) { setNewKey(j.key); setAddingKey(false); setF({ label: '', acc_type: 'own', broker: '', account_login: '', acc_size: '' }); }
      else toast(errMsg(j, lang));
    } catch { toast(errMsg({ code: 'network' }, lang)); }
    await load(); setLoading(false);
  }
  async function revoke(id: string) {
    if (!confirm(t.confirmRevoke)) return;
    await fetch('/api/keys', { method: 'PATCH', body: JSON.stringify({ id }) });
    await load();
  }
  function copy(text: string, tag: string) {
    navigator.clipboard.writeText(text);
    setCopied(tag); setTimeout(() => setCopied(''), 1500);
  }

  const hasKey = keys.length > 0;
  // Una fase del recorrido: hecho (verde) · actual (resaltada) · pendiente (gris)
  const Phase = ({ n, done, active, label }: any) => (
    <div className="row" style={{ gap: 8, alignItems: 'center' }}>
      <span style={{
        width: 26, height: 26, borderRadius: '50%', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700,
        background: done ? 'var(--green)' : active ? 'var(--grad)' : 'var(--card2)', color: done || active ? '#fff' : 'var(--mut)',
      }}>{done ? '✓' : n}</span>
      <span style={{ fontSize: 13, fontWeight: active ? 700 : 500, color: done ? 'var(--green)' : active ? 'var(--tx)' : 'var(--mut)' }}>{label}</span>
    </div>
  );

  return (
    <>

      <div className="wrap" style={{ padding: '28px 26px', maxWidth: 1180, fontSize: 15 }}>
        <div className="row between" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <h1>{t.h1}</h1>
          {typeof window !== 'undefined' && <QrPop data={window.location.origin + '/dashboard/keys'} label={lang === 'es' ? 'Abrir en el móvil' : 'Open on phone'} />}
        </div>
        <p className="muted" style={{ margin: '8px 0 22px' }}>{t.intro}</p>

        {/* Medidor de cupos del plan */}
        {usage && (
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="row between" style={{ flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
              <h3>{t.slots}</h3>
              <span className="muted" style={{ fontSize: 13 }}>{usage.used} {t.of} {usage.unlimited ? t.unlimited : usage.max} · {lang === 'en' ? (usage.planNameEn || usage.planName) : usage.planName}</span>
            </div>
            <div style={{ height: 6, background: 'var(--bg2)', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ width: (usage.unlimited ? 8 : Math.min(100, Math.round((usage.used / Math.max(usage.max, 1)) * 100))) + '%', height: '100%', background: atLimit ? 'var(--red)' : usage.used / Math.max(usage.max, 1) >= .75 ? 'var(--amber)' : 'var(--green)', transition: '.3s' }} />
            </div>
            <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>
              {usage.unlimited ? t.unlimitedTxt : atLimit ? t.full : `${t.left} ${usage.max - usage.used} ${t.left2}`}
            </div>
          </div>
        )}

        {/* Recorrido en 3 fases */}
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="row" style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Phase n={1} done={hasKey} active={!hasKey} label={lang === 'en' ? 'Create your key' : 'Crea tu clave'} />
            <div style={{ flex: 1, height: 2, minWidth: 16, background: hasKey ? 'var(--green)' : 'var(--line)' }} />
            <Phase n={2} done={false} active={hasKey} label={lang === 'en' ? 'Install the connector' : 'Instala el conector'} />
            <div style={{ flex: 1, height: 2, minWidth: 16, background: 'var(--line)' }} />
            <Phase n={3} done={false} active={false} label={lang === 'en' ? 'Connect' : 'Conecta'} />
          </div>
        </div>

        {/* Fase 1: crear la clave — colapsa a fila verde cuando ya existe */}
        {(hasKey && !addingKey) ? (
          <div className="card" style={{ marginBottom: 18, border: '1px solid var(--green)' }}>
            <div className="row between" style={{ flexWrap: 'wrap', gap: 10 }}>
              <div className="row" style={{ gap: 10, alignItems: 'center' }}>
                <span style={{ width: 28, height: 28, borderRadius: '50%', flex: 'none', background: 'rgba(52,226,160,.14)', color: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>✓</span>
                <div>
                  <div style={{ fontWeight: 700 }}>{newKey ? (lang === 'en' ? 'Step 1 · key created' : 'Paso 1 · clave creada') : (lang === 'en' ? 'Step 1 · your key is ready' : 'Paso 1 · tu clave está lista')}</div>
                  <div className="muted" style={{ fontSize: 13 }}>{keys[0]?.label || keys[0]?.broker || (lang === 'en' ? 'Key created' : 'Clave creada')}</div>
                </div>
              </div>
              <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => { setAddingKey(true); setNewKey(''); }}>{lang === 'en' ? 'Add another' : 'Crear otra'}</button>
            </div>
            {newKey && (
              <div style={{ marginTop: 14, background: 'var(--bg2)', border: '1px solid var(--green)', borderRadius: 10, padding: 14 }}>
                <p className="muted" style={{ fontSize: 13, marginBottom: 8 }}>{t.created}</p>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <code style={{ flex: 1, minWidth: 200, wordBreak: 'break-all', padding: '8px 10px' }}>{newKey}</code>
                  <button className="btn btn-ghost" onClick={() => copy(newKey, 'new')}>{copied === 'new' ? t.copied : t.copy}</button>
                </div>
              </div>
            )}
          </div>
        ) : (
        <div className="card" style={{ marginBottom: 18 }}>
          <h3 style={{ marginBottom: 4 }}>{t.step1}</h3>
          <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>{t.formHint}</p>

          {atLimit ? (
            <div style={{ background: 'rgba(124,140,255,.10)', border: '1px solid var(--brand)', borderRadius: 10, padding: 14 }}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>🔒 {t.limitT}</div>
              <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>{t.limitD}</p>
              {addon?.enabled ? (
                <div className="row" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Link className="btn btn-primary" href="/account">➕ {t.addBuy} · ${addon.price}{t.addMo}</Link>
                  <span className="muted" style={{ fontSize: 12.5 }}>{t.addOr}</span>
                  <Link className="btn btn-ghost" href="/pricing">{t.limitCta}</Link>
                </div>
              ) : (
                <Link className="btn btn-primary" href="/pricing">{t.limitCta}</Link>
              )}
            </div>
          ) : (
            <>
              <div className="grid g2" style={{ gap: 12 }}>
                <div>
                  <span style={lbl}>{t.fNick}</span>
                  <input value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder="Ej: FTMO 100K" style={{ margin: '4px 0 0' }} />
                  <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{t.fNickHint}</div>
                </div>
                <div>
                  <span style={lbl}>{t.fType}</span>
                  <select value={f.acc_type} onChange={(e) => setF({ ...f, acc_type: e.target.value })} style={{ margin: '4px 0 0' }}>
                    {ACC_TYPES.map((x) => <option key={x.key} value={x.key}>{lang === 'en' ? x.en : x.es}</option>)}
                  </select>
                </div>
                <div>
                  <span style={lbl}>{t.fFirm}</span>
                  <input list="onyx-firms" value={f.broker} onChange={(e) => setF({ ...f, broker: e.target.value })} placeholder="Ej: FTMO" style={{ margin: '4px 0 0' }} />
                  <datalist id="onyx-firms">{firmItems.map((x) => <option key={x.code} value={lang === 'en' ? (x.en || x.es) : x.es} />)}</datalist>
                  <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{t.fFirmHint}</div>
                </div>
                <div>
                  <span style={lbl}>{t.fLogin}</span>
                  <input value={f.account_login} onChange={(e) => setF({ ...f, account_login: e.target.value })} placeholder={t.fLoginPh} style={{ margin: '4px 0 0' }} />
                </div>
                {(f.acc_type === 'challenge' || f.acc_type === 'funded') && (
                  <div>
                    <span style={lbl}>{t.fSize}</span>
                    <input value={f.acc_size} onChange={(e) => setF({ ...f, acc_size: e.target.value })} placeholder="Ej: 100000" style={{ margin: '4px 0 0' }} />
                    <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{t.fSizeHint}</div>
                  </div>
                )}
              </div>
              {missing.length > 0 && (
                <div className="muted" style={{ fontSize: 13, marginTop: 14, background: 'rgba(255,192,77,.10)', border: '1px solid var(--amber)', borderRadius: 10, padding: '9px 12px', color: 'var(--amber)' }}>
                  {t.missT} {missing.join(', ')}.
                </div>
              )}
              <button className="btn btn-primary" style={{ marginTop: 16, opacity: missing.length ? .5 : 1 }} onClick={create} disabled={loading || missing.length > 0}>
                {loading ? '...' : t.newKey}
              </button>
            </>
          )}
        </div>
        )}

        {/* Paso 2: elige tu plataforma */}
        <div className="card" style={{ marginBottom: 18 }}>
          <h3 style={{ marginBottom: 4 }}>{t.platT}</h3>
          <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>{t.platD}</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
            {t.platforms.map((p: any) => {
              const on = p.key === plat;
              return (
                <button key={p.key} onClick={() => pickPlat(p.key)}
                  style={{
                    textAlign: 'left', cursor: 'pointer', borderRadius: 12, padding: '12px 13px',
                    background: on ? 'rgba(124,140,255,.10)' : 'var(--bg2)',
                    border: on ? '2px solid var(--brand)' : '1px solid var(--line)', transition: '.15s',
                  }}>
                  <div className="row between" style={{ gap: 6, alignItems: 'center' }}>
                    <b style={{ fontSize: 14.5, color: 'var(--tx)' }}>{p.name}</b>
                    <span style={{
                      width: 16, height: 16, borderRadius: '50%', flex: 'none',
                      border: on ? 'none' : '1.5px solid var(--line)',
                      background: on ? 'var(--brand)' : 'transparent', color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11,
                    }}>{on ? '✓' : ''}</span>
                  </div>
                  <span className="pill" style={{ marginTop: 8, fontSize: 11, background: 'var(--card2)', color: 'var(--mut)' }}>{p.badge}</span>
                </button>
              );
            })}
          </div>
        </div>

        {kind === 'soon' ? (
          /* MatchTrader: aún no conectable */
          <div className="card" style={{ marginBottom: 18, border: '1px solid var(--amber)' }}>
            <div style={{ fontWeight: 800, marginBottom: 6, color: 'var(--amber)' }}>⏳ {t.soonT}</div>
            <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.7 }}>{t.soonD}</p>
          </div>
        ) : (
          <>
            {/* Paso 3: descarga el conector de la plataforma elegida */}
            <div className="card" style={{ marginBottom: 18 }}>
              <h3 style={{ marginBottom: 4 }}>{t.dlCardT}</h3>
              <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>{activePlat.name}</p>

              <div style={{ background: 'var(--bg2)', border: '2px solid var(--brand)', borderRadius: 12, padding: 14, maxWidth: 460 }}>
                <div className="row between" style={{ marginBottom: 8, gap: 8 }}>
                  <b style={{ fontSize: 15 }}>Onyx · {activePlat.name}</b>
                  <span className="pill" style={{ background: 'rgba(124,140,255,.16)', color: '#aeb7ff' }}>{activePlat.badge}</span>
                </div>
                <div style={{ fontSize: 12, lineHeight: 1.9, color: 'var(--mut)', marginBottom: 14 }}>
                  {platData.does.map((x: string, i: number) => (
                    <div key={i}><span style={{ color: 'var(--green)' }}>✓</span> {x}</div>
                  ))}
                  {platData.note && <div style={{ color: 'var(--amber)' }}>! {platData.note}</div>}
                </div>
                <a className="btn btn-primary" style={{ width: '100%' }} href={platData.dl[0].href} download
                  onClick={() => markDone('dl')}><span className="ic">↓</span>{platData.dl[0].label}</a>
                <div className="muted" style={{ fontSize: 11, marginTop: 7, textAlign: 'center' }}>{platData.fileName}</div>
                {kind === 'ctrader' && (
                  <div style={{ textAlign: 'center', marginTop: 8 }}>
                    <a className="muted" style={{ fontSize: 12, textDecoration: 'underline' }} href="/ctrader/GUIA_CTRADER.md" target="_blank" rel="noreferrer">{t.ctGuide}</a>
                  </div>
                )}
              </div>
            </div>

            {/* Paso 4: asistente de instalación de la plataforma */}
            <InstallWizard
              key={plat}
              t={t} w={WIZ[lang]} lang={lang}
              apiUrl={apiUrl} origin={origin}
              apiKey={newKey || keys[0]?.key || ''}
              onDownload={() => markDone('dl')}
              copy={copy} copied={copied}
              steps={platData.steps} stuckList={platData.stuck}
              dlButtons={platData.dl} conn={platData.conn}
            />
          </>
        )}

        {/* Lista de keys */}
        <div className="card">
          <h3 style={{ marginBottom: 12 }}>{t.yourKeys}</h3>
          {keys.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {keys.map((k) => {
                const tm = ACC_TYPES.find((x) => x.key === k.acc_type);
                const synced = !!k.account?.last_sync_at;
                return (
                  <div key={k.id} style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: '12px 14px' }}>
                    <div className="row between" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                        <b>{k.label}</b>
                        {tm && <span className="pill" style={{ color: tm.color, background: tm.color + '22', border: '1px solid ' + tm.color }}>{lang === 'en' ? tm.en : tm.es}</span>}
                        {synced ? <span className="pill green">{t.active}</span> : <span className="pill" style={{ color: 'var(--amber)', background: 'rgba(255,192,77,.15)' }}>{t.waiting}</span>}
                      </div>
                      <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => revoke(k.id)}>{t.revoke}</button>
                    </div>
                    <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
                      {k.account_login ? `${t.acct} ${k.account_login}` : t.notBound}
                      {k.broker ? ` · ${k.broker}` : ''}
                      {k.acc_size ? ` · ${Number(k.acc_size).toLocaleString()} ${k.currency || 'USD'}` : ''}
                      {synced ? ` · ${t.lastSync} ${fmtDateTime(k.account.last_sync_at, lang)}` : ''}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <code style={{ flex: 1, minWidth: 200, wordBreak: 'break-all' }}>{k.key}</code>
                      <button className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => copy(k.key, k.id)}>{copied === k.id ? t.copied : t.copy}</button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <p className="muted">{t.noKeys}</p>}
        </div>
      </div>
    </>
  );
}
