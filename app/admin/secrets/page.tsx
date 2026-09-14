'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

// Bóveda de claves — API keys, webhook secrets y variables. Solo el dueño (lo
// verifica la API). Para borrarla luego: elimina esta carpeta y app/api/admin/secrets/.
type Item = { name: string; set: boolean; hint?: string; value?: string };

export default function SecretsPage() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState('');
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');

  const load = (mode: 'status' | 'reveal') => {
    setLoading(true); setErr('');
    fetch('/api/admin/secrets?mode=' + mode, { cache: 'no-store' })
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (!ok) { setErr(j?.error || 'No autorizado'); return; }
        setItems(j.items || []); setRevealed(mode === 'reveal');
      })
      .catch(() => setErr('Error de red'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load('status'); }, []);

  const copy = (name: string, value: string) => {
    try { navigator.clipboard.writeText(value); setCopied(name); setTimeout(() => setCopied(''), 1200); } catch {}
  };
  const copyAll = () => {
    const body = (items || []).filter((i) => i.set && i.value).map((i) => `${i.name}=${i.value}`).join('\n');
    if (body) copy('__all__', body);
  };

  const list = (items || []).filter((i) => !q || i.name.toLowerCase().includes(q.toLowerCase()));
  const setCount = (items || []).filter((i) => i.set).length;

  return (
    <div className="wrap" style={{ maxWidth: 900, padding: '28px 22px' }}>
      <div className="card" style={{ border: '1.5px solid var(--amber)', background: 'color-mix(in srgb,var(--amber) 8%,transparent)', marginBottom: 16 }}>
        <b style={{ color: 'var(--amber)' }}>🔐 Bóveda de claves — solo el dueño</b>
        <p className="muted" style={{ fontSize: 13, margin: '6px 0 0', lineHeight: 1.6 }}>
          Aquí están TODAS las API keys, webhook secrets y variables de la app con su valor real.
          No compartas esta pantalla ni el archivo descargado. Guárdalo en tu gestor de contraseñas.
        </p>
      </div>

      {err ? (
        <div className="card" style={{ color: 'var(--red)' }}>{err}</div>
      ) : !items ? (
        <div className="card muted">Cargando…</div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="row between" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 19 }}>Variables y secretos</h2>
                <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{setCount} de {items.length} configuradas.</div>
              </div>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                {revealed ? (
                  <button className="btn" onClick={() => load('status')}>🙈 Ocultar valores</button>
                ) : (
                  <button className="btn btn-primary" onClick={() => load('reveal')} disabled={loading}>{loading ? 'Cargando…' : '👁 Revelar valores'}</button>
                )}
                {revealed && <button className="btn" onClick={copyAll}>{copied === '__all__' ? '✓ Copiado' : '⧉ Copiar todo (.env)'}</button>}
                <a className="btn" href="/api/admin/secrets?mode=export" download>↓ Descargar .env</a>
              </div>
            </div>
            <input
              value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar variable…"
              style={{ marginTop: 12, width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--tx)', fontSize: 13 }}
            />
          </div>

          <div className="card" style={{ padding: 0 }}>
            {list.map((i, idx) => (
              <div key={i.name} style={{ display: 'grid', gridTemplateColumns: 'minmax(180px,1fr) 2fr auto', gap: 10, alignItems: 'center', padding: '9px 14px', borderTop: idx ? '1px solid var(--line)' : 'none' }}>
                <div style={{ fontSize: 12.5, fontFamily: 'monospace', color: 'var(--tx)', wordBreak: 'break-all' }}>{i.name}</div>
                <div style={{ fontSize: 12.5, fontFamily: 'monospace', wordBreak: 'break-all', color: i.set ? 'var(--tx)' : 'var(--mut)' }}>
                  {!i.set ? <span style={{ color: 'var(--mut)' }}>✗ falta</span>
                    : revealed ? (i.value || '')
                    : <span style={{ color: 'var(--green)' }}>✓ ••••{(i.hint || '').replace(/•/g, '')}</span>}
                </div>
                <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {revealed && i.set && i.value
                    ? <button className="btn" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => copy(i.name, i.value!)}>{copied === i.name ? '✓' : '⧉'}</button>
                    : null}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <p style={{ marginTop: 18 }}><Link href="/admin" className="muted">← Volver al admin</Link></p>
    </div>
  );
}
