import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { hasTrainingAccess, certData } from '@/lib/training';
import { certificatePdf } from '@/lib/trainingCert';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Descarga del certificado en PDF (solo el propio alumno, si aprobó la ruta).
export async function GET(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  if (!(await hasTrainingAccess(user.id))) return NextResponse.json({ error: 'sin acceso' }, { status: 403 });

  const url = new URL(req.url);
  const trackId = url.searchParams.get('track') || '';
  const lang = url.searchParams.get('lang') === 'en' ? 'en' : 'es';
  const data = await certData(user.id, trackId, lang);
  if (!data) return NextResponse.json({ error: 'sin certificado' }, { status: 404 });

  const pdf = await certificatePdf({ ...data, lang });
  const name = `certificado-${(data.code || 'onyx').toLowerCase()}.pdf`;
  return new NextResponse(Buffer.from(pdf), {
    headers: { 'content-type': 'application/pdf', 'content-disposition': `attachment; filename="${name}"` },
  });
}
