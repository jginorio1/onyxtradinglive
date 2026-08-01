'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/lib/lang';
import { bySlug } from '@/lib/guide';

// ============================================================
// El "?" que se pone al lado de un concepto.
//
// Un artículo bien escrito que nadie encuentra no sirve de nada. Esto abre
// justo la explicación de lo que el trader está mirando, sin sacarlo de la
// pantalla, con enlace al artículo completo si quiere más.
// ============================================================
export default function Help({ slug }: { slug: string }) {
  const { lang } = useLang();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  const a = bySlug(slug);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  if (!a) return null;
  const more = lang === 'en' ? 'Read the full article →' : 'Leer el artículo completo →';

  return (
    <span ref={box} style={{ position: 'relative', display: 'inline-flex' }}>
      <button className="helpdot" onClick={() => setOpen(!open)}
        aria-label={a.title[lang]} aria-expanded={open}>?</button>

      {open && (
        <span className="helppop">
          <span style={{ display: 'block', fontSize: 13, marginBottom: 5 }}>{a.title[lang]}</span>
          <span className="muted" style={{ display: 'block', fontSize: 12, lineHeight: 1.7, marginBottom: 9 }}>
            {a.summary[lang]}
          </span>
          <Link href={`/guia/${a.slug}`} style={{ color: '#aeb7ff', fontSize: 12 }} onClick={() => setOpen(false)}>
            {more}
          </Link>
        </span>
      )}
    </span>
  );
}
