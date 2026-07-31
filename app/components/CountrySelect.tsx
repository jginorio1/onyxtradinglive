'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { flagOf, countryCode } from '@/app/components/countries';
import { useCatalog } from '@/lib/useCatalog';
import { useLang } from '@/lib/lang';

// Selector de país con BUSCADOR. Lee la lista del catálogo del admin
// (/api/catalog?kind=country) con respaldo a la lista por defecto. Guarda el
// código ISO y acepta valores antiguos en texto libre ("Puerto Rico" -> PR).
export default function CountrySelect({
  value, onChange, placeholder = '—', style,
}: {
  value: string | null | undefined;
  onChange: (code: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
}) {
  const items = useCatalog('country');
  const { lang } = useLang();
  const es = lang !== 'en';
  const code = countryCode(value);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const box = useRef<HTMLDivElement>(null);

  const label = (c: { es: string; en: string }) => (es ? c.es : (c.en || c.es));
  const selected = useMemo(() => items.find((c) => c.code === code), [items, code]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((c) => (`${label(c)} ${c.code}`).toLowerCase().includes(s));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, q, es]);

  const trigger: React.CSSProperties = {
    width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 8, background: 'var(--bg2, #10131c)', border: '1px solid var(--line)', borderRadius: 10,
    padding: '9px 11px', fontSize: 14, color: 'var(--tx)', cursor: 'pointer',
  };
  const item: React.CSSProperties = { padding: '8px 11px', fontSize: 14, cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'center' };

  return (
    <div ref={box} style={{ position: 'relative', ...style }}>
      <button type="button" onClick={() => { setOpen((o) => !o); setQ(''); }} style={trigger}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? `${flagOf(selected.code)} ${label(selected)}` : <span style={{ color: 'var(--mut)' }}>{placeholder}</span>}
        </span>
        <span style={{ color: 'var(--mut)', flex: 'none' }}>▾</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', zIndex: 60, top: 'calc(100% + 4px)', left: 0, right: 0,
          background: 'var(--card, #151a28)', border: '1px solid var(--line)', borderRadius: 10,
          boxShadow: '0 14px 40px rgba(0,0,0,.4)', overflow: 'hidden',
        }}>
          <div style={{ padding: 8, borderBottom: '1px solid var(--line)' }}>
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={es ? 'Buscar país…' : 'Search country…'}
              style={{ width: '100%', margin: 0, padding: '7px 10px', fontSize: 13.5 }} />
          </div>
          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            <div style={{ ...item, color: 'var(--mut)' }} onMouseDown={(e) => { e.preventDefault(); onChange(''); setOpen(false); }}>{placeholder}</div>
            {filtered.map((c) => (
              <div key={c.code} style={{ ...item, background: c.code === code ? 'color-mix(in srgb,var(--brand) 14%,transparent)' : 'transparent' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'color-mix(in srgb,var(--brand) 12%,transparent)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = c.code === code ? 'color-mix(in srgb,var(--brand) 14%,transparent)' : 'transparent')}
                onMouseDown={(e) => { e.preventDefault(); onChange(c.code); setOpen(false); setQ(''); }}>
                <span style={{ flex: 'none' }}>{flagOf(c.code)}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label(c)}</span>
              </div>
            ))}
            {!filtered.length && <div style={{ ...item, color: 'var(--mut)' }}>{es ? 'Sin resultados' : 'No results'}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
