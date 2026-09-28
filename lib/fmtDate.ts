// Formato de fecha ÚNICO para toda la app, bilingüe y consistente.
//   fmtDate     → "27 jul 2026" (es) · "Jul 27, 2026" (en)
//   fmtDateTime → "27 jul 2026 · 11:32" (es) · "Jul 27, 2026 · 11:32 AM" (en)
type Lang = 'es' | 'en';

export function fmtDate(input: any, lang: Lang = 'es'): string {
  const d = input ? new Date(input) : null;
  if (!d || isNaN(d.getTime())) return '—';
  const loc = lang === 'en' ? 'en-US' : 'es-ES';
  return new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}

export function fmtDateTime(input: any, lang: Lang = 'es'): string {
  const d = input ? new Date(input) : null;
  if (!d || isNaN(d.getTime())) return '—';
  const loc = lang === 'en' ? 'en-US' : 'es-ES';
  const day = new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
  const time = new Intl.DateTimeFormat(loc, { hour: '2-digit', minute: '2-digit', hour12: lang === 'en' }).format(d);
  return `${day} · ${time}`;
}
