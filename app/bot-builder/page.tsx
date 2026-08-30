import type { Metadata } from 'next';
import { serverLang } from '@/lib/locale';
import LandingConstructor from './LandingConstructor';

const SITE = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.onyxtradinglive.com').replace(/\/$/, '');

// Metadatos SEO del landing "Crea tu bot" (/bot-builder). Bilingüe según el idioma
// del servidor: título + descripción, canonical, hreflang, Open Graph y Twitter.
export function generateMetadata(): Metadata {
  const es = serverLang() !== 'en';
  const path = '/bot-builder';
  const title = es
    ? 'Crea tu bot de trading sin programar · MT4, MT5 y cTrader | Onyx'
    : 'Build your trading bot without coding · MT4, MT5 & cTrader | Onyx';
  const description = es
    ? 'Crea robots de trading para pasar tu reto de fondeo sin programar. El bot lleva tus reglas de pérdida diaria, drawdown, noticias y sesión adentro. Descarga el EA y una guía en PDF. Para MT4, MT5 y cTrader.'
    : 'Build trading robots to pass your funded challenge without coding. The bot carries your daily-loss, drawdown, news and session rules inside. Download the EA and a PDF guide. For MT4, MT5 and cTrader.';
  const keywords = es
    ? ['crear bot de trading', 'bot de trading sin programar', 'robot para cuenta de fondeo', 'expert advisor MT5', 'EA para prop firm', 'bot MT4 MT5 cTrader', 'pasar reto de fondeo', 'constructor de bots forex']
    : ['build trading bot', 'no-code trading bot', 'funded account robot', 'MT5 expert advisor', 'prop firm EA', 'MT4 MT5 cTrader bot', 'pass funded challenge', 'forex bot builder'];
  return {
    title,
    description,
    keywords,
    alternates: {
      canonical: `${SITE}${path}`,
      languages: { 'x-default': `${SITE}${path}`, es: `${SITE}${path}`, en: `${SITE}/en${path}` },
    },
    openGraph: {
      type: 'website',
      url: `${SITE}${path}`,
      siteName: 'Onyx Trading Live',
      title,
      description,
      locale: es ? 'es_ES' : 'en_US',
    },
    twitter: { card: 'summary_large_image', title, description },
    robots: { index: true, follow: true },
  };
}

export default function ConstructorPage() {
  const es = serverLang() !== 'en';
  const path = '/bot-builder';
  // Datos estructurados: qué es el producto (SoftwareApplication), migas de pan y
  // preguntas frecuentes → habilita rich results y ayuda a que Google entienda la página.
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: 'Onyx Bot',
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'MetaTrader 4, MetaTrader 5, cTrader',
        url: `${SITE}${path}`,
        description: es
          ? 'Constructor de bots de trading sin programar para cuentas de fondeo. Genera un EA con tus reglas de riesgo, noticias y sesión, y registra cada operación en tu panel.'
          : 'No-code trading bot builder for funded accounts. Generates an EA with your risk, news and session rules, and logs every trade to your dashboard.',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', description: es ? 'Empieza gratis' : 'Start free' },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Onyx Trading Live', item: SITE },
          { '@type': 'ListItem', position: 2, name: es ? 'Crea tu bot' : 'Build a bot', item: `${SITE}${path}` },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: es ? '¿Necesito saber programar?' : 'Do I need to know how to code?',
            acceptedAnswer: { '@type': 'Answer', text: es ? 'No. Armas el bot por campos (entrada, stop, TP, riesgo) y Onyx genera el robot listo para MT4, MT5 o cTrader, con una guía en PDF paso a paso.' : 'No. You build the bot by fields (entry, stop, TP, risk) and Onyx generates the ready robot for MT4, MT5 or cTrader, with a step-by-step PDF guide.' },
          },
          {
            '@type': 'Question',
            name: es ? '¿Funciona con mi prop firm?' : 'Does it work with my prop firm?',
            acceptedAnswer: { '@type': 'Answer', text: es ? 'Sí. Defines las reglas de tu reto (pérdida diaria, drawdown, objetivo) y el bot las lleva dentro: se frena solo antes de romperlas.' : 'Yes. You set your challenge rules (daily loss, drawdown, target) and the bot carries them inside: it stops itself before breaking them.' },
          },
          {
            '@type': 'Question',
            name: es ? '¿En qué plataformas corre?' : 'Which platforms does it run on?',
            acceptedAnswer: { '@type': 'Answer', text: es ? 'MetaTrader 4, MetaTrader 5 y cTrader. El mismo constructor genera el archivo correcto para cada una.' : 'MetaTrader 4, MetaTrader 5 and cTrader. The same builder generates the correct file for each.' },
          },
          {
            '@type': 'Question',
            name: es ? '¿El bot garantiza ganancias?' : 'Does the bot guarantee profit?',
            acceptedAnswer: { '@type': 'Answer', text: es ? 'No. Ninguna herramienta puede garantizar resultados. El trading conlleva riesgo; prueba todo en demo antes de real.' : 'No. No tool can guarantee results. Trading carries risk; test everything on demo before going live.' },
          },
        ],
      },
    ],
  };
  return (
    <div className="wrap-wide" style={{ padding: '0 18px' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <LandingConstructor />
    </div>
  );
}
