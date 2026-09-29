// Rate limiting ligero, respaldado por la base (tabla rate_hits).
//
// Uso:
//   const rl = await rateLimit('analyze', clientIp(req), 8, 60);   // 8 por minuto
//   if (!rl.ok) return tooMany(rl.retryAfter);
//
// A prueba de fallos: si la tabla rate_hits aún no existe (SQL sin correr) o la
// base falla, NO bloquea (fail-open) para no tumbar producción por el limitador.
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Saca la IP real del visitante detrás del proxy de Vercel.
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for') || '';
  const first = xff.split(',')[0].trim();
  return first || req.headers.get('x-real-ip') || 'unknown';
}

export type RateResult = { ok: boolean; remaining: number; retryAfter: number };

// max = peticiones permitidas dentro de windowSec segundos por (bucket, ip).
export async function rateLimit(bucket: string, ip: string, max: number, windowSec: number): Promise<RateResult> {
  try {
    const since = new Date(Date.now() - windowSec * 1000).toISOString();
    const { count, error } = await supabaseAdmin
      .from('rate_hits')
      .select('id', { count: 'exact', head: true })
      .eq('bucket', bucket).eq('ip', ip).gte('created_at', since);
    // Si la tabla no existe o hay error, no bloqueamos (fail-open).
    if (error) return { ok: true, remaining: max, retryAfter: 0 };

    const used = count || 0;
    if (used >= max) return { ok: false, remaining: 0, retryAfter: windowSec };

    // Registramos esta petición (best-effort; si falla, igual dejamos pasar).
    await supabaseAdmin.from('rate_hits').insert({ bucket, ip }).then(() => {}, () => {});
    // Limpieza oportunista muy de vez en cuando (borra lo más viejo que 1 día).
    if (Math.random() < 0.02) {
      const old = new Date(Date.now() - 86400000).toISOString();
      await supabaseAdmin.from('rate_hits').delete().lt('created_at', old).then(() => {}, () => {});
    }
    return { ok: true, remaining: Math.max(0, max - used - 1), retryAfter: 0 };
  } catch {
    return { ok: true, remaining: max, retryAfter: 0 };   // ante cualquier fallo, no bloquea
  }
}

// Respuesta 429 estándar (con Retry-After en segundos).
import { NextResponse } from 'next/server';
export function tooMany(retryAfter: number, lang: 'es' | 'en' = 'es') {
  const msg = lang === 'en'
    ? 'Too many requests. Please wait a moment and try again.'
    : 'Demasiadas peticiones. Espera un momento e inténtalo de nuevo.';
  return NextResponse.json({ ok: false, error: msg, code: 'rate_limited' }, {
    status: 429, headers: { 'Retry-After': String(Math.max(1, retryAfter)) },
  });
}
