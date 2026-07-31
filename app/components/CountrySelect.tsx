'use client';
import { COUNTRIES, flagOf, countryCode } from '@/app/components/countries';

// Selector de país reutilizable (mismo que usa la academia). Guarda el código ISO.
// Acepta un valor previo en texto libre ("Puerto Rico") y lo normaliza al código.
export default function CountrySelect({
  value, onChange, placeholder = '—', style,
}: {
  value: string | null | undefined;
  onChange: (code: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
}) {
  const code = countryCode(value);
  return (
    <select value={code} onChange={(e) => onChange(e.target.value)} style={style}>
      <option value="">{placeholder}</option>
      {COUNTRIES.map((c) => (
        <option key={c[0]} value={c[0]}>{flagOf(c[0])} {c[1]}</option>
      ))}
    </select>
  );
}
