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

// Abre una URL en el NAVEGADOR DEL SISTEMA (no en el WebView de la app).
// Imprescindible para DESCARGAS: el WebView de Android ignora el atributo
// `download`, así que dentro de la app la descarga "no hace nada". Enviando el
// archivo al navegador del sistema (Chrome), el gestor de descargas del teléfono
// sí lo baja. Devuelve true si gestionó la apertura (para evitar la descarga web).
export function openExternal(url: string): boolean {
  try {
    const abs = /^https?:\/\//i.test(url) ? url : ((typeof window !== 'undefined' ? window.location.origin : '') + url);
    // Capacitor expone `Capacitor.Plugins.Browser` (plugin @capacitor/browser) o,
    // en su defecto, abrimos con window.open que el wrapper enruta al sistema.
    const cap: any = (typeof window !== 'undefined') ? (window as any).Capacitor : null;
    const br = cap?.Plugins?.Browser;
    if (br && typeof br.open === 'function') { br.open({ url: abs }); return true; }
    const w = window.open(abs, '_system');     // convención Cordova/Capacitor
    if (w) return true;
    const w2 = window.open(abs, '_blank');
    if (w2) return true;
    window.location.assign(abs);
    return true;
  } catch { return false; }
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
