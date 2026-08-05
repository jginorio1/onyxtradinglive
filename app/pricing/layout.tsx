import type { Metadata } from 'next';
import JsonLd from '../JsonLd';
import { serverLang, localeAlternates, SITE as url } from '@/lib/locale';
import { getSeoMeta, seoFor } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const es = serverLang() === 'es';
  const seo = seoFor(await getSeoMeta(), 'pricing', es,
    es ? 'Planes y precios · Onyx Trading Live' : 'Plans and pricing · Onyx Trading Live',
    es ? 'Compara los planes de Onyx Trading Live: Gratis, Pro y Elite. Diario de trading, estadísticas automáticas, control de fondeo y Onyx Guardian para MetaTrader (MT4/MT5) y cTrader.'
       : 'Compare Onyx Trading Live plans: Free, Pro and Elite. Trading journal, automatic stats, funding control and Onyx Guardian for MetaTrader (MT4/MT5) and cTrader.');
  return {
    title: seo.title,
    description: seo.description,
    alternates: localeAlternates('/pricing'),
    openGraph: { title: seo.title, description: seo.description, url: `${url}/pricing`, type: 'website' },
  };
}

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  const ld = {
    '@context': 'https://schema.org', '@type': 'Product',
    name: 'Onyx Trading Live', description: 'Diario de trading y gestor de riesgo para cuentas de MetaTrader (MT4/MT5) y cTrader.',
    brand: { '@type': 'Brand', name: 'Onyx Trading Live' },
    offers: { '@type': 'AggregateOffer', priceCurrency: 'USD', lowPrice: '0', offerCount: 3, availability: 'https://schema.org/InStock', url: `${url}/pricing` },
  };
  return <><JsonLd data={ld} />{children}</>;
}
