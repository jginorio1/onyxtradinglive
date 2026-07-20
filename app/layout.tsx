import './globals.css';
import type { Metadata } from 'next';

const url = process.env.NEXT_PUBLIC_APP_URL || 'https://onyxtradinglive.vercel.app';

export const metadata: Metadata = {
  metadataBase: new URL(url),
  title: 'Onyx Trading Live · Tu diario de trading conectado a MT4/MT5',
  description: 'Conecta tus cuentas MT4/MT5 y analiza tu trading automáticamente: estadísticas, calendario, sesiones, pares y seguimiento de fondeo. Empieza gratis.',
  keywords: ['trading journal', 'diario de trading', 'MT4', 'MT5', 'MetaTrader', 'estadísticas trading', 'FTMO', 'prop firm', 'analytics'],
  openGraph: {
    title: 'Onyx Trading Live · Tu diario de trading inteligente',
    description: 'Conecta MT4/MT5 y analiza cada operación. Estadísticas, calendario y portafolio en tiempo real.',
    url,
    siteName: 'Onyx Trading Live',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Onyx Trading Live',
    description: 'Tu diario de trading conectado a MT4/MT5.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
