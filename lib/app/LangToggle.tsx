'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useLang, Lang } from '@/lib/lang';
import { LANGS, LANG_META } from '@/lib/navText';

// Selector de idioma (6). Cambia el idioma de dos formas a la vez:
//  1) setLang → actualiza el contexto (la UI cambia al instante) y la cookie.
//  2) router.push → en páginas públicas cambia la URL (/xx) para que quede
//     compartible y Google la indexe por idioma. En el panel va solo por cookie.
const PREFIXES = ['en', 'zh', 'ja', 'pt', 'vi'];

export default function LangToggle({ compact = false, label = '' }: { compact?: boolean; label?: string }) {
  const { lang, setLang } = useLang();
  const pathname = usePathname() || '/';
  const router = useRouter();

  function go(l: Lang) {
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

  const select = (
    <select className="langsel" value={lang} onChange={(e) => go(e.target.value as Lang)} aria-label="Language"
      style={{ margin: 0, padding: '5px 8px', fontSize: 12.5, width: 'auto', minWidth: 0 }}>
      {LANGS.map((l) => <option key={l} value={l}>{LANG_META[l].flag} {LANG_META[l].native}</option>)}
    </select>
  );

  if (compact) return select;
  return (
    <div className="row between" style={{ padding: '4px 6px 4px 10px', gap: 10, alignItems: 'center' }}>
      <span style={{ fontSize: 12, color: 'var(--mut)' }}>{label}</span>
      {select}
    </div>
  );
}
