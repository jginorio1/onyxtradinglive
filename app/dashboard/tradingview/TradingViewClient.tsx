'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/lib/lang';
import { mkL } from '@/lib/i18n';

type Acc = {
  id: string; login: string; nickname: string | null; broker: string | null;
  tv_token: string | null; tv_enabled: boolean; tv_default_lot: number; tv_max_lot: number; tv_symbols: string[];
  copyKey: boolean; eaLive: boolean;
};
type Sig = { id: string; account_id: string; action: string; symbol: string; lots: number; status: string; error: string | null; created_at: string };

export default function TradingViewClient() {
  const { lang } = useLang();
  const L = mkL(lang);
  const [data, setData] = useState<{ allowed: boolean; accounts: Acc[]; signals: Sig[] } | null>(null);
  const [sel, setSel] = useState('');
  const [busy, setBusy] = useState('');
  const [copied, setCopied] = useState('');
  const [origin, setOrigin] = useState('');
  const [testMsg, setTestMsg] = useState('');

  const load = () => fetch('/api/tradingview').then((r) => r.json()).then((d) => {
    setData(d); setSel((p) => p || (d.accounts?.[0]?.id ?? ''));
  }).catch(() => setData({ allowed: false, accounts: [], signals: [] } as any));

  useEffect(() => { setOrigin(window.location.origin); load(); const iv = setInterval(load, 12000); return () => clearInterval(iv); }, []);

  const acc = useMemo(() => data?.accounts.find((a) => a.id === sel) || null, [data, sel]);
  const mySignals = useMemo(() => (data?.signals || []).filter((s) => s.account_id === sel), [data, sel]);

  async function patch(body: any) {
    setBusy(JSON.stringify(body).slice(0, 24));
    try {
      const r = await fetch('/api/tradingview', { method: 'PATCH', body: JSON.stringify({ accountId: sel, ...body }) });
      const j = await r.json();
      if (j.account) setData((d) => d ? { ...d, accounts: d.accounts.map((a) => a.id === j.account.id ? { ...a, ...j.account } : a) } : d);
    } finally { setBusy(''); }
  }
  async function sendTest() {
    setBusy('test'); setTestMsg('');
    try {
      const r = await fetch('/api/tradingview', { method: 'POST', body: JSON.stringify({ accountId: sel }) });
      const j = await r.json();
      setTestMsg(j.ok ? L(`Señal de prueba enviada (${j.symbol}). Míralo en tu MetaTrader y abajo.`, `Test signal sent (${j.symbol}). Watch your MetaTrader and below.`) : L('No se pudo enviar (cuenta en pausa).', 'Could not send (account paused).'));
      load();
    } finally { setBusy(''); }
  }
  const copy = (txt: string, key: string) => { navigator.clipboard?.writeText(txt); setCopied(key); setTimeout(() => setCopied(''), 1500); };

  const webhookUrl = acc?.tv_token ? `${origin}/api/tradingview/webhook?token=${acc.tv_token}` : '';
  const jsonTemplate = `{\n  "action": "{{strategy.order.action}}",\n  "symbol": "{{ticker}}",\n  "lots": 0.10\n}`;

  if (!data) return <div className="wrap" style={{ padding: 40 }}><p className="muted">…</p></div>;

  if (!data.allowed) {
    return (
      <div className="wrap" style={{ padding: '40px 22px', maxWidth: 640 }}>
        <h1 style={{ fontSize: 26 }}>📈 TradingView → Onyx</h1>
        <div className="card" style={{ marginTop: 18, padding: 24 }}>
          <p style={{ marginBottom: 12 }}>{L('Ejecuta tus alertas de TradingView directamente en tu cuenta real, a través de tu EA de Onyx.', 'Run your TradingView alerts straight into your real account through your Onyx EA.')}</p>
          <p className="muted" style={{ marginBottom: 18 }}>{L('Esta función está incluida en los planes de pago.', 'This feature is included in the paid plans.')}</p>
          <Link className="btn btn-primary" href="/pricing">{L('Ver planes', 'See plans')}</Link>
        </div>
      </div>
    );
  }
  if (!data.accounts.length) {
    return (
      <div className="wrap" style={{ padding: '40px 22px', maxWidth: 640 }}>
        <h1 style={{ fontSize: 26 }}>📈 TradingView → Onyx</h1>
        <div className="card" style={{ marginTop: 18, padding: 24 }}>
          <p>{L('Primero conecta una cuenta y ten el EA de Copy corriendo en ella.', 'First connect an account and have the Copy EA running on it.')}</p>
          <Link className="btn btn-primary" href="/dashboard/keys" style={{ marginTop: 14 }}>{L('Conectar cuenta', 'Connect account')}</Link>
        </div>
      </div>
    );
  }

  const accLabel = (a: Acc) => (a.nickname || a.broker || 'MT') + ' · ' + a.login;

  // Estado de cada paso
  const s1 = !!acc?.copyKey;
  const s2 = !!acc?.eaLive;
  const s3 = !!acc?.tv_enabled;
  const s4 = mySignals.length > 0;

  const Circle = ({ done, active, n, spin }: { done?: boolean; active?: boolean; n: number; spin?: boolean }) => (
    <div style={{ flex: 'none', width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700,
      background: done ? 'var(--green)' : active ? 'var(--brand)' : 'var(--bg2)', color: done || active ? '#fff' : 'var(--mut)', border: done || active ? 'none' : '1px solid var(--line)' }}>
      {done ? '✓' : spin ? '…' : n}
    </div>
  );
  const Step = ({ n, done, active, spin, title, sub, tint, children }: any) => (
    <div className="card" style={{ padding: 16, marginBottom: 10, display: 'flex', gap: 12, alignItems: 'flex-start',
      border: active ? '2px solid var(--brand)' : done ? '1px solid rgba(52,226,160,.4)' : '1px solid var(--line)',
      background: done && tint ? 'rgba(52,226,160,.07)' : undefined }}>
      <Circle done={done} active={active} n={n} spin={spin} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: done ? 'var(--green)' : 'var(--tx)' }}>{title}</div>
        {sub && <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>{sub}</div>}
        {children && <div style={{ marginTop: 12 }}>{children}</div>}
      </div>
    </div>
  );
  const LiveDot = () => <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--green)', background: 'rgba(52,226,160,.12)', border: '1px solid rgba(52,226,160,.4)', padding: '1px 8px', borderRadius: 20, marginLeft: 8 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)' }} />{L('en vivo', 'live')}</span>;

  return (
    <div className="wrap" style={{ padding: '32px 26px', maxWidth: 1180, fontSize: 15 }}>
      <h1 style={{ fontSize: 26, marginBottom: 4 }}>📈 TradingView → Onyx</h1>
      <p className="muted" style={{ marginBottom: 20 }}>{L('Conéctalo en 4 pasos. Cada paso se confirma solo.', 'Connect it in 4 steps. Each step confirms itself.')}</p>

      {data.accounts.length > 1 && (
        <div style={{ marginBottom: 16 }}>
          <span className="muted" style={{ fontSize: 13, marginRight: 8 }}>{L('Cuenta', 'Account')}:</span>
          <select value={sel} onChange={(e) => setSel(e.target.value)} style={{ padding: '6px 10px' }}>
            {data.accounts.map((a) => <option key={a.id} value={a.id}>{accLabel(a)}</option>)}
          </select>
        </div>
      )}

      {acc && (<>
        {/* Paso 1 */}
        <Step n={1} done={s1} tint title={s1 ? L('Cuenta conectada', 'Account connected') : L('Falta la clave de Copy', 'Missing Copy key')}
          sub={s1 ? `${accLabel(acc)} · ${L('clave de Copy activa', 'Copy key active')}` : L('Genera la clave de Copy de esta cuenta para poder ejecutar señales.', 'Create the Copy key for this account to execute signals.')}>
          {!s1 && <Link className="btn btn-ghost" href="/dashboard/copy">{L('Ir a Copy trading', 'Go to Copy trading')}</Link>}
        </Step>

        {/* Paso 2 */}
        <Step n={2} done={s2} tint active={s1 && !s2}
          title={<span>{s2 ? L('EA de Copy corriendo', 'Copy EA running') : L('El EA de Copy no reporta', 'Copy EA not reporting')}{s2 && <LiveDot />}</span>}
          sub={s2 ? L('OnyxCopySlave conectado hace segundos.', 'OnyxCopySlave connected seconds ago.') : L('Abre MetaTrader con esta cuenta y deja el EA OnyxCopySlave corriendo (AutoTrading ON).', 'Open MetaTrader on this account and keep the OnyxCopySlave EA running (AutoTrading ON).')}>
          {!s2 && <Link className="btn btn-ghost" href="/dashboard/copy">{L('Cómo instalar el EA', 'How to install the EA')}</Link>}
        </Step>

        {/* Paso 3 */}
        <Step n={3} done={s3} active={s2 && !s3} title={L('Activa y pega en TradingView', 'Enable and paste into TradingView')}
          sub={s3 ? L('Activado. Copia la URL y el mensaje en tu alerta.', 'Enabled. Copy the URL and message into your alert.') : L('Enciende TradingView para esta cuenta.', 'Turn TradingView on for this account.')}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button className={'btn ' + (s3 ? 'btn-ghost' : 'btn-primary')} style={{ alignSelf: 'flex-start' }} onClick={() => patch({ enabled: !s3 })} disabled={!!busy}>
              {s3 ? L('● Activado — desactivar', '● Enabled — turn off') : L('Activar TradingView', 'Enable TradingView')}
            </button>
            {s3 && (<>
              <div>
                <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{L('URL de webhook (Notificaciones → Webhook URL)', 'Webhook URL (Notifications → Webhook URL)')}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input readOnly value={webhookUrl} onFocus={(e) => e.target.select()} style={{ flex: 1, minWidth: 200, fontFamily: 'monospace', fontSize: 12 }} />
                  <button className="btn btn-ghost" onClick={() => copy(webhookUrl, 'url')}>{copied === 'url' ? L('✓', '✓') : L('Copiar', 'Copy')}</button>
                  <button className="btn btn-ghost" onClick={() => { if (confirm(L('¿Token nuevo? La URL anterior deja de servir.', 'New token? The old URL stops working.'))) patch({ action: 'rotate' }); }} disabled={!!busy}>{L('Rotar', 'Rotate')}</button>
                </div>
              </div>
              <div>
                <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{L('Mensaje de la alerta', 'Alert message')}</div>
                <pre style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: 10, fontSize: 12, overflow: 'auto', margin: 0 }}>{jsonTemplate}</pre>
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  <button className="btn btn-ghost" onClick={() => copy(jsonTemplate, 'json')}>{copied === 'json' ? L('✓ Copiado', '✓ Copied') : L('Copiar mensaje', 'Copy message')}</button>
                </div>
                <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>{L('Para cerrar: "action": "close".', 'To close: "action": "close".')}</p>
              </div>
              {/* Riesgo */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
                <div><div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{L('Lote por defecto', 'Default lot')}</div>
                  <input type="number" step="0.01" min="0.01" defaultValue={acc.tv_default_lot} onBlur={(e) => patch({ default_lot: Number(e.target.value) })} style={{ width: '100%' }} /></div>
                <div><div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{L('Lote máx (0=sin tope)', 'Max lot (0=no cap)')}</div>
                  <input type="number" step="0.01" min="0" defaultValue={acc.tv_max_lot} onBlur={(e) => patch({ max_lot: Number(e.target.value) })} style={{ width: '100%' }} /></div>
                <div><div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{L('Símbolos (coma, vacío=todos)', 'Symbols (comma, empty=all)')}</div>
                  <input defaultValue={(acc.tv_symbols || []).join(', ')} onBlur={(e) => patch({ symbols: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} placeholder="EURUSD, XAUUSD" style={{ width: '100%' }} /></div>
              </div>
            </>)}
          </div>
        </Step>

        {/* Paso 4 */}
        <Step n={4} done={s4} spin={s3 && !s4} active={s3 && !s4}
          title={s4 ? L('¡Recibiendo señales!', 'Receiving signals!') : L('Esperando tu primera señal…', 'Waiting for your first signal…')}
          sub={s4 ? L('Tu conexión funciona. Aquí verás cada señal que llegue.', 'Your connection works. Every incoming signal shows here.') : L('Dispara una alerta en TradingView, o envía una prueba aquí.', 'Fire an alert in TradingView, or send a test here.')}>
          <div>
            <button className="btn btn-ghost" onClick={sendTest} disabled={!!busy || !s2} title={!s2 ? L('Necesitas el EA corriendo', 'You need the EA running') : ''}>
              {busy === 'test' ? L('Enviando…', 'Sending…') : L('Enviar señal de prueba (0.01)', 'Send test signal (0.01)')}
            </button>
            {testMsg && <p className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>{testMsg}</p>}
            {!s2 && <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>⚠️ {L('El EA de Copy debe estar corriendo para probar.', 'The Copy EA must be running to test.')}</p>}
          </div>
        </Step>

        {/* Log */}
        {!!mySignals.length && (
          <div className="card" style={{ padding: 18, marginTop: 6 }}>
            <b style={{ fontSize: 14 }}>{L('Últimas señales', 'Recent signals')}</b>
            <div style={{ marginTop: 10, overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                <thead><tr style={{ color: 'var(--mut)', textAlign: 'left' }}><th style={{ padding: '5px 8px' }}>{L('Hora', 'Time')}</th><th>{L('Acción', 'Action')}</th><th>{L('Símbolo', 'Symbol')}</th><th>{L('Lote', 'Lot')}</th><th>{L('Estado', 'Status')}</th></tr></thead>
                <tbody>{mySignals.map((s) => (
                  <tr key={s.id} style={{ borderTop: '1px solid var(--line)' }}>
                    <td style={{ padding: '5px 8px' }} className="muted">{new Date(s.created_at).toLocaleString(lang === 'es' ? 'es-ES' : 'en-US', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                    <td style={{ textTransform: 'uppercase' }}>{s.action}</td><td>{s.symbol || '—'}</td><td>{s.lots || '—'}</td>
                    <td style={{ color: s.status === 'queued' ? 'var(--green)' : 'var(--amber)' }}>{s.status === 'queued' ? L('En cola', 'Queued') : (L('Rechazada', 'Rejected') + (s.error ? ` (${s.error})` : ''))}</td>
                  </tr>))}</tbody>
              </table>
            </div>
          </div>
        )}

        <p className="muted" style={{ fontSize: 12, marginTop: 14 }}>🛡️ {L('Onyx Guardian (opcional) sigue vigilando: si tu pérdida diaria está alcanzada, el EA no abrirá aunque llegue la señal.', 'Onyx Guardian (optional) still watches: if your daily loss is hit, the EA won\'t open even if a signal arrives.')}</p>
      </>)}
    </div>
  );
}
