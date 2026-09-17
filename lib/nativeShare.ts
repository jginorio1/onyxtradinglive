// ============================================================
// Compartir / guardar / abrir — funciona igual en la WEB y en la APP (Capacitor).
//
// El problema real observado: dentro del WebView de la app, `navigator.share` casi
// nunca existe y la descarga con <a download> no hace NADA. Además, al cargar la web
// remota (server.url) la detección `isNativePlatform()` a veces no está lista, así que
// aquí detectamos lo nativo de forma TOLERANTE: si existe `window.Capacitor` y la
// plataforma no es 'web', usamos los plugins (Share/Filesystem/Browser). Y si compartir
// el ARCHIVO falla, caemos a compartir TEXTO+ENLACE con el mismo plugin nativo, para
// que la hoja de compartir SIEMPRE abra (antes caía al no-op de la web = "no pasa nada").
// ============================================================

type ShareResult = 'shared' | 'copied' | 'downloaded' | 'cancel' | 'error';

type CapWin = Window & { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string; Plugins?: any } };

// Último error de compartir (para diagnóstico en pantalla). Se lee con getLastShareError().
let _lastShareError = '';
export function getLastShareError(): string { return _lastShareError; }
function rec(where: string, e: any) { _lastShareError = where + ': ' + String(e?.message || e || 'error').slice(0, 160); }

// ¿Estamos dentro de la app nativa? Tolerante: vale isNativePlatform() O getPlatform()
// distinto de 'web' O que exista el puente de plugins de Capacitor.
function isNative(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as CapWin).Capacitor;
  if (!cap) return false;
  try {
    if (typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()) return true;
    if (typeof cap.getPlatform === 'function' && cap.getPlatform() !== 'web') return true;
    if (cap.Plugins && (cap.Plugins.Share || cap.Plugins.Filesystem)) return true;
  } catch {}
  return false;
}

// Compartir un ENLACE. App → hoja de compartir nativa. Web → Web Share si existe,
// si no copia al portapapeles.
export async function shareLink(o: { title?: string; text?: string; url: string }): Promise<ShareResult> {
  const { title, text, url } = o;
  if (isNative()) {
    try {
      const { Share } = await import('@capacitor/share');
      await Share.share({ title, text, url, dialogTitle: title });
      return 'shared';
    } catch (e: any) {
      if (/cancel/i.test(String(e?.message || ''))) return 'cancel';
    }
  }
  if (typeof navigator !== 'undefined' && (navigator as any).share) {
    try { await (navigator as any).share({ title, text, url }); return 'shared'; }
    catch (e: any) { if (e?.name === 'AbortError') return 'cancel'; }
  }
  try { await navigator.clipboard.writeText(url); return 'copied'; } catch { return 'error'; }
}

// Comparte el TEXTO/ENLACE por el plugin nativo (respaldo cuando falla el archivo).
async function nativeShareText(opts: { title?: string; text?: string; url?: string }): Promise<boolean> {
  try {
    const { Share } = await import('@capacitor/share');
    const payload: any = { dialogTitle: opts.title };
    if (opts.title) payload.title = opts.title;
    if (opts.text) payload.text = opts.text;
    if (opts.url) payload.url = opts.url;
    // Share.share exige al menos uno; si no hay nada, mandamos la web como enlace.
    if (!payload.text && !payload.url) payload.url = (typeof location !== 'undefined' ? location.origin : 'https://onyxtradinglive.com');
    await Share.share(payload);
    return true;
  } catch (e: any) {
    if (/cancel/i.test(String(e?.message || ''))) return true;
    rec('text', e);
    return false;
  }
}

// Compartir una IMAGEN (Blob). App → guarda en caché y abre la hoja nativa con el
// archivo; si el archivo falla, comparte texto+enlace (la hoja abre igual). Web → Web
// Share con archivo si se puede; si no, descarga directa.
export async function shareImage(blob: Blob, filename = 'onyx.png', opts: { title?: string; text?: string; url?: string } = {}): Promise<ShareResult> {
  if (isNative()) {
    // 1) Intento con el ARCHIVO (imagen).
    try {
      const base64 = await blobToBase64(blob);
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const { Share } = await import('@capacitor/share');
      await Filesystem.writeFile({ path: filename, data: base64, directory: Directory.Cache });
      const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache });
      await Share.share({ title: opts.title, text: opts.text, files: [uri], dialogTitle: opts.title });
      return 'shared';
    } catch (e: any) {
      if (/cancel/i.test(String(e?.message || ''))) return 'cancel';
      rec('file', e);
      // 2) Respaldo nativo: comparte texto+enlace para que la hoja SIEMPRE abra.
      if (await nativeShareText({ title: opts.title, text: opts.text, url: opts.url })) return 'shared';
      return 'error';
    }
  }
  // WEB
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

// Guardar una imagen. Web → descarga. App → hoja de compartir (el usuario elige
// "Guardar en Fotos"); si falla, comparte texto+enlace para no quedarse en "nada".
export async function saveImage(blob: Blob, filename = 'onyx.png', opts: { title?: string; text?: string; url?: string } = {}): Promise<ShareResult> {
  if (isNative()) return shareImage(blob, filename, opts);
  downloadBlob(blob, filename);
  return 'downloaded';
}

// Abrir un enlace externo. App → navegador del sistema; web → pestaña nueva.
export async function openExternal(url: string) {
  if (isNative()) {
    try { const { Browser } = await import('@capacitor/browser'); await Browser.open({ url }); return; } catch {}
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
