import type { Metadata } from 'next';

const url = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.onyxtradinglive.com').replace(/\/$/, '');

export const metadata: Metadata = {
  title: 'Programa de embajadores · Onyx Trading Live',
  description: 'Gana una comisión recurrente por cada persona que se suscriba con tu enlace de Onyx Trading Live, y dale un descuento a tu comunidad de traders.',
  alternates: { canonical: '/embajadores' },
  openGraph: { title: 'Programa de embajadores · Onyx Trading Live', description: 'Comisión recurrente por cada suscripción con tu enlace.', url: `${url}/embajadores`, type: 'website' },
};

export default function EmbajadoresLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
