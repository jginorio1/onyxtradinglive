'use client';
import { useEffect, useState } from 'react';
import React from 'react';
import { useLang } from '@/lib/lang';

// VPS recomendado (afiliado). Una sola fuente: el admin lo edita en Bot Lab y aquí
// se lee vía /api/botlab/vps. Si no hay URL, seguimos recomendando VPS pero sin enlace.
export type VpsInfo = { on: boolean; url: string; name: string; note_es: string; note_en: string };

// Caché a nivel de módulo: una sola petición por carga de página, compartida por
// todas las instancias (tarjetas, guía, chat…).
let _cache: VpsInfo | null = null;
let _inflight: Promise<VpsInfo> | null = null;
async function fetchVps(): Promise<VpsInfo> {
  if (_cache) return _cache;
  if (_inflight) return _inflight;
  _inflight = fetch('/api/botlab/vps').then((r) => r.json()).then((j) => {
    _cache = { on: j?.on !== false, url: String(j?.url || ''), name: String(j?.name || ''), note_es: String(j?.note_es || ''), note_en: String(j?.note_en || '') };
    return _cache;
  }).catch(() => { _cache = { on: false, url: '', name: '', note_es: '', note_en: '' }; return _cache; });
  return _inflight;
}

export function useVpsInfo(): VpsInfo | null {
  const [v, setV] = useState<VpsInfo | null>(_cache);
  useEffect(() => { let on = true; fetchVps().then((x) => { if (on) setV(x); }); return () => { on = false; }; }, []);
  return v;
}

// Atributos seguros para un enlace de afiliado.
const REL = 'sponsored nofollow noopener noreferrer';

// Reemplaza el token [[VPS]] dentro de un texto por un enlace (si hay URL) o por
// la palabra "VPS". Devuelve nodos React listos para renderizar.
export function renderVps(text: string, v: VpsInfo | null): React.ReactNode {
  if (!text || text.indexOf('[[VPS]]') < 0) return text;
  const url = v?.url || '';
  const parts = text.split('[[VPS]]');
  const out: React.ReactNode[] = [];
  parts.forEach((p, i) => {
    out.push(<React.Fragment key={'t' + i}>{p}</React.Fragment>);
    if (i < parts.length - 1) {
      out.push(url
        ? <a key={'l' + i} href={url} target="_blank" rel={REL} style={{ color: 'var(--brand)', fontWeight: 600, textDecoration: 'underline' }}>VPS</a>
        : <React.Fragment key={'l' + i}>VPS</React.Fragment>);
    }
  });
  return out;
}

type Variant = 'badge' | 'callout' | 'inline';
export default function VpsCallout({ variant = 'callout', gold = false }: { variant?: Variant; gold?: boolean }) {
  const { lang } = useLang();
  const es = lang === 'es';
  const v = useVpsInfo();
  if (!v || v.on === false) return null;

  const acc = gold ? 'var(--gold, #ffd45e)' : 'var(--brand)';
  const provider = v.name ? ` (${v.name})` : '';
  const cta = es ? 'Conseguir uno' : 'Get one';
  const note = (es ? v.note_es : v.note_en) || (es
    ? 'Mantén tu robot operando 24/7 aunque apagues el PC.'
    : 'Keep your robot running 24/7 even if you turn off your PC.');

  // Línea compacta para tarjetas: "🖥️ 24/7 con VPS · Conseguir uno"
  if (variant === 'inline') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: acc, marginTop: 8 }}>
        <span aria-hidden>🖥️</span>
        <span>{es ? '24/7 con VPS' : '24/7 on a VPS'}</span>
        {v.url && <><span aria-hidden style={{ opacity: .6 }}>·</span><a href={v.url} target="_blank" rel={REL} style={{ color: acc, fontWeight: 800, textDecoration: 'underline' }}>{cta}</a></>}
      </div>
    );
  }

  if (variant === 'badge') {
    const title = es ? 'Funciona 24/7 con un VPS' : 'Runs 24/7 on a VPS';
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--tx)', background: 'var(--card2, rgba(255,255,255,.04))', border: '1px solid var(--line)', borderRadius: 8, padding: '6px 10px' }}>
        <span aria-hidden style={{ color: acc }}>🖥️</span>
        <span style={{ flex: 1 }}>{title}</span>
        {v.url && <a href={v.url} target="_blank" rel={REL} style={{ color: acc, fontWeight: 700, textDecoration: 'underline', whiteSpace: 'nowrap' }}>{cta}</a>}
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'var(--card2, rgba(255,255,255,.04))', border: '1px solid var(--line)', borderRadius: 12, padding: '11px 13px' }}>
      <span aria-hidden style={{ fontSize: 18, color: acc, flex: 'none', lineHeight: 1.3 }}>🖥️</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13.5 }}>{es ? `Recomendado: un VPS${provider}` : `Recommended: a VPS${provider}`}</div>
        <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>{note}</div>
      </div>
      {v.url && (
        <a href={v.url} target="_blank" rel={REL} className="btn btn-ghost" style={{ flex: 'none', fontSize: 12.5, padding: '6px 11px', borderColor: acc, color: acc }}>{cta} ↗</a>
      )}
    </div>
  );
}
