import { NextResponse } from 'next/server';
import { verifyCertificate } from '@/lib/training';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Verificación pública de un folio de certificado de formación. No requiere
// sesión y no expone datos sensibles (solo nombre, ruta, nota, fechas y estado).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const folio = url.searchParams.get('folio') || url.searchParams.get('code') || '';
  const r = await verifyCertificate(folio);
  return NextResponse.json(r || { valid: false });
}
