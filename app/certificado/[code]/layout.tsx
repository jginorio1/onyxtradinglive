import type { Metadata } from 'next';
import { serverLang, localeAlternates, SITE as url } from '@/lib/locale';

// Metadata del certificado público de Onyx Copy (página client). Canonical por
// código; indexable para que sirva de prueba pública verificable.
export async function generateMetadata({ params }: { params: { code: string } }): Promise<Metadata> {
  const es = serverLang() === 'es';
  const code = String(params?.code || '').slice(0, 60);
  const title = es ? 'Certificado verificado · Onyx Copy' : 'Verified certificate · Onyx Copy';
  const description = es
    ? 'Certificado público y verificable de rendimiento de un proveedor de Onyx Copy.'
    : 'Public, verifiable performance certificate of an Onyx Copy provider.';
  return {
    title, description,
    alternates: localeAlternates(`/certificado/${code}`),
    openGraph: { title, description, url: `${url}/certificado/${code}`, type: 'website' },
  };
}

export default function CertificadoCodeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
