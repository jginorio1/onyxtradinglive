'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useLang, Lang } from '@/lib/lang';

// Selector ES|EN. Cambia el idioma de dos formas a la vez:
//  1) setLang → actualiza el contexto (la UI cambia al instante) y la cookie.
//  2) router.push → cambia la URL (español sin prefijo, inglés en /en) para
//     que quede compartible y Google la indexe por idioma.
export default function LangToggle({ compact = false, label = '' }: { compact?: boolean; label?: string }) {
  const { lang, setLang } = useLang();
  const pathname = usePathname() || '/';
  const router = useRouter();

  function go(l: Lang) {
    if (l === lang) return;
    setLang(l);                              // contexto + cookie + refresh (la UI cambia ya)

    // La URL con prefijo /en solo tiene sentido en las páginas públicas (SEO).
    // En el panel (dashboard/cuenta/admin) el idioma va por cookie, sin tocar la URL.
    const base = pathname === '/en' ? '/' : pathname.startsWith('/en/') ? pathname.slice(3) : pathname;
    const PUBLIC = ['/pricing', '/embajadores', '/guia', '/login', '/terms'];
    const isPublic = base === '/' || PUBLIC.some((p) => base === p || base.startsWith(p + '/'));
    if (isPublic) {
      const target = l === 'en' ? (base === '/' ? '/en' : '/en' + base) : base;
      if (target !== pathname) router.push(target);
    }
  }

  const seg = (l: Lang) => (
    <button key={l} className={'langseg' + (lang === l ? ' on' : '')} onClick={() => go(l)}
      aria-pressed={lang === l}>{l.toUpperCase()}</button>
  );

  if (compact) return <div className="langtoggle">{seg('es')}{seg('en')}</div>;

  return (
    <div className="row between" style={{ padding: '4px 6px 4px 10px' }}>
      <span style={{ fontSize: 12, color: 'var(--mut)' }}>{label}</span>
      <div className="langtoggle">{seg('es')}{seg('en')}</div>
    </div>
  );
}
