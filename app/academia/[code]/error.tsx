'use client';
import { useEffect } from 'react';
import Link from 'next/link';

// Red de seguridad de la ruta /academia/[code]: si ALGO lanza una excepción en
// el cliente, Next renderiza esto en vez de la pantalla cruda "Application error".
// El prospecto ve un mensaje amable + reintentar, nunca un pantallazo en blanco.
export default function AcademiaError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { try { console.error('academia error:', error); } catch {} }, [error]);
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
      <div style={{ maxWidth: 420, textAlign: 'center' }}>
        <img src="/onyx-symbol.png" alt="Onyx" style={{ width: 44, height: 44, objectFit: 'contain', marginBottom: 14 }} />
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>Ups, algo se atascó</h1>
        <p style={{ color: 'var(--mut)', fontSize: 14, marginBottom: 18, lineHeight: 1.55 }}>
          No pudimos cargar esta academia por un momento. Vuelve a intentarlo; casi siempre funciona a la segunda.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => reset()}>Reintentar</button>
          <Link className="btn btn-ghost" href="/">Ir al inicio</Link>
        </div>
      </div>
    </div>
  );
}
