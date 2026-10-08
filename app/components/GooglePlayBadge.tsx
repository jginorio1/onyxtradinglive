'use client';
// Badge OFICIAL de Google Play. La imagen vive en /public (Next.js la sirve en
// la raíz del sitio). Enlace único a la ficha de la app. La imagen oficial ya
// trae el botón negro con su borde y el texto "GET IT ON · Google Play", por eso
// aquí NO envolvemos en ninguna caja: solo el enlace + la imagen.

export const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.onyxtradinglive.app';

// Archivo tal cual lo subiste a /public. Si lo renombras, cambia solo esta línea.
const BADGE_SRC = '/googleplay-badge-01-getit.width-375.png';

export default function GooglePlayBadge({ size = 'md' }: { size?: 'xs' | 'sm' | 'md' }) {
  // Alto del badge. La imagen oficial trae margen transparente, por eso usamos
  // alturas generosas para que el logo se vea bien grande. 'xs' es para banners
  // y filas compactas (dashboard, barra inferior).
  const h = size === 'xs' ? 44 : size === 'sm' ? 62 : 78; // el ancho se ajusta solo
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
