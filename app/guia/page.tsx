import type { Metadata } from 'next';
import GuideHome from './GuideHome';
import { serverLang, localeAlternates } from '@/lib/locale';
import { getSeoMeta, seoFor } from '@/lib/seo';

// Pública a propósito: los artículos sobre métricas y fondeo responden a
// búsquedas reales de Google y traen usuarios sin coste añadido.
export async function generateMetadata(): Promise<Metadata> {
  const es = serverLang() === 'es';
  const seo = seoFor(await getSeoMeta(), 'guia', es,
    es ? 'Guía Onyx: Instalar, Métricas y Reglas de Prop Firm' : 'Onyx Guide: Install, Metrics & Prop Firm Rules',
    es ? 'Aprende a instalar Onyx en MT4, MT5 y cTrader, gestionar el riesgo en fondeos y dominar las reglas de prop firm y el drawdown diario.'
       : 'Learn to install Onyx on MT4, MT5 and cTrader, manage risk in funded accounts, and master prop firm rules and daily drawdown.');
  return { title: seo.title, description: seo.description, alternates: localeAlternates('/guia') };
}

export default function GuiaPage() {
  return <GuideHome />;
}
