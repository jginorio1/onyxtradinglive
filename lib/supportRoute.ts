// ============================================================
// Ruteo automático de tickets de soporte.
// Elige el mejor agente para un ticket por: idioma del cliente + encaje de
// categoría (puesto del agente) + disponibilidad + menor carga (tickets abiertos
// asignados). Todo configurable desde Admin → Soporte (supportRoutingSettings).
// Nunca lanza: si no hay a quién asignar, devuelve null (queda sin asignar).
// ============================================================
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { supportRoutingSettings } from '@/lib/settings';

// Idiomas comunes en texto → código ISO2 (para comparar con el idioma del cliente).
const LANG_ALIASES: Record<string, string> = {
  'espanol': 'es', 'español': 'es', 'spanish': 'es', 'es': 'es',
  'ingles': 'en', 'inglés': 'en', 'english': 'en', 'en': 'en',
  'portugues': 'pt', 'portugués': 'pt', 'portuguese': 'pt', 'pt': 'pt',
  'frances': 'fr', 'francés': 'fr', 'french': 'fr', 'fr': 'fr',
  'italiano': 'it', 'italian': 'it', 'it': 'it',
  'aleman': 'de', 'alemán': 'de', 'german': 'de', 'de': 'de',
  'chino': 'zh', 'chinese': 'zh', 'zh': 'zh',
  'arabe': 'ar', 'árabe': 'ar', 'arabic': 'ar', 'ar': 'ar',
};
function langCodes(languages?: string): Set<string> {
  const out = new Set<string>();
  for (const part of String(languages || '').split(',')) {
    const key = part.trim().toLowerCase();
    if (!key) continue;
    out.add(LANG_ALIASES[key] || key.slice(0, 2));
  }
  return out;
}

// Palabras en el puesto que sugieren encaje con cada categoría.
const CAT_HINTS: Record<string, RegExp> = {
  facturacion: /(factur|billing|pago|cobr|finanz|admin|cuenta)/i,
  conexion: /(conex|conect|t[eé]cnic|tech|sync|api|soporte)/i,
  instalacion: /(instal|install|t[eé]cnic|tech|ea|mt4|mt5|soporte)/i,
  guardian: /(guardian|riesgo|risk|reto|challenge|soporte)/i,
  general: /(soporte|support|atenci)/i,
};

type Agent = { id: string; email?: string; languages?: string; job_title?: string; role?: string; available?: boolean };

// Devuelve el id del agente elegido, o null si el ruteo está apagado o no hay
// candidatos. `openCount` mapea agentId → nº de tickets abiertos ya asignados.
export async function pickAssignee(opts: { category?: string; lang?: string; exclude?: string[] }): Promise<string | null> {
  const cfg = await supportRoutingSettings();
  if (!cfg.on) return null;
  try {
    const { data: team } = await supabaseAdmin.from('profiles')
      .select('id,email,languages,job_title,role,available').eq('is_admin', true);
    let agents = (team || []) as Agent[];
    const exclude = new Set(opts.exclude || []);
    agents = agents.filter((a) => a.id && !exclude.has(a.id));
    if (cfg.onlyAvailable) {
      const avail = agents.filter((a) => a.available !== false);
      if (avail.length) agents = avail;   // si nadie está disponible, repartimos igual (no dejamos sin dueño)
    }
    if (!agents.length) return null;

    // Carga actual: tickets no resueltos por agente.
    const load: Record<string, number> = {};
    try {
      const { data: open } = await supabaseAdmin.from('support_tickets')
        .select('assignee_id').neq('status', 'resolved').not('assignee_id', 'is', null);
      for (const t of (open || []) as any[]) { if (t.assignee_id) load[t.assignee_id] = (load[t.assignee_id] || 0) + 1; }
    } catch {}

    const wantLang = String(opts.lang || '').slice(0, 2).toLowerCase();
    const catRe = CAT_HINTS[String(opts.category || 'general')] || CAT_HINTS.general;

    const scored = agents.map((a) => {
      let score = 0;
      if (cfg.byLanguage && wantLang && langCodes(a.languages).has(wantLang)) score += 100;
      if (cfg.byCategory && (catRe.test(a.job_title || '') || catRe.test(a.role || ''))) score += 40;
      // Menos carga = mejor (se resta para desempatar). Máx -30 para no dominar al idioma.
      const l = load[a.id] || 0;
      score += cfg.balanceLoad ? -Math.min(l, 30) : 0;
      return { id: a.id, score, load: l };
    });
    scored.sort((x, y) => (y.score - x.score) || (x.load - y.load) || (Math.random() - 0.5));
    return scored[0]?.id || null;
  } catch { return null; }
}
