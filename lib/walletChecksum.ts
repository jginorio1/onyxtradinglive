// ============================================================
// VALIDACIÓN DE WALLET POR CHECKSUM · isomórfico (server + navegador), sin
// dependencias. Las direcciones USDT llevan un dígito de control MATEMÁTICO:
//
//   • TRON (TRC20): Base58Check — los últimos 4 bytes son SHA256(SHA256(payload)).
//     Si te equivocas en un solo carácter, el checksum ya no cuadra.
//   • Ethereum (ERC20): EIP-55 — las mayúsculas/minúsculas de la dirección
//     codifican un checksum keccak-256. Si viene en mayús/minús mezcladas y no
//     cuadra, está mal escrita.
//
// Gracias a esto NO hace falta que el usuario copie los 34–42 caracteres dos
// veces: el propio número atrapa casi cualquier error de tecleo. Solo pedimos
// confirmar los últimos caracteres (que sí ve y reconoce de su exchange).
// ============================================================

/* ----------------------------- SHA-256 ------------------------------ */
const K256 = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);
function rotr(n: number, x: number) { return (x >>> n) | (x << (32 - n)); }
export function sha256(msg: Uint8Array): Uint8Array {
  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const l = msg.length;
  const withOne = l + 1;
  const k = (56 - (withOne % 64) + 64) % 64;
  const total = withOne + k + 8;
  const m = new Uint8Array(total);
  m.set(msg); m[l] = 0x80;
  const bits = l * 8;
  // longitud en bits (64-bit big-endian; soporta tamaños normales)
  m[total - 4] = (bits >>> 24) & 0xff; m[total - 3] = (bits >>> 16) & 0xff; m[total - 2] = (bits >>> 8) & 0xff; m[total - 1] = bits & 0xff;
  const w = new Uint32Array(64);
  for (let i = 0; i < total; i += 64) {
    for (let t = 0; t < 16; t++) { const o = i + t * 4; w[t] = (m[o] << 24) | (m[o + 1] << 16) | (m[o + 2] << 8) | m[o + 3]; }
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(7, w[t - 15]) ^ rotr(18, w[t - 15]) ^ (w[t - 15] >>> 3);
      const s1 = rotr(17, w[t - 2]) ^ rotr(19, w[t - 2]) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
    }
    let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
    for (let t = 0; t < 64; t++) {
      const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K256[t] + w[t]) | 0;
      const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
  }
  const out = new Uint8Array(32);
  for (let i = 0; i < 8; i++) { out[i * 4] = (H[i] >>> 24) & 0xff; out[i * 4 + 1] = (H[i] >>> 16) & 0xff; out[i * 4 + 2] = (H[i] >>> 8) & 0xff; out[i * 4 + 3] = H[i] & 0xff; }
  return out;
}

/* ---------------------------- Keccak-256 ---------------------------- */
// Keccak-256 (variante Ethereum, padding 0x01), 32 bytes. Implementación con
// BigInt de 64 bits: más lenta pero directa y fácil de verificar. Las entradas
// son direcciones de 40 caracteres, así que el coste es despreciable.
const KMASK = (1n << 64n) - 1n;
const KRC: bigint[] = [
  0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
  0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
  0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
  0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
  0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
  0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
];
// Rotaciones r[x][y] (offsets de rho), layout [x*5+y].
const KROT = [
  0, 36, 3, 41, 18,
  1, 44, 10, 45, 2,
  62, 6, 43, 15, 61,
  28, 55, 25, 21, 56,
  27, 20, 39, 8, 14,
];
function krotl(x: bigint, n: number): bigint { const b = BigInt(n); return ((x << b) | (x >> (64n - b))) & KMASK; }
function keccakF(A: bigint[]) {
  for (let round = 0; round < 24; round++) {
    // Theta
    const C = new Array<bigint>(5);
    for (let x = 0; x < 5; x++) C[x] = A[x] ^ A[x + 5] ^ A[x + 10] ^ A[x + 15] ^ A[x + 20];
    const D = new Array<bigint>(5);
    for (let x = 0; x < 5; x++) D[x] = C[(x + 4) % 5] ^ krotl(C[(x + 1) % 5], 1);
    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) A[x + 5 * y] ^= D[x];
    // Rho + Pi
    const B = new Array<bigint>(25);
    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) {
      B[y + 5 * ((2 * x + 3 * y) % 5)] = krotl(A[x + 5 * y], KROT[x * 5 + y]);
    }
    // Chi
    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) {
      A[x + 5 * y] = B[x + 5 * y] ^ ((~B[(x + 1) % 5 + 5 * y] & KMASK) & B[(x + 2) % 5 + 5 * y]);
    }
    // Iota
    A[0] ^= KRC[round];
  }
}
export function keccak256(msg: Uint8Array): Uint8Array {
  const rate = 136; // bytes (1088 bits) para keccak-256
  const A = new Array<bigint>(25).fill(0n);
  const padded = new Uint8Array(Math.ceil((msg.length + 1) / rate) * rate);
  padded.set(msg);
  padded[msg.length] ^= 0x01;              // padding keccak
  padded[padded.length - 1] ^= 0x80;
  for (let off = 0; off < padded.length; off += rate) {
    for (let i = 0; i < rate; i += 8) {
      let lane = 0n;
      for (let b = 7; b >= 0; b--) lane = (lane << 8n) | BigInt(padded[off + i + b]); // little-endian
      A[i / 8] ^= lane;
    }
    keccakF(A);
  }
  const out = new Uint8Array(32);
  for (let i = 0; i < 4; i++) {
    let lane = A[i];
    for (let b = 0; b < 8; b++) { out[i * 8 + b] = Number(lane & 0xffn); lane >>= 8n; }
  }
  return out;
}

/* ----------------------------- Base58 ------------------------------- */
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function base58Decode(str: string): Uint8Array | null {
  const map: Record<string, number> = {};
  for (let i = 0; i < B58.length; i++) map[B58[i]] = i;
  const bytes: number[] = [0];
  for (const ch of str) {
    const val = map[ch];
    if (val === undefined) return null;
    let carry = val;
    for (let j = 0; j < bytes.length; j++) { carry += bytes[j] * 58; bytes[j] = carry & 0xff; carry >>= 8; }
    while (carry > 0) { bytes.push(carry & 0xff); carry >>= 8; }
  }
  // ceros a la izquierda ('1' en base58 = 0x00)
  for (let i = 0; i < str.length && str[i] === '1'; i++) bytes.push(0);
  return new Uint8Array(bytes.reverse());
}

/* ----------------------- Validadores públicos ----------------------- */
function toHex(b: Uint8Array): string { let s = ''; for (const x of b) s += x.toString(16).padStart(2, '0'); return s; }

// TRON (TRC20): Base58Check, 25 bytes, prefijo 0x41, checksum SHA256d correcto.
export function isValidTron(addr: string): boolean {
  const a = (addr || '').trim();
  if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(a)) return false;
  const dec = base58Decode(a);
  if (!dec || dec.length !== 25) return false;
  if (dec[0] !== 0x41) return false;
  const payload = dec.subarray(0, 21);
  const check = dec.subarray(21, 25);
  const h = sha256(sha256(payload));
  return h[0] === check[0] && h[1] === check[1] && h[2] === check[2] && h[3] === check[3];
}

// Ethereum (ERC20): formato 0x + 40 hex. Si viene con mayús/minús mezcladas,
// además debe cumplir el checksum EIP-55; si va todo en un caso, se acepta.
export function isValidEvm(addr: string): boolean {
  const a = (addr || '').trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(a)) return false;
  const body = a.slice(2);
  const allSame = body === body.toLowerCase() || body === body.toUpperCase();
  if (allSame) return true; // sin información de checksum → válido por formato
  return body === toEip55(body);
}
function toEip55(body40: string): string {
  const lower = body40.toLowerCase();
  const hash = toHex(keccak256(new TextEncoder().encode(lower)));
  let out = '';
  for (let i = 0; i < 40; i++) {
    const c = lower[i];
    out += (/[a-f]/.test(c) && parseInt(hash[i], 16) >= 8) ? c.toUpperCase() : c;
  }
  return out;
}
// Forma canónica EIP-55 (para mostrarla ya "checksumeada").
export function toChecksumEvm(addr: string): string {
  const a = (addr || '').trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(a)) return a;
  return '0x' + toEip55(a.slice(2));
}

export type WalletCheck = { ok: boolean; reason?: 'empty' | 'format' | 'checksum' | 'network' };
export function checkWallet(network: string, addr: string): WalletCheck {
  const a = (addr || '').trim();
  if (!a) return { ok: true, reason: 'empty' };
  if (network === 'trc20') {
    if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(a)) return { ok: false, reason: 'format' };
    return isValidTron(a) ? { ok: true } : { ok: false, reason: 'checksum' };
  }
  if (network === 'erc20') {
    if (!/^0x[0-9a-fA-F]{40}$/.test(a)) return { ok: false, reason: 'format' };
    return isValidEvm(a) ? { ok: true } : { ok: false, reason: 'checksum' };
  }
  return { ok: false, reason: 'network' };
}

/* --------------------------- Presentación --------------------------- */
// Enmascara el centro dejando ver inicio y fin: TQ5x8b·········a9F2kD
export function maskAddress(addr: string, head = 6, tail = 6): string {
  const a = (addr || '').trim();
  if (a.length <= head + tail) return a;
  return a.slice(0, head) + '·'.repeat(9) + a.slice(-tail);
}
// Últimos N caracteres (lo que el usuario confirma contra su exchange).
export function lastChars(addr: string, n = 6): string { const a = (addr || '').trim(); return a.slice(-n); }
