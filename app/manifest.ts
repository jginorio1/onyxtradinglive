import type { MetadataRoute } from 'next';

// Manifest de la PWA: hace que Onyx se pueda "instalar" en el móvil
// (ícono en la pantalla de inicio, se abre a pantalla completa sin barra del navegador).
export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Onyx Trading Live',
    short_name: 'Onyx',
    description: 'Tu diario de trading conectado a MT4/MT5, Onyx Guardian y copy trading.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0b0f1a',
    theme_color: '#121829',
    lang: 'es',
    categories: ['finance', 'productivity'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
