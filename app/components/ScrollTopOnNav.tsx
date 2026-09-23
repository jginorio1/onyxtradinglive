'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

// Al cambiar de RUTA, la página debe empezar ARRIBA. En algunos casos (navegación
// del lado del cliente, restauración de scroll del navegador, o un menú que se abre
// tras hacer scroll abajo) quedaba a media página o abajo. Esto lo resetea siempre.
export default function ScrollTopOnNav() {
  const path = usePathname();
  useEffect(() => {
    try {
      window.scrollTo(0, 0);
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
      const m = document.getElementById('main');
      if (m) (m as HTMLElement).scrollTop = 0;
    } catch {}
  }, [path]);
  return null;
}
