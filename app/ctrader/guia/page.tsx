'use client';
import { useEffect, useState } from 'react';

// Página que muestra la guía de cTrader RENDERIZADA (antes el enlace abría el .md
// crudo y se veían los #, ** y backticks). Lee el MISMO archivo público
// /ctrader/GUIA_CTRADER.md (una sola fuente de verdad) y lo convierte a HTML con un
// mini-render de Markdown suficiente para esta guía: títulos, negritas, `código`,
// listas, citas (>), separadores (---) y párrafos.

// Escapa HTML para no inyectar nada del .md.
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
// Convierte lo "inline": **negrita**, `código`, [texto](url).
function inline(s: string): string {
  let t = esc(s);
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  return t;
}

function mdToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let inList = false;
  const closeList = () => { if (inList) { out.push('</ul>'); inList = false; } };
  for (let raw of lines) {
    const line = raw.replace(/\s+$/, '');
    const t = line.trim();
    if (!t) { closeList(); continue; }
    if (/^---+$/.test(t)) { closeList(); out.push('<hr/>'); continue; }
    let m: RegExpMatchArray | null;
    if ((m = t.match(/^###\s+(.*)/))) { closeList(); out.push('<h3>' + inline(m[1]) + '</h3>'); continue; }
    if ((m = t.match(/^##\s+(.*)/)))  { closeList(); out.push('<h2>' + inline(m[1]) + '</h2>'); continue; }
    if ((m = t.match(/^#\s+(.*)/)))   { closeList(); out.push('<h1>' + inline(m[1]) + '</h1>'); continue; }
    if ((m = t.match(/^>\s?(.*)/)))   { closeList(); out.push('<blockquote>' + inline(m[1]) + '</blockquote>'); continue; }
    if ((m = t.match(/^(?:[-*]|\d+\.)\s+(.*)/))) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push('<li>' + inline(m[1]) + '</li>');
      continue;
    }
    closeList();
    out.push('<p>' + inline(t) + '</p>');
  }
  closeList();
  return out.join('\n');
}

export default function CtraderGuide() {
  const [html, setHtml] = useState('');
  const [err, setErr] = useState(false);
  useEffect(() => {
    fetch('/ctrader/GUIA_CTRADER.md', { cache: 'no-store' })
      .then((r) => { if (!r.ok) throw new Error('404'); return r.text(); })
      .then((md) => setHtml(mdToHtml(md)))
      .catch(() => setErr(true));
  }, []);
  return (
    <div className="wrap" style={{ maxWidth: 820, padding: '32px 22px 60px' }}>
      <p style={{ marginBottom: 16 }}>
        <a className="muted" style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={(e) => { e.preventDefault(); if (typeof window !== 'undefined' && window.history.length > 1) window.history.back(); else window.location.href = '/dashboard/keys'; }}>← Volver</a>
      </p>
      <div className="card ctguide" style={{ lineHeight: 1.7 }}>
        {err ? <p className="muted">No se pudo cargar la guía. Intenta de nuevo.</p>
             : html ? <div dangerouslySetInnerHTML={{ __html: html }} />
             : <p className="muted">Cargando guía…</p>}
      </div>
      <style>{`
        .ctguide h1{font-size:24px;margin:6px 0 14px}
        .ctguide h2{font-size:19px;margin:22px 0 8px}
        .ctguide h3{font-size:16px;margin:18px 0 6px}
        .ctguide p{margin:8px 0}
        .ctguide ul{margin:8px 0;padding-left:20px}
        .ctguide li{margin:4px 0}
        .ctguide code{background:var(--bg2,#1a1f2e);padding:1px 6px;border-radius:6px;font-size:.92em}
        .ctguide blockquote{margin:10px 0;padding:8px 14px;border-left:3px solid var(--brand,#7c8cff);background:color-mix(in srgb,var(--brand,#7c8cff) 8%,transparent);border-radius:0 8px 8px 0}
        .ctguide hr{border:none;border-top:1px solid var(--line,#2a3040);margin:20px 0}
        .ctguide a{color:var(--brand,#7c8cff)}
      `}</style>
    </div>
  );
}
