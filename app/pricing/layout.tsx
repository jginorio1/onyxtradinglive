import type { Metadata } from 'next';
import JsonLd from '../JsonLd';

const url = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.onyxtradinglive.com').replace(/\/$/, '');

export const metadata: Metadata = {
  title: 'Planes y precios · Onyx Trading Live',
  description: 'Compara los planes de Onyx Trading Live: Gratis, Pro y Elite. Diario de trading, estadísticas automáticas, control de fondeo y Onyx Guardian para MT4/MT5.',
  alternates: { canonical: '/pricing' },
  openGraph: { title: 'Planes y precios · Onyx Trading Live', description: 'Gratis, Pro y Elite. Elige cómo llevar tu trading al siguiente nivel.', url: `${url}/pricing`, type: 'website' },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  const ld = {
    '@context': 'https://schema.org', '@type': 'Product',
    name: 'Onyx Trading Live', description: 'Diario de trading y gestor de riesgo para cuentas MT4/MT5.',
    brand: { '@type': 'Brand', name: 'Onyx Trading Live' },
    offers: { '@type': 'AggregateOffer', priceCurrency: 'USD', lowPrice: '0', offerCount: 3, availability: 'https://schema.org/InStock', url: `${url}/pricing` },
  };
  return <><JsonLd data={ld} />{children}</>;
}
