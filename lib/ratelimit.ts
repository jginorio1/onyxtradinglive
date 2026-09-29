// Rate limiting ligero, respaldado por la base (tabla rate_hits).
// A prueba de fallos: si la tabla no existe o la base falla, NO bloquea (fail-open).
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NextResponse } from 'next/server';

export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for') || '';
  const first = xff.split(',')[0].trim();
  return first || req.headers.get('x-real-ip') || 'unknown';
}

export type RateResult = { ok: boolean; remaining: number; retryAfter: number };

export async function rateLimit(bucket: string, ip: string, max: number, windowSec: number): Promise<RateResult> {
  try {
    const since = new Date(Date.now() - windowSec * 1000).toISOString();
    const { count, error } = await supabaseAdmin
      .from('rate_hits')
      .select('id', { count: 'exact', head: true })
      .eq('bucket', bucket).eq('ip', ip).gte('created_at', since);
    if (error) return { ok: true, remaining: max, retryAfter: 0 };
    const used = count || 0;
    if (used >= max) return { ok: false, remaining: 0, retryAfter: windowSec };
    await supabaseAdmin.from('rate_hits').insert({ bucket, ip }).then(() => {}, () => {});
    if (Math.random() < 0.02) {
      const old = new Date(Date.now() - 86400000).toISOString();
      await supabaseAdmin.from('rate_hits').delete().lt('created_at', old).then(() => {}, () => {});
    }
    return { ok: true, remaining: Math.max(0, max - used - 1), retryAfter: 0 };
  } catch {
    return { ok: true, remaining: max, retryAfter: 0 };
  }
}

export function tooMany(retryAfter: number, lang: 'es' | 'en' = 'es') {
  const msg = lang === 'en'
    ? 'Too many requests. Please wait a moment and try again.'
    : 'Demasiadas peticiones. Espera un momento e inténtalo de nuevo.';
  return NextResponse.json({ ok: false, error: msg, code: 'rate_limited' }, {
    status: 429, headers: { 'Retry-After': String(Math.max(1, retryAfter)) },
  });
}
