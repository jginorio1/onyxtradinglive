import type { Metadata } from 'next';
import { serverLang, localeAlternates, SITE as url } from '@/lib/locale';
import { getSeoMeta, seoFor } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const es = serverLang() === 'es';
  const seo = seoFor(await getSeoMeta(), 'embajadores', es,
    es ? 'Programa de embajadores · Onyx Trading Live' : 'Ambassador program · Onyx Trading Live',
    es ? 'Gana una comisión recurrente por cada persona que se suscriba con tu enlace de Onyx Trading Live, y dale un descuento a tu comunidad de traders.'
       : 'Earn a recurring commission for everyone who subscribes with your Onyx Trading Live link, and give your trading community a discount.');
  return {
    title: seo.title, description: seo.description,
    alternates: localeAlternates('/embajadores'),
    openGraph: { title: seo.title, description: seo.description, url: `${url}/embajadores`, type: 'website' },
  };
}

export default function EmbajadoresLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
