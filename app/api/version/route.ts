import { NextResponse } from 'next/server';
import { appVersion } from '@/lib/appVersion';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Público: la versión que ve todo el mundo (production). Para el footer.
export async function GET() {
  try {
    const v = await appVersion();
    return NextResponse.json({ version: v.production || '1.0' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ version: '1.0' }, { headers: { 'Cache-Control': 'no-store' } });
  }
}
