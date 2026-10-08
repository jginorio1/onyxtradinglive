'use client';
// Badge de Google Play (imagen en /public, fondo transparente). Mismo alto y misma
// caja que AppStoreBadge → al ponerlos lado a lado se ven idénticos.

export const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.onyxtradinglive.app';

// Imagen con fondo transparente subida a /public. Si la renombras, cambia esta línea.
const BADGE_SRC = '/googleplay-badge.png';

export default function GooglePlayBadge({ size = 'md' }: { size?: 'xs' | 'sm' | 'md' }) {
  // Mismo alto que AppStoreBadge (ambas imágenes tienen la misma caja 135×40 sin
  // margen blanco), por eso quedan iguales.
  const h = size === 'xs' ? 30 : size === 'sm' ? 38 : 46;
  return (
    <a
      href={PLAY_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Descargar Onyx Trading Live en Google Play"
      style={{ display: 'inline-flex', lineHeight: 0 }}
    >
      <img
        src={BADGE_SRC}
        alt="Disponible en Google Play"
        style={{ height: h, width: 'auto', display: 'block' }}
      />
    </a>
  );
}
