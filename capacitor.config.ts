import type { CapacitorConfig } from '@capacitor/cli';

// ============================================================
// Onyx Trading Live — app nativa (Capacitor) para Google Play y App Store.
//
// Enfoque "carga el sitio en vivo": como Onyx es Next.js con login, Stripe y
// APIs en el servidor, la app nativa abre la web real (server.url). Así todo el
// código y las funciones se reutilizan al 100%; la app aporta ícono propio,
// splash, barra de estado nativa, botón atrás y presencia en las tiendas.
//
// webDir apunta a /public solo como respaldo obligatorio de Capacitor; con
// server.url definido, la app no usa esos archivos salvo si no hay red.
// ============================================================
const config: CapacitorConfig = {
  appId: 'com.onyxtradinglive.app',
  appName: 'Onyx Trading Live',
  webDir: 'public',
  // SOLO iOS: añade una marca al user-agent para que la web sepa con certeza que
  // corre dentro de la app de iPhone/iPad y oculte planes/precios (regla 3.1.1 de
  // Apple), sin depender de que el bridge JS de Capacitor esté disponible en la
  // página remota. Android NO lleva marca, así que allí no cambia nada.
  ios: { appendUserAgent: 'OnyxiOSApp' },
  server: {
    url: 'https://www.onyxtradinglive.com',
    androidScheme: 'https',
    iosScheme: 'https',
    // Solo dominios de Onyx se abren dentro de la app; el resto (Stripe, etc.)
    // se abre en el navegador del sistema para no romper pagos ni logins externos.
    allowNavigation: ['www.onyxtradinglive.com', 'onyxtradinglive.com'],
  },
  backgroundColor: '#0b0f1a',
  plugins: {
    SplashScreen: {
      launchShowDuration: 900,
      backgroundColor: '#0b0f1a',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },
    StatusBar: {
      style: 'DARK',            // texto claro sobre fondo oscuro
      backgroundColor: '#121829',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    // Teclado: 'none' = al abrir el teclado el webview NO se redimensiona, así el
    // header pegado arriba no se mueve (el teclado solo se superpone abajo). Sin
    // barra de accesorios para que se vea más app.
    Keyboard: {
      resize: 'none',
      resizeOnFullScreen: true,
    },
  },
};

export default config;
