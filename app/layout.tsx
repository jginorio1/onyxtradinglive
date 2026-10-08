import './globals.css';
import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import TopBar from './TopBar';
import SectionNav from './SectionNav';
import SiteFooter from './SiteFooter';
import BotLabHeader from './bot-lab/BotLabHeader';
import BotLabFooter from './bot-lab/BotLabFooter';
import PWARegister from './PWARegister';
import ChunkReload from './ChunkReload';
import LiveNavRefresh from './LiveNavRefresh';
import AuthChrome from './AuthChrome';
import UpdateToast from './UpdateToast';
import SupportWidget from './SupportWidget';
import BackToTop from './BackToTop';
import { Toaster } from '@/lib/toast';
import JsonLd from './JsonLd';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { LanguageProvider } from '@/lib/lang';
import { BetaProvider } from '@/lib/beta';
import BetaBanner from './BetaBanner';
import EnvBanner from './EnvBanner';
import NativeInit from './NativeInit';
import ScrollTopOnNav from './components/ScrollTopOnNav';
import MonitorBeacon from './MonitorBeacon';
import { serverBeta } from '@/lib/betaServer';
import PromoBar from './PromoBar';
import { AppSmartBanner } from './components/AppPromo';
import OnlineNow from './OnlineNow';
import VisitorBeacon from './VisitorBeacon';
import StickyAd from './components/StickyAd';
import RepInviteBanner from './RepInviteBanner';
import TzSync from './TzSync';
import PendingCheckoutGate from './PendingCheckoutGate';
import { getSetting, onlineNowSettings, chatWidgetSettings, botlabChatWidget } from '@/lib/settings';
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
    es ? 'Diario de Trading y Gestión de Riesgo | Onyx Trading Live' : 'Trading Journal & Risk Management | Onyx Trading Live',
    es ? 'Diario de trading y gestión de riesgo para forex y CFDs. Onyx Guardian, copy trading y retos de prop firm en MT4, MT5, cTrader, MatchTrader, TradeLocker y DXtrade. Empieza gratis.'
       : 'Trading journal and risk management for forex and CFDs. Onyx Guardian, copy trading and prop firm challenges on MT4, MT5, cTrader, MatchTrader, TradeLocker and DXtrade. Start free.');
  const gVer = process.env.GOOGLE_SITE_VERIFICATION;
  const bVer = process.env.BING_SITE_VERIFICATION;
  const adsenseId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;   // ej. ca-pub-7228105221509555
  return {
    metadataBase: new URL(url),
    title: seo.title,
    description: seo.description,
    // Etiqueta meta de verificación de AdSense (método "Meta tag"). Siempre en el <head>.
    ...(adsenseId ? { other: { 'google-adsense-account': adsenseId } } : {}),
    keywords: ['trading journal', 'diario de trading', 'forex', 'forex journal', 'diario de forex', 'trading de forex', 'CFDs', 'CFD trading', 'trading de CFDs', 'diario de CFDs', 'MT4', 'MT5', 'MetaTrader', 'cTrader', 'MatchTrader', 'TradingView', 'TradingView signals', 'señales TradingView', 'estadísticas trading', 'trading stats', 'FTMO', 'prop firm', 'copy trading', 'trading academy', 'analytics'],
    verification: gVer ? { google: gVer, ...(bVer ? { other: { 'msvalidate.01': bVer } } : {}) } : (bVer ? { other: { 'msvalidate.01': bVer } } : undefined),
    alternates: localeAlternates('/'),
    manifest: '/manifest.webmanifest',
    appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Onyx' },
    icons: { icon: '/onyx-symbol.png', apple: '/apple-touch-icon.png' },
    openGraph: {
      title: es ? 'Onyx Trading Live · El sistema operativo del trader de fondeo' : 'Onyx Trading Live · The operating system for funded traders',
      description: es
        ? 'MT4, MT5, cTrader, MatchTrader, TradeLocker y DXtrade: sigue las reglas de tu prop firm, protégete con el Guardian y copia entre cuentas. Mucho más que un diario.'
        : 'MT4, MT5, cTrader, MatchTrader, TradeLocker and DXtrade: track your prop-firm rules, protect yourself with Guardian and copy across accounts. Much more than a journal.',
      url, siteName: 'Onyx Trading Live', type: 'website',
      images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Onyx Trading Live' }],
    },
    twitter: {
      card: 'summary_large_image', title: 'Onyx Trading Live',
      description: es ? 'El sistema operativo del trader de fondeo: journal, Guardian, prop firms y copy.' : 'The operating system for funded traders: journal, Guardian, prop firms and copy.',
      images: ['/og.png'],
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
  // ¿Estamos dentro del "producto" Onyx Bot Lab? Ahí mostramos su barra y pie
  // propios (mismo login/BD) para que se sienta un producto aparte.
  const inBotLab = ['/bot-lab', '/dashboard/bot-lab', '/en/bot-lab', '/en/dashboard/bot-lab'].some((p) => path === p || path.startsWith(p + '/'));
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
  // En Bot Lab: mismo widget/IA pero en dorado y con marca Bot Lab.
  const botlabCfg = inBotLab ? await botlabChatWidget() : null;

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
        '@type': 'SoftwareApplication', '@id': `${url}/#app`, name: 'Onyx Trading Live',
        applicationCategory: 'FinanceApplication', operatingSystem: 'Windows, macOS (MetaTrader 4/5, cTrader)',
        description: 'Diario de trading y gestor de riesgo (Onyx Guardian) para cuentas de MetaTrader (MT4/MT5), cTrader, MatchTrader, TradeLocker y DXtrade: estadísticas automáticas, calendario, control de fondeo, copy trading, academia y protección del plan de trading.',
        url, image: `${url}/og.png`, publisher: { '@id': `${url}/#org` },
        // Catálogo de precios: habilita resultados enriquecidos con rango de precio.
        offers: [
          { '@type': 'Offer', name: 'Free', price: '0', priceCurrency: 'USD', description: 'Para empezar con 1 cuenta.', url: `${url}/pricing` },
          { '@type': 'Offer', name: 'Pro', price: '19', priceCurrency: 'USD', description: 'Onyx Guardian, 5 cuentas e historial ilimitado.', url: `${url}/pricing` },
          { '@type': 'Offer', name: 'Elite', price: '79', priceCurrency: 'USD', description: 'Copy trading, cierres parciales y alertas por Telegram.', url: `${url}/pricing` },
          { '@type': 'Offer', name: 'Black Onyx', price: '199', priceCurrency: 'USD', description: 'Copy trading ilimitado y todo sin límites.', url: `${url}/pricing` },
        ],
      },
    ],
  };

  const ga = process.env.NEXT_PUBLIC_GA_ID;   // Google Analytics 4 (opcional)
  const adsense = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;   // ej. ca-pub-7228105221509555 (verificación + anuncios AdSense)

  // Estilo "con vida" (tono china: naranja/ámbar con auroras y glows) SOLO en las
  // páginas PÚBLICAS de marketing. Las zonas de app (dashboard, admin, cuenta,
  // academia, login, onboarding, conectar, constructor) quedan sobrias para no
  // cansar la vista al trabajar dentro. Se enciende con la clase onyx-vivid.
  const appArea = ['/dashboard', '/admin', '/account', '/login', '/onboarding', '/academy', '/staff', '/connect']
    .some((p) => { const q = path.replace(/^\/en/, '') || '/'; return q === p || q.startsWith(p + '/'); });
  const vivid = !appArea;

  // Pantallas de ENTRADA (login, recuperar contraseña): sin menú superior ni barra
  // de promo, para que la caja del login sea el único foco (menos distracción).
  const isAuthScreen = ['/login', '/reset-password'].some((p) => { const q = path.replace(/^\/en/, '') || '/'; return q === p || q.startsWith(p + '/'); });

  return (
    <html lang={lang} data-theme={theme || undefined} className={isAuthScreen ? 'is-auth' : undefined} suppressHydrationWarning>
      <body className={vivid ? 'onyx-vivid' : undefined}>
        {/* Auroras de color (tono china) animadas de fondo. Solo en páginas públicas. */}
        {vivid && <div className="lv-aurora" aria-hidden="true"><span></span><span></span><span></span></div>}
        {/* Google AdSense: carga la librería de anuncios y sirve para verificar el
            sitio (método "AdSense code snippet"). Se activa poniendo
            NEXT_PUBLIC_ADSENSE_CLIENT en las variables de entorno. Además se emite
            la etiqueta meta google-adsense-account (método "Meta tag") en el head
            vía metadata, así cualquiera de los dos métodos de Google funciona. */}
        {adsense && (
          <script async src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsense}`} crossOrigin="anonymous"></script>
        )}
        {/* Login-first SIN parpadeo (solo app nativa Capacitor): este script corre
            mientras el HTML se está parseando, ANTES de que el landing se pinte. Si
            la app abre en la raíz o /en, redirige a /dashboard de inmediato (y el
            servidor manda a /login si no hay sesión). Pinta un fondo oscuro de marca
            para que no se vea ningún destello blanco durante el salto. En el
            navegador no hace nada (no existe window.Capacitor nativo). */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var C=window.Capacitor;if(C&&C.isNativePlatform&&C.isNativePlatform()){document.documentElement.classList.add('native-app');var p=(location.pathname||'/').replace(/\\/+$/,'')||'/';if(p===''||p==='/'||p==='/en'){document.documentElement.style.background='#0b1020';location.replace('/dashboard');}}}catch(e){}",
          }}
        />
        {/* Pantalla de arranque nativa: logo de Onyx mientras carga el webview. Solo
            visible en la app (html.native-app); se desvanece al terminar de cargar. */}
        <div className="onyx-boot" id="onyxBoot"><img src="/onyx-symbol.png" alt="Onyx" /></div>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var h=function(){var b=document.getElementById('onyxBoot');if(b){b.classList.add('onyx-boot--hide');setTimeout(function(){if(b&&b.parentNode){b.parentNode.removeChild(b);}},600);}};if(document.readyState==='complete'){setTimeout(h,300);}else{window.addEventListener('load',function(){setTimeout(h,300);});}setTimeout(h,8000);}catch(e){}",
          }}
        />
        {/* Arranque nativo (Capacitor): no hace nada en el navegador. */}
        <NativeInit />
        <ScrollTopOnNav />
        {/* Google Analytics 4 (solo si hay NEXT_PUBLIC_GA_ID). Mide tráfico y conversión. */}
        {ga && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${ga}`} strategy="lazyOnload" />
            <Script id="ga-init" strategy="lazyOnload" dangerouslySetInnerHTML={{ __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga}');` }} />
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
            {/* Nota: el menú de arriba (promo + TopBar + submenú) se renderiza SIEMPRE en
                páginas públicas y se oculta en login/registro vía la clase html.is-auth
                (AuthChrome la mantiene en cada navegación). Así vuelve al salir de login. */}
            {promoLive && promo && !inBotLab && (
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
            {inBotLab ? <BotLabHeader loggedIn={loggedIn} /> : <TopBar home={['/', '/en', '/en/', '/bot-builder', '/en/bot-builder'].includes(path)} />}
            <AuthChrome />
            {/* Segundo menú GLOBAL: siempre visible en las páginas públicas (se auto-oculta
                con sesión). En Bot Lab NO se muestra: usa su propia barra. */}
            {!inBotLab && (() => {
              const en = path.startsWith('/en');
              // Nota: /login NO se excluye aquí a propósito. El submenú se oculta en login
              // vía html.is-auth (CSS), para que al salir de login vuelva a aparecer sin recargar.
              const priv = ['/dashboard', '/admin', '/account', '/onboarding', '/en/dashboard', '/en/admin', '/en/account', '/en/onboarding'].some((p) => path === p || path.startsWith(p + '/'));
              if (priv) return null;
              // Etiquetas en AMBOS idiomas: SectionNav (cliente) elige con el idioma actual
              // (cookie/contexto), así el submenú cambia AL INSTANTE al togglear, sin depender de la URL /en.
              const items = [
                { id: 'features', es: 'Funciones', en: 'Features' },
                { id: 'eco', es: 'Ecosistema', en: 'Ecosystem' },
                { id: 'how', es: 'Cómo funciona', en: 'How it works' },
                { id: 'fondeo', es: 'Fondeo', en: 'Funding' },
                { id: 'gestor', es: 'Guardian', en: 'Guardian' },
                { id: 'faq', es: 'FAQ', en: 'FAQ' },
              ];
              return <SectionNav items={items} hrefBase={en ? '/en' : '/'} />;
            })()}
            {/* Landmark de contenido principal ÚNICO para toda la app (accesibilidad —
                Lighthouse/axe lo exigen). Antes solo lo tenía el landing y bot-lab; ahora
                lo hereda cada página pública y privada por igual. Las páginas NO deben
                envolver su contenido en otro <main> (dos landmarks = falta a11y). */}
            <main id="main">{children}</main>
            {(() => {
              // El footer de marketing NO se muestra dentro de la app (dashboard, admin,
              // cuenta, onboarding, login), en español ni en /en. Solo en páginas públicas.
              // /login fuera de la lista: el footer se oculta en login vía html.is-auth (CSS),
              // así vuelve al salir sin recargar.
              const appArea = ['/dashboard', '/admin', '/account', '/onboarding', '/en/dashboard', '/en/admin', '/en/account', '/en/onboarding'].some((p) => path === p || path.startsWith(p + '/'));
              if (appArea) return null;
              // Con sesión iniciada el footer de marketing NO se muestra en NINGUNA página:
              // si el usuario entra a /blog, /copy, /academy, Bot Lab o el landing estando
              // dentro de su cuenta, sigue sin ver el footer. Solo lo ven los visitantes
              // sin sesión en las páginas públicas.
              if (loggedIn) return null;
              // En Bot Lab público, si ya hay sesión, el footer de marketing sobra en móvil
              // (el usuario ya está dentro): lo ocultamos SOLO en móvil con .blf-hide-mobile.
              // En PC se sigue viendo.
              if (inBotLab) return <div className={loggedIn ? 'blf-hide-mobile' : undefined}><BotLabFooter /></div>;
              return <SiteFooter />;
            })()}
            {!path.startsWith('/admin') && (inBotLab
              ? (botlabCfg && <SupportWidget loggedIn={loggedIn} cfg={botlabCfg} variant="botlab" />)
              : <SupportWidget loggedIn={loggedIn} cfg={chatCfg} />)}
            <BackToTop />
            {/* Smart banner de la app Android, solo en web móvil (nunca en la app nativa) */}
            {!path.startsWith('/admin') && <AppSmartBanner />}
            {online && online.enabled && (
              <OnlineNow min={online.min} max={online.max} speed={online.speed} color={online.color} hideMobile={online.hideMobile} label={lang === 'es' ? online.label_es : online.label_en} />
            )}
            <PendingCheckoutGate />
            {!path.startsWith('/admin') && !path.startsWith('/dashboard') && <RepInviteBanner />}
            <VisitorBeacon />
            {/* Banner sticky de abajo RETIRADO por completo (molestaba y tapaba
                contenido en escritorio y móvil). Si algún día se quiere reactivar,
                volver a montar <StickyAd lang={lang} /> aquí. */}
            {loggedIn && <MonitorBeacon />}
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
