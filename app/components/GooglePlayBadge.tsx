'use client';
// Badge oficial-style de Google Play. Enlace único a la ficha de la app.
// Si más adelante quieres el arte OFICIAL exacto de Google, reemplaza el
// contenido por <img src="/google-play-badge.png" .../> (descárgalo del
// "Google Play Badge Generator"); este botón sigue las guías de marca
// (triángulo + "GET IT ON / Google Play") y queda idéntico en ambos temas.

export const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.onyxtradinglive.app';

export default function GooglePlayBadge({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const h = size === 'sm' ? 44 : 54;
  return (
    <a
      href={PLAY_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Descargar Onyx Trading Live en Google Play"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 10,
        background: '#000', border: '1px solid #3a3a3a', borderRadius: 10,
        padding: size === 'sm' ? '7px 14px' : '9px 18px', height: h,
        textDecoration: 'none', color: '#fff', lineHeight: 1,
      }}
    >
      {/* Triángulo Play (colores oficiales) */}
      <svg width={size === 'sm' ? 20 : 24} height={size === 'sm' ? 22 : 26} viewBox="0 0 512 512" aria-hidden="true" style={{ flex: 'none' }}>
        <path fill="#00D4FF" d="M47 24C40 29 36 38 36 50v412c0 12 4 21 11 26l2 1 231-231v-5L49 23z" />
        <path fill="#FFCE00" d="M357 336l-77-77v-6l77-77 2 1 91 52c26 15 26 39 0 54l-91 52z" />
        <path fill="#FF3D47" d="M359 335l-79-79-233 233c9 9 23 10 39 1l273-155z" />
        <path fill="#00F076" d="M359 177L86 23C70 14 56 15 47 24l233 232z" />
      </svg>
      <span style={{ textAlign: 'left' }}>
        <span style={{ display: 'block', fontSize: 8.5, letterSpacing: '.14em', opacity: .85 }}>GET IT ON</span>
        <span style={{ display: 'block', fontSize: size === 'sm' ? 15 : 17, fontWeight: 600, letterSpacing: '.01em' }}>Google Play</span>
      </span>
    </a>
  );
}
