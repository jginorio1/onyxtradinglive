import type { Metadata } from 'next';
import { serverLang, localeAlternates, SITE as url } from '@/lib/locale';
import { getSeoMeta, seoFor } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const es = serverLang() === 'es';
  const seo = seoFor(await getSeoMeta(), 'academias', es,
    es ? 'Academias de trading en Onyx · Encuentra tu mentor' : 'Trading academies on Onyx · Find your mentor',
    es ? 'Explora las academias y comunidades de trading que usan Onyx: cursos, clases en vivo y mentores verificados. Aprende con datos, disciplina y acompañamiento.'
       : 'Explore the trading academies and communities on Onyx: courses, live classes and verified mentors. Learn with data, discipline and support.');
  return {
    title: seo.title, description: seo.description,
    alternates: localeAlternates('/academias'),
    openGraph: { title: seo.title, description: seo.description, url: `${url}/academias`, type: 'website' },
  };
}

export default function AcademiasLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
