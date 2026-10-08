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
const BADGE_SRC = '/appstore-badge.png';

export default function AppStoreBadge({ size = 'md' }: { size?: 'xs' | 'sm' | 'md' }) {
  // El badge de Google Play (PNG oficial) trae margen transparente arriba/abajo, así
  // que su botón visible es más bajo que su caja. El de Apple no tiene margen. Para
  // que se vean del MISMO alto uno al lado del otro, usamos ~72% de la altura de la
  // caja de Google Play (sm 62→44, md 78→56, xs 44→32).
  const h = size === 'xs' ? 32 : size === 'sm' ? 44 : 56;
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
