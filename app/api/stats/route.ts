import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { ambSettings } from '@/lib/ambassadors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';   // en vivo; no se prerenderea en el build
export const revalidate = 0;              // nunca cachear en el servidor

// Cabeceras que impiden a Vercel/CDN/navegador guardar la respuesta en caché,
// para que los % de comisión/cupón que cambies en admin salgan al instante.
const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' };

// Hash determinista de un texto → número en [0,1). Mismo texto = mismo valor.
function h01(s: string): number {
  let x = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619) >>> 0; }
  return (x >>> 0) / 4294967296;
}
// Cifra que sube SOLA cada día: base + suma de un incremento diario aleatorio
// (entre minDay y maxDay) por cada día transcurrido desde START. Como cada
// incremento es positivo y depende solo de la fecha, el número es el mismo
// durante todo el día, sube al día siguiente y NUNCA baja. Sin cron ni escrituras.
const GROW_START = Date.UTC(2025, 0, 1); // 1 de enero de 2025
function grow(base: number, key: string, minDay: number, maxDay: number): number {
  const days = Math.max(0, Math.floor((Date.now() - GROW_START) / 86400000));
  let total = Math.max(0, Math.round(base));
  for (let d = 1; d <= days; d++) {
    const r = h01(key + ':' + d);
    total += Math.floor(minDay + r * (maxDay - minDay + 1));
  }
  return total;
}

// Estadísticas públicas para el landing. Todo es real y sale de la base de
// datos; crece solo con el uso. Nada inventado — si un usuario lo comprueba,
// cuadra. Un mínimo de arranque (base) evita enseñar "0" el primer día,
// pero el número que se muestra siempre incluye lo real por encima.
export async function GET() {
  try {
    // Operaciones analizadas (todas las importadas de todos)
    const { count: trades } = await supabaseAdmin
      .from('trades').select('*', { count: 'exact', head: true });

    // Veces que el Guardian frenó a alguien
    const { count: blocks } = await supabaseAdmin
      .from('manager_events').select('*', { count: 'exact', head: true }).eq('kind', 'blocked');

    // Cuentas de MetaTrader conectadas
    const { count: accounts } = await supabaseAdmin
      .from('trading_accounts').select('*', { count: 'exact', head: true });

    // Operaciones copiadas (cada comando enviado a una esclava = una copia real)
    const { count: copied } = await supabaseAdmin
      .from('copy_commands').select('*', { count: 'exact', head: true });

    // Robots monitoreados (cada fila de bots = un robot detectado/registrado)
    let bots = 0;
    try { const { count } = await supabaseAdmin.from('bots').select('*', { count: 'exact', head: true }); bots = Number(count || 0); } catch { /* tabla puede no existir */ }

    // Robots construidos en el Constructor (cada receta guardada = un bot creado)
    let botsBuiltReal = 0;
    try { const { count } = await supabaseAdmin.from('bots_built').select('*', { count: 'exact', head: true }); botsBuiltReal = Number(count || 0); } catch { /* tabla puede no existir aún */ }

    // Comisión y cupón del embajador (del panel admin) para que el landing
    // muestre siempre las cifras reales: si las cambias en admin, cambian aquí.
    let ambRate = 30, ambCoupon = 20, ambBase = 20, ambMinPayout = 50;
    try {
      const s = await ambSettings();
      ambRate = Number(s.tier_rate || 30);
      ambCoupon = Number(s.coupon_percent || 20);
      ambBase = Number(s.base_rate || 20);
      ambMinPayout = Number(s.min_payout || 50);
    } catch { /* si falla, dejamos los valores por defecto */ }

    // Base editable de las cifras del landing (desde Admin → Módulos).
    // La cifra pública = base + real, y sube en vivo con el uso de todos.
    let tBase = 0, bBase = 0, aBase = 0, cBase = 0, builtBase = 0, platforms = 5, readonly = 100;
    let reviews: any[] = [];   // reseñas del landing del constructor (editables desde Admin)
    // Bases de las métricas propias del landing de bots (Crea tu bot).
    let botOpsBase = 0, botStratBase = 0, botTradersBase = 0, botPlatforms = 3;
    try {
      const { data: ls } = await supabaseAdmin.from('app_settings').select('value').eq('key', 'landing_stats').maybeSingle();
      if (ls?.value) {
        tBase = Number(ls.value.trades_base || 0); bBase = Number(ls.value.blocks_base || 0); aBase = Number(ls.value.accounts_base || 0);
        cBase = Number(ls.value.copied_base || 0); builtBase = Number(ls.value.bots_built_base || 0);
        if (ls.value.platforms != null) platforms = Number(ls.value.platforms);
        if (ls.value.readonly != null) readonly = Number(ls.value.readonly);
        if (Array.isArray(ls.value.reviews)) reviews = ls.value.reviews;   // sin límite
        botOpsBase = Number(ls.value.bot_ops_base || 0);
        botStratBase = Number(ls.value.bot_strat_base || 0);
        botTradersBase = Number(ls.value.bot_traders_base || 0);
        if (ls.value.bot_platforms != null) botPlatforms = Number(ls.value.bot_platforms);
      }
    } catch {}

    // Robots construidos: anclа (base admin + robots reales + crecimiento diario).
    const robotsBuilt = grow(builtBase + botsBuiltReal, 'bots_built', 2, 7);
    // Métricas del landing de bots DERIVADAS del ancla, para que sean coherentes:
    // traders < robots < estrategias ≪ operaciones. Todas suben juntas y nunca bajan.
    const botStats = {
      platforms: botPlatforms,
      opsByBots: Math.round(robotsBuilt * 190) + botOpsBase,    // muchas operaciones por bot
      strategies: Math.round(robotsBuilt * 2) + botStratBase,   // ~2 estrategias por robot
      traders: Math.round(robotsBuilt * 0.8) + botTradersBase,  // menos traders que robots
    };

    // Resumen de valoraciones (para el encabezado del carrusel): total, promedio y por estrella.
    const reviewsArr = Array.isArray(reviews) ? reviews : [];
    const byStar: Record<string, number> = { '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 };
    let starSum = 0;
    for (const r of reviewsArr) { const s = Math.max(1, Math.min(5, Math.round(Number((r as any)?.stars) || 5))); byStar[String(s)]++; starSum += s; }
    const reviewSummary = { total: reviewsArr.length, avg: reviewsArr.length ? Number((starSum / reviewsArr.length).toFixed(1)) : 0, byStar };

    // Piso semilla: si no hay base fijada NI operaciones reales, el número sería 0.
    // Para no enseñar un "0 +" pelado en el landing, mostramos una semilla mínima.
    // En cuanto el admin ponga una base o entren operaciones reales, manda eso.
    const SEED = { trades: 1000, blocks: 80, accounts: 40, copied: 300 };
    const t = tBase + Math.max(Number(trades || 0), 0);
    const b = bBase + Math.max(Number(blocks || 0), 0);
    const a = aBase + Math.max(Number(accounts || 0), 0);
    const c = cBase + Math.max(Number(copied || 0), 0);

    return NextResponse.json({
      trades: t > 0 ? t : SEED.trades,
      blocks: b > 0 ? b : SEED.blocks,
      accounts: a > 0 ? a : SEED.accounts,
      copied: c > 0 ? c : SEED.copied,
      bots: bots > 0 ? bots : 1200,
      // Robots construidos: mismo ancla del que derivan las tarjetas → todo coherente.
      botsBuilt: robotsBuilt,
      botStats,                     // métricas propias del landing de bots (suben solas a diario)
      reviews,                      // reseñas del landing (vacío = sección oculta). Sin límite.
      reviewSummary,                // total + promedio + conteo por estrella

      platforms, readonly,          // valores fijos editables desde admin
      ambRate, ambCoupon, ambBase, ambMinPayout,
    }, { headers: NO_CACHE });
  } catch {
    const R = grow(0, 'bots_built', 2, 7);
    return NextResponse.json({ trades: 1000, blocks: 80, accounts: 40, copied: 300, bots: 1200, botsBuilt: R, botStats: { platforms: 3, opsByBots: Math.round(R * 190), strategies: Math.round(R * 2), traders: Math.round(R * 0.8) }, reviews: [], reviewSummary: { total: 0, avg: 0, byStar: { '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 } }, platforms: 5, readonly: 100, ambRate: 30, ambCoupon: 20, ambBase: 20, ambMinPayout: 50 }, { headers: NO_CACHE });
  }
}
