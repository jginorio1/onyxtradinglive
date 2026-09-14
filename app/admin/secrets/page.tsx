'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

// SECCIÓN TEMPORAL — respaldo de claves. Solo el dueño (lo verifica la API).
// Para borrarla luego: elimina esta carpeta y app/api/admin/secrets/, y quita
// ENABLE_SECRETS_EXPORT de Vercel.
type Item = { name: string; set: boolean; hint: string };

export default function SecretsPage() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [exportEnabled, setExportEnabled] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch('/api/admin/secrets', { cache: 'no-store' })
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => { if (!ok) { setErr(j?.error || 'No autorizado'); return; } setItems(j.items || []); setExportEnabled(!!j.exportEnabled); })
      .catch(() => setErr('Error de red'));
  }, []);

  const setCount = (items || []).filter((i) => i.set).length;

  return (
    <div className="wrap" style={{ maxWidth: 820, padding: '28px 22px' }}>
      <div className="card" style={{ border: '1.5px solid var(--red)', background: 'color-mix(in srgb,var(--red) 8%,transparent)', marginBottom: 16 }}>
        <b style={{ color: 'var(--red)' }}>⚠ Sección temporal — bórrala al terminar</b>
        <p className="muted" style={{ fontSize: 13, margin: '6px 0 0', lineHeight: 1.6 }}>
          Guarda tu respaldo en un lugar seguro (gestor de contraseñas) y luego elimina esta sección.
          Para desactivar la descarga: quita <code>ENABLE_SECRETS_EXPORT</code> de Vercel.
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
                <h2 style={{ margin: 0, fontSize: 19 }}>Respaldo de claves</h2>
                <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{setCount} de {items.length} variables configuradas.</div>
              </div>
              {exportEnabled ? (
                <a className="btn btn-primary" href="/api/admin/secrets?mode=export" download>↓ Descargar backup (.env)</a>
              ) : (
                <span className="pill" style={{ background: 'color-mix(in srgb,var(--amber) 16%,transparent)', color: 'var(--amber)', fontSize: 12 }}>
                  Descarga apagada · pon ENABLE_SECRETS_EXPORT=1 en Vercel
                </span>
              )}
            </div>
          </div>

          <div className="card">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '2px 14px' }}>
              {items.map((i) => (
                <div key={i.name} style={{ display: 'contents' }}>
                  <div style={{ fontSize: 13, padding: '7px 0', borderTop: '1px solid var(--line)', color: 'var(--tx)', fontFamily: 'monospace', wordBreak: 'break-all' }}>{i.name}</div>
                  <div style={{ fontSize: 13, padding: '7px 0', borderTop: '1px solid var(--line)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {i.set
                      ? <span style={{ color: 'var(--green)' }}>✓ puesta <span className="muted" style={{ fontFamily: 'monospace' }}>{i.hint}</span></span>
                      : <span style={{ color: 'var(--mut)' }}>✗ falta</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <p style={{ marginTop: 18 }}><Link href="/admin" className="muted">← Volver al admin</Link></p>
    </div>
  );
}
