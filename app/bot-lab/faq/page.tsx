import type { Metadata } from 'next';
import { serverLang, localeAlternates, SITE } from '@/lib/locale';
import BotLabFaq from '../BotLabFaq';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const es = serverLang() === 'es';
  const title = es ? 'Onyx Bot Lab · Preguntas frecuentes' : 'Onyx Bot Lab · FAQ';
  const description = es
    ? 'Todo sobre comprar y vender robots, servicios a medida, pagos con tarjeta y USDT, y seguridad en Onyx Bot Lab.'
    : 'Everything about buying and selling robots, bespoke services, card and USDT payments, and safety on Onyx Bot Lab.';
  return { title, description, alternates: localeAlternates('/bot-lab/faq'), openGraph: { title, description, url: `${SITE}/bot-lab/faq`, type: 'website' } };
}

export default function BotLabFaqPage() {
  return <main style={{ padding: '30px 0 50px' }}><BotLabFaq /></main>;
}
