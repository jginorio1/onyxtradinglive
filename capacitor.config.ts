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
  },
};

export default config;
