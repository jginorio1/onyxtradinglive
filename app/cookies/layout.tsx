import type { Metadata } from 'next';
import { serverLang, localeAlternates, SITE as url } from '@/lib/locale';
import { getSeoMeta, seoFor } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const es = serverLang() === 'es';
  const seo = seoFor(await getSeoMeta(), 'cookies', es,
    es ? 'Política de Cookies · Onyx Trading Live' : 'Cookie Policy · Onyx Trading Live',
    es ? 'Qué cookies usa Onyx Trading Live y para qué.'
       : 'What cookies Onyx Trading Live uses and why.');
  return {
    title: seo.title, description: seo.description,
    alternates: localeAlternates('/cookies'),
    openGraph: { title: seo.title, description: seo.description, url: `${url}/cookies`, type: 'website' },
  };
}

export default function CookiesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
