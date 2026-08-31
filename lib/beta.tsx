'use client';
import { createContext, useContext, useState } from 'react';
import { useRouter } from 'next/navigation';

// ============================================================
// Modo beta.
//
// Deja ver la versión de pruebas del sitio a quien tenga el PIN de 6 dígitos.
// El estado real vive en la cookie onyx_beta (la escribe el servidor tras
// validar el PIN), así el layout de servidor puede pintar el aviso "BETA".
// Aquí solo guardamos el valor inicial para que el cliente sepa en qué modo
// está sin tener que leer la cookie a mano.
// ============================================================

const Ctx = createContext<{ beta: boolean; setBeta: (b: boolean) => void }>({
  beta: false,
  setBeta: () => {},
});

export const useBeta = () => useContext(Ctx);

export function BetaProvider({ initial, children }: { initial: boolean; children: React.ReactNode }) {
  const [beta, setBetaState] = useState<boolean>(initial);
  const router = useRouter();

  function setBeta(b: boolean) {
    setBetaState(b);
    router.refresh(); // re-pinta el layout de servidor (aviso BETA)
  }

  return <Ctx.Provider value={{ beta, setBeta }}>{children}</Ctx.Provider>;
}
