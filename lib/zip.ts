// ============================================================
// Onyx Bot Factory · Creador de ZIP mínimo (método "store", sin comprimir).
// Sin dependencias: arma un .zip válido en el navegador para el "Pack Onyx"
// (EA + reporte + trades en un solo archivo). Nombres ASCII, fecha fija.
// ============================================================

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    let c = (crc ^ bytes[i]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export type ZipEntry = { name: string; data: string | Uint8Array };

export function makeZip(entries: ZipEntry[]): Blob {
  const enc = new TextEncoder();
  const files = entries.map((e) => ({ name: e.name, bytes: typeof e.data === 'string' ? enc.encode(e.data) : e.data }));
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const f of files) {
    const nameB = enc.encode(f.name);
    const crc = crc32(f.bytes);
    const sz = f.bytes.length;
    // Local file header (30 bytes + nombre).
    const lh = new Uint8Array(30 + nameB.length);
    const lv = new DataView(lh.buffer);
    lv.setUint32(0, 0x04034b50, true);      // firma
    lv.setUint16(4, 20, true);              // versión
    lv.setUint16(6, 0, true);               // flags
    lv.setUint16(8, 0, true);               // método: store
    lv.setUint16(10, 0, true);              // hora
    lv.setUint16(12, 0x21, true);           // fecha (1980-01-01)
    lv.setUint32(14, crc, true);
    lv.setUint32(18, sz, true);             // comprimido
    lv.setUint32(22, sz, true);             // sin comprimir
    lv.setUint16(26, nameB.length, true);
    lv.setUint16(28, 0, true);              // extra
    lh.set(nameB, 30);
    chunks.push(lh, f.bytes);

    // Central directory header.
    const ch = new Uint8Array(46 + nameB.length);
    const cv = new DataView(ch.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0x21, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, sz, true);
    cv.setUint32(24, sz, true);
    cv.setUint16(28, nameB.length, true);
    cv.setUint32(42, offset, true);         // offset del local header
    ch.set(nameB, 46);
    central.push(ch);

    offset += lh.length + f.bytes.length;
  }

  const cdSize = central.reduce((s, c) => s + c.length, 0);
  const cdOffset = offset;
  // End of central directory.
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, cdOffset, true);

  return new Blob([...chunks, ...central, eocd], { type: 'application/zip' });
}
