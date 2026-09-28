import type { Metadata } from 'next';
import JsonLd from '../JsonLd';
import { serverLang, localeAlternates, SITE as url } from '@/lib/locale';
import { getSeoMeta, seoFor } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const es = serverLang() === 'es';
  const seo = seoFor(await getSeoMeta(), 'pricing', es,
    es ? 'Planes Onyx Trading Live | Precios para Prop Firms' : 'Onyx Trading Live Plans | Pricing for Prop Firms',
    es ? 'Compara los planes Free, Pro y Elite. Gestión de riesgo, copy trading y diario para forex y CFDs. Conecta MT4, MT5 o cTrader sin comisión.'
       : 'Compare Free, Pro and Elite plans. Risk management, copy trading and journal for forex and CFDs. Connect MT4, MT5 or cTrader with no fees.');
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
