'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/lib/lang';
import { mkL } from '@/lib/i18n';

type Acc = {
  id: string; login: string; nickname: string | null; broker: string | null;
  tv_token: string | null; tv_enabled: boolean; tv_default_lot: number; tv_max_lot: number; tv_symbols: string[];
};
type Sig = { id: string; account_id: string; action: string; symbol: string; lots: number; sl: number | null; tp: number | null; status: string; error: string | null; created_at: string };

export default function TradingViewClient() {
  const { lang } = useLang();
  const L = mkL(lang);
  const [data, setData] = useState<{ allowed: boolean; plan: string; accounts: Acc[]; signals: Sig[] } | null>(null);
  const [sel, setSel] = useState<string>('');
  const [busy, setBusy] = useState('');
  const [copied, setCopied] = useState('');
  const [origin, setOrigin] = useState('');

  const load = () => fetch('/api/tradingview').then((r) => r.json()).then((d) => {
    setData(d);
    setSel((prev) => prev || (d.accounts?.[0]?.id ?? ''));
  }).catch(() => setData({ allowed: false, plan: '', accounts: [], signals: [] } as any));

  useEffect(() => { setOrigin(window.location.origin); load(); const iv = setInterval(load, 15000); return () => clearInterval(iv); }, []);

  const acc = useMemo(() => data?.accounts.find((a) => a.id === sel) || null, [data, sel]);

  async function patch(body: any) {
    setBusy(JSON.stringify(body).slice(0, 20));
    try {
      const r = await fetch('/api/tradingview', { method: 'PATCH', body: JSON.stringify({ accountId: sel, ...body }) });
      const j = await r.json();
      if (j.account) setData((d) => d ? { ...d, accounts: d.accounts.map((a) => a.id === j.account.id ? j.account : a) } : d);
    } finally { setBusy(''); }
  }
  const copy = (txt: string, key: string) => { navigator.clipboard?.writeText(txt); setCopied(key); setTimeout(() => setCopied(''), 1500); };

  const webhookUrl = acc?.tv_token ? `${origin}/api/tradingview/webhook?token=${acc.tv_token}` : '';
  const jsonTemplate = `{
  "action": "{{strategy.order.action}}",
  "symbol": "{{ticker}}",
  "lots": 0.10
}`;

  if (!data) return <div className="wrap" style={{ padding: 40 }}><p className="muted">…</p></div>;

  // Sin plan → upsell
  if (!data.allowed) {
    return (
      <div className="wrap" style={{ padding: '40px 22px', maxWidth: 640 }}>
        <h1 style={{ fontSize: 26 }}>📈 TradingView → Onyx</h1>
        <div className="card" style={{ marginTop: 18, padding: 24 }}>
          <p style={{ marginBottom: 12 }}>{L('Ejecuta tus alertas de TradingView directamente en tu cuenta real, a través de tu EA de Onyx. Sin copiar y pegar órdenes a mano.', 'Run your TradingView alerts straight into your real account through your Onyx EA. No manual order copying.')}</p>
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
          <p>{L('Primero conecta una cuenta y ten el EA de Copy corriendo en ella. Las señales de TradingView se ejecutan con ese mismo EA.', 'First connect an account and have the Copy EA running on it. TradingView signals execute with that same EA.')}</p>
          <Link className="btn btn-primary" href="/dashboard/keys" style={{ marginTop: 14 }}>{L('Conectar cuenta', 'Connect account')}</Link>
        </div>
      </div>
    );
  }

  const accLabel = (a: Acc) => (a.nickname || a.broker || 'MT') + ' · ' + a.login;

  return (
    <div className="wrap" style={{ padding: '32px 22px', maxWidth: 860 }}>
      <h1 style={{ fontSize: 26, marginBottom: 4 }}>📈 TradingView → Onyx</h1>
      <p className="muted" style={{ marginBottom: 22 }}>{L('Tus alertas de TradingView se ejecutan en tu cuenta real usando el EA de Copy que ya tienes instalado.', 'Your TradingView alerts execute in your real account using the Copy EA you already have installed.')}</p>

      {/* Selector de cuenta */}
      {data.accounts.length > 1 && (
        <div style={{ marginBottom: 18 }}>
          <span className="muted" style={{ fontSize: 13, marginRight: 8 }}>{L('Cuenta', 'Account')}:</span>
          <select value={sel} onChange={(e) => setSel(e.target.value)} style={{ padding: '6px 10px' }}>
            {data.accounts.map((a) => <option key={a.id} value={a.id}>{accLabel(a)}</option>)}
          </select>
        </div>
      )}

      {acc && (
        <>
          {/* Encendido + estado */}
          <div className="card" style={{ padding: 20, marginBottom: 16 }}>
            <div className="row between" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <b style={{ fontSize: 16 }}>{L('Señales de TradingView', 'TradingView signals')}</b>
                <div className="muted" style={{ fontSize: 13, marginTop: 3 }}>{accLabel(acc)}</div>
              </div>
              <button className={'btn ' + (acc.tv_enabled ? 'btn-primary' : 'btn-ghost')} onClick={() => patch({ enabled: !acc.tv_enabled })} disabled={!!busy}>
                {acc.tv_enabled ? L('● Activado', '● Enabled') : L('Activar', 'Enable')}
              </button>
            </div>
          </div>

          {/* URL del webhook + token */}
          <div className="card" style={{ padding: 20, marginBottom: 16 }}>
            <b>{L('1. Tu URL de webhook', '1. Your webhook URL')}</b>
            <p className="muted" style={{ fontSize: 13, margin: '6px 0 10px' }}>{L('Pégala en la alerta de TradingView, en "Notificaciones → Webhook URL".', 'Paste it into your TradingView alert, under "Notifications → Webhook URL".')}</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input readOnly value={webhookUrl} onFocus={(e) => e.target.select()} style={{ flex: 1, minWidth: 220, fontFamily: 'monospace', fontSize: 12.5 }} />
              <button className="btn btn-ghost" onClick={() => copy(webhookUrl, 'url')}>{copied === 'url' ? L('✓ Copiado', '✓ Copied') : L('Copiar', 'Copy')}</button>
              <button className="btn btn-ghost" onClick={() => { if (confirm(L('¿Generar un token nuevo? La URL anterior dejará de funcionar.', 'Generate a new token? The old URL will stop working.'))) patch({ action: 'rotate' }); }} disabled={!!busy}>{L('Rotar token', 'Rotate token')}</button>
            </div>
          </div>

          {/* Mensaje de la alerta (JSON) */}
          <div className="card" style={{ padding: 20, marginBottom: 16 }}>
            <b>{L('2. Mensaje de la alerta', '2. Alert message')}</b>
            <p className="muted" style={{ fontSize: 13, margin: '6px 0 10px' }}>{L('Pega esto en el campo "Mensaje" de la alerta. TradingView rellena la acción y el símbolo solos.', 'Paste this into the alert "Message" field. TradingView fills the action and symbol automatically.')}</p>
            <pre style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: 12, fontSize: 12.5, overflow: 'auto', margin: 0 }}>{jsonTemplate}</pre>
            <button className="btn btn-ghost" style={{ marginTop: 10 }} onClick={() => copy(jsonTemplate, 'json')}>{copied === 'json' ? L('✓ Copiado', '✓ Copied') : L('Copiar mensaje', 'Copy message')}</button>
            <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>{L('Para cerrar: usa "action": "close". Puedes fijar el lote en el mensaje o dejar el lote por defecto de abajo.', 'To close: use "action": "close". You can set the lot in the message or leave the default lot below.')}</p>
          </div>

          {/* Controles de riesgo */}
          <div className="card" style={{ padding: 20, marginBottom: 16 }}>
            <b>{L('3. Riesgo', '3. Risk')}</b>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginTop: 12 }}>
              <div>
                <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{L('Lote por defecto', 'Default lot')}</div>
                <input type="number" step="0.01" min="0.01" defaultValue={acc.tv_default_lot} onBlur={(e) => patch({ default_lot: Number(e.target.value) })} style={{ width: '100%' }} />
              </div>
              <div>
                <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{L('Lote máximo (0 = sin tope)', 'Max lot (0 = no cap)')}</div>
                <input type="number" step="0.01" min="0" defaultValue={acc.tv_max_lot} onBlur={(e) => patch({ max_lot: Number(e.target.value) })} style={{ width: '100%' }} />
              </div>
              <div>
                <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{L('Símbolos permitidos (coma, vacío = todos)', 'Allowed symbols (comma, empty = all)')}</div>
                <input defaultValue={(acc.tv_symbols || []).join(', ')} onBlur={(e) => patch({ symbols: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} placeholder="EURUSD, XAUUSD" style={{ width: '100%' }} />
              </div>
            </div>
            <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>🛡️ {L('Onyx Guardian sigue vigilando esta cuenta: si tu límite de pérdida diaria está alcanzado, el EA no abrirá aunque llegue la señal.', 'Onyx Guardian still watches this account: if your daily loss limit is hit, the EA won\'t open even if a signal arrives.')}</p>
          </div>

          {/* Historial de señales */}
          <div className="card" style={{ padding: 20 }}>
            <b>{L('Últimas señales', 'Recent signals')}</b>
            {!data.signals.filter((s) => s.account_id === sel).length ? (
              <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>{L('Aún no ha llegado ninguna señal. Cuando dispares una alerta en TradingView, aparecerá aquí.', 'No signals yet. When you fire a TradingView alert, it shows up here.')}</p>
            ) : (
              <div style={{ marginTop: 12, overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                  <thead><tr style={{ color: 'var(--mut)', textAlign: 'left' }}>
                    <th style={{ padding: '6px 8px' }}>{L('Hora', 'Time')}</th><th>{L('Acción', 'Action')}</th><th>{L('Símbolo', 'Symbol')}</th><th>{L('Lote', 'Lot')}</th><th>{L('Estado', 'Status')}</th>
                  </tr></thead>
                  <tbody>
                    {data.signals.filter((s) => s.account_id === sel).map((s) => (
                      <tr key={s.id} style={{ borderTop: '1px solid var(--line)' }}>
                        <td style={{ padding: '6px 8px' }} className="muted">{new Date(s.created_at).toLocaleString(lang === 'es' ? 'es-ES' : 'en-US', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                        <td style={{ textTransform: 'uppercase' }}>{s.action}</td>
                        <td>{s.symbol || '—'}</td>
                        <td>{s.lots || '—'}</td>
                        <td style={{ color: s.status === 'queued' ? 'var(--green)' : 'var(--amber)' }}>{s.status === 'queued' ? L('En cola', 'Queued') : (L('Rechazada', 'Rejected') + (s.error ? ` (${s.error})` : ''))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
