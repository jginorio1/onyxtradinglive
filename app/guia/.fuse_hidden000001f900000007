import type { Metadata } from 'next';
import GuideHome from './GuideHome';
import { serverLang, localeAlternates } from '@/lib/locale';

// Pública a propósito: los artículos sobre métricas y fondeo responden a
// búsquedas reales de Google y traen usuarios sin coste añadido.
export function generateMetadata(): Metadata {
  const es = serverLang() === 'es';
  return {
    title: es
      ? 'Guía de Onyx · Cómo sacarle partido a tu diario de trading'
      : 'Onyx Guide · How to get the most out of your trading journal',
    description: es
      ? 'Instalación, métricas explicadas sin tecnicismos, gestión de riesgo y reglas de prop firms. La guía completa de Onyx Trading Live.'
      : 'Install, metrics explained in plain words, risk management and prop-firm rules. The complete Onyx Trading Live guide.',
    alternates: localeAlternates('/guia'),
  };
}

export default function GuiaPage() {
  return <GuideHome />;
}
