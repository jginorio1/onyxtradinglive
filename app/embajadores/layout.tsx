import type { Metadata } from 'next';
import { serverLang, localeAlternates, SITE as url } from '@/lib/locale';

export function generateMetadata(): Metadata {
  const es = serverLang() === 'es';
  return {
    title: es ? 'Programa de embajadores · Onyx Trading Live' : 'Ambassador program · Onyx Trading Live',
    description: es
      ? 'Gana una comisión recurrente por cada persona que se suscriba con tu enlace de Onyx Trading Live, y dale un descuento a tu comunidad de traders.'
      : 'Earn a recurring commission for everyone who subscribes with your Onyx Trading Live link, and give your trading community a discount.',
    alternates: localeAlternates('/embajadores'),
    openGraph: { title: es ? 'Programa de embajadores · Onyx Trading Live' : 'Ambassador program · Onyx Trading Live', description: es ? 'Comisión recurrente por cada suscripción con tu enlace.' : 'Recurring commission for every subscription with your link.', url: `${url}/embajadores`, type: 'website' },
  };
}

export default function EmbajadoresLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
