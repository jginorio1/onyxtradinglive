'use client';
// Badge OFICIAL de Apple App Store. La imagen vive en /public (Next.js la sirve en
// la raíz del sitio). Enlace único a la ficha de la app por su Apple ID numérico.
// La imagen oficial ya trae el botón negro con su borde y el texto "Download on
// the App Store", por eso aquí NO envolvemos en ninguna caja: solo enlace + imagen.

// Apple ID numérico de la app (App Store Connect → App Information → Apple ID).
export const APPSTORE_URL = 'https://apps.apple.com/app/id6813729962';

// Archivo oficial de Apple subido a /public. Descárgalo de los lineamientos de
// marketing de Apple ("Download on the App Store" badge). Si lo renombras, cambia
// solo esta línea.
const BADGE_SRC = '/images.png';

export default function AppStoreBadge({ size = 'md' }: { size?: 'xs' | 'sm' | 'md' }) {
  // Alturas alineadas con GooglePlayBadge para que se vean parejos uno al lado del
  // otro. 'xs' es para banners y filas compactas (dashboard, chat, barra inferior).
  const h = size === 'xs' ? 44 : size === 'sm' ? 62 : 78;
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
