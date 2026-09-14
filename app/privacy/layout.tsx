import type { Metadata } from 'next';
import { serverLang, localeAlternates, SITE as url } from '@/lib/locale';
import { getSeoMeta, seoFor } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const es = serverLang() === 'es';
  const seo = seoFor(await getSeoMeta(), 'privacy', es,
    es ? 'Política de privacidad · Onyx Trading Live' : 'Privacy Policy · Onyx Trading Live',
    es ? 'Cómo Onyx Trading Live recopila, usa y protege tus datos personales.'
       : 'How Onyx Trading Live collects, uses and protects your personal data.');
  return {
    title: seo.title, description: seo.description,
    alternates: localeAlternates('/privacy'),
    openGraph: { title: seo.title, description: seo.description, url: `${url}/privacy`, type: 'website' },
  };
}

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
