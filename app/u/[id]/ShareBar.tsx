'use client';
import { useState } from 'react';

// Barra de compartir del trackrecord público: copiar enlace + compartir nativo.
export default function ShareBar({ url, es }: { url: string; es: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch {}
  };
  const share = async () => {
    try { if ((navigator as any).share) await (navigator as any).share({ title: 'Onyx Trading', url }); else copy(); } catch {}
  };
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <button className="btn btn-ghost" onClick={copy} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>🔗 {copied ? (es ? '¡Copiado!' : 'Copied!') : (es ? 'Copiar enlace' : 'Copy link')}</button>
      <button className="btn btn-ghost" onClick={share} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>📤 {es ? 'Compartir' : 'Share'}</button>
    </div>
  );
}
