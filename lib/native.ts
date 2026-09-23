// Detección de "¿corremos dentro de la app nativa (Capacitor) o en el navegador?"
//
// No importamos @capacitor/core de forma estática para que el bundle web no
// dependa de él: solo cuando existe (dentro de la app) el objeto window.Capacitor
// está presente. Así el mismo código sirve para web y para la app, sin romper el
// build web aunque el paquete no esté instalado en ese entorno.

type CapWin = Window & { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string } };

export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as CapWin).Capacitor;
  try { return !!cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform(); }
  catch { return false; }
}

// 'ios' | 'android' | 'web'
export function nativePlatform(): string {
  if (typeof window === 'undefined') return 'web';
  const cap = (window as CapWin).Capacitor;
  try { return (cap && cap.getPlatform && cap.getPlatform()) || 'web'; }
  catch { return 'web'; }
}
