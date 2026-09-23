'use client';
import Link from 'next/link';
import { useIsIOSApp } from '@/app/account/ManageOnWeb';

// Píldora del plan en la barra superior. Muestra el nombre del plan.
// En web/Android enlaza a /pricing (planes). En la app de iOS NO llevamos a la
// página de compra (regla 3.1.1 de Apple): la píldora lleva a "Mi cuenta", donde
// se ve el plan y se explica gestionarlo en el sitio web.
export default function PlanPill({ planName, free }: { planName: string; free?: boolean }) {
  const ios = useIsIOSApp();
  return (
    <Link className={'planpill' + (free ? ' free' : '')} href={ios ? '/account' : '/pricing'}>
      {planName}
    </Link>
  );
}
