import type { Metadata } from 'next';
import { serverLang, localeAlternates, SITE as url } from '@/lib/locale';
import { getSeoMeta, seoFor } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const es = serverLang() === 'es';
  const seo = seoFor(await getSeoMeta(), 'invita', es,
    es ? 'Invita y gana con Onyx · Programa de referidos' : 'Refer & earn with Onyx',
    es ? 'Comparte tu enlace de Onyx Trading Live, dale un descuento a tu gente y gana recompensas por cada persona que se una.'
       : 'Share your Onyx Trading Live link, give your people a discount and earn rewards for everyone who joins.');
  return {
    title: seo.title, description: seo.description,
    alternates: localeAlternates('/invita'),
    openGraph: { title: seo.title, description: seo.description, url: `${url}/invita`, type: 'website' },
  };
}

export default function InvitaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
