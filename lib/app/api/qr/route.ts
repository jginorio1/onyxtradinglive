import QRCode from 'qrcode';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Genera un código QR para cualquier texto/enlace. Reutilizable en toda la app
// (referidos, embajador, Telegram, instalar app, USDT, checkout…).
//   ?data=...   texto o URL (obligatorio)
//   ?size=      lado en px (por defecto 240, máx 1000)
//   ?fmt=svg|png  (svg por defecto, para <img>; png para descargar)
//   ?fg=&bg=    colores en hex (por defecto negro sobre blanco: máxima lectura)
//   ?download=1 fuerza descarga (png)
const hex = (v: string | null, def: string) => (v && /^#?[0-9a-fA-F]{6}$/.test(v) ? (v[0] === '#' ? v : '#' + v) : def);

export async function GET(req: Request) {
  const u = new URL(req.url);
  const data = u.searchParams.get('data') || '';
  if (!data || data.length > 1200) return new Response('bad data', { status: 400 });
  const size = Math.min(1000, Math.max(80, parseInt(u.searchParams.get('size') || '240', 10) || 240));
  const dark = hex(u.searchParams.get('fg'), '#0b1020');
  const light = hex(u.searchParams.get('bg'), '#ffffff');
  const fmt = u.searchParams.get('fmt') === 'png' ? 'png' : 'svg';
  const opts: any = { margin: 1, width: size, errorCorrectionLevel: 'M', color: { dark, light } };

  try {
    if (fmt === 'png') {
      const buf: Buffer = await QRCode.toBuffer(data, { ...opts, type: 'png' });
      const dl = u.searchParams.get('download') === '1';
      return new Response(new Uint8Array(buf), {
        headers: {
          'content-type': 'image/png',
          'cache-control': 'public, max-age=86400',
          ...(dl ? { 'content-disposition': 'attachment; filename="onyx-qr.png"' } : {}),
        },
      });
    }
    const svg: string = await QRCode.toString(data, { ...opts, type: 'svg' });
    return new Response(svg, { headers: { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=86400' } });
  } catch {
    return new Response('qr error', { status: 500 });
  }
}
