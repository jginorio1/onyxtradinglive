import type { Metadata } from 'next';
import { serverLang, localeAlternates, SITE as url } from '@/lib/locale';
import { getSeoMeta, seoFor } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const es = serverLang() === 'es';
  const seo = seoFor(await getSeoMeta(), 'terms', es,
    es ? 'Términos y condiciones · Onyx Trading Live' : 'Terms & Conditions · Onyx Trading Live',
    es ? 'Los términos de uso de Onyx Trading Live: cuenta, suscripción, pagos y responsabilidades.'
       : 'The terms of use for Onyx Trading Live: account, subscription, payments and responsibilities.');
  return {
    title: seo.title, description: seo.description,
    alternates: localeAlternates('/terms'),
    openGraph: { title: seo.title, description: seo.description, url: `${url}/terms`, type: 'website' },
  };
}

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
