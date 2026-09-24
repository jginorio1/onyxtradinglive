'use client';
import React from 'react';

// Maqueta visual de la página que muestra EXACTAMENTE dónde caerá el anuncio.
// Dibuja un mini-navegador con la estructura de la página (blog, artículo,
// landing, sitio o directorio) y resalta en dorado el espacio elegido, con su
// tamaño y una etiqueta "Tu anuncio aquí". Sirve para que el vendedor y el
// anunciante vean la ubicación real antes de reservar.
//
// slotKey: clave del espacio (blog_top, article_sidebar, …)
// page:    grupo de página del catálogo (blog | article | landing | site | directory)
// size:    tamaño IAB, ej. '728x90'
export default function SlotPreview({ slotKey, page, size, es = true }: { slotKey: string; page: string; size: string; es?: boolean }) {
  const L = (a: string, b: string) => (es ? a : b);
  const ACC = 'var(--accent,#8b93ff)';
  const line = 'var(--line,#2a3350)';
  const soft = 'color-mix(in srgb, var(--accent,#8b93ff) 22%, transparent)';
  const grayBlock = (h: number | string, extra: React.CSSProperties = {}) => ({ height: h, background: 'color-mix(in srgb, var(--mut,#9aa6bd) 16%, transparent)', borderRadius: 5, ...extra } as React.CSSProperties);

  // El bloque resaltado (el anuncio). w/h opcionales para respetar proporción.
  const Ad = ({ h = 34, label }: { h?: number; label?: string }) => (
    <div style={{ position: 'relative', height: h, borderRadius: 6, background: soft, border: `2px solid ${ACC}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 0 3px color-mix(in srgb, var(--accent,#8b93ff) 18%, transparent)` }}>
      <span style={{ fontSize: 10.5, fontWeight: 700, color: ACC, textAlign: 'center', lineHeight: 1.2 }}>{label || L('Tu anuncio', 'Your ad')}<br /><span style={{ fontSize: 9, opacity: .8 }}>{size}</span></span>
    </div>
  );

  const isAd = (k: string) => k === slotKey;

  // Estructura por página. Cada zona que puede llevar anuncio comprueba isAd().
  let body: React.ReactNode = null;

  if (page === 'blog') {
    body = (
      <div style={{ display: 'grid', gap: 7 }}>
        {isAd('blog_top') ? <Ad h={26} /> : <div style={grayBlock(10)} />}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
          <div style={grayBlock(46)} />
          {isAd('blog_native') ? <Ad h={46} label={L('Native', 'Native')} /> : <div style={grayBlock(46)} />}
        </div>
        {isAd('blog_infeed') ? <Ad h={30} label={L('Entre posts', 'In-feed')} /> : <div style={grayBlock(20)} />}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
          <div style={grayBlock(46)} /><div style={grayBlock(46)} />
        </div>
      </div>
    );
  } else if (page === 'article') {
    body = (
      <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr', gap: 8 }}>
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={grayBlock(12, { width: '70%' })} />
          <div style={grayBlock(8)} /><div style={grayBlock(8)} />
          {isAd('article_incontent') ? <Ad h={24} label={L('En el texto', 'In-content')} /> : <div style={grayBlock(8)} />}
          <div style={grayBlock(8)} /><div style={grayBlock(8)} />
        </div>
        <div style={{ display: 'grid', gap: 6 }}>
          {isAd('article_sidebar') ? <Ad h={70} label={L('Lateral', 'Sidebar')} />
            : isAd('article_halfpage') ? <Ad h={110} label={L('Media página', 'Half-page')} />
            : <div style={grayBlock(70)} />}
        </div>
      </div>
    );
  } else if (page === 'landing') {
    body = (
      <div style={{ display: 'grid', gap: 7 }}>
        {isAd('landing_billboard') ? <Ad h={54} label={L('Billboard', 'Billboard')} />
          : isAd('landing_top') ? <Ad h={26} />
          : <div style={grayBlock(22)} />}
        <div style={grayBlock(30, { width: '60%', margin: '2px auto 0' })} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 7 }}>
          <div style={grayBlock(34)} /><div style={grayBlock(34)} /><div style={grayBlock(34)} />
        </div>
      </div>
    );
  } else if (page === 'directory') {
    body = (
      <div style={{ display: 'grid', gap: 6 }}>
        <div style={grayBlock(12, { width: '50%' })} />
        {isAd('directory_partner') ? <Ad h={30} label={L('Partner destacado', 'Featured partner')} /> : <div style={grayBlock(24)} />}
        <div style={grayBlock(22)} /><div style={grayBlock(22)} /><div style={grayBlock(22)} />
      </div>
    );
  } else {
    // site (footer / sticky) u otros
    body = (
      <div style={{ display: 'grid', gap: 7, position: 'relative' }}>
        <div style={grayBlock(10, { width: '60%' })} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}><div style={grayBlock(40)} /><div style={grayBlock(40)} /></div>
        {isAd('footer_site') ? <Ad h={24} label={L('Footer', 'Footer')} /> : <div style={grayBlock(14)} />}
        {isAd('sticky_bottom') && (
          <div style={{ marginTop: 2 }}><Ad h={20} label={L('Barra fija inferior', 'Sticky bottom bar')} /></div>
        )}
      </div>
    );
  }

  const pageName = ({ blog: L('Blog', 'Blog'), article: L('Artículo', 'Article'), landing: L('Landing', 'Landing'), site: L('Sitio', 'Site'), directory: L('Directorio', 'Directory') } as any)[page] || page;

  return (
    <div style={{ border: `1px solid ${line}`, borderRadius: 12, overflow: 'hidden', background: 'var(--panel,#161c2e)' }}>
      {/* barra del navegador */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', background: 'color-mix(in srgb, var(--mut,#9aa6bd) 12%, transparent)', borderBottom: `1px solid ${line}` }}>
        <span style={{ width: 8, height: 8, borderRadius: 8, background: '#f0736f' }} />
        <span style={{ width: 8, height: 8, borderRadius: 8, background: '#f0b74e' }} />
        <span style={{ width: 8, height: 8, borderRadius: 8, background: '#5ed6a0' }} />
        <span style={{ marginLeft: 8, fontSize: 10.5, color: 'var(--mut,#9aa6bd)' }}>onyxtradinglive.com · {pageName}</span>
      </div>
      <div style={{ padding: 12 }}>{body}</div>
      <div style={{ padding: '6px 12px 10px', fontSize: 11, color: 'var(--mut,#9aa6bd)' }}>
        {L('Vista aproximada de dónde se mostrará el anuncio.', 'Approximate view of where the ad will appear.')}
      </div>
    </div>
  );
}
