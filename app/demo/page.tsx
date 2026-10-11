import DashboardClient from '@/app/dashboard/DashboardClient';
import DemoGuard from './DemoGuard';

export const metadata = {
  title: 'Demo en vivo · Onyx Trading Live',
  description: 'Explora el panel de Onyx con datos de ejemplo, sin registrarte.',
  robots: { index: false, follow: false },
};

// Demo PÚBLICO del dashboard para el landing.
// Seguro por construcción: no hay sesión ni lectura de base de datos. El panel
// arranca en "modo demo" (forceDemo) y genera sus propios datos de ejemplo en el
// navegador; como el invitado no tiene sesión, cualquier acción que intente
// escribir contra el API ya la rechaza la auth existente (no hay nada que tocar).
export default function DemoPage() {
  const demoAccounts = [
    { id: 'demo-ftmo', login: 1045872, nickname: 'Demo · FTMO 100K', broker: 'FTMO', platform: 'MT5', balance: 108240, currency: 'USD', fund_target: 10000, fund_max_daily: 5000, fund_max_total: 10000, fund_start: 100000, acc_type: 'challenge', challenge_status: 'active', challenge_cost: 540 },
    { id: 'demo-ctrader', login: 20391, nickname: 'Demo · Real cTrader', broker: 'IC Markets', platform: 'cTrader', balance: 24980, currency: 'USD', fund_target: null, fund_max_daily: null, fund_max_total: null, fund_start: 20000, acc_type: 'real', challenge_status: null, challenge_cost: null },
  ] as any;

  return (
    <>
      <DemoGuard />
      <DashboardClient
        forceDemo
        email=""
        plan="elite"
        profile={{ full_name: 'Trader Demo' }}
        accounts={demoAccounts}
        trades={[]}
      />
    </>
  );
}
