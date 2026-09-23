'use client';
import { useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/lib/lang';
import { bySlug } from '@/lib/guide';

// ============================================================
// El "?" que se pone al lado de un concepto.
//
// El globo es `position:fixed` y se coloca midiendo el botón, así NUNCA se
// recorta dentro de tarjetas con overflow (antes, dentro de Guardian, no se
// veía al abrir). Cierra al tocar fuera, con la X o con Escape.
// ============================================================
export default function Help({ slug }: { slug: string }) {
  const { lang } = useLang();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLSpanElement>(null);
  const a = bySlug(slug);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const b = btn.current?.getBoundingClientRect();
      if (!b) return;
      const vw = window.innerWidth, vh = window.innerHeight;
      const width = Math.min(280, vw - 24);
      let left = b.left + b.width / 2 - width / 2;
      left = Math.max(12, Math.min(left, vw - width - 12));
      const h = pop.current?.offsetHeight || 150;
      let top = b.bottom + 8;
      if (top + h > vh - 12) top = Math.max(12, b.top - h - 8);
      top = Math.max(12, Math.min(top, vh - h - 12));
      setPos({ top, left, width });
    };
    place();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, slug]);

  if (!a) return null;
  const more = lang === 'en' ? 'Read the full article →' : 'Leer el artículo completo →';

  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <button ref={btn} className="helpdot" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((o) => !o); }}
        aria-label={a.title[lang]} aria-expanded={open}>?</button>
      {open && (
        <>
          <span onClick={(e) => { e.stopPropagation(); setOpen(false); }} style={{ position: 'fixed', inset: 0, zIndex: 4000, background: 'transparent' }} />
          <span ref={pop} onClick={(e) => e.stopPropagation()} role="tooltip"
            style={{ position: 'fixed', top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: pos?.width ?? 280, background: 'var(--card)', border: '1px solid var(--brand)', borderRadius: 10, padding: '12px 14px', paddingRight: 30, zIndex: 4001, boxShadow: '0 12px 34px rgba(0,0,0,.5)', textAlign: 'left', fontWeight: 400, maxHeight: '60vh', overflowY: 'auto', visibility: pos ? 'visible' : 'hidden' }}>
            <button type="button" aria-label={lang === 'en' ? 'Close' : 'Cerrar'} onClick={(e) => { e.stopPropagation(); setOpen(false); }}
              style={{ position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: '50%', border: 'none', background: 'transparent', color: 'var(--mut)', fontSize: 15, cursor: 'pointer', lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            <span style={{ display: 'block', fontSize: 13, marginBottom: 5, fontWeight: 600 }}>{a.title[lang]}</span>
            <span className="muted" style={{ display: 'block', fontSize: 12, lineHeight: 1.7, marginBottom: 9 }}>{a.summary[lang]}</span>
            <Link href={`/guia/${a.slug}`} style={{ color: '#aeb7ff', fontSize: 12 }} onClick={() => setOpen(false)}>{more}</Link>
          </span>
        </>
      )}
    </span>
  );
}
