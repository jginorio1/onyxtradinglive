// Detección de "¿corremos dentro de la app nativa (Capacitor) o en el navegador?"
//
// No importamos @capacitor/core de forma estática para que el bundle web no
// dependa de él: solo cuando existe (dentro de la app) el objeto window.Capacitor
// está presente. Así el mismo código sirve para web y para la app, sin romper el
// build web aunque el paquete no esté instalado en ese entorno.

type CapWin = Window & { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string } };

// Respaldo robusto: la app nativa de iOS añade esta marca al user-agent
// (capacitor.config.ts → ios.appendUserAgent). Así detectamos la app de iPhone/iPad
// aunque el "bridge" JS de Capacitor no esté disponible en la página remota
// (server.url). En Android y en el navegador esta marca NO existe, así que no cambia
// nada allí. Es la forma fiable de saber "estoy dentro de la app de iOS".
const IOS_UA_MARK = 'OnyxiOSApp';
function uaHasIOSMark(): boolean {
  try { return typeof navigator !== 'undefined' && new RegExp(IOS_UA_MARK).test(navigator.userAgent || ''); }
  catch { return false; }
}

export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const cap = (window as CapWin).Capacitor;
    if (cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()) return true;
  } catch {}
  return uaHasIOSMark();   // respaldo por user-agent (app de iOS)
}

// 'ios' | 'android' | 'web'
export function nativePlatform(): string {
  if (typeof window === 'undefined') return 'web';
  try {
    const cap = (window as CapWin).Capacitor;
    const p = cap && cap.getPlatform && cap.getPlatform();
    if (p && p !== 'web') return p;
  } catch {}
  return uaHasIOSMark() ? 'ios' : 'web';   // respaldo por user-agent
}
