'use client';
import React from 'react';

// ============================================================
// HubVitals — cabecera del dashboard rediseñada.
// Anillos grandes "encendidos" (neón) con color semáforo + cuadrícula de
// mosaicos por sección, fáciles de escanear y tocar. Todo con las variables
// de tema (funciona claro/oscuro).
// ============================================================

export type Vital = { pct: number; color: string; value: string; label: string };
export type Tile = { key: string; icon: string; label: string; metric?: string; mc?: string; color: string; onClick: () => void; badge?: React.ReactNode };

function GlowRing({ v }: { v: Vital }) {
  const size = 96; const r = size / 2 - 9; const c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(1, v.pct)));
  const mix = (p: number) => `color-mix(in srgb, ${v.color} ${p}%, transparent)`;
  return (
    <div style={{ background: 'var(--bg2)', borderRadius: 16, padding: '14px 6px 12px', textAlign: 'center', boxShadow: `inset 0 0 0 1px ${mix(30)}` }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ filter: `drop-shadow(0 0 6px ${mix(70)})` }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth="9" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={v.color} strokeWidth="9" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize={v.value.length > 4 ? 16 : 20} fontWeight="800" fill={v.color}>{v.value}</text>
      </svg>
      <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{v.label}</div>
    </div>
  );
}

export default function HubVitals({ net, netPos, netLabel, vitals, tiles }: {
  net: string; netPos: boolean; netLabel: string; vitals: Vital[]; tiles: Tile[];
}) {
  const netColor = netPos ? 'var(--green)' : 'var(--red)';
  return (
    <div>
      <style>{`
        .hv-tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:11px}
        @media(max-width:900px){.hv-tiles{grid-template-columns:repeat(3,1fr)}}
        @media(max-width:560px){.hv-tiles{grid-template-columns:repeat(2,1fr)}}
        .hv-vitals{display:grid;grid-template-columns:repeat(4,1fr);gap:11px;margin-bottom:14px}
        @media(max-width:560px){.hv-vitals{grid-template-columns:repeat(2,1fr)}}
        .navtile{position:relative;cursor:pointer;text-align:left;background:var(--card);border:1px solid var(--line);
          border-top:2px solid var(--tc);border-radius:13px;padding:13px 13px 14px;transition:box-shadow .18s,transform .12s;overflow:hidden}
        .navtile:hover{box-shadow:0 0 0 1px var(--tc),0 0 22px -4px color-mix(in srgb,var(--tc) 65%,transparent);transform:translateY(-2px)}
        .navtile:active{transform:translateY(0)}
        .navtile-ic{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;font-size:18px;color:var(--tc);
          background:color-mix(in srgb,var(--tc) 20%,transparent);filter:drop-shadow(0 0 5px color-mix(in srgb,var(--tc) 55%,transparent))}
      `}</style>

      {/* Titular: resultado del periodo, grande y encendido */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <span className="muted" style={{ fontSize: 13 }}>{netLabel}</span>
        <span style={{ fontSize: 30, fontWeight: 800, color: netColor, textShadow: `0 0 18px ${netPos ? 'rgba(52,226,160,.55)' : 'rgba(255,107,125,.55)'}` }}>{net}</span>
      </div>

      {/* Anillos vitales */}
      <div className="hv-vitals">
        {vitals.map((v, i) => <GlowRing key={i} v={v} />)}
      </div>

      {/* Mosaicos de navegación */}
      <div className="hv-tiles">
        {tiles.map((t) => (
          <button key={t.key} onClick={t.onClick} className="navtile" style={{ ['--tc' as any]: t.color }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="navtile-ic">{t.icon}</span>
              {t.badge ? t.badge : <span style={{ color: 'var(--mut)', fontSize: 15 }}>→</span>}
            </div>
            <div style={{ fontSize: 13.5, color: 'var(--tx)', marginTop: 9, fontWeight: 600 }}>{t.label}</div>
            {t.metric ? <div style={{ fontSize: 16, fontWeight: 800, color: t.mc || 'var(--tx)', marginTop: 1 }}>{t.metric}</div> : null}
          </button>
        ))}
      </div>
    </div>
  );
}
