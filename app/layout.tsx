import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Onyx Trading Live · Tu diario de trading',
  description: 'Conecta tus cuentas MT4/MT5 y analiza tu trading automáticamente.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
