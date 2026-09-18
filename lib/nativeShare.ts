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

// Guarda un archivo DIRECTO en el dispositivo (carpeta pública Documentos), sin
// abrir la hoja de Compartir. Devuelve la URI si lo logró.
async function nativeSaveToDevice(filename: string, base64: string): Promise<string | undefined> {
  const bridge = bridgePlugin('Filesystem');
  if (bridge && typeof bridge.writeFile === 'function') {
    for (const dir of ['DOCUMENTS', 'EXTERNAL_STORAGE']) {
      try {
        await bridge.writeFile({ path: filename, data: base64, directory: dir, recursive: true });
        const r = await bridge.getUri({ path: filename, directory: dir });
        return r?.uri || 'saved';
      } catch (e: any) { rec('save-bridge-' + dir, e); }
    }
  }
  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    for (const dir of [Directory.Documents, Directory.ExternalStorage]) {
      try {
        await Filesystem.writeFile({ path: filename, data: base64, directory: dir, recursive: true });
        const { uri } = await Filesystem.getUri({ path: filename, directory: dir });
        return uri || 'saved';
      } catch (e: any) { rec('save-pkg', e); }
    }
  } catch {}
  return undefined;
}

// Guarda la imagen DIRECTO en la GALERÍA (Fotos) con las reglas modernas de
// Android (scoped storage). Usa el plugin de medios por el puente del APK:
// escribe el PNG en caché → obtiene su URI → lo mete en la galería con
// Media.savePhoto. Devuelve true si lo logró.
//
// POR QUÉ ESTO: en builds nuevas de Android ya no se puede escribir directo en la
// carpeta pública (por eso "Guardar" caía a Compartir). El plugin de medios sí
// sabe guardar en Fotos con MediaStore, sin pedir permisos raros.
async function nativeSaveToGallery(filename: string, base64: string): Promise<boolean> {
  const uri = await nativeWriteCache(filename, base64);   // archivo temporal → URI
  if (!uri) return false;
  const media = bridgePlugin('Media');
  if (media && typeof media.savePhoto === 'function') {
    // Intento 1: guardar en un álbum "Onyx" (si el plugin lo soporta).
    try { await media.savePhoto({ path: uri, albumIdentifier: undefined, album: 'Onyx Trading Live' }); return true; }
    catch (e: any) { rec('media-album', e); }
    // Intento 2: guardar sin álbum (galería principal).
    try { await media.savePhoto({ path: uri }); return true; }
    catch (e: any) { rec('media-bridge', e); }
  }
  return false;
}

// "Guardar": en la app guarda la imagen DIRECTO en la galería (Fotos). Si el
// plugin de medios no estuviera, intenta escribir a Documentos y, como último
// recurso, comparte el archivo (para poder "Guardar en…" desde la hoja). En web,
// descarga normal.
export async function saveImage(blob: Blob, filename = 'onyx.png', opts: { title?: string; text?: string; url?: string } = {}): Promise<ShareResult> {
  if (isNative()) {
    const base64 = await blobToBase64(blob);
    if (await nativeSaveToGallery(filename, base64)) return 'downloaded';   // ✔ en la galería
    const uri = await nativeSaveToDevice(filename, base64);
    if (uri) return 'downloaded';                          // respaldo: Documentos
    return shareImage(blob, filename, opts);               // último recurso: compartir
  }
  downloadBlob(blob, filename);
  return 'downloaded';
}

// Abrir/guardar un ARCHIVO que requiere sesión (reporte PDF/Excel/CSV). El problema:
// abrir la URL en el navegador del sistema pierde la sesión → "no autorizado". Aquí
// lo DESCARGAMOS con la sesión de la app (fetch credentials:'include') y lo guardamos/
// compartimos por la hoja nativa. En web se descarga normal (mismo origen, con cookie).
export async function openAuthedFile(url: string, filename: string): Promise<ShareResult> {
  if (isNative()) {
    try {
      const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
      if (!res.ok) { rec('authfetch', new Error('http ' + res.status)); return 'error'; }
      const blob = await res.blob();
      // Reutiliza la ruta de compartir/guardar archivo (sirve para pdf/xlsx/csv/html).
      const r = await shareImage(blob, filename, { title: 'Onyx Trading Live', url: (typeof location !== 'undefined' ? location.origin : '') });
      return r;
    } catch (e: any) { rec('authfile', e); return 'error'; }
  }
  try {
    const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
    if (res.ok) { downloadBlob(await res.blob(), filename); return 'downloaded'; }
  } catch {}
  try { window.open(url, '_blank', 'noopener,noreferrer'); } catch { window.location.href = url; }
  return 'shared';
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
