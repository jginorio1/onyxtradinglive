import { NextResponse } from 'next/server';
import { landingContent } from '@/lib/landingContent';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Público: el contenido editable del landing para que las páginas lo apliquen.
export async function GET() {
  const c = await landingContent();
  return NextResponse.json(c, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' } });
}
