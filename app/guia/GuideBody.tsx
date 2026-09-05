'use client';
import { useState } from 'react';

// Render EXACTO de una guía (título, meta, portada y bloques) con visor/zoom.
// Lo usan tanto la página pública del artículo como la vista previa del editor,
// así el dueño ve en el builder lo mismo que verá el trader.

type Any = any;

function readMins(body: Any[]): number {
  const words = body.map((b: Any) => (b.p || b.h || b.note || b.warn || b.tip || b.caption || (b.list || b.steps || []).join(' ') || (b.walk ? b.walk.map((s: Any) => (s.t || '') + ' ' + (s.d || '')).join(' ') : '') || '')).join(' ').trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 180));
}

export default function GuideBody({ article, lang }: { article: Any; lang: 'es' | 'en' }) {
  const [zoom, setZoom] = useState<{ src: string; alt: string } | null>(null);
  const [full, setFull] = useState(false);
  const openZoom = (src: string, alt: string) => { setZoom({ src, alt }); setFull(false); };
  if (!article) return null;
  const body: Any[] = (article.body?.[lang]) || [];
  const min = readMins(body);

  return (
    <>
      <h1 style={{ fontSize: 26, letterSpacing: '-.4px', marginBottom: 10, lineHeight: 1.3 }}>{article.title?.[lang] || ''}</h1>

      <div className="row" style={{ gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <span className="pill" style={{ fontSize: 11.5, background: 'var(--bg2)', border: '1px solid var(--line)', color: 'var(--mut)' }}>🕒 {min} {lang === 'en' ? 'min read' : 'min de lectura'}</span>
        {article.updated && <span className="pill" style={{ fontSize: 11.5, background: 'rgba(124,140,255,.15)', color: 'var(--soft-brand)' }}>✨ {lang === 'en' ? 'New' : 'Nuevo'}</span>}
      </div>

      {article.cover && (
        <img src={article.cover} alt={article.title?.[lang] || ''} loading="lazy" onClick={() => openZoom(article.cover, article.title?.[lang] || '')}
          style={{ width: '100%', height: 'auto', borderRadius: 14, border: '1px solid var(--line)', marginBottom: 22, display: 'block', cursor: 'zoom-in' }} />
      )}

      {body.map((b, i) => <BlockView key={i} b={b} onZoom={openZoom} />)}

      {zoom && (
        <div onClick={() => setZoom(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.9)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto', padding: 20 }}>
          <img src={zoom.src} alt={zoom.alt} onClick={(e) => { e.stopPropagation(); setFull((f) => !f); }}
            style={full ? { maxWidth: 'none', width: 'auto', height: 'auto', cursor: 'zoom-out' } : { maxWidth: '95vw', maxHeight: '90vh', width: 'auto', height: 'auto', cursor: 'zoom-in', borderRadius: 8 }} />
          <button onClick={() => setZoom(null)} aria-label="Cerrar" style={{ position: 'fixed', top: 16, right: 18, background: 'rgba(255,255,255,.12)', border: 'none', color: '#fff', width: 40, height: 40, borderRadius: '50%', fontSize: 20, cursor: 'pointer' }}>×</button>
          <div style={{ position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,.75)', fontSize: 12.5, background: 'rgba(0,0,0,.4)', padding: '5px 12px', borderRadius: 20 }}>{full ? (lang === 'en' ? 'Click to fit' : 'Clic para ajustar') : (lang === 'en' ? 'Click to zoom 100%' : 'Clic para tamaño real')}</div>
        </div>
      )}
    </>
  );
}

export function BlockView({ b, onZoom }: { b: Any; onZoom?: (src: string, alt: string) => void }) {
  const any = b as Any;
  if (any.h) return <h2 style={{ fontSize: 18, margin: '26px 0 10px' }}>{any.h}</h2>;
  if (any.p) return <p style={{ fontSize: 15, lineHeight: 1.85, color: 'var(--tx)', marginBottom: 14 }}>{any.p}</p>;
  if (any.note) return (
    <div style={{ background: 'var(--bg2)', borderLeft: '3px solid var(--amber)', padding: '13px 15px', marginBottom: 16, borderRadius: 0 }}>
      {any.title && <div style={{ color: 'var(--amber)', fontSize: 12, marginBottom: 5 }}>{any.title}</div>}
      <div className="muted" style={{ fontSize: 14, lineHeight: 1.75, whiteSpace: 'pre-line' }}>{any.note}</div>
    </div>
  );
  if (any.warn) return (
    <div style={{ background: 'rgba(255,107,125,.06)', border: '1px solid var(--red)', padding: '13px 15px', marginBottom: 16, borderRadius: 10 }}>
      {any.title && <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 5 }}>{any.title}</div>}
      <div style={{ fontSize: 14, lineHeight: 1.75, color: '#e8d5d8' }}>{any.warn}</div>
    </div>
  );
  if (any.tip) return (
    <div style={{ background: 'rgba(52,226,160,.08)', border: '1px solid var(--green)', padding: '13px 15px', marginBottom: 16, borderRadius: 10 }}>
      <div style={{ color: 'var(--green)', fontSize: 12, marginBottom: 5 }}>💡 {any.title || 'Consejo'}</div>
      <div style={{ fontSize: 14, lineHeight: 1.75, color: 'var(--tx)' }}>{any.tip}</div>
    </div>
  );
  if (any.img) return (
    <figure style={{ margin: '4px 0 20px' }}>
      {any.img
        ? <img src={any.img} alt={any.alt || ''} loading="lazy" onClick={() => onZoom?.(any.img, any.alt || '')} style={{ width: '100%', height: 'auto', borderRadius: 12, border: '1px solid var(--line)', display: 'block', cursor: 'zoom-in' }} />
        : <div className="muted" style={{ height: 90, border: '1px dashed var(--line)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>🖼️ imagen</div>}
      {any.caption && <figcaption className="muted" style={{ fontSize: 12.5, lineHeight: 1.6, marginTop: 8, textAlign: 'center' }}>{any.caption}</figcaption>}
    </figure>
  );
  if (any.list) return (
    <ul style={{ margin: '0 0 16px 20px', padding: 0 }}>
      {any.list.map((x: string, i: number) => <li key={i} style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--tx)', marginBottom: 7 }}>{x}</li>)}
    </ul>
  );
  if (any.walk) return (
    <div style={{ marginBottom: 18 }}>
      {any.walk.map((s: Any, i: number) => (
        <div key={i} className="row" style={{ gap: 13, alignItems: 'stretch' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 'none' }}>
            <span style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--grad)', color: '#fff', fontSize: 12.5, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{i + 1}</span>
            {i < any.walk.length - 1 && <span style={{ width: 2, flex: 1, background: 'var(--line)', marginTop: 6, minHeight: 14 }} />}
          </div>
          <div style={{ flex: 1, minWidth: 0, paddingBottom: 18 }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: s.d ? 4 : 0 }}>{s.t}</div>
            {s.d && <div className="muted" style={{ fontSize: 14, lineHeight: 1.7 }}>{s.d}</div>}
            {s.img && <img src={s.img} alt={s.alt || ''} loading="lazy" onClick={() => onZoom?.(s.img, s.alt || '')} style={{ width: '100%', maxWidth: 440, height: 'auto', borderRadius: 10, border: '1px solid var(--line)', marginTop: 10, display: 'block', cursor: 'zoom-in' }} />}
            {s.tip && <div style={{ marginTop: 10, background: 'rgba(52,226,160,.08)', border: '1px solid var(--green)', borderRadius: 10, padding: '9px 12px', fontSize: 13, lineHeight: 1.6, color: 'var(--tx)' }}><span style={{ color: 'var(--green)' }}>💡</span> {s.tip}</div>}
          </div>
        </div>
      ))}
    </div>
  );
  if (any.steps) return (
    <div style={{ marginBottom: 16 }}>
      {any.steps.map((x: string, i: number) => (
        <div key={i} className="row" style={{ gap: 12, alignItems: 'flex-start', marginBottom: 10 }}>
          <span style={{ width: 22, height: 22, borderRadius: '50%', flex: 'none', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--card2)', color: 'var(--mut)' }}>{i + 1}</span>
          <span style={{ fontSize: 14.5, lineHeight: 1.7, color: 'var(--tx)' }}>{x}</span>
        </div>
      ))}
    </div>
  );
  return null;
}
