'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useLang, Lang } from '@/lib/lang';

// Selector ES|EN. Ahora también cambia la URL: español sin prefijo, inglés en /en.
// Así el idioma queda en la dirección (compartible y bueno para SEO), y el
// servidor sabe qué renderizar por la cabecera que pone el middleware.
export default function LangToggle({ compact = false, label = '' }: { compact?: boolean; label?: string }) {
  const { lang } = useLang();
  const pathname = usePathname() || '/';
  const router = useRouter();

  function go(l: Lang) {
    if (l === lang) return;
    // Ruta sin el prefijo /en
    const base = pathname === '/en' ? '/' : pathname.startsWith('/en/') ? pathname.slice(3) : pathname;
    const target = l === 'en' ? (base === '/' ? '/en' : '/en' + base) : base;
    try { document.cookie = `onyx_lang=${l}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`; } catch {}
    try { localStorage.setItem('onyx_lang', l); } catch {}
    router.push(target);
    router.refresh();
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
