// Lista curada de zonas horarias (nombre IANA + etiqueta legible), agrupada por
// región, para el dropdown del perfil. No pretende ser exhaustiva: cubre las
// zonas de mercado y de país más comunes de los traders. Si el navegador reporta
// una zona que no está aquí, la app la añade al vuelo (ver ensureZone()).
export type TzOption = { id: string; label: string };
export type TzGroup = { region: string; zones: TzOption[] };

export const TZ_GROUPS: TzGroup[] = [
  {
    region: 'América',
    zones: [
      { id: 'America/Los_Angeles', label: 'Los Ángeles · Pacífico (PT)' },
      { id: 'America/Denver', label: 'Denver · Montaña (MT)' },
      { id: 'America/Chicago', label: 'Chicago · Central (CT)' },
      { id: 'America/New_York', label: 'Nueva York · Este (ET)' },
      { id: 'America/Toronto', label: 'Toronto (ET)' },
      { id: 'America/Mexico_City', label: 'Ciudad de México (CT)' },
      { id: 'America/Bogota', label: 'Bogotá / Lima / Quito' },
      { id: 'America/Caracas', label: 'Caracas' },
      { id: 'America/Puerto_Rico', label: 'San Juan / Santo Domingo (AST)' },
      { id: 'America/Santiago', label: 'Santiago de Chile' },
      { id: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires' },
      { id: 'America/Sao_Paulo', label: 'São Paulo' },
    ],
  },
  {
    region: 'Europa / África',
    zones: [
      { id: 'Europe/London', label: 'Londres / Lisboa (GMT/BST)' },
      { id: 'Europe/Madrid', label: 'Madrid / París / Roma (CET)' },
      { id: 'Europe/Berlin', label: 'Berlín / Ámsterdam (CET)' },
      { id: 'Europe/Athens', label: 'Atenas / Bucarest (EET)' },
      { id: 'Europe/Moscow', label: 'Moscú' },
      { id: 'Africa/Lagos', label: 'Lagos / Casablanca (WAT)' },
      { id: 'Africa/Johannesburg', label: 'Johannesburgo (SAST)' },
    ],
  },
  {
    region: 'Asia / Pacífico',
    zones: [
      { id: 'Asia/Dubai', label: 'Dubái (GST)' },
      { id: 'Asia/Karachi', label: 'Karachi / Islamabad' },
      { id: 'Asia/Kolkata', label: 'India (IST)' },
      { id: 'Asia/Bangkok', label: 'Bangkok / Yakarta' },
      { id: 'Asia/Singapore', label: 'Singapur / Hong Kong' },
      { id: 'Asia/Shanghai', label: 'Shanghái / Pekín (CST)' },
      { id: 'Asia/Tokyo', label: 'Tokio / Seúl (JST)' },
      { id: 'Australia/Sydney', label: 'Sídney (AEST)' },
      { id: 'Pacific/Auckland', label: 'Auckland (NZST)' },
    ],
  },
  {
    region: 'Universal',
    zones: [{ id: 'UTC', label: 'UTC (hora universal)' }],
  },
];

// Todas las zonas en una lista plana (para búsquedas por id).
export const TZ_FLAT: TzOption[] = TZ_GROUPS.flatMap((g) => g.zones);

// Devuelve la etiqueta legible de un id IANA, o el propio id si no está en la lista.
export function tzLabel(id: string): string {
  return TZ_FLAT.find((z) => z.id === id)?.label || id;
}

// Si `id` es una zona IANA válida que no está en la lista, la devuelve como una
// opción extra (para no perder la zona real detectada del navegador). Vacío si no
// hay que añadir nada.
export function ensureZone(id?: string): TzOption | null {
  const v = String(id || '').trim();
  if (!v) return null;
  if (TZ_FLAT.some((z) => z.id === v)) return null;
  // Validación mínima: que Intl la reconozca.
  try { new Intl.DateTimeFormat('en-US', { timeZone: v }); } catch { return null; }
  return { id: v, label: v.replace(/_/g, ' ') };
}
