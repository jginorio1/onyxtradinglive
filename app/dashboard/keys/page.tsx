'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

type Lang = 'es' | 'en';

const K = {
  es: {
    nav_dash: 'Panel', nav_connect: 'Conectar cuenta', nav_plan: 'Plan', signout: 'Salir',
    h1: '🔗 Conectar tu cuenta MT4 / MT5',
    intro: 'El mismo proceso y la misma API key sirven para MT4 y MT5. Solo cambia el archivo del connector según tu plataforma.',
    step1: '1 · Genera tu API key', newKey: '+ Nueva API key', created: '✅ API key creada. Cópiala y pégala en el connector:',
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
    step1: '1 · Generate your API key', newKey: '+ New API key', created: '✅ API key created. Copy it and paste it into the connector:',
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

export default function KeysPage() {
  const [keys, setKeys] = useState<any[]>([]);
  const [newKey, setNewKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState('');
  const [origin, setOrigin] = useState('');
  const [lang, setLang] = useState<Lang>('es');
  const t = K[lang];

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
  }
  useEffect(() => { load(); }, []);

  async function create() {
    setLoading(true); setNewKey('');
    try {
      const r = await fetch('/api/keys', { method: 'POST', body: JSON.stringify({ label: 'Mi cuenta MT' }) });
      const j = await r.json();
      if (j.key) setNewKey(j.key);
      else alert(t.errKey + (j.error || 'error'));
    } catch (e: any) { alert(t.errNet + (e?.message || e)); }
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

        {/* Paso 1: generar key */}
        <div className="card" style={{ marginBottom: 18 }}>
          <h3>{t.step1}</h3>
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={create} disabled={loading}>
            {loading ? '...' : t.newKey}
          </button>
          {newKey && (
            <div style={{ marginTop: 14, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: 14 }}>
              <p className="muted" style={{ fontSize: 13, marginBottom: 8 }}>{t.created}</p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <code style={{ flex: 1, wordBreak: 'break-all', padding: '8px 10px' }}>{newKey}</code>
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
              {keys.map((k) => (
                <div key={k.id} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 12px' }}>
                  <code style={{ flex: 1, minWidth: 200, wordBreak: 'break-all', opacity: k.revoked ? .5 : 1 }}>{k.key}</code>
                  {k.revoked ? <span className="pill">{t.revoked}</span> : <span className="pill green">{t.active}</span>}
                  {!k.revoked && <button className="btn btn-ghost" onClick={() => copy(k.key, k.id)}>{copied === k.id ? t.copied : t.copy}</button>}
                  {!k.revoked && <button className="btn btn-danger" onClick={() => revoke(k.id)}>{t.revoke}</button>}
                </div>
              ))}
            </div>
          ) : <p className="muted">{t.noKeys}</p>}
        </div>
      </div>
    </>
  );
}
