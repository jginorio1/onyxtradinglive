'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useLang, Lang } from '@/lib/lang';
import { LANGS, LANG_META } from '@/lib/navText';

// Selector de idioma (6). Cambia el idioma de dos formas a la vez:
//  1) setLang → actualiza el contexto (la UI cambia al instante) y la cookie.
//  2) router.push → en páginas públicas cambia la URL (/xx) para que quede
//     compartible y Google la indexe por idioma. En el panel va solo por cookie.
// Usa un desplegable propio (no <select> nativo) para controlar su ancho:
// en móvil el panel nativo salía demasiado ancho; este es compacto y consistente.
const PREFIXES = ['en', 'zh', 'ja', 'pt', 'vi'];

export default function LangToggle({ compact = false, label = '' }: { compact?: boolean; label?: string }) {
  const { lang, setLang } = useLang();
  const pathname = usePathname() || '/';
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  function go(l: Lang) {
    setOpen(false);
    if (l === lang) return;
    setLang(l);
    const seg = pathname.split('/')[1];
    const base = PREFIXES.includes(seg) ? (pathname.slice(seg.length + 1) || '/') : pathname;
    const PUBLIC = ['/pricing', '/embajadores', '/guia', '/login', '/terms', '/mentores'];
    const isPublic = base === '/' || PUBLIC.some((p) => base === p || base.startsWith(p + '/'));
    if (isPublic) {
      const target = l === 'es' ? base : (base === '/' ? `/${l}` : `/${l}${base}`);
      if (target !== pathname) router.push(target);
    }
  }

  const dropdown = (
    <div ref={box} style={{ position: 'relative', display: 'inline-block' }}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-label="Language" title="Language / Idioma"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 36, padding: '0 9px', borderRadius: 9, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--tx)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>
        <span>{LANG_META[lang].flag}</span>
        <span style={{ fontSize: 10, color: 'var(--mut)', transform: open ? 'rotate(180deg)' : 'none', transition: '.15s' }}>▾</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', width: 168, maxWidth: 'calc(100vw - 24px)', background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 11, boxShadow: '0 12px 30px rgba(0,0,0,.45)', zIndex: 80, overflow: 'hidden', padding: 4 }}>
          {LANGS.map((l) => {
            const on = l === lang;
            return (
              <button key={l} type="button" onClick={() => go(l)}
                style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13.5,
                  background: on ? 'color-mix(in srgb,var(--brand) 20%,transparent)' : 'transparent', color: 'var(--tx)', fontWeight: on ? 700 : 500 }}>
                <span style={{ fontSize: 16 }}>{LANG_META[l].flag}</span>
                <span style={{ flex: 1 }}>{LANG_META[l].native}</span>
                {on && <span style={{ color: 'var(--brand)', fontSize: 12 }}>✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  if (compact) return dropdown;
  return (
    <div className="row between" style={{ padding: '4px 6px 4px 10px', gap: 10, alignItems: 'center' }}>
      <span style={{ fontSize: 12, color: 'var(--mut)' }}>{label}</span>
      {dropdown}
    </div>
  );
}
