import { supabaseAdmin } from '@/lib/supabaseAdmin';

// ============================================================
// CONTEXTO ONYX · un solo perfil de empresa que alimenta a la IA.
// Qué somos, qué stack usamos y hacia dónde vamos. Lo usan Carreras
// (generar/sugerir skills/auditar) y Ventas. Editable desde el panel;
// si no se ha tocado, usa un default inteligente basado en el producto.
// Se guarda en app_settings, clave 'company'.
// ============================================================

export const COMPANY_DEFAULT = `Onyx Trading Live es un SaaS para traders (retail y prop firm).
Qué hacemos: monitoreo de cuentas en vivo, copy-trading, gestión de riesgo (Onyx Guardian), fábrica y marketplace de robots (Bot Lab), academia de mentores, y asistente Onyx AI.
Stack técnico: Next.js 14 (App Router) + React + TypeScript, Supabase (Postgres, Storage, Auth), Stripe y Stripe Connect, Vercel, Resend para correo, API de Anthropic (Claude) para la IA. App móvil con Capacitor (Android). Robots/EAs para MetaTrader 4, MetaTrader 5 y cTrader.
Cómo trabajamos: equipo remoto, multiplataforma, iteración rápida, bilingüe (español/inglés).
Hacia dónde vamos: crecer el copy-trading y la academia, más automatización con IA, y expandir la app móvil y los pagos (tarjeta y USDT).`;

export async function companyContext(): Promise<string> {
  try {
    const { data } = await supabaseAdmin.from('app_settings').select('value').eq('key', 'company').maybeSingle();
    const t = String((data?.value as any)?.text || '').trim();
    return t || COMPANY_DEFAULT;
  } catch { return COMPANY_DEFAULT; }
}

export async function saveCompanyContext(text: string): Promise<{ ok: boolean; text: string }> {
  const value = { text: String(text || '').slice(0, 4000) };
  await supabaseAdmin.from('app_settings').upsert({ key: 'company', value, updated_at: new Date().toISOString() });
  return { ok: true, text: value.text };
}
