import type { Metadata } from 'next';
import JsonLd from '../JsonLd';
import { serverLang, localeAlternates, SITE as url } from '@/lib/locale';

export function generateMetadata(): Metadata {
  const es = serverLang() === 'es';
  return {
    title: es ? 'Planes y precios · Onyx Trading Live' : 'Plans and pricing · Onyx Trading Live',
    description: es
      ? 'Compara los planes de Onyx Trading Live: Gratis, Pro y Elite. Diario de trading, estadísticas automáticas, control de fondeo y Onyx Guardian para MT4/MT5.'
      : 'Compare Onyx Trading Live plans: Free, Pro and Elite. Trading journal, automatic stats, funding control and Onyx Guardian for MT4/MT5.',
    alternates: localeAlternates('/pricing'),
    openGraph: { title: es ? 'Planes y precios · Onyx Trading Live' : 'Plans and pricing · Onyx Trading Live', description: es ? 'Gratis, Pro y Elite.' : 'Free, Pro and Elite.', url: `${url}/pricing`, type: 'website' },
  };
}

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  const ld = {
    '@context': 'https://schema.org', '@type': 'Product',
    name: 'Onyx Trading Live', description: 'Diario de trading y gestor de riesgo para cuentas MT4/MT5.',
    brand: { '@type': 'Brand', name: 'Onyx Trading Live' },
    offers: { '@type': 'AggregateOffer', priceCurrency: 'USD', lowPrice: '0', offerCount: 3, availability: 'https://schema.org/InStock', url: `${url}/pricing` },
  };
  return <><JsonLd data={ld} />{children}</>;
}
