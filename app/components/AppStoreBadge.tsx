'use client';
// Badge de la App Store (imagen en /public, fondo transparente, sin borde blanco).
// Mismo alto y misma caja que GooglePlayBadge → al ponerlos lado a lado se ven iguales.

// Apple ID numérico de la app (App Store Connect → App Information → Apple ID).
export const APPSTORE_URL = 'https://apps.apple.com/app/id6813729962';

// Imagen con fondo transparente subida a /public. Si la renombras, cambia esta línea.
const BADGE_SRC = '/appstore-badge.png';

export default function AppStoreBadge({ size = 'md' }: { size?: 'xs' | 'sm' | 'md' }) {
  // Mismo alto que GooglePlayBadge (misma caja 135×40, sin margen) → quedan iguales.
  const h = size === 'xs' ? 30 : size === 'sm' ? 38 : 46;
  return (
    <a
      href={APPSTORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Descargar Onyx Trading Live en la App Store"
      style={{ display: 'inline-flex', lineHeight: 0 }}
    >
      <img
        src={BADGE_SRC}
        alt="Disponible en la App Store"
        style={{ height: h, width: 'auto', display: 'block' }}
      />
    </a>
  );
}
