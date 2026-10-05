// Carga el logo de marca (onyx-symbol.png) desde /public para embeberlo en los
// PDFs generados con pdf-lib (propuestas, cotizaciones, certificados).
//
// Es el MISMO símbolo que usa el Track Record y los correos, así la marca se ve
// igual en todos los reportes. Se cachea en memoria tras la primera lectura.
// Si por alguna razón no se encuentra el archivo, devuelve null y el llamador
// sigue sin logo (nunca rompe la generación del PDF).

let _cache: Uint8Array | null | undefined;

export async function brandLogoPng(): Promise<Uint8Array | null> {
  if (_cache !== undefined) return _cache;
  try {
    const fs = await import('fs');
    const path = await import('path');
    // En producción (Vercel/Next) el cwd es la raíz del proyecto → /public.
    const candidates = [
      path.join(process.cwd(), 'public', 'onyx-symbol.png'),
      path.join(process.cwd(), 'onyx-symbol.png'),
    ];
    for (const p of candidates) {
      try {
        const buf = fs.readFileSync(p);
        _cache = new Uint8Array(buf);
        return _cache;
      } catch { /* siguiente candidato */ }
    }
  } catch { /* fs no disponible */ }
  _cache = null;
  return _cache;
}
