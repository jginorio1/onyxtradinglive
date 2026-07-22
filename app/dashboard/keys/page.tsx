'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ACC_TYPES } from '@/lib/accountMeta';
import { errMsg } from '@/lib/i18nErrors';

type Lang = 'es' | 'en';

const K = {
  es: {
    nav_dash: 'Panel', nav_connect: 'Conectar cuenta', nav_plan: 'Plan', signout: 'Salir',
    h1: '🔗 Conectar tu cuenta MT4 / MT5',
    intro: 'El mismo proceso y la misma API key sirven para MT4 y MT5. Solo cambia el archivo del connector según tu plataforma.',
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
    step2: '2 · Descarga el Onyx Connector', dlMt5: '⬇ Descargar para MT5', dlMt4: '⬇ Descargar para MT4',
    dlNote: 'Ya viene con la URL de tu servidor configurada. Solo tendrás que pegar tu API key.',
    step3: '3 · Instálalo (pasos)',
    s: [
      'Descarga el connector de tu plataforma con los botones de arriba (MT5 o MT4).',
      'En MetaTrader: Archivo → Abrir carpeta de datos → copia el archivo en la carpeta MQL5/Experts (o MQL4/Experts en MT4).',
      'Abre MetaEditor (tecla F4), abre el connector y pulsa Compilar (F7).',
      'En MetaTrader, abre el Navegador → Asesores Expertos → arrastra el Onyx Connector a cualquier gráfico.',
    ],
    inputsIntro: 'En la ventana de inputs pon:',
    apiKeyHint: 'tu API key (la de arriba, o una de la lista de abajo)',
    s6: 'Autoriza el envío: Herramientas → Opciones → Asesores Expertos → marca “Permitir WebRequest para las siguientes URL” y añade:',
    s7: 'Activa el botón AlgoTrading (verde). En segundos el panel del connector dirá “Sincronizado” y tus operaciones aparecerán en el dashboard.',
    yourKeys: 'Tus API keys', active: 'activa', revoked: 'revocada', revoke: 'Revocar', noKeys: 'Aún no tienes API keys. Genera una arriba.',
    errKey: 'No se pudo crear la key: ', errNet: 'Error de red: ', confirmRevoke: '¿Revocar esta API key? La cuenta MT que la use dejará de sincronizar.',
  },
  en: {
    nav_dash: 'Dashboard', nav_connect: 'Connect account', nav_plan: 'Plan', signout: 'Sign out',
    h1: '🔗 Connect your MT4 / MT5 account',
    intro: 'The same process and the same API key work for both MT4 and MT5. Just use the connector file for your platform.',
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
    step2: '2 · Download the Onyx Connector', dlMt5: '⬇ Download for MT5', dlMt4: '⬇ Download for MT4',
    dlNote: 'It already has your server URL configured. You only need to paste your API key.',
    step3: '3 · Install it (steps)',
    s: [
      'Download the connector for your platform with the buttons above (MT5 or MT4).',
      'In MetaTrader: File → Open Data Folder → copy the file into the MQL5/Experts folder (or MQL4/Experts on MT4).',
      'Open MetaEditor (F4 key), open the connector and click Compile (F7).',
      'In MetaTrader, open the Navigator → Expert Advisors → drag the Onyx Connector onto any chart.',
    ],
    inputsIntro: 'In the inputs window set:',
    apiKeyHint: 'your API key (the one above, or one from the list below)',
    s6: 'Authorize sending: Tools → Options → Expert Advisors → check “Allow WebRequest for listed URL” and add:',
    s7: 'Turn on the AlgoTrading button (green). In seconds the connector panel will say “Synced” and your trades will appear in the dashboard.',
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

export default function KeysPage() {
  const [keys, setKeys] = useState<any[]>([]);
  const [usage, setUsage] = useState<any>(null);
  const [f, setF] = useState<any>({ label: '', acc_type: 'own', broker: '', account_login: '', acc_size: '' });
  const [newKey, setNewKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState('');
  const [origin, setOrigin] = useState('');
  const [lang, setLang] = useState<Lang>('es');
  const t = K[lang];
  const atLimit = !!usage && !usage.unlimited && usage.used >= usage.max;

  // Campos obligatorios: sin ellos no dejamos crear la clave
  const missing: string[] = [];
  if (!String(f.label || '').trim()) missing.push(t.missNick);
  if (!String(f.broker || '').trim()) missing.push(t.missFirm);
  if ((f.acc_type === 'challenge' || f.acc_type === 'funded') && !String(f.acc_size || '').trim()) missing.push(t.missSize);

  useEffect(() => {
    setOrigin(window.location.origin);
    try {
      const s = localStorage.getItem('onyx_lang');
      if (s === 'en' || s === 'es') setLang(s as Lang);
      else if (navigator.language?.toLowerCase().startsWith('en')) setLang('en');
    } catch {}
  }, []);
  function switchLang(l: Lang) { setLang(l); try { localStorage.setItem('onyx_lang', l); } catch {} }
  const apiUrl = origin + '/api/v1/sync';

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
      <div className="topbar"><div className="wrap">
        <div className="logo"><span className="mark">◆</span> Onyx</div>
        <div className="navl"><Link href="/dashboard">{t.nav_dash}</Link><Link href="/dashboard/keys">{t.nav_connect}</Link><Link href="/pricing">{t.nav_plan}</Link></div>
        <div className="row">
          <button className="btn btn-ghost" style={{ padding: '6px 10px' }} onClick={() => switchLang(lang === 'es' ? 'en' : 'es')}>{lang === 'es' ? '🇬🇧 EN' : '🇪🇸 ES'}</button>
          <form action="/auth/signout" method="post"><button className="btn btn-ghost">{t.signout}</button></form>
        </div>
      </div></div>

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

        {/* Paso 2: instrucciones */}
        <div className="card" style={{ marginBottom: 18 }}>
          <h3>{t.step2}</h3>
          <div style={{ display: 'flex', gap: 10, margin: '12px 0', flexWrap: 'wrap' }}>
            <a className="btn btn-primary" href="/OnyxConnector_MT5.mq5" download>{t.dlMt5}</a>
            <a className="btn btn-primary" href="/OnyxConnector_MT4.mq4" download>{t.dlMt4}</a>
          </div>
          <p className="muted" style={{ fontSize: 13 }}>{t.dlNote}</p>
          <h3 style={{ marginTop: 18 }}>{t.step3}</h3>
          <ol style={{ margin: '12px 0 0 18px', lineHeight: 2, color: '#d6d9e0', fontSize: 15 }}>
            {t.s.map((step, i) => <li key={i}>{step}</li>)}
            <li>{t.inputsIntro}
              <div style={{ margin: '8px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className="muted" style={{ width: 90 }}>InpApiUrl</span>
                  <code style={{ flex: 1, wordBreak: 'break-all' }}>{apiUrl || '...'}</code>
                  <button className="btn btn-ghost" onClick={() => copy(apiUrl, 'url')}>{copied === 'url' ? '✓' : t.copy}</button>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className="muted" style={{ width: 90 }}>InpApiKey</span>
                  <span className="muted" style={{ flex: 1 }}>{t.apiKeyHint}</span>
                </div>
              </div>
            </li>
            <li>{t.s6}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '8px 0' }}>
                <code style={{ flex: 1 }}>{origin || '...'}</code>
                <button className="btn btn-ghost" onClick={() => copy(origin, 'dom')}>{copied === 'dom' ? '✓' : t.copy}</button>
              </div>
            </li>
            <li>{t.s7}</li>
          </ol>
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
