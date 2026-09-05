'use client';
import { useEffect } from 'react';
import Link from 'next/link';

// Red de seguridad GLOBAL: cualquier excepción de cliente en una página muestra
// esto (mensaje amable + reintentar) en vez de la pantalla cruda de Next.
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { try { console.error('app error:', error); } catch {} }, [error]);
  return (
    <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
      <div style={{ maxWidth: 420, textAlign: 'center' }}>
        <img src="/onyx-symbol.png" alt="Onyx" style={{ width: 44, height: 44, objectFit: 'contain', marginBottom: 14 }} />
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>Algo salió mal</h1>
        <p style={{ color: 'var(--mut)', fontSize: 14, marginBottom: 18, lineHeight: 1.55 }}>
          Tuvimos un problema al cargar esta página. Inténtalo de nuevo.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => reset()}>Reintentar</button>
          <Link className="btn btn-ghost" href="/">Ir al inicio</Link>
        </div>
      </div>
    </div>
  );
}
