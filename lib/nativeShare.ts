// ============================================================
// Compartir / guardar / abrir — funciona en WEB y en la APP (Capacitor).
//
// CLAVE (por qué antes fallaba con "Share plugin is not implemented on android"):
// la app carga la web EN VIVO (server.url), así que el paquete web `@capacitor/share`
// no siempre engancha con el plugin nativo. La forma FIABLE es llamar al plugin
// DIRECTAMENTE por el puente que inyecta el APK: `window.Capacitor.Plugins.Share`.
// Ese objeto ES la implementación nativa registrada en el APK. Solo si no existe,
// probamos el paquete importado, y por último el comportamiento web.
// ============================================================

type ShareResult = 'shared' | 'copied' | 'downloaded' | 'cancel' | 'error';
type CapWin = Window & { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string; Plugins?: any } };

let _lastShareError = '';
export function getLastShareError(): string { return _lastShareError; }
function rec(where: string, e: any) { _lastShareError = where + ': ' + String(e?.message || e || 'error').slice(0, 160); }

function cap(): CapWin['Capacitor'] | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as CapWin).Capacitor;
}
function isNative(): boolean {
  const c = cap(); if (!c) return false;
  try {
    if (typeof c.isNativePlatform === 'function' && c.isNativePlatform()) return true;
    if (typeof c.getPlatform === 'function' && c.getPlatform() !== 'web') return true;
    if (c.Plugins && (c.Plugins.Share || c.Plugins.Filesystem)) return true;
  } catch {}
  return false;
}
// Devuelve el plugin nativo del PUENTE del APK (fiable), o el del paquete importado.
function bridgePlugin(name: string): any | undefined {
  const c = cap(); return c && c.Plugins ? c.Plugins[name] : undefined;
}

// Compartir un ENLACE.
export async function shareLink(o: { title?: string; text?: string; url: string }): Promise<ShareResult> {
  const { title, text, url } = o;
  if (isNative()) {
    if (await nativeShare({ title, text, url })) return 'shared';
    // (si nativeShare devolvió false ya quedó el error grabado)
  }
  if (typeof navigator !== 'undefined' && (navigator as any).share) {
    try { await (navigator as any).share({ title, text, url }); return 'shared'; }
    catch (e: any) { if (e?.name === 'AbortError') return 'cancel'; }
  }
  try { await navigator.clipboard.writeText(url); return 'copied'; } catch { return 'error'; }
}

// Llama a Share nativo: primero el puente del APK, luego el paquete. Devuelve true si
// abrió (o el usuario canceló). Graba el error si no.
async function nativeShare(payload: { title?: string; text?: string; url?: string; files?: string[] }): Promise<boolean> {
  const p: any = { ...payload, dialogTitle: payload.title };
  if (!p.text && !p.url && !(p.files && p.files.length)) p.url = (typeof location !== 'undefined' ? location.origin : 'https://onyxtradinglive.com');
  const bridge = bridgePlugin('Share');
  if (bridge && typeof bridge.share === 'function') {
    try { await bridge.share(p); return true; }
    catch (e: any) { if (/cancel/i.test(String(e?.message || ''))) return true; rec('share-bridge', e); }
  }
  try {
    const { Share } = await import('@capacitor/share');
    await Share.share(p); return true;
  } catch (e: any) { if (/cancel/i.test(String(e?.message || ''))) return true; rec('share-pkg', e); }
  return false;
}

// Escribe un archivo en caché y devuelve su URI (puente del APK o paquete).
async function nativeWriteCache(filename: string, base64: string): Promise<string | undefined> {
  const bridge = bridgePlugin('Filesystem');
  if (bridge && typeof bridge.writeFile === 'function') {
    try {
      await bridge.writeFile({ path: filename, data: base64, directory: 'CACHE' });
      const r = await bridge.getUri({ path: filename, directory: 'CACHE' });
      return r?.uri;
    } catch (e: any) { rec('fs-bridge', e); }
  }
  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    await Filesystem.writeFile({ path: filename, data: base64, directory: Directory.Cache });
    const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache });
    return uri;
  } catch (e: any) { rec('fs-pkg', e); }
  return undefined;
}

// Compartir / guardar una IMAGEN (Blob).
export async function shareImage(blob: Blob, filename = 'onyx.png', opts: { title?: string; text?: string; url?: string } = {}): Promise<ShareResult> {
  if (isNative()) {
    // 1) Intento con el ARCHIVO (imagen).
    const base64 = await blobToBase64(blob);
    const uri = await nativeWriteCache(filename, base64);
    if (uri && await nativeShare({ title: opts.title, text: opts.text, files: [uri] })) return 'shared';
    // 2) Respaldo: comparte texto+enlace (la hoja abre igual).
    if (await nativeShare({ title: opts.title, text: opts.text, url: opts.url })) return 'shared';
    return 'error';
  }
  try {
    const file = new File([blob], filename, { type: blob.type || 'image/png' });
    if (typeof navigator !== 'undefined' && (navigator as any).canShare?.({ files: [file] })) {
      await (navigator as any).share({ files: [file], title: opts.title, text: opts.text });
      return 'shared';
    }
  } catch (e: any) { if (e?.name === 'AbortError') return 'cancel'; }
  downloadBlob(blob, filename);
  return 'downloaded';
}

export async function saveImage(blob: Blob, filename = 'onyx.png', opts: { title?: string; text?: string; url?: string } = {}): Promise<ShareResult> {
  if (isNative()) return shareImage(blob, filename, opts);
  downloadBlob(blob, filename);
  return 'downloaded';
}

// Abrir un enlace externo.
export async function openExternal(url: string) {
  if (isNative()) {
    const bridge = bridgePlugin('Browser');
    if (bridge && typeof bridge.open === 'function') { try { await bridge.open({ url }); return; } catch (e) { rec('browser-bridge', e); } }
    try { const { Browser } = await import('@capacitor/browser'); await Browser.open({ url }); return; } catch (e) { rec('browser-pkg', e); }
  }
  try { window.open(url, '_blank', 'noopener,noreferrer'); } catch { window.location.href = url; }
}

export function downloadBlob(blob: Blob, filename: string) {
  try {
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  } catch {}
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onloadend = () => res(String(r.result || '').split(',')[1] || '');
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}
