'use client';
import { useEffect, useState } from 'react';

// Anclas del landing. Solo aparecen aquí: estos enlaces no significan nada
// en el resto de la web, así que no tienen sitio en la barra principal.
// Se marca sola la sección que estás mirando.
export default function SectionNav({ items }: { items: { id: string; label: string }[] }) {
  const [active, setActive] = useState(items[0]?.id || '');

  useEffect(() => {
    const nodes = items.map((i) => document.getElementById(i.id)).filter(Boolean) as HTMLElement[];
    if (!nodes.length) return;

    // La sección visible más alta gana. El margen superior descuenta las dos barras.
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-120px 0px -55% 0px', threshold: 0 }
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [items]);

  return (
    <div className="secnav">
      <div className="wrap-wide secnav-items">
        {items.map((i) => (
          <a key={i.id} href={`#${i.id}`} className={'secnav-item' + (active === i.id ? ' on' : '')}>
            {i.label}
          </a>
        ))}
      </div>
    </div>
  );
}
