'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';

// Un artículo ya "aplanado" por el servidor (idioma resuelto), listo para pintar.
export type BlogCard = {
  id: string; href: string; title: string; excerpt: string;
  cover: string; dateLabel: string; cat: string; readMin: number;
};

// Categorías + color de su chip (funciona en claro y oscuro con color-mix).
const CAT_COLOR: Record<string, string> = {
  macro: '#7c8cff', markets: '#22d3ee', crypto: '#f5b23e', earnings: '#a78bfa', guide: '#34e2a0',
};
const CAT_LABEL: Record<string, [string, string]> = {
  all: ['Todos', 'All'], macro: ['Macro', 'Macro'], markets: ['Mercados', 'Markets'],
  crypto: ['Cripto', 'Crypto'], earnings: ['Earnings', 'Earnings'], guide: ['Guías', 'Guides'],
};
const ORDER = ['all', 'macro', 'markets', 'crypto', 'earnings', 'guide'];

export default function BlogList({ posts, es, pageSize = 12 }: { posts: BlogCard[]; es: boolean; pageSize?: number }) {
  const L = (a: string, b: string) => (es ? a : b);
  const [cat, setCat] = useState('all');
  const [q, setQ] = useState('');
  const [shown, setShown] = useState(pageSize);

  // Solo mostramos pills de categorías que EXISTEN entre los artículos.
  const cats = useMemo(() => {
    const present = new Set(posts.map((p) => p.cat));
    return ORDER.filter((k) => k === 'all' || present.has(k));
  }, [posts]);

  const term = q.trim().toLowerCase();
  const matches = (p: BlogCard) => (cat === 'all' || p.cat === cat) && (!term || (p.title + ' ' + p.excerpt).toLowerCase().includes(term));
  const totalMatches = useMemo(() => posts.filter(matches).length, [posts, cat, term]);

  // El destacado (más reciente) solo en la vista "Todos" sin búsqueda.
  const featuredId = cat === 'all' && !term && posts.length ? posts[0].id : null;
  const gridTotal = totalMatches - (featuredId ? 1 : 0);

  const catLbl = (c: string) => (es ? (CAT_LABEL[c]?.[0] || c) : (CAT_LABEL[c]?.[1] || c));
  const pill = (active: boolean): any => ({
    border: '1px solid ' + (active ? 'transparent' : 'var(--line)'),
    background: active ? 'var(--brand)' : 'var(--bg2)',
    color: active ? '#0b0b12' : 'var(--mut)',
    borderRadius: 20, padding: '6px 14px', fontSize: 13, cursor: 'pointer', fontWeight: active ? 700 : 500, whiteSpace: 'nowrap',
  });
  const chip = (c: string): any => {
    const col = CAT_COLOR[c] || 'var(--mut)';
    return { fontSize: 11, padding: '2px 9px', borderRadius: 20, width: 'fit-content', background: `color-mix(in srgb, ${col} 16%, transparent)`, color: col, fontWeight: 600 };
  };
  const Cover = ({ p, h }: { p: BlogCard; h: number }) => (
    <img src={p.cover} alt="" loading="lazy" decoding="async" width={400} height={h} style={{ width: '100%', height: h, objectFit: 'cover', background: 'var(--bg2)' }} />
  );

  // IMPORTANTE (SEO): renderizamos TODAS las tarjetas en el HTML (para que Google
  // las rastree). Solo OCULTAMOS visualmente las que sobran (display:none). Al filtrar
  // o pulsar "Cargar más" cambiamos qué se ve, sin quitar nada del HTML.
  let gridRank = 0;
  const featured = posts.length ? posts[0] : null;

  return (
    <div>
      {/* Barra de categorías + buscador */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          {cats.map((k) => (
            <button key={k} type="button" onClick={() => { setCat(k); setShown(pageSize); }} style={pill(cat === k)}>{catLbl(k)}</button>
          ))}
        </div>
        <div style={{ position: 'relative', flex: 1, minWidth: 190, maxWidth: 280 }}>
          <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--mut)', fontSize: 14, pointerEvents: 'none' }}>⌕</span>
          <input value={q} onChange={(e) => { setQ(e.target.value); setShown(pageSize); }} placeholder={L('Buscar artículos', 'Search articles')} aria-label={L('Buscar artículos', 'Search articles')} style={{ width: '100%', margin: 0, paddingLeft: 30 }} />
        </div>
      </div>

      {/* Destacado (siempre en el HTML; se oculta al filtrar/buscar) */}
      {featured && (
        <Link href={featured.href} className="card" style={{ display: featuredId ? 'flex' : 'none', gap: 0, textDecoration: 'none', color: 'inherit', overflow: 'hidden', padding: 0, marginBottom: 18, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 260px', minWidth: 240, maxWidth: 360 }}><Cover p={featured} h={200} /></div>
          <div style={{ flex: '2 1 320px', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 9, justifyContent: 'center' }}>
            <span style={chip(featured.cat)}>{catLbl(featured.cat)}</span>
            <h2 style={{ fontSize: 22, lineHeight: 1.25, margin: 0 }}>{featured.title}</h2>
            <div className="muted" style={{ fontSize: 12 }}>{featured.dateLabel} · {featured.readMin} min {L('de lectura', 'read')}</div>
            {featured.excerpt && <p className="muted" style={{ fontSize: 14, margin: 0 }}>{featured.excerpt}</p>}
            <span style={{ color: 'var(--brand)', fontSize: 14, fontWeight: 700 }}>{L('Leer artículo →', 'Read article →')}</span>
          </div>
        </Link>
      )}

      {/* Rejilla: TODAS las tarjetas en el HTML; visibles según filtro + "cargar más" */}
      <div className="grid g3" style={{ gap: 18, alignItems: 'stretch' }}>
        {posts.map((p) => {
          const isFeat = p.id === featuredId;
          let show = matches(p) && !isFeat;
          if (show) { gridRank++; if (gridRank > shown) show = false; }
          return (
            <Link key={p.id} href={p.href} className="card" style={{ display: show ? 'flex' : 'none', flexDirection: 'column', gap: 8, textDecoration: 'none', color: 'inherit', overflow: 'hidden', padding: 0 }}>
              <Cover p={p} h={150} />
              <div style={{ padding: '10px 16px 16px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                <span style={chip(p.cat)}>{catLbl(p.cat)}</span>
                <h3 style={{ fontSize: 17, lineHeight: 1.3, margin: 0 }}>{p.title}</h3>
                <div className="muted" style={{ fontSize: 12 }}>{p.dateLabel} · {p.readMin} min</div>
                {p.excerpt && <p className="muted" style={{ fontSize: 13.5, flex: 1, margin: 0 }}>{p.excerpt}</p>}
                <span style={{ color: 'var(--brand)', fontSize: 13.5, fontWeight: 600 }}>{L('Leer →', 'Read →')}</span>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Vacío */}
      {totalMatches === 0 && (
        <div className="card muted" style={{ textAlign: 'center', padding: 30 }}>{L('No hay artículos que coincidan.', 'No matching articles.')}</div>
      )}

      {/* Cargar más + contador */}
      {totalMatches > 0 && (
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          {gridTotal > shown && (
            <button type="button" className="btn btn-ghost" onClick={() => setShown((n) => n + 9)} style={{ padding: '9px 22px' }}>＋ {L('Cargar más', 'Load more')}</button>
          )}
          <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
            {L(`Mostrando ${Math.min(shown + (featuredId ? 1 : 0), totalMatches)} de ${totalMatches} artículos`, `Showing ${Math.min(shown + (featuredId ? 1 : 0), totalMatches)} of ${totalMatches} articles`)}
          </div>
        </div>
      )}
    </div>
  );
}
