'use client';
import React, { useEffect, useState } from 'react';

// Vista EN VIVO de dónde caerá el anuncio: carga la página real del sitio en un
// mini-navegador (iframe) y superpone el recuadro dorado del anuncio en su zona
// real (leaderboard arriba, lateral, media página, footer, barra fija, etc.),
// con su tamaño. El iframe es solo lectura (sin clics) para que sea una vista
// previa segura. Si el iframe no carga, igual se ve el recuadro y la etiqueta.
//
// slotKey: clave del espacio (blog_top, article_sidebar, …)
// page:    grupo de página del catálogo (blog | article | landing | site | directory)
// size:    tamaño IAB, ej. '728x90'
export default function SlotPreview({ slotKey, page, size, es = true }: { slotKey: string; page: string; size: string; es?: boolean }) {
  const L = (a: string, b: string) => (es ? a : b);
  const ACC = 'var(--accent,#8b93ff)';
  const line = 'var(--line,#2a3350)';
  const [origin, setOrigin] = useState('https://www.onyxtradinglive.com');
  useEffect(() => { try { if (typeof window !== 'undefined' && window.location?.origin) setOrigin(window.location.origin); } catch {} }, []);

  // Página real a mostrar según el grupo del espacio.
  const path = page === 'blog' || page === 'article' ? '/blog'
    : page === 'directory' ? '/publicidad'
    : '/';
  const src = `${origin}${path}`;

  // Zona del anuncio dentro de la vista (en % del recuadro visible). Aproximada
  // pero fiel a la posición real de cada ubicación.
  const zone: React.CSSProperties = (() => {
    switch (slotKey) {
      case 'blog_top':
      case 'landing_top': return { top: '9%', left: '3%', width: '94%', height: '7%' };
      case 'landing_billboard': return { top: '9%', left: '3%', width: '94%', height: '15%' };
      case 'article_incontent': return { top: '40%', left: '3%', width: '64%', height: '7%' };
      case 'article_sidebar': return { top: '26%', right: '3%', width: '30%', height: '16%' };
      case 'article_halfpage': return { top: '22%', right: '3%', width: '30%', height: '34%' };
      case 'blog_infeed': return { top: '52%', left: '3%', width: '94%', height: '8%' };
      case 'blog_native': return { top: '30%', left: '52%', width: '45%', height: '16%' };
      case 'footer_site': return { bottom: '4%', left: '3%', width: '94%', height: '7%' };
      case 'sticky_bottom': return { bottom: '2%', left: '3%', width: '94%', height: '5%' };
      case 'directory_partner': return { top: '26%', left: '3%', width: '94%', height: '9%' };
      default: return { top: '9%', left: '3%', width: '94%', height: '8%' };
    }
  })();

  const pageName = ({ blog: L('Blog', 'Blog'), article: L('Artículo', 'Article'), landing: L('Landing', 'Landing'), site: L('Sitio', 'Site'), directory: L('Directorio', 'Directory') } as any)[page] || page;

  return (
    <div style={{ border: `1px solid ${line}`, borderRadius: 12, overflow: 'hidden', background: 'var(--panel,#161c2e)' }}>
      {/* barra del navegador */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', background: 'color-mix(in srgb, var(--mut,#9aa6bd) 12%, transparent)', borderBottom: `1px solid ${line}` }}>
        <span style={{ width: 8, height: 8, borderRadius: 8, background: '#f0736f' }} />
        <span style={{ width: 8, height: 8, borderRadius: 8, background: '#f0b74e' }} />
        <span style={{ width: 8, height: 8, borderRadius: 8, background: '#5ed6a0' }} />
        <span style={{ marginLeft: 8, fontSize: 10.5, color: 'var(--mut,#9aa6bd)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{src.replace(/^https?:\/\//, '')}</span>
        <span style={{ marginLeft: 'auto', fontSize: 9.5, color: ACC, border: `1px solid ${ACC}`, borderRadius: 20, padding: '1px 7px' }}>{L('EN VIVO', 'LIVE')}</span>
      </div>

      {/* página real (solo lectura) + recuadro del anuncio superpuesto */}
      <div style={{ position: 'relative', width: '100%', height: 420, background: '#0b0f1a' }}>
        <iframe
          src={src}
          title={pageName}
          loading="lazy"
          sandbox="allow-same-origin allow-scripts"
          scrolling="no"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, pointerEvents: 'none' }}
        />
        {/* capa que bloquea interacción con el iframe */}
        <div style={{ position: 'absolute', inset: 0 }} />
        {/* recuadro del anuncio */}
        <div style={{ position: 'absolute', ...zone, borderRadius: 6, border: `2px solid ${ACC}`, background: 'color-mix(in srgb, var(--accent,#8b93ff) 26%, transparent)', boxShadow: `0 0 0 3px color-mix(in srgb, var(--accent,#8b93ff) 22%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(1px)' }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,.6)', textAlign: 'center', lineHeight: 1.25 }}>
            {L('Tu anuncio aquí', 'Your ad here')}<br /><span style={{ fontSize: 10, opacity: .95 }}>{size}</span>
          </span>
        </div>
      </div>

      <div style={{ padding: '6px 12px 10px', fontSize: 11, color: 'var(--mut,#9aa6bd)' }}>
        {L('Página real del sitio. El recuadro marca dónde se mostrará el anuncio.', 'Real site page. The box marks where the ad will appear.')}
      </div>
    </div>
  );
}
