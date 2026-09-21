import { NextResponse } from 'next/server';
import { fcmDiagnose } from '@/lib/fcm';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/push/diag?secret=<CRON_SECRET>[&token=<fcm token iOS>]
// Diagnóstico de push iOS: manda un push al token iOS más reciente y devuelve el
// estado y respuesta exacta de FCM/APNs. Protegido con el CRON_SECRET (que ya
// tienes en Vercel). Si el push llega al iPhone, mejor aún: config OK.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = url.searchParams.get('secret') || '';
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const token = url.searchParams.get('token') || undefined;
  const res = await fcmDiagnose(token);
  return NextResponse.json(res, { status: 200 });
}
