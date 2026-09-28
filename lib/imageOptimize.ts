// Comprime y redimensiona una imagen antes de guardarla en Storage.
// Usa sharp con import dinámico: si no estuviera disponible, devuelve el
// original sin romper la subida.
export async function compressImage(buf: Buffer, contentType?: string): Promise<{ buffer: Buffer; contentType: string; ext: string; originalSize: number; newSize: number; saved: number }> {
  const originalSize = buf.length;
  const fallback = () => ({ buffer: buf, contentType: contentType || 'image/jpeg', ext: (contentType || '').includes('png') ? 'png' : 'jpg', originalSize, newSize: originalSize, saved: 0 });
  try {
    // @ts-ignore - sharp se instala en producción (package.json); import dinámico tolerante.
    const sharp = (await import('sharp')).default;
    // Máximo 1600px de ancho, calidad razonable, formato webp (mucho más ligero).
    const out = await sharp(buf)
      .rotate() // respeta la orientación EXIF
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 72 })
      .toBuffer();
    // Si por lo que sea quedó más grande, nos quedamos con el original.
    if (out.length >= originalSize) return fallback();
    return { buffer: out, contentType: 'image/webp', ext: 'webp', originalSize, newSize: out.length, saved: originalSize - out.length };
  } catch {
    return fallback();
  }
}
