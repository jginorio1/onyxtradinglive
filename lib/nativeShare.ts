// ============================================================
// Compartir / guardar / abrir — funciona igual en la WEB y en la APP (Capacitor).
//
// El problema: dentro del WebView de la app, `navigator.share` casi nunca existe
// (por eso "Compartir" solo copiaba el enlace) y la descarga de archivos con un
// <a download> no hace NADA (por eso "Descargar" no respondía). La solución es usar
// los plugins nativos de Capacitor (Share + Filesystem) cuando corremos dentro de
// la app, y quedarnos con el comportamiento web normal en el navegador.
//
// Todo se importa de forma perezosa (dynamic import) para NO cargar los plugins en
// la web ni romper el build. Si algo falla, siempre hay un respaldo razonable.
// ============================================================
import { isNativeApp } from '@/lib/native';

type ShareResult = 'shared' | 'copied' | 'downloaded' | 'cancel' | 'error';

// Compartir un ENLACE. App → hoja de compartir nativa. Web → Web Share si existe,
// si no copia al portapapeles. Devuelve qué pasó para poder mostrar un aviso.
export async function shareLink(o: { title?: string; text?: string; url: string }): Promise<ShareResult> {
  const { title, text, url } = o;
  if (isNativeApp()) {
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

// Compartir / guardar una IMAGEN (Blob). App → guarda el archivo en caché y abre la
// hoja de compartir nativa (desde ahí el usuario elige "Guardar en Fotos", WhatsApp,
// etc.). Web → Web Share con archivo si se puede; si no, descarga directa.
export async function shareImage(blob: Blob, filename = 'onyx.png', opts: { title?: string; text?: string } = {}): Promise<ShareResult> {
  if (isNativeApp()) {
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
      // Si falla el guardado nativo, caemos a la descarga web más abajo.
    }
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

// Descargar un Blob (web) o, dentro de la app, mandarlo a la hoja de compartir para
// que el usuario lo guarde (en el WebView una descarga normal no funciona).
export async function saveImage(blob: Blob, filename = 'onyx.png', opts: { title?: string; text?: string } = {}): Promise<ShareResult> {
  if (isNativeApp()) return shareImage(blob, filename, opts);
  downloadBlob(blob, filename);
  return 'downloaded';
}

// Abrir un enlace externo. En la app usa el navegador del sistema (no atrapa la URL
// dentro del WebView); en web abre una pestaña nueva.
export async function openExternal(url: string) {
  if (isNativeApp()) {
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
