'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

export default function KeysPage() {
  const sb = supabaseBrowser();
  const [keys, setKeys] = useState<any[]>([]);
  const [newKey, setNewKey] = useState('');
  const [loading, setLoading] = useState(false);
  const apiUrl = (process.env.NEXT_PUBLIC_APP_URL || '') + '/api/v1/sync';

  async function load() {
    const { data } = await sb.from('api_keys').select('*').order('created_at', { ascending: false });
    setKeys(data || []);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    setLoading(true); setNewKey('');
    const r = await fetch('/api/keys', { method: 'POST', body: JSON.stringify({ label: 'Mi cuenta MT' }) });
    const j = await r.json();
    if (j.key) setNewKey(j.key);
    await load(); setLoading(false);
  }
  async function revoke(id: string) {
    await fetch('/api/keys', { method: 'PATCH', body: JSON.stringify({ id }) });
    await load();
  }

  return (
    <>
      <div className="topbar"><div className="wrap">
        <div className="logo"><span className="mark">◆</span> Onyx</div>
        <div className="navl"><Link href="/dashboard">Dashboard</Link><Link href="/dashboard/keys">Conectar cuenta</Link><Link href="/pricing">Plan</Link></div>
        <form action="/auth/signout" method="post"><button className="btn btn-ghost">Salir</button></form>
      </div></div>

      <div className="wrap" style={{ padding: '28px 22px', maxWidth: 820 }}>
        <h1>Conectar tu cuenta MT4/MT5</h1>
        <p className="muted" style={{ margin: '8px 0 22px' }}>Genera una API key, ponla en el Onyx Connector y tus operaciones aparecerán solas.</p>

        <div className="card" style={{ marginBottom: 20 }}>
          <h3>1 · Genera tu API key</h3>
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={create} disabled={loading}>
            {loading ? '...' : '+ Nueva API key'}
          </button>
          {newKey && (
            <div style={{ marginTop: 14 }}>
              <p className="muted" style={{ fontSize: 13 }}>Cópiala ahora (solo se muestra una vez de forma destacada):</p>
              <div className="code" style={{ display: 'inline-block', marginTop: 6 }}>{newKey}</div>
            </div>
          )}
        </div>

        <div className="card" style={{ marginBottom: 20 }}>
          <h3>2 · Configura el Onyx Connector en MT4/MT5</h3>
          <p className="muted" style={{ marginTop: 10 }}>En los inputs del EA:</p>
          <ul style={{ margin: '10px 0 0 18px', color: 'var(--mut)', fontSize: 14 }}>
            <li><b>InpApiUrl</b> = <span className="code">{apiUrl}</span></li>
            <li><b>InpApiKey</b> = tu API key</li>
          </ul>
          <p className="muted" style={{ marginTop: 10, fontSize: 14 }}>Y en MT4/MT5 → Herramientas → Opciones → Asesores → permite WebRequest para tu dominio.</p>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 10 }}>Tus API keys</h3>
          {keys.length ? (
            <table>
              <thead><tr><th>Key</th><th>Etiqueta</th><th>Estado</th><th></th></tr></thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id}>
                    <td className="code">{k.key.slice(0, 14)}…</td>
                    <td className="muted">{k.label}</td>
                    <td>{k.revoked ? <span className="pill">revocada</span> : <span className="pill green">activa</span>}</td>
                    <td style={{ textAlign: 'right' }}>{!k.revoked && <button className="btn btn-danger" onClick={() => revoke(k.id)}>Revocar</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="muted">Aún no tienes API keys.</p>}
        </div>
      </div>
    </>
  );
}
