import type { Metadata } from 'next';
import { serverLang, localeAlternates, SITE as url } from '@/lib/locale';
import { getSeoMeta, seoFor } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const es = serverLang() === 'es';
  const seo = seoFor(await getSeoMeta(), 'embajadores', es,
    es ? 'Programa de Embajadores Onyx | Gana Comisión' : 'Onyx Ambassador Program | Earn Recurring Commission',
    es ? 'Gana comisión recurrente refiriendo traders. Acceso a diario de trading, gestión de riesgo y copy trading en MT4, MT5 y cTrader.'
       : 'Earn recurring commissions by referring traders. Access to the trading journal, risk management and copy trading for MT4, MT5 and cTrader.');
  return {
    title: seo.title, description: seo.description,
    alternates: localeAlternates('/embajadores'),
    openGraph: { title: seo.title, description: seo.description, url: `${url}/embajadores`, type: 'website' },
  };
}

export default function EmbajadoresLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
