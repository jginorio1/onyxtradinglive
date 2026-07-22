'use client';
import { useLang, Lang } from '@/lib/lang';

// Selector ES|EN. Dos tamaños: dentro del menú (con etiqueta) y suelto
// en la barra para quien todavía no tiene sesión.
export default function LangToggle({ compact = false, label = '' }: { compact?: boolean; label?: string }) {
  const { lang, setLang } = useLang();

  const seg = (l: Lang) => (
    <button key={l} className={'langseg' + (lang === l ? ' on' : '')} onClick={() => setLang(l)}
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
