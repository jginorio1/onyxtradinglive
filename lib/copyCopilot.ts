import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { copyGuardForSlave } from '@/lib/copyGuard';

// ============================================================
// ONYX AI · Copiloto de copia (#10)
// Lee el estado real de las copias del trader (reglas de prop firm, colchón,
// latencia, slippage, actividad reciente) y genera sugerencias claras en su
// idioma. Es determinista (reglas), no inventa números: todo sale de datos
// que ya existen. Pensado para avisar antes de que un problema cueste el reto.
// ============================================================

export type CopilotTip = {
  level: 'alert' | 'warn' | 'info' | 'ok';   // rojo / ámbar-marca / informativo / verde
  es: string;
  en: string;
  account?: string;   // nombre de la esclava, si aplica
};

function accName(a: any): string {
  return a?.nickname || (a?.broker ? `${a.broker} · #${a.login}` : `#${a?.login || ''}`);
}

export async function copyCopilot(userId: string): Promise<{ tips: CopilotTip[] }> {
  const tips: CopilotTip[] = [];
  try {
    const { data: links } = await supabaseAdmin.from('copy_links')
      .select('id,slave_account_id,enabled,multiplier,guard_prop_rules,guard_strict,size_by_challenge,daily_loss_pct,require_sl')
      .eq('owner_id', userId);
    const list = links || [];
    if (!list.length) {
      tips.push({ level: 'info', es: 'Aún no tienes copias configuradas. Crea una para empezar.', en: 'You have no copies set up yet. Create one to get started.' });
      return { tips };
    }

    // Nombres de las esclavas.
    const slaveIds = Array.from(new Set(list.map((l: any) => l.slave_account_id)));
    const { data: accs } = await supabaseAdmin.from('trading_accounts').select('id,nickname,broker,login').in('id', slaveIds);
    const byId: Record<string, any> = {}; (accs || []).forEach((a: any) => { byId[a.id] = a; });

    // Log reciente para latencia/slippage/errores por copia.
    const { data: logs } = await supabaseAdmin.from('copy_log')
      .select('link_id,ok,latency_ms,detail,created_at').eq('owner_id', userId)
      .order('created_at', { ascending: false }).limit(200);
    const lg = logs || [];

    const activeN = list.filter((l: any) => l.enabled).length;
    if (!activeN) tips.push({ level: 'warn', es: 'Todas tus copias están en pausa. Ninguna operación se está replicando.', en: 'All your copies are paused. Nothing is being replicated.' });

    for (const l of list) {
      const nm = accName(byId[l.slave_account_id] || {});
      const mine = lg.filter((e: any) => e.link_id === l.id);
      const oks = mine.filter((e: any) => e.ok);
      const errs = mine.filter((e: any) => !e.ok);

      // Guardián / colchón del reto.
      if (l.guard_prop_rules || l.size_by_challenge) {
        try {
          const g = await copyGuardForSlave(userId, l.slave_account_id, { strict: !!l.guard_strict });
          const hr = Math.round((g.headroom ?? 1) * 100);
          if (g.verdict === 'breach') tips.push({ level: 'alert', account: nm, es: `${nm}: alcanzó un límite de prop firm (${g.reasonEs}). El Guardián frenó las copias nuevas.`, en: `${nm}: hit a prop-firm limit (${g.reasonEn}). The Guard paused new copies.` });
          else if (g.verdict === 'watch') tips.push({ level: 'warn', account: nm, es: `${nm}: está cerca de su límite (colchón ${hr}%). Considera bajar el multiplicador o activar el modo estricto.`, en: `${nm}: close to its limit (${hr}% headroom). Consider lowering the multiplier or enabling strict mode.` });
          else if (hr <= 40 && l.enabled) tips.push({ level: 'info', account: nm, es: `${nm}: colchón al ${hr}%. Vigila el riesgo en las próximas operaciones.`, en: `${nm}: ${hr}% headroom left. Watch risk on the next trades.` });
        } catch {}
      } else if (l.enabled && Number(l.daily_loss_pct) > 0) {
        tips.push({ level: 'info', account: nm, es: `${nm}: no tiene el Guardián de prop firm activo. Si es una cuenta de reto, enciéndelo para proteger el límite.`, en: `${nm}: the prop-firm Guard is off. If this is a challenge account, turn it on to protect the limit.` });
      }

      // Tasa de error reciente.
      if (mine.length >= 5) {
        const errRate = errs.length / mine.length;
        if (errRate >= 0.3) tips.push({ level: 'warn', account: nm, es: `${nm}: ${Math.round(errRate * 100)}% de las últimas señales se saltaron o fallaron. Revisa spread, sesión o la lista de símbolos.`, en: `${nm}: ${Math.round(errRate * 100)}% of recent signals were skipped or failed. Check spread, session or the symbol list.` });
      }

      // Latencia alta.
      const lats = oks.map((e: any) => Number(e.latency_ms)).filter((n: number) => n > 0);
      if (lats.length >= 5) {
        const avg = lats.reduce((s: number, n: number) => s + n, 0) / lats.length;
        if (avg > 1500) tips.push({ level: 'warn', account: nm, es: `${nm}: latencia media alta (${Math.round(avg)} ms). Si usas EA, acércalo a un VPS cerca del bróker.`, en: `${nm}: high average latency (${Math.round(avg)} ms). If using an EA, move it to a VPS near the broker.` });
      }

      // Sin SL exigido.
      if (l.enabled && l.require_sl === false) tips.push({ level: 'info', account: nm, es: `${nm}: no exige Stop Loss. Actívalo para no copiar entradas sin protección.`, en: `${nm}: Stop Loss not required. Enable it so unprotected entries aren't copied.` });

      // Inactividad: copia activa sin señales recientes.
      if (l.enabled && !mine.length) tips.push({ level: 'info', account: nm, es: `${nm}: activa pero sin señales recientes. Verifica que el EA o la conexión de la master estén en línea.`, en: `${nm}: active but no recent signals. Check that the master's EA or connection is online.` });
    }

    if (!tips.length) tips.push({ level: 'ok', es: 'Todo en orden: tus copias están dentro de las reglas y sin incidencias recientes.', en: 'All good: your copies are within the rules with no recent issues.' });
  } catch {
    tips.push({ level: 'info', es: 'No se pudo analizar ahora mismo. Intenta de nuevo en un momento.', en: 'Could not analyze right now. Try again in a moment.' });
  }
  return { tips };
}
