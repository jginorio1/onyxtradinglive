'use client';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

// Mantiene "vivos" los puntos verdes de la barra (Guardian, Copy, Robots, EA).
// Cada 45s refresca los componentes de servidor SOLO si:
//   · la pestaña está visible (no gasta si está en segundo plano), y
//   · estás dentro del dashboard (no en el landing público).
// router.refresh() no recarga la página: solo vuelve a pedir el estado al servidor.
export default function LiveNavRefresh() {
  const router = useRouter();
  const path = usePathname();
  useEffect(() => {
    if (!path || !path.startsWith('/dashboard')) return;
    const tick = () => { if (document.visibilityState === 'visible') router.refresh(); };
    const iv = setInterval(tick, 45000);
    return () => clearInterval(iv);
  }, [path, router]);
  return null;
}
