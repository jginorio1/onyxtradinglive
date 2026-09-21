import type { Metadata } from 'next';
import { serverLang, localeAlternates, SITE as url } from '@/lib/locale';
import { getSeoMeta, seoFor } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const es = serverLang() === 'es';
  const seo = seoFor(await getSeoMeta(), 'analiza', es,
    es ? 'Analiza tu reporte de trading gratis · Onyx' : 'Analyze your trading report free · Onyx',
    es ? 'Sube tu reporte de MT4/MT5 o cTrader y recibe un análisis instantáneo con IA: métricas, fortalezas y qué mejorar. Gratis y sin registrarte.'
       : 'Upload your MT4/MT5 or cTrader report and get an instant AI analysis: metrics, strengths and what to improve. Free, no sign-up.');
  return {
    title: seo.title, description: seo.description,
    alternates: localeAlternates('/analiza'),
    openGraph: { title: seo.title, description: seo.description, url: `${url}/analiza`, type: 'website' },
  };
}

export default function AnalizaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
