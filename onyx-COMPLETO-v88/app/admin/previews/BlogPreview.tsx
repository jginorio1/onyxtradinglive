'use client';
import { mdToHtml } from '@/lib/md';
// Vista previa reutilizable de un ARTÍCULO del blog tal como se publica:
// portada, título (H1) y cuerpo markdown renderizado (imágenes y gráficas
// incluidas). Usa el MISMO conversor que la página pública, así lo que ves
// aquí es exactamente lo que se publica. La usa el constructor del blog.
export default function BlogPreview({
  title, cover, coverAlt, body, es = true,
}: { title: string; cover?: string; coverAlt?: string; body: string; es?: boolean }) {
  const html = mdToHtml(body || '');
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', background: 'var(--bg2)' }}>
      {cover
        ? <img src={cover} alt={coverAlt || ''} style={{ width: '100%', maxHeight: 200, objectFit: 'cover', display: 'block' }} />
        : <div style={{ height: 90, background: 'var(--card)', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mut)', fontSize: 12 }}>{es ? 'Sin portada' : 'No cover'}</div>}
      <div style={{ padding: '14px 16px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 10px', lineHeight: 1.2 }}>{title || (es ? '(sin título)' : '(no title)')}</h1>
        <article className="blog-body" style={{ fontSize: 14, lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
}
