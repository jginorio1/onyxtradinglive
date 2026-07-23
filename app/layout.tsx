import './globals.css';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import TopBar from './TopBar';
import SupportWidget from './SupportWidget';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { LanguageProvider } from '@/lib/lang';
import type { Lang } from '@/lib/navText';

// La barra lee la sesión en cada petición, así que esta capa no se cachea.
export const dynamic = 'force-dynamic';

const url = process.env.NEXT_PUBLIC_APP_URL || 'https://onyxtradinglive.vercel.app';

export const metadata: Metadata = {
  metadataBase: new URL(url),
  title: 'Onyx Trading Live · Tu diario de trading conectado a MT4/MT5',
  description: 'Conecta tus cuentas MT4/MT5 y analiza tu trading automáticamente: estadísticas, calendario, sesiones, pares y seguimiento de fondeo. Empieza gratis.',
  keywords: ['trading journal', 'diario de trading', 'MT4', 'MT5', 'MetaTrader', 'estadísticas trading', 'FTMO', 'prop firm', 'analytics'],
  icons: { icon: '/onyx-symbol.png', apple: '/onyx-symbol.png' },
  openGraph: {
    title: 'Onyx Trading Live · Tu diario de trading inteligente',
    description: 'Conecta MT4/MT5 y analiza cada operación. Estadísticas, calendario y portafolio en tiempo real.',
    url,
    siteName: 'Onyx Trading Live',
    type: 'website',
    images: ['/onyx-symbol.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Onyx Trading Live',
    description: 'Tu diario de trading conectado a MT4/MT5.',
    images: ['/onyx-symbol.png'],
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // El idioma se decide aquí, una sola vez, y baja a todo lo demás.
  const lang: Lang = (cookies().get('onyx_lang')?.value === 'en' ? 'en' : 'es');

  // ¿Hay sesión? La burbuja de soporte se comporta distinto para trader o visitante.
  let loggedIn = false;
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    loggedIn = !!user;
  } catch { /* si falla, la tratamos como visitante */ }

  return (
    <html lang={lang}>
      <body>
        <LanguageProvider initial={lang}>
          <TopBar />
          {children}
          <SupportWidget loggedIn={loggedIn} />
        </LanguageProvider>
      </body>
    </html>
  );
}
