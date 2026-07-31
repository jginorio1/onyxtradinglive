'use client';
import { useEffect } from 'react';
import { useLang } from '@/lib/lang';

// Barra reutilizable: presets de fecha + rango personalizado + PDF/CSV.
// Se usa en Ingresos, Usuarios, Embajadores, etc. — misma apariencia en todos.
//
//  value    : { preset, from, to }   (estado controlado por el padre)
//  onChange : (value) => void
//  pdfUrl / csvUrl : función (from,to) => URL, o undefined para ocultar el botón

export type Range = { preset: string; from: string; to: string };
const iso = (d: Date) => d.toISOString().slice(0, 10);

export function presetRange(k: string): [string, string] {
  const now = new Date();
  if (k === 'month') return [iso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))), iso(now)];
  if (k === 'd7') return [iso(new Date(Date.now() - 7 * 86400000)), iso(now)];
  if (k === 'd30') return [iso(new Date(Date.now() - 30 * 86400000)), iso(now)];
  if (k === 'quarter') return [iso(new Date(Date.now() - 90 * 86400000)), iso(now)];
  if (k === 'year') return [iso(new Date(Date.now() - 365 * 86400000)), iso(now)];
  return ['', ''];
}
export function defaultRange(preset = 'month'): Range {
  const [from, to] = presetRange(preset);
  return { preset, from, to };
}

const L: any = {
  es: { month: 'Este mes', d7: '7 días', d30: '30 días', quarter: 'Trimestre', year: 'Año', custom: 'Personalizado', from: 'Desde', to: 'Hasta', pdf: 'PDF', csv: 'CSV' },
  en: { month: 'This month', d7: '7 days', d30: '30 days', quarter: 'Quarter', year: 'Year', custom: 'Custom', from: 'From', to: 'To', pdf: 'PDF', csv: 'CSV' },
};

export default function RangeBar({
  value, onChange, pdfUrl, csvUrl, presets = ['month', 'd7', 'd30', 'quarter', 'custom'],
}: {
  value: Range; onChange: (v: Range) => void;
  pdfUrl?: (from: string, to: string) => string;
  csvUrl?: (from: string, to: string) => string;
  presets?: string[];
}) {
  const { lang } = useLang();
  const t = L[lang];

  // Al montar, si el rango viene vacío, aplica el preset por defecto.
  useEffect(() => { if (!value.from || !value.to) onChange(defaultRange(value.preset || 'month')); }, []);

  function pick(k: string) {
    if (k === 'custom') { onChange({ ...value, preset: 'custom' }); return; }
    const [from, to] = presetRange(k);
    onChange({ preset: k, from, to });
  }

  const chip = (k: string) => (
    <button key={k} className="btn btn-ghost" onClick={() => pick(k)}
      style={{ padding: '5px 12px', fontSize: 12, ...(value.preset === k ? { borderColor: 'var(--brand)', color: 'var(--brand)' } : {}) }}>{t[k]}</button>
  );

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {presets.map(chip)}
        {(pdfUrl || csvUrl) && (
          <span className="row" style={{ gap: 8, marginLeft: 'auto' }}>
            {pdfUrl && <a className="btn btn-ghost" href={pdfUrl(value.from, value.to)} target="_blank" rel="noreferrer" style={{ padding: '6px 12px', fontSize: 12 }}>🖨️ {t.pdf}</a>}
            {csvUrl && <a className="btn btn-ghost" href={csvUrl(value.from, value.to)} style={{ padding: '6px 12px', fontSize: 12 }}>⤓ {t.csv}</a>}
          </span>
        )}
      </div>
      {value.preset === 'custom' && (
        <div className="row" style={{ gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
          <div><label className="muted" style={{ fontSize: 11.5, display: 'block' }}>{t.from}</label><input type="date" value={value.from} onChange={(e) => onChange({ ...value, from: e.target.value })} style={{ width: 150, marginTop: 3 }} /></div>
          <div><label className="muted" style={{ fontSize: 11.5, display: 'block' }}>{t.to}</label><input type="date" value={value.to} onChange={(e) => onChange({ ...value, to: e.target.value })} style={{ width: 150, marginTop: 3 }} /></div>
        </div>
      )}
    </div>
  );
}
