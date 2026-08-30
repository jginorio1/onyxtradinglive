import './globals.css';
import type { Metadata, Viewport } from 'next';
import TopBar from './TopBar';
import SectionNav from './SectionNav';
import SiteFooter from './SiteFooter';
import PWARegister from './PWARegister';
import ChunkReload from './ChunkReload';
import LiveNavRefresh from './LiveNavRefresh';
import UpdateToast from './UpdateToast';
import SupportWidget from './SupportWidget';
import { Toaster } from '@/lib/toast';
import JsonLd from './JsonLd';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { LanguageProvider } from '@/lib/lang';
import { BetaProvider } from '@/lib/beta';
import BetaBanner from './BetaBanner';
import EnvBanner from './EnvBanner';
import { serverBeta } from '@/lib/betaServer';
import PromoBar from './PromoBar';
import OnlineNow from './OnlineNow';
import VisitorBeacon from './VisitorBeacon';
import TzSync from './TzSync';
import PendingCheckoutGate from './PendingCheckoutGate';
import { getSetting, onlineNowSettings, chatWidgetSettings } from '@/lib/settings';
import { getSeoMeta, seoFor } from '@/lib/seo';
import { type Promo, type PromoQueue, pickActiveBar } from '@/lib/promo';
import { headers } from 'next/headers';
import type { Lang } from '@/lib/navText';
import { serverLang, localeAlternates } from '@/lib/locale';
import { serverTheme } from '@/lib/theme';

// La barra lee la sesión en cada petición, así que esta capa no se cachea.
export const dynamic = 'force-dynamic';

// Color de la barra del sistema cuando se instala como app (PWA).
// width=device-width + initialScale evitan el zoom raro en móvil; viewportFit
// 'cover' habilita las zonas seguras (safe-area) del notch; interactiveWidget
// hace que el teclado móvil reduzca el alto (dvh) en vez de tapar el input.
export const viewport: Viewport = {
  themeColor: '#121829',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
};

const url = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.onyxtradinglive.com').replace(/\/$/, '');

export async function generateMetadata(): Promise<Metadata> {
  const es = serverLang() === 'es';
  // Overrides de título/descripción que el owner edita en Admin → SEO (si vacío, usa el default).
  const seo = seoFor(await getSeoMeta(), 'home', es,
    es ? 'Onyx Trading Live · El sistema operativo del trader de fondeo' : 'Onyx Trading Live · The operating system for funded traders',
    es ? 'Conecta MT4, MT5 y cTrader, sigue las reglas de tu prop firm en vivo, protege tu riesgo con el Onyx Guardian y copia entre cuentas. Journal, analítica y ganancia neta. Empieza gratis.'
       : 'Connect MT4, MT5 and cTrader, track your prop-firm rules live, protect your risk with Onyx Guardian and copy across accounts. Journal, analytics and net profit. Start free.');
  const gVer = process.env.GOOGLE_SITE_VERIFICATION;
  const bVer = process.env.BING_SITE_VERIFICATION;
  return {
    metadataBase: new URL(url),
    title: seo.title,
    description: seo.description,
    keywords: ['trading journal', 'diario de trading', 'MT4', 'MT5', 'MetaTrader', 'cTrader', 'MatchTrader', 'TradingView', 'TradingView signals', 'señales TradingView', 'estadísticas trading', 'trading stats', 'FTMO', 'prop firm', 'copy trading', 'trading academy', 'analytics'],
    verification: gVer ? { google: gVer, ...(bVer ? { other: { 'msvalidate.01': bVer } } : {}) } : (bVer ? { other: { 'msvalidate.01': bVer } } : undefined),
    alternates: localeAlternates('/'),
    manifest: '/manifest.webmanifest',
    appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Onyx' },
    icons: { icon: '/onyx-symbol.png', apple: '/apple-touch-icon.png' },
    openGraph: {
      title: es ? 'Onyx Trading Live · El sistema operativo del trader de fondeo' : 'Onyx Trading Live · The operating system for funded traders',
      description: es
        ? 'MT4, MT5 y cTrader: sigue las reglas de tu prop firm, protégete con el Guardian y copia entre cuentas. Mucho más que un diario.'
        : 'MT4, MT5 and cTrader: track your prop-firm rules, protect yourself with Guardian and copy across accounts. Much more than a journal.',
      url, siteName: 'Onyx Trading Live', type: 'website', images: ['/onyx-symbol.png'],
    },
    twitter: {
      card: 'summary_large_image', title: 'Onyx Trading Live',
      description: es ? 'El sistema operativo del trader de fondeo: journal, Guardian, prop firms y copy.' : 'The operating system for funded traders: journal, Guardian, prop firms and copy.',
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
  // ¿Hay sesión? La burbuja de soporte se comporta distinto para trader o visitante.
  let loggedIn = false, userPlan = 'free';
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    loggedIn = !!user;
    if (user) { try { const { data: pr } = await supabaseAdmin.from('profiles').select('plan').eq('id', user.id).maybeSingle(); userPlan = (pr as any)?.plan || 'free'; } catch {} }
  } catch { /* si falla, la tratamos como visitante */ }

  // Cola de barras: el sitio muestra sola la que toca por fecha/página/público.
  let promo: Promo | null = null;
  if (isPublic) {
    const q = await getSetting<PromoQueue | null>('promo_queue', null as any);
    let bars: Promo[] = q && Array.isArray(q.bars) ? q.bars : [];
    if (!bars.length) { const old = await getSetting<Promo | null>('promo', null as any); if (old && (old.text_es || old.text_en)) bars = [old]; }
    const isLanding = path === '/' || path === '/en';
    const isPricing = /^\/(en\/)?pricing/.test(path);
    promo = pickActiveBar(bars, Date.now(), { lang, isLanding, isPricing, loggedIn, plan: userPlan });
  }
  const promoLive = !!promo;

  // Burbuja "en línea ahora" (simulada) · solo en páginas públicas.
  const online = isPublic ? await onlineNowSettings() : null;
  // Configuración editable del chat de soporte (se pinta al vuelo).
  const chatCfg = await chatWidgetSettings();

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

  const ga = process.env.NEXT_PUBLIC_GA_ID;   // Google Analytics 4 (opcional)

  return (
    <html lang={lang} data-theme={theme || undefined} suppressHydrationWarning>
      <body>
        {/* Google Analytics 4 (solo si hay NEXT_PUBLIC_GA_ID). Mide tráfico y conversión. */}
        {ga && (
          <>
            <script async src={`https://www.googletagmanager.com/gtag/js?id=${ga}`} />
            <script dangerouslySetInnerHTML={{ __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga}');` }} />
          </>
        )}
        {/* Fuente CJK: solo se carga cuando el idioma es chino o japonés (pesan). */}
        {(lang === 'zh' || lang === 'ja') && (
          <link rel="stylesheet" href={`https://fonts.googleapis.com/css2?family=Noto+Sans+${lang === 'ja' ? 'JP' : 'SC'}:wght@400;500;700&display=swap`} />
        )}
        <JsonLd data={graph} />
        <EnvBanner />
        <LanguageProvider initial={lang}>
          <BetaProvider initial={beta}>
            {promoLive && promo && (
              <PromoBar
                id={promo.id}
                text={(lang === 'es' ? promo.text_es : promo.text_en) || (lang === 'es' ? promo.text_en : promo.text_es)}
                cta={(lang === 'es' ? promo.cta_es : promo.cta_en) || (lang === 'es' ? promo.cta_en : promo.cta_es)}
                link={promo.link} bg={promo.bg} bg2={promo.bg2} gradient={promo.gradient} fg={promo.fg} endsAt={promo.endsAt}
                emoji={promo.emoji} coupon={promo.coupon} newTab={promo.newTab} position={promo.position} sticky={promo.sticky}
                anim={promo.anim} speed={promo.speed} countdown={promo.countdown} countdownFmt={promo.countdownFmt} dismissible={promo.dismissible}
              />
            )}
            <BetaBanner />
            <TopBar home={['/', '/en', '/en/', '/bot-builder', '/en/bot-builder'].includes(path)} />
            {/* Segundo menú GLOBAL: siempre visible en las páginas públicas (se auto-oculta
                con sesión). Enlaza a las secciones de la home desde cualquier tab. */}
            {(() => {
              const en = path.startsWith('/en');
              const priv = ['/dashboard', '/admin', '/account', '/login', '/onboarding', '/en/dashboard', '/en/admin', '/en/account', '/en/login', '/en/onboarding'].some((p) => path === p || path.startsWith(p + '/'));
              if (priv) return null;
              const items = en
                ? [{ id: 'features', label: 'Features' }, { id: 'eco', label: 'Ecosystem' }, { id: 'how', label: 'How it works' }, { id: 'fondeo', label: 'Funding' }, { id: 'gestor', label: 'Guardian' }, { id: 'faq', label: 'FAQ' }]
                : [{ id: 'features', label: 'Funciones' }, { id: 'eco', label: 'Ecosistema' }, { id: 'how', label: 'Cómo funciona' }, { id: 'fondeo', label: 'Fondeo' }, { id: 'gestor', label: 'Guardian' }, { id: 'faq', label: 'FAQ' }];
              return <SectionNav items={items} hrefBase={en ? '/en' : '/'} />;
            })()}
            {children}
            {!path.startsWith('/admin') && <SiteFooter />}
            {!path.startsWith('/admin') && <SupportWidget loggedIn={loggedIn} cfg={chatCfg} />}
            {online && online.enabled && (
              <OnlineNow min={online.min} max={online.max} speed={online.speed} color={online.color} hideMobile={online.hideMobile} label={lang === 'es' ? online.label_es : online.label_en} />
            )}
            <PendingCheckoutGate />
            <VisitorBeacon />
            <TzSync />
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
