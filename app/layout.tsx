import './globals.css';
import type { Metadata, Viewport } from 'next';
import TopBar from './TopBar';
import SiteFooter from './SiteFooter';
import PWARegister from './PWARegister';
import ChunkReload from './ChunkReload';
import LiveNavRefresh from './LiveNavRefresh';
import UpdateToast from './UpdateToast';
import SupportWidget from './SupportWidget';
import { Toaster } from '@/lib/toast';
import JsonLd from './JsonLd';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { LanguageProvider } from '@/lib/lang';
import { BetaProvider } from '@/lib/beta';
import BetaBanner from './BetaBanner';
import EnvBanner from './EnvBanner';
import { serverBeta } from '@/lib/betaServer';
import PromoBar from './PromoBar';
import { getSetting } from '@/lib/settings';
import { type Promo, PROMO0 } from '@/lib/promo';
import { headers } from 'next/headers';
import type { Lang } from '@/lib/navText';
import { serverLang, localeAlternates } from '@/lib/locale';
import { serverTheme } from '@/lib/theme';

// La barra lee la sesión en cada petición, así que esta capa no se cachea.
export const dynamic = 'force-dynamic';

// Color de la barra del sistema cuando se instala como app (PWA).
export const viewport: Viewport = {
  themeColor: '#121829',
};

const url = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.onyxtradinglive.com').replace(/\/$/, '');

export function generateMetadata(): Metadata {
  const es = serverLang() === 'es';
  return {
    metadataBase: new URL(url),
    title: es
      ? 'Onyx Trading Live · Tu diario de trading conectado a MT4/MT5'
      : 'Onyx Trading Live · Your trading journal connected to MT4/MT5',
    description: es
      ? 'Conecta tus cuentas de MetaTrader (MT4/MT5) o cTrader y analiza tu trading automáticamente: estadísticas, calendario, sesiones, pares, seguimiento de fondeo, copy trading y academia. Empieza gratis.'
      : 'Connect your MetaTrader (MT4/MT5) or cTrader accounts and analyze your trading automatically: stats, calendar, sessions, pairs, funding tracking, copy trading and academy. Start free.',
    keywords: ['trading journal', 'diario de trading', 'MT4', 'MT5', 'MetaTrader', 'cTrader', 'MatchTrader', 'estadísticas trading', 'trading stats', 'FTMO', 'prop firm', 'copy trading', 'trading academy', 'analytics'],
    alternates: localeAlternates('/'),
    manifest: '/manifest.webmanifest',
    appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Onyx' },
    icons: { icon: '/onyx-symbol.png', apple: '/apple-touch-icon.png' },
    openGraph: {
      title: es ? 'Onyx Trading Live · Tu diario de trading inteligente' : 'Onyx Trading Live · Your smart trading journal',
      description: es
        ? 'Conecta MT4/MT5 y analiza cada operación. Estadísticas, calendario y portafolio en tiempo real.'
        : 'Connect MT4/MT5 and analyze every trade. Stats, calendar and portfolio in real time.',
      url, siteName: 'Onyx Trading Live', type: 'website', images: ['/onyx-symbol.png'],
    },
    twitter: {
      card: 'summary_large_image', title: 'Onyx Trading Live',
      description: es ? 'Tu diario de trading conectado a MT4/MT5.' : 'Your trading journal connected to MT4/MT5.',
      images: ['/onyx-symbol.png'],
    },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // El idioma se decide aquí (cabecera /en del middleware o cookie) y baja a todo lo demás.
  const lang: Lang = serverLang();
  const beta = serverBeta();
  const theme = serverTheme(); // 'light' | 'dark' | null (null = sigue el sistema)

  // Barra de descuentos: solo en páginas públicas (no en dashboard/admin/cuenta).
  const path = headers().get('x-onyx-path') || '/';
  const isPublic = !/^\/(dashboard|admin|account|onboarding)/.test(path);
  const promo = isPublic ? await getSetting<Promo>('promo', PROMO0) : PROMO0;
  const promoLive = promo.on && (lang === 'es' ? promo.text_es : promo.text_en) && (!promo.endsAt || new Date(promo.endsAt).getTime() > Date.now());

  // ¿Hay sesión? La burbuja de soporte se comporta distinto para trader o visitante.
  let loggedIn = false;
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    loggedIn = !!user;
  } catch { /* si falla, la tratamos como visitante */ }

  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization', '@id': `${url}/#org`, name: 'Onyx Trading Live', url,
        logo: `${url}/onyx-symbol.png`,
        sameAs: [] as string[],
      },
      {
        '@type': 'WebSite', '@id': `${url}/#site`, url, name: 'Onyx Trading Live',
        publisher: { '@id': `${url}/#org` }, inLanguage: ['es', 'en'],
      },
      {
        '@type': 'SoftwareApplication', name: 'Onyx Trading Live',
        applicationCategory: 'FinanceApplication', operatingSystem: 'Windows, macOS (MetaTrader 4/5, cTrader)',
        description: 'Diario de trading y gestor de riesgo (Onyx Guardian) para cuentas de MetaTrader (MT4/MT5) y cTrader: estadísticas automáticas, calendario, control de fondeo, copy trading, academia y protección del plan de trading.',
        url,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', description: 'Plan gratis para empezar' },
      },
    ],
  };

  return (
    <html lang={lang} data-theme={theme || undefined} suppressHydrationWarning>
      <body>
        {/* Fuente CJK: solo se carga cuando el idioma es chino o japonés (pesan). */}
        {(lang === 'zh' || lang === 'ja') && (
          <link rel="stylesheet" href={`https://fonts.googleapis.com/css2?family=Noto+Sans+${lang === 'ja' ? 'JP' : 'SC'}:wght@400;500;700&display=swap`} />
        )}
        <JsonLd data={graph} />
        <EnvBanner />
        <LanguageProvider initial={lang}>
          <BetaProvider initial={beta}>
            {promoLive && (
              <PromoBar
                text={lang === 'es' ? promo.text_es : promo.text_en}
                cta={lang === 'es' ? promo.cta_es : promo.cta_en}
                link={promo.link} bg={promo.bg} fg={promo.fg} endsAt={promo.endsAt}
              />
            )}
            <BetaBanner />
            <TopBar />
            {children}
            {!path.startsWith('/admin') && <SiteFooter />}
            {!path.startsWith('/admin') && <SupportWidget loggedIn={loggedIn} />}
            <Toaster />
            <PWARegister />
            <ChunkReload />
            <LiveNavRefresh />
            {/* <UpdateToast /> — aviso de "nueva versión" desactivado (molesto). La
                versión nueva llega en la próxima recarga; ChunkReload evita errores. */}
          </BetaProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
