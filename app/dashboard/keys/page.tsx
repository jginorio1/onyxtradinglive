'use client';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/lang';
import Link from 'next/link';
import { ACC_TYPES } from '@/lib/accountMeta';
import { errMsg } from '@/lib/i18nErrors';

type Lang = 'es' | 'en';

const K = {
  es: {
    nav_dash: 'Panel', nav_connect: 'Conectar cuenta', nav_plan: 'Plan', signout: 'Salir',
    h1: 'Instalar Onyx en MetaTrader',
    intro: 'Un solo archivo por plataforma. Ya trae tu servidor configurado: solo tienes que pegar tu clave.',
    step2: '2 · Elige tu archivo',
    dlNote: 'Los dos hacen lo mismo. Solo cambia la plataforma para la que están escritos.',
    eaMt5: 'Onyx EA · MT5', eaMt4: 'Onyx EA · MT4',
    recommended: 'Más usado', newBadge: 'Nuevo',
    mt5Does: ['Registra tus operaciones en el diario', 'Break even, trailing y cierres parciales', 'Tu plan de trading, límites y noticias'],
    mt4Does: ['Registra tus operaciones en el diario', 'Break even, trailing y cierres parciales', 'Tu plan de trading, límites y noticias'],
    mt4Note: 'En MT4, al cerrar parte de una operación el resto cambia de número. Está resuelto, pero avísanos si ves algo raro.',
    oldT: 'Necesito el conector antiguo (solo diario)',
    oldD: 'Solo envía operaciones al diario, sin gestionar nada. Únicamente si el EA nuevo te da problemas.',
    dlMt5: 'Descargar para MT5', dlMt4: 'Descargar para MT4',
    step3: '3 · Instalarlo',
    stepsD: 'Los pasos se van marcando solos según avanzas.',
    folderPath: 'MQL5/Experts  (o MQL4/Experts en MT4)',
    allDone: 'Listo. Tu MetaTrader está reportando a Onyx.',
    steps: [
      { t: 'Descarga el archivo de tu plataforma', d: 'Con los botones de arriba.' },
      { t: 'Cópialo a la carpeta de MetaTrader', d: 'En MetaTrader: Archivo → Abrir carpeta de datos. Desde ahí entra en la carpeta Experts.', copy: 'folder' },
      { t: 'Compílalo', d: 'Abre MetaEditor (tecla F4), abre el archivo y pulsa Compilar (F7). Si sale algún error, cópialo y escríbenos.' },
      { t: 'Arrástralo a un gráfico', d: 'Navegador → Asesores Expertos → arrastra Onyx a cualquier gráfico. Con uno basta: gestiona todas tus posiciones desde ahí.' },
      { t: 'Rellena los dos campos de la ventana', d: 'Se abre al soltarlo en el gráfico.', copy: 'url' },
      { t: 'Autoriza el envío', d: 'Herramientas → Opciones → Asesores Expertos → marca "Permitir WebRequest para las siguientes URL" y añade:', copy: 'domain' },
      { t: 'Enciende AlgoTrading', d: 'El botón de arriba, que se pone verde. En unos segundos el panel del gráfico dirá "Conectado" y tus operaciones aparecerán en el dashboard.' },
    ],
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
    waiting: 'esperando sync', acct: 'Cuenta', notBound: 'Sin atar todavía', lastSync: 'sync',
    copy: 'Copiar', copied: '✓ Copiado',
    apiKeyHint: 'tu clave de arriba (o una de la lista de abajo)',
    yourKeys: 'Tus API keys', active: 'activa', revoked: 'revocada', revoke: 'Revocar', noKeys: 'Aún no tienes API keys. Genera una arriba.',
    errKey: 'No se pudo crear la key: ', errNet: 'Error de red: ', confirmRevoke: '¿Revocar esta API key? La cuenta MT que la use dejará de sincronizar.',
  },
  en: {
    nav_dash: 'Dashboard', nav_connect: 'Connect account', nav_plan: 'Plan', signout: 'Sign out',
    h1: 'Install Onyx in MetaTrader',
    intro: 'One file per platform. It already has your server configured: you only paste your key.',
    step2: '2 · Pick your file',
    dlNote: 'Both do the same. Only the platform they are written for changes.',
    eaMt5: 'Onyx EA · MT5', eaMt4: 'Onyx EA · MT4',
    recommended: 'Most used', newBadge: 'New',
    mt5Does: ['Logs your trades to the journal', 'Break even, trailing and partial closes', 'Your trading plan, limits and news'],
    mt4Does: ['Logs your trades to the journal', 'Break even, trailing and partial closes', 'Your trading plan, limits and news'],
    mt4Note: 'On MT4, closing part of a trade changes the ticket of the rest. It is handled, but tell us if you see anything odd.',
    oldT: 'I need the old connector (journal only)',
    oldD: 'It only sends trades to the journal, it manages nothing. Use it only if the new EA gives you trouble.',
    dlMt5: 'Download for MT5', dlMt4: 'Download for MT4',
    step3: '3 · Install it',
    stepsD: 'Steps tick themselves off as you go.',
    folderPath: 'MQL5/Experts  (or MQL4/Experts on MT4)',
    allDone: 'Done. Your MetaTrader is reporting to Onyx.',
    steps: [
      { t: 'Download the file for your platform', d: 'Use the buttons above.' },
      { t: 'Copy it into the MetaTrader folder', d: 'In MetaTrader: File → Open Data Folder. From there go into the Experts folder.', copy: 'folder' },
      { t: 'Compile it', d: 'Open MetaEditor (F4), open the file and click Compile (F7). If any error shows up, copy it and send it to us.' },
      { t: 'Drag it onto a chart', d: 'Navigator → Expert Advisors → drag Onyx onto any chart. One is enough: it manages all your positions from there.' },
      { t: 'Fill the two fields in the window', d: 'It opens when you drop it on the chart.', copy: 'url' },
      { t: 'Authorize sending', d: 'Tools → Options → Expert Advisors → check "Allow WebRequest for listed URL" and add:', copy: 'domain' },
      { t: 'Turn on AlgoTrading', d: 'The button at the top, which turns green. In a few seconds the chart panel will say "Connected" and your trades will appear in the dashboard.' },
    ],
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
    waiting: 'waiting for sync', acct: 'Account', notBound: 'Not bound yet', lastSync: 'sync',
    copy: 'Copy', copied: '✓ Copied',
    apiKeyHint: 'your key from above (or one from the list below)',
    yourKeys: 'Your API keys', active: 'active', revoked: 'revoked', revoke: 'Revoke', noKeys: 'You have no API keys yet. Generate one above.',
    errKey: 'Could not create the key: ', errNet: 'Network error: ', confirmRevoke: 'Revoke this API key? The MT account using it will stop syncing.',
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
  const [f, setF] = useState<any>({ label: '', acc_type: 'own', broker: '', account_login: '', acc_size: '' });
  const [newKey, setNewKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState('');
  const [origin, setOrigin] = useState('');
  const { lang, setLang } = useLang();
  const t = K[lang];
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
  useEffect(() => {
    try { setDownloaded(localStorage.getItem('onyx_ea_dl') === '1'); } catch {}
  }, []);
  function markDone(what: string) {
    if (what === 'dl') { setDownloaded(true); try { localStorage.setItem('onyx_ea_dl', '1'); } catch {} }
  }

  const eaLive = keys.some((k: any) => k.account?.last_sync_at);

  function stepState(i: number): 'done' | 'now' | 'todo' {
    // Si el EA ya reportó, todos los pasos están cumplidos por definición
    if (eaLive) return 'done';
    if (i === 0) return downloaded ? 'done' : 'now';
    if (!downloaded) return 'todo';
    // El primero pendiente después de la descarga es el que toca
    return i === 1 ? 'now' : 'todo';
  }

  async function load() {
    const r = await fetch('/api/keys');
    const j = await r.json();
    setKeys(j.keys || []);
    setUsage(j.usage || null);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    setLoading(true); setNewKey('');
    try {
      const body = { ...f, label: (f.label || '').trim() || (f.broker ? f.broker : 'Mi cuenta MT') };
      const r = await fetch('/api/keys', { method: 'POST', body: JSON.stringify(body) });
      const j = await r.json();
      if (j.key) { setNewKey(j.key); setF({ label: '', acc_type: 'own', broker: '', account_login: '', acc_size: '' }); }
      else alert(errMsg(j, lang));
    } catch { alert(errMsg({ code: 'network' }, lang)); }
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

  return (
    <>

      <div className="wrap" style={{ padding: '28px 22px', maxWidth: 860 }}>
        <h1>{t.h1}</h1>
        <p className="muted" style={{ margin: '8px 0 22px' }}>{t.intro}</p>

        {/* Medidor de cupos del plan */}
        {usage && (
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="row between" style={{ flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
              <h3>{t.slots}</h3>
              <span className="muted" style={{ fontSize: 13 }}>{usage.used} {t.of} {usage.unlimited ? t.unlimited : usage.max} · {lang === 'en' ? (usage.planNameEn || usage.planName) : usage.planName}</span>
            </div>
            <div style={{ height: 6, background: 'var(--bg2)', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ width: (usage.unlimited ? 8 : Math.min(100, Math.round((usage.used / Math.max(usage.max, 1)) * 100))) + '%', height: '100%', background: atLimit ? '#ff6b7d' : usage.used / Math.max(usage.max, 1) >= .75 ? '#ffc04d' : '#34e2a0', transition: '.3s' }} />
            </div>
            <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>
              {usage.unlimited ? t.unlimitedTxt : atLimit ? t.full : `${t.left} ${usage.max - usage.used} ${t.left2}`}
            </div>
          </div>
        )}

        {/* Paso 1: conectar una cuenta */}
        <div className="card" style={{ marginBottom: 18 }}>
          <h3 style={{ marginBottom: 4 }}>{t.step1}</h3>
          <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>{t.formHint}</p>

          {atLimit ? (
            <div style={{ background: 'rgba(124,140,255,.10)', border: '1px solid #7c8cff', borderRadius: 10, padding: 14 }}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>🔒 {t.limitT}</div>
              <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>{t.limitD}</p>
              <Link className="btn btn-primary" href="/pricing">{t.limitCta}</Link>
            </div>
          ) : (
            <>
              <div className="grid g2" style={{ gap: 12 }}>
                <div>
                  <span style={lbl}>{t.fNick}</span>
                  <input value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder="FTMO 100K" style={{ margin: '4px 0 0' }} />
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
                  <input list="onyx-firms" value={f.broker} onChange={(e) => setF({ ...f, broker: e.target.value })} placeholder="FTMO" style={{ margin: '4px 0 0' }} />
                  <datalist id="onyx-firms">{FIRMS.map((x) => <option key={x} value={x} />)}</datalist>
                  <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{t.fFirmHint}</div>
                </div>
                <div>
                  <span style={lbl}>{t.fLogin}</span>
                  <input value={f.account_login} onChange={(e) => setF({ ...f, account_login: e.target.value })} placeholder={t.fLoginPh} style={{ margin: '4px 0 0' }} />
                </div>
                {(f.acc_type === 'challenge' || f.acc_type === 'funded') && (
                  <div>
                    <span style={lbl}>{t.fSize}</span>
                    <input value={f.acc_size} onChange={(e) => setF({ ...f, acc_size: e.target.value })} placeholder="100000" style={{ margin: '4px 0 0' }} />
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

        {/* Paso 2: elegir el archivo */}
        <div className="card" style={{ marginBottom: 18 }}>
          <h3 style={{ marginBottom: 4 }}>{t.step2}</h3>
          <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>{t.dlNote}</p>

          <div className="grid g2" style={{ gap: 12 }}>
            {/* MT5: el gestor completo */}
            <div style={{ background: 'var(--bg2)', border: '2px solid var(--brand)', borderRadius: 12, padding: 14 }}>
              <div className="row between" style={{ marginBottom: 8, gap: 8 }}>
                <b style={{ fontSize: 15 }}>{t.eaMt5}</b>
                <span className="pill" style={{ background: 'rgba(124,140,255,.16)', color: '#aeb7ff' }}>{t.recommended}</span>
              </div>
              <div style={{ fontSize: 12, lineHeight: 1.9, color: 'var(--mut)', marginBottom: 14 }}>
                {t.mt5Does.map((x: string, i: number) => (
                  <div key={i}><span style={{ color: 'var(--green)' }}>✓</span> {x}</div>
                ))}
              </div>
              <a className="btn btn-primary" style={{ width: '100%' }} href="/OnyxManager_MT5.mq5" download
                onClick={() => markDone('dl')}><span className="ic">↓</span>{t.dlMt5}</a>
              <div className="muted" style={{ fontSize: 11, marginTop: 7, textAlign: 'center' }}>OnyxManager_MT5.mq5 · v2.0</div>
            </div>

            {/* MT4: lo mismo, portado a MQL4 */}
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 12, padding: 14 }}>
              <div className="row between" style={{ marginBottom: 8, gap: 8 }}>
                <b style={{ fontSize: 15 }}>{t.eaMt4}</b>
                <span className="pill">{t.newBadge}</span>
              </div>
              <div style={{ fontSize: 12, lineHeight: 1.9, color: 'var(--mut)', marginBottom: 14 }}>
                {t.mt4Does.map((x: string, i: number) => (
                  <div key={i}><span style={{ color: 'var(--green)' }}>✓</span> {x}</div>
                ))}
                <div style={{ color: 'var(--amber)' }}>! {t.mt4Note}</div>
              </div>
              <a className="btn btn-ghost" style={{ width: '100%' }} href="/OnyxManager_MT4.mq4" download
                onClick={() => markDone('dl')}><span className="ic">↓</span>{t.dlMt4}</a>
              <div className="muted" style={{ fontSize: 11, marginTop: 7, textAlign: 'center' }}>OnyxManager_MT4.mq4 · v2.0</div>
            </div>
          </div>

          <details style={{ marginTop: 14 }}>
            <summary className="muted" style={{ fontSize: 12, cursor: 'pointer' }}>{t.oldT}</summary>
            <div className="row" style={{ gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
              <a className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }} href="/OnyxConnector_MT5.mq5" download>Conector MT5 (v1)</a>
              <a className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }} href="/OnyxConnector_MT4.mq4" download>Conector MT4 (v1)</a>
            </div>
            <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>{t.oldD}</p>
          </details>
        </div>

        {/* Paso 3: instalación con estado */}
        <div className="card" style={{ marginBottom: 18 }}>
          <h3 style={{ marginBottom: 4 }}>{t.step3}</h3>
          <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>{t.stepsD}</p>

          {t.steps.map((s: any, i: number) => {
            const state = stepState(i);
            return (
              <div key={i} className="row" style={{ gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', flex: 'none', fontSize: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: state === 'done' ? 'var(--green)' : state === 'now' ? 'var(--brand)' : 'transparent',
                  border: state === 'todo' ? '1px solid var(--line)' : 'none',
                  color: state === 'todo' ? 'var(--mut)' : '#111726',
                }}>{state === 'done' ? '✓' : i + 1}</div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, color: state === 'todo' ? 'var(--mut)' : 'var(--tx)' }}>{s.t}</div>
                  {s.d && <div className="muted" style={{ fontSize: 12, marginTop: 4, lineHeight: 1.6 }}>{s.d}</div>}

                  {s.copy === 'folder' && (
                    <CopyRow label="" value={t.folderPath} tag="folder" copy={copy} copied={copied} t={t} />
                  )}
                  {s.copy === 'url' && (
                    <>
                      <CopyRow label="ServidorUrl" value={apiUrl} tag="url" copy={copy} copied={copied} t={t} />
                      <div className="row" style={{ gap: 8, marginTop: 6, fontSize: 12 }}>
                        <span className="muted" style={{ width: 92, flex: 'none' }}>ApiKey</span>
                        <span className="muted">{t.apiKeyHint}</span>
                      </div>
                    </>
                  )}
                  {s.copy === 'domain' && (
                    <CopyRow label="" value={origin} tag="dom" copy={copy} copied={copied} t={t} />
                  )}
                </div>
              </div>
            );
          })}

          {eaLive && (
            <div style={{ marginTop: 4, padding: '10px 12px', background: 'rgba(52,226,160,.08)', border: '1px solid var(--green)', borderRadius: 10 }}>
              <b style={{ color: 'var(--green)', fontSize: 13 }}>✓ {t.allDone}</b>
            </div>
          )}
        </div>

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
                        {synced ? <span className="pill green">{t.active}</span> : <span className="pill" style={{ color: '#ffc04d', background: 'rgba(255,192,77,.15)' }}>{t.waiting}</span>}
                      </div>
                      <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => revoke(k.id)}>{t.revoke}</button>
                    </div>
                    <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
                      {k.account_login ? `${t.acct} ${k.account_login}` : t.notBound}
                      {k.broker ? ` · ${k.broker}` : ''}
                      {k.acc_size ? ` · ${Number(k.acc_size).toLocaleString()} ${k.currency || 'USD'}` : ''}
                      {synced ? ` · ${t.lastSync} ${new Date(k.account.last_sync_at).toLocaleString()}` : ''}
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
