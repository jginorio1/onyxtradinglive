'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

// Oculta/muestra TODO el menú de arriba (barra promo + TopBar + submenú) en las
// pantallas de login/registro/recuperar, y lo VUELVE A MOSTRAR al salir (p. ej.
// "Back to home").
//
// ¿Por qué un componente cliente? En Next.js el layout raíz NO se re-renderiza al
// navegar sin recargar, así que decidir en el servidor dejaba el menú "congelado":
// si entrabas a /login desde otra página, el menú se quedaba visible; y si salías
// de /login a inicio, se quedaba oculto. usePathname() se re-evalúa en CADA
// navegación, así que togglear una clase en <html> arregla ambos sentidos.
// El layout ya pone la clase is-auth en el servidor para la primera carga (sin
// parpadeo); aquí solo la mantenemos sincronizada en las navegaciones de cliente.
export default function AuthChrome() {
  const path = usePathname() || '/';
  useEffect(() => {
    const q = path.replace(/^\/en/, '') || '/';
    const isAuth = ['/login', '/reset-password'].some((p) => q === p || q.startsWith(p + '/'));
    document.documentElement.classList.toggle('is-auth', isAuth);
  }, [path]);
  return null;
}
