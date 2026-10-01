'use client';
import { useLang } from '@/lib/lang';

// Página 404 GLOBAL. Next.js la muestra automáticamente en CUALQUIER ruta que no
// exista, así ningún enlace roto (presente o futuro) deja al usuario atrapado en el
// 404 pelado. Da dos salidas claras: ir al panel y volver atrás.
export default function NotFound() {
  const { lang } = useLang();
  const es = lang !== 'en';
  return (
    <div className="wrap" style={{ padding: '72px 22px 90px', textAlign: 'center', maxWidth: 520, margin: '0 auto' }}>
      <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--bg2)', border: '1px solid var(--line)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, fontSize: 26 }}>🧭</div>
      <div style={{ fontSize: 40, fontWeight: 800, lineHeight: 1 }}>404</div>
      <h1 style={{ fontSize: 18, margin: '12px 0 0' }}>{es ? 'Esta página no existe o se movió' : 'This page doesn’t exist or moved'}</h1>
      <p className="muted" style={{ fontSize: 14, margin: '10px auto 0', maxWidth: 400, lineHeight: 1.6 }}>
        {es ? 'El enlace que seguiste no lleva a ningún lado. Vuelve y sigue donde estabas.' : 'The link you followed doesn’t go anywhere. Head back and continue where you were.'}
      </p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 26, flexWrap: 'wrap' }}>
        <a href="/dashboard" className="btn btn-primary">{es ? 'Ir al panel' : 'Go to dashboard'}</a>
        <a
          className="btn btn-ghost"
          style={{ cursor: 'pointer' }}
          onClick={(e) => { e.preventDefault(); if (typeof window !== 'undefined' && window.history.length > 1) window.history.back(); else window.location.href = '/'; }}
        >{es ? '← Volver atrás' : '← Go back'}</a>
      </div>
    </div>
  );
}
