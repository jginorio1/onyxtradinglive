'use client';
import React from 'react';

const TRACK = '#232a3d';

// Anillo / gauge circular con texto central
export function Ring({ pct, color, value, size = 92, stroke = 10 }: { pct: number; color: string; value: string; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2 - 1;
  const C = 2 * Math.PI * r;
  const dash = Math.max(0, Math.min(1, pct)) * C;
  const c = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={c} cy={c} r={r} fill="none" stroke={TRACK} strokeWidth={stroke} />
      <circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${dash} ${C - dash}`} transform={`rotate(-90 ${c} ${c})`} style={{ transition: 'stroke-dasharray .8s ease' }} />
      <text x={c} y={c + size * 0.075} textAnchor="middle" fill="#f2f5fb" fontSize={size * 0.24} fontWeight="800">{value}</text>
    </svg>
  );
}

// Sparkline con área degradada
export function MiniArea({ points, color = '#34e2a0', w = 120, h = 46 }: { points: number[]; color?: string; w?: number; h?: number }) {
  if (!points.length) return <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} />;
  const min = Math.min(...points), max = Math.max(...points), rng = (max - min) || 1;
  const pts = points.map((v, i) => [(i / (points.length - 1 || 1)) * w, h - 4 - ((v - min) / rng) * (h - 8)]);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const id = 'ma' + Math.random().toString(36).slice(2, 7);
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity="0.45" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <path d={`${line} L${w},${h} L0,${h} Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" />
    </svg>
  );
}

// Donut de segmentos
export function MiniDonut({ segs, size = 84 }: { segs: { v: number; c: string }[]; size?: number }) {
  const total = segs.reduce((s, x) => s + x.v, 0) || 1;
  const r = size / 2 - 8, C = 2 * Math.PI * r, c = size / 2; let acc = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={c} cy={c} r={r} fill="none" stroke={TRACK} strokeWidth={12} />
      {segs.map((s, i) => { const frac = s.v / total; const dash = frac * C; const el = <circle key={i} cx={c} cy={c} r={r} fill="none" stroke={s.c} strokeWidth={12} strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-acc * C} transform={`rotate(-90 ${c} ${c})`} />; acc += frac; return el; })}
    </svg>
  );
}

// Barras verticales
export function MiniBars({ vals, colors, h = 60 }: { vals: number[]; colors: string[]; h?: number }) {
  const max = Math.max(1, ...vals.map((v) => Math.abs(v)));
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: h }}>
      {vals.map((v, i) => <div key={i} style={{ flex: 1, height: `${Math.max(8, (Math.abs(v) / max) * 100)}%`, borderRadius: '5px 5px 0 0', background: colors[i % colors.length] }} />)}
    </div>
  );
}

// Mini mapa de calor (grid de celdas con intensidad por valor -1..1)
export function MiniHeat({ cells, cols = 7 }: { cells: number[]; cols?: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols},1fr)`, gap: 3 }}>
      {cells.map((v, i) => { const a = Math.min(1, Math.abs(v)); const bg = v === 0 ? TRACK : v > 0 ? `rgba(52,226,160,${.25 + a * .6})` : `rgba(255,107,125,${.25 + a * .6})`; return <div key={i} style={{ height: 15, borderRadius: 3, background: bg }} />; })}
    </div>
  );
}

// Radar (valores 0..1)
export function MiniRadar({ vals, size = 92, color = '#7c8cff' }: { vals: number[]; size?: number; color?: string }) {
  const n = vals.length, c = size / 2, R = size / 2 - 8;
  const pt = (i: number, r: number) => { const ang = -Math.PI / 2 + (i / n) * 2 * Math.PI; return [c + Math.cos(ang) * r, c + Math.sin(ang) * r]; };
  const grid = vals.map((_, i) => pt(i, R));
  const poly = vals.map((v, i) => pt(i, R * Math.max(0.05, Math.min(1, v))));
  const toStr = (a: number[][]) => a.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <polygon points={toStr(grid)} fill="none" stroke="#2a3346" strokeWidth="1" />
      <polygon points={toStr(grid.map((_, i) => pt(i, R * 0.5)))} fill="none" stroke="#2a3346" strokeWidth="0.5" />
      <polygon points={toStr(poly)} fill={color + '44'} stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

// Puntuación de salud 0-100 a partir del análisis
export function healthScore(a: { winRate: number; profitFactor: number; payoff: number }) {
  const wr = a.winRate;
  const pf = Math.min(a.profitFactor, 2.5) / 2.5 * 100;
  const po = Math.min(a.payoff, 2) / 2 * 100;
  const s = Math.max(0, Math.min(100, Math.round(0.35 * wr + 0.4 * pf + 0.25 * po)));
  const color = s >= 70 ? '#34e2a0' : s >= 45 ? '#ffd45e' : '#ff6b7d';
  return { score: s, color };
}
