import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Descarga una copia .sql.gz guardada en Backblaze B2, autenticando con las
// mismas llaves que usa la tarea de backup. Necesita en Vercel:
//   B2_KEY_ID, B2_APP_KEY, B2_BUCKET
// Solo el Owner (ajustes: gestionar) puede descargar.
export async function GET(req: Request) {
  const { ok } = await requirePerm('ajustes', 'manage');
  if (!ok) return NextResponse.json({ error: 'Solo el Owner puede descargar copias.' }, { status: 403 });

  const file = new URL(req.url).searchParams.get('file') || '';
  // Nombre esperado: onyx-backup-YYYYMMDD-HHMM.sql.gz (evita rutas raras).
  if (!/^onyx-backup-[\w-]+\.sql\.gz$/.test(file)) {
    return NextResponse.json({ error: 'Nombre de archivo no válido.' }, { status: 400 });
  }

  const keyId = process.env.B2_KEY_ID;
  const appKey = process.env.B2_APP_KEY;
  const bucket = process.env.B2_BUCKET;
  if (!keyId || !appKey || !bucket) {
    return NextResponse.json({
      error: 'Para descargar desde aquí, añade B2_KEY_ID, B2_APP_KEY y B2_BUCKET en Vercel (Project → Settings → Environment Variables), las mismas que ya tienes en GitHub. Mientras tanto, descárgalo desde Backblaze → Browse Files.',
    }, { status: 501 });
  }

  try {
    // 1) Autorizar
    const auth = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
      headers: { Authorization: 'Basic ' + Buffer.from(`${keyId}:${appKey}`).toString('base64') },
    });
    if (!auth.ok) return NextResponse.json({ error: 'No se pudo autenticar con Backblaze. Revisa las llaves.' }, { status: 502 });
    const a = await auth.json();

    // 2) Descargar el archivo por nombre (carpeta backups/)
    const url = `${a.downloadUrl}/file/${encodeURIComponent(bucket)}/backups/${encodeURIComponent(file)}`;
    const dl = await fetch(url, { headers: { Authorization: a.authorizationToken } });
    if (!dl.ok || !dl.body) {
      return NextResponse.json({ error: 'No se encontró la copia en Backblaze (puede haber caducado por la regla de ciclo de vida).' }, { status: 404 });
    }

    return new NextResponse(dl.body, {
      headers: {
        'content-type': 'application/gzip',
        'content-disposition': `attachment; filename="${file}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Error al descargar la copia.' }, { status: 500 });
  }
}
