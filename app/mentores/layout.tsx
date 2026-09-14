import type { Metadata } from 'next';
import { serverLang, localeAlternates, SITE as url } from '@/lib/locale';
import { getSeoMeta, seoFor } from '@/lib/seo';

// Metadata SEO de /mentores (la página es client, así que va aquí, en el layout
// server, igual que embajadores/contacto/pricing).
export async function generateMetadata(): Promise<Metadata> {
  const es = serverLang() === 'es';
  const seo = seoFor(await getSeoMeta(), 'mentores', es,
    es ? 'Monta tu academia de trading · Onyx para mentores' : 'Build your trading academy · Onyx for mentors',
    es ? 'Convierte tu conocimiento en una academia de trading estilo comunidad: cursos, clases en vivo, cobros con Stripe y tu propia marca. Onyx pone la tecnología.'
       : 'Turn your knowledge into a community-style trading academy: courses, live classes, Stripe payouts and your own brand. Onyx brings the tech.');
  return {
    title: seo.title, description: seo.description,
    alternates: localeAlternates('/mentores'),
    openGraph: { title: seo.title, description: seo.description, url: `${url}/mentores`, type: 'website' },
  };
}

export default function MentoresLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
