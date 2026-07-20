'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function KeysPage() {
  const [keys, setKeys] = useState<any[]>([]);
  const [newKey, setNewKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState('');
  const [origin, setOrigin] = useState('');

  useEffect(() => { setOrigin(window.location.origin); }, []);
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
      else alert('No se pudo crear la key: ' + (j.error || 'error desconocido'));
    } catch (e: any) { alert('Error de red: ' + (e?.message || e)); }
    await load(); setLoading(false);
  }
  async function revoke(id: string) {
    if (!confirm('¿Revocar esta API key? La cuenta MT que la use dejará de sincronizar.')) return;
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
        <div className="navl"><Link href="/dashboard">Dashboard</Link><Link href="/dashboard/keys">Conectar cuenta</Link><Link href="/pricing">Plan</Link></div>
        <form action="/auth/signout" method="post"><button className="btn btn-ghost">Salir</button></form>
      </div></div>

      <div className="wrap" style={{ padding: '28px 22px', maxWidth: 860 }}>
        <h1>🔗 Conectar tu cuenta MT4 / MT5</h1>
        <p className="muted" style={{ margin: '8px 0 22px' }}>El mismo proceso y la misma API key sirven para <b>MT4 y MT5</b>. Solo cambia el archivo del connector según tu plataforma.</p>

        {/* Paso 1: generar key */}
        <div className="card" style={{ marginBottom: 18 }}>
          <h3>1 · Genera tu API key</h3>
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={create} disabled={loading}>
            {loading ? '...' : '+ Nueva API key'}
          </button>
          {newKey && (
            <div style={{ marginTop: 14, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: 14 }}>
              <p className="muted" style={{ fontSize: 13, marginBottom: 8 }}>✅ API key creada. Cópiala y pégala en el connector:</p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <code style={{ flex: 1, wordBreak: 'break-all', padding: '8px 10px' }}>{newKey}</code>
                <button className="btn btn-ghost" onClick={() => copy(newKey, 'new')}>{copied === 'new' ? '✓ Copiado' : 'Copiar'}</button>
              </div>
            </div>
          )}
        </div>

        {/* Paso 2: instrucciones */}
        <div className="card" style={{ marginBottom: 18 }}>
          <h3>2 · Instala el Onyx Connector (pasos)</h3>
          <ol style={{ margin: '12px 0 0 18px', lineHeight: 2, color: '#d6d9e0', fontSize: 15 }}>
            <li>Descarga el connector de tu plataforma: <b>MT5 → OnyxConnector_MT5.mq5</b> · <b>MT4 → OnyxConnector_MT4.mq4</b>.</li>
            <li>En MetaTrader: <b>Archivo → Abrir carpeta de datos</b> → copia el archivo en la carpeta <span className="code">MQL5/Experts</span> (o <span className="code">MQL4/Experts</span> en MT4).</li>
            <li>Abre <b>MetaEditor</b> (tecla F4), abre el connector y pulsa <b>Compilar (F7)</b>.</li>
            <li>En MetaTrader, abre el <b>Navegador</b> → Asesores Expertos → <b>arrastra el Onyx Connector</b> a cualquier gráfico.</li>
            <li>En la ventana de inputs pon:
              <div style={{ margin: '8px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className="muted" style={{ width: 90 }}>InpApiUrl</span>
                  <code style={{ flex: 1, wordBreak: 'break-all' }}>{apiUrl || '...'}</code>
                  <button className="btn btn-ghost" onClick={() => copy(apiUrl, 'url')}>{copied === 'url' ? '✓' : 'Copiar'}</button>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className="muted" style={{ width: 90 }}>InpApiKey</span>
                  <span className="muted" style={{ flex: 1 }}>tu API key (la de arriba, o una de la lista de abajo)</span>
                </div>
              </div>
            </li>
            <li>Autoriza el envío: <b>Herramientas → Opciones → Asesores Expertos</b> → marca <b>“Permitir WebRequest para las siguientes URL”</b> y añade:
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '8px 0' }}>
                <code style={{ flex: 1 }}>{origin || '...'}</code>
                <button className="btn btn-ghost" onClick={() => copy(origin, 'dom')}>{copied === 'dom' ? '✓' : 'Copiar'}</button>
              </div>
            </li>
            <li>Activa el botón <b>AlgoTrading</b> (verde). En segundos el panel del connector dirá <b>“Sincronizado”</b> y tus operaciones aparecerán en el dashboard.</li>
          </ol>
        </div>

        {/* Lista de keys */}
        <div className="card">
          <h3 style={{ marginBottom: 12 }}>Tus API keys</h3>
          {keys.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {keys.map((k) => (
                <div key={k.id} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 12px' }}>
                  <code style={{ flex: 1, minWidth: 200, wordBreak: 'break-all', opacity: k.revoked ? .5 : 1 }}>{k.key}</code>
                  {k.revoked ? <span className="pill">revocada</span> : <span className="pill green">activa</span>}
                  {!k.revoked && <button className="btn btn-ghost" onClick={() => copy(k.key, k.id)}>{copied === k.id ? '✓ Copiado' : 'Copiar'}</button>}
                  {!k.revoked && <button className="btn btn-danger" onClick={() => revoke(k.id)}>Revocar</button>}
                </div>
              ))}
            </div>
          ) : <p className="muted">Aún no tienes API keys. Genera una arriba.</p>}
        </div>
      </div>
    </>
  );
}
