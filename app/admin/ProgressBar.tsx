'use client';
import React from 'react';

// Verde lima con brillo — barra de progreso moderna para todo lo que "analiza".
export const LIME = '#84e51b';

export function ProgressBar({ p, label, height = 12 }: { p: number; label?: string; height?: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(p * 100)));
  return (
    <div style={{ width: '100%' }}>
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
          <span style={{ color: LIME, fontWeight: 700 }}>{label}</span>
          <span style={{ color: LIME, fontWeight: 800, fontFamily: 'monospace' }}>{pct}%</span>
        </div>
      )}
      <div style={{ position: 'relative', height, borderRadius: 99, background: 'color-mix(in srgb,var(--line) 70%,transparent)', overflow: 'hidden', border: '1px solid color-mix(in srgb,#000 12%,transparent)' }}>
        <div style={{ position: 'absolute', inset: 0, width: pct + '%', borderRadius: 99, background: `linear-gradient(90deg,#5bbf0e,${LIME} 60%,#b6ff4d)`, boxShadow: `0 0 10px ${LIME}, 0 0 20px color-mix(in srgb,${LIME} 60%,transparent)`, transition: 'width .25s ease' }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: 99, background: 'linear-gradient(90deg,transparent, rgba(255,255,255,.55), transparent)', animation: 'onyxshine 1.1s linear infinite' }} />
        </div>
      </div>
      <style>{`@keyframes onyxshine{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}`}</style>
    </div>
  );
}

// Barra indeterminada (cuando no hay % pero está trabajando).
export function ProgressBarIndeterminate({ label, height = 12 }: { label?: string; height?: number }) {
  return (
    <div style={{ width: '100%' }}>
      {label && <div style={{ fontSize: 12, marginBottom: 5, color: LIME, fontWeight: 700 }}>{label}</div>}
      <div style={{ position: 'relative', height, borderRadius: 99, background: 'color-mix(in srgb,var(--line) 70%,transparent)', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, bottom: 0, width: '40%', borderRadius: 99, background: `linear-gradient(90deg,transparent,${LIME},transparent)`, boxShadow: `0 0 12px ${LIME}`, animation: 'onyxsweep 1.1s ease-in-out infinite' }} />
      </div>
      <style>{`@keyframes onyxsweep{0%{left:-40%}100%{left:100%}}`}</style>
    </div>
  );
}
