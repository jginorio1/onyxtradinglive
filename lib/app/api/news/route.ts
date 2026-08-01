import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const revalidate = 900; // 15 minutos

// Calendario económico semanal de Forex Factory (feed público que usa su web).
export async function GET() {
  try {
    const r = await fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.json', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Onyx Trading Live)' },
      next: { revalidate: 900 },
    });
    if (!r.ok) return NextResponse.json({ events: [], error: 'feed no disponible' });
    const data = await r.json();
    const events = (Array.isArray(data) ? data : [])
      .filter((e: any) => e && (e.impact === 'High' || e.impact === 'Medium'))
      .map((e: any) => ({
        title: e.title || '',
        currency: e.country || '',
        impact: e.impact || '',
        date: e.date || '',
        forecast: e.forecast ?? '',
        previous: e.previous ?? '',
      }));
    return NextResponse.json({ events });
  } catch (e: any) {
    return NextResponse.json({ events: [], error: e?.message || 'error' });
  }
}
