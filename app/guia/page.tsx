import type { Metadata } from 'next';
import GuideHome from './GuideHome';

// Pública a propósito: los artículos sobre métricas y fondeo responden a
// búsquedas reales de Google y traen usuarios sin coste añadido.
export const metadata: Metadata = {
  title: 'Guía de Onyx · Cómo sacarle partido a tu diario de trading',
  description: 'Instalación, métricas explicadas sin tecnicismos, gestión de riesgo y reglas de prop firms. La guía completa de Onyx Trading Live.',
};

export default function GuiaPage() {
  return <GuideHome />;
}
