import type { Metadata } from 'next';
import LandingConstructor from './LandingConstructor';

export const metadata: Metadata = {
  title: 'Constructor de bots — Onyx Trading Live',
  description: 'Construye bots de trading sin programar, protege tu cuenta de fondeo con Onyx Guardian y copia a los mejores. Para MT4, MT5 y cTrader.',
};

export default function ConstructorPage() {
  return (
    <div className="wrap-wide" style={{ padding: '0 18px' }}>
      <LandingConstructor />
    </div>
  );
}
