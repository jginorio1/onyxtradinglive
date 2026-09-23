import type { Metadata } from 'next';
import { serverLang, localeAlternates, SITE as url } from '@/lib/locale';

// Metadata genérica de la academia pública (la página es client y el título real
// depende del código). Canonical por código para que cada academia sea indexable.
export async function generateMetadata({ params }: { params: { code: string } }): Promise<Metadata> {
  const es = serverLang() === 'es';
  const code = String(params?.code || '').slice(0, 60);
  const title = es ? 'Academia de trading en Onyx' : 'Trading academy on Onyx';
  const description = es
    ? 'Comunidad de trading con cursos, clases en vivo y mentoría, montada sobre Onyx Trading Live.'
    : 'A trading community with courses, live classes and mentorship, built on Onyx Trading Live.';
  return {
    title, description,
    alternates: localeAlternates(`/academia/${code}`),
    openGraph: { title, description, url: `${url}/academia/${code}`, type: 'website' },
  };
}

export default function AcademiaCodeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
