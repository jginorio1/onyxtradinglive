import { isNativeApp } from './native';

// Redirección a un checkout/portal de pago.
//
// En la WEB: navega normal a la URL (comportamiento de siempre).
// En la APP NATIVA (Android/iOS con Capacitor): abre el pago en el NAVEGADOR DEL
// SISTEMA en lugar de dentro del APK. Esto cumple la política de Google Play, que
// prohíbe comprar bienes digitales dentro de la app sin usar Google Play Billing.
// El usuario paga en su navegador (Stripe) y al volver la app ya lo refleja.
export function payRedirect(url: string) {
  if (!url) return;
  if (isNativeApp()) {
    try { window.open(url, '_blank'); return; } catch { /* cae a navegación normal */ }
  }
  window.location.href = url;
}

// ¿Debemos evitar mostrar/abrir la compra dentro del APK? true solo en la app nativa.
export function blockInAppPurchase(): boolean {
  return isNativeApp();
}
