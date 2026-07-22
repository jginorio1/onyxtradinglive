'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

// Consola de pruebas: simula lo que hace el EA, sin necesidad de MetaTrader.
// Sirve para comprobar la cadena completa: clave → límites → configuración → comandos.

export default function TestConsole({ meEmail }: { meEmail: string }) {
  const [keys, setKeys] = useState<any[]>([]);
  const [key, setKey] = useState('');
  const [login, setLogin] = useState('');
  const [out, setOut] = useState('');
  const [busy, setBusy] = useState('');
  const [me, setMe] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [withPos, setWithPos] = useState(false);

  useEffect(() => { load(); }, []);
  async function load() {
    try {
      const r = await fetch('/api/keys'); const j = await r.json();
      setKeys(j.keys || []);
      if (j.keys?.[0]) { setKey(j.keys[0].key); setLogin(String(j.keys[0].account_login || '')); }
    } catch {}
    try {
      const r = await fetch('/api/account'); const j = await r.json();
      setMe(j.profile || null);
    } catch {}
    try {
      const r = await fetch('/api/admin/plans'); const j = await r.json();
      setPlans(j.plans || []);
    } catch {}
  }

  // Envía al servidor exactamente el mismo cuerpo que manda el EA
  async function simulate() {
    if (!key) return;
    setBusy('sim'); setOut('');
    const acc = Number(login) || 9999001;
    const body: any = {
      apiKey: key,
      eaVersion: 'SIM',
      serverOffset: 120,
      account: {
        login: acc, broker: 'Simulador', server: 'Onyx-Test', name: 'Prueba',
        currency: 'USD', leverage: 100, platform: 'MT5', balance: 10000, equity: 10120,
      },
      openPositions: withPos ? [{
        ticket: 777001, symbol: 'EURUSD', side: 'buy', volume: 0.5,
        openTime: Math.floor(Date.now() / 1000) - 3600, openPrice: 1.08420,
        sl: 1.08200, tp: 1.08900, profit: 120,
      }] : [],
      closedTrades: [],
    };
    try {
      const r = await fetch('/api/v1/sync', { method: 'POST', body: JSON.stringify(body) });
      const txt = await r.text();
      let pretty = txt;
      try { pretty = JSON.stringify(JSON.parse(txt), null, 2); } catch {}
      setOut(`HTTP ${r.status}\n\n${pretty}`);
    } catch (e: any) { setOut('Error: ' + (e?.message || e)); }
    setBusy(''); load();
  }

  // Encola una acción rápida para ver que aparece en la respuesta
  async function queue(cmd: string) {
    setBusy(cmd);
    try {
      const r = await fetch('/api/manager/command', { method: 'POST', body: JSON.stringify({ account_id: accountIdOf(), command: cmd }) });
      const j = await r.json();
      setOut(r.ok ? `Comando "${cmd}" encolado. Dale a Simular sync para verlo llegar.` : 'No se pudo encolar: ' + (j.error || ''));
    } catch (e: any) { setOut('Error: ' + (e?.message || e)); }
    setBusy('');
  }
  function accountIdOf() {
    const k = keys.find((x) => x.key === key);
    return k?.account?.id || k?.account_id || '';
  }

  // Cambiar mi propio plan para probar los candados
  async function setMyPlan(planId: string) {
    if (!me?.id) { setOut('No pude leer tu perfil. Recarga la pagina e intentalo de nuevo.'); return; }
    setBusy('plan');
    try {
      const r = await fetch('/api/admin/users', { method: 'PATCH', body: JSON.stringify({ id: me.id, action: 'plan', value: planId }) });
      const txt = await r.text();
      if (!r.ok) { setOut('No se pudo cambiar el plan:\n' + txt); setBusy(''); return; }
      setOut(`Listo. Tu plan ahora es "${planId}". Recarga el dashboard para ver los cambios.`);
    } catch (e: any) { setOut('Error: ' + (e?.message || e)); }
    setBusy(''); load();
  }

  const box = { background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: 12 } as any;
  const lbl = { fontSize: 12, color: 'var(--mut)', display: 'block', marginBottom: 4 } as any;

  return (
    <>
      <div className="card" style={{ marginBottom: 16, border: '1px solid var(--amber)' }}>
        <h3 style={{ marginBottom: 6, color: 'var(--amber)' }}>🧪 Consola de pruebas</h3>
        <p className="muted" style={{ fontSize: 13 }}>
          Simula exactamente lo que envía el EA, sin abrir MetaTrader. Sirve para comprobar que la clave funciona,
          que los límites del plan se respetan y que la configuración del gestor llega bien.
        </p>
      </div>

      {/* Mi plan */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 4 }}>Mi plan de prueba</h3>
        <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
          Cámbiate de plan para probar los candados y el gestor. Es tu propia cuenta ({meEmail}).
        </p>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {plans.map((p) => (
            <button key={p.id} className={'btn ' + (me?.plan === p.id ? 'btn-primary' : 'btn-ghost')}
              onClick={() => setMyPlan(p.id)} disabled={busy === 'plan'}>
              {p.name}
            </button>
          ))}
        </div>
        {me && <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>Plan actual: <b>{me.plan}</b></div>}
      </div>

      {/* Simulador */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 12 }}>Simular una sincronización</h3>

        <span style={lbl}>Clave API</span>
        {keys.length ? (
          <select value={key} onChange={(e) => { setKey(e.target.value); const k = keys.find((x) => x.key === e.target.value); setLogin(String(k?.account_login || '')); }} style={{ margin: 0, marginBottom: 12 }}>
            {keys.map((k) => <option key={k.id} value={k.key}>{k.label} · {k.account_login || 'sin atar'}</option>)}
          </select>
        ) : (
          <div style={{ ...box, marginBottom: 12 }}>
            <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>Todavía no tienes ninguna clave. Créala primero.</p>
            <Link className="btn btn-primary" href="/dashboard/keys">Crear una clave →</Link>
          </div>
        )}

        <span style={lbl}>Número de cuenta a simular</span>
        <input value={login} onChange={(e) => setLogin(e.target.value)} placeholder="9999001" style={{ margin: '0 0 12px', maxWidth: 200 }} />

        <label className="row" style={{ gap: 8, marginBottom: 14, cursor: 'pointer' }}>
          <input type="checkbox" checked={withPos} onChange={(e) => setWithPos(e.target.checked)} style={{ width: 'auto', margin: 0 }} />
          <span style={{ fontSize: 14 }}>Incluir una posición abierta de ejemplo (EURUSD 0.50)</span>
        </label>

        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={simulate} disabled={!key || busy === 'sim'}>{busy === 'sim' ? '...' : 'Simular sync'}</button>
          <button className="btn btn-ghost" onClick={() => queue('close_all')} disabled={!key || !!busy}>Encolar "cerrar todo"</button>
          <button className="btn btn-ghost" onClick={() => queue('sl_to_be')} disabled={!key || !!busy}>Encolar "SL a BE"</button>
        </div>

        <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
          Ojo: simular crea o actualiza esa cuenta en tu base de datos, igual que haría el EA de verdad.
        </p>
      </div>

      {/* Respuesta */}
      <div className="card">
        <h3 style={{ marginBottom: 10 }}>Respuesta del servidor</h3>
        {!out && <p className="muted" style={{ fontSize: 14 }}>Aquí verás lo que el servidor le contesta al EA: la configuración del gestor y los comandos pendientes.</p>}
        {out && (
          <pre style={{ ...box, fontSize: 12, lineHeight: 1.5, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 420, overflowY: 'auto', margin: 0 }}>{out}</pre>
        )}
        <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
          Qué mirar: <b>config</b> debe traer tus ajustes del Gestor (si es <b>null</b>, o el gestor está apagado o tu plan no lo incluye).
          <b> commands</b> debe traer lo que hayas encolado.
        </div>
      </div>
    </>
  );
}
