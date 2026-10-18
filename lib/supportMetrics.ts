// ============================================================
// Métricas operativas de soporte para el tablero.
// Primera respuesta, tiempo de resolución, backlog, reaperturas, escalados,
// CSAT, y desgloses por categoría, por AGENTE y por LEAD SOURCE (de dónde vienen
// los clientes). Ventana configurable (por defecto 30 días). Nunca lanza.
// ============================================================
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const MIN = 60000, HR = 3.6e6;
function avg(xs: number[]): number { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0; }
function median(xs: number[]): number { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }

export type SupportMetrics = {
  days: number;
  totals: { created: number; resolved: number; open: number; backlog: number; leads: number };
  firstResponse: { avgMin: number; medianMin: number; measured: number };
  resolution: { avgHr: number; medianHr: number; measured: number };
  reopenRate: number;      // % de tickets que se reabrieron
  escalated: number;       // tickets con nivel ≥2
  csat: { avg: number; count: number; promoters: number; detractors: number };
  byCategory: Array<{ key: string; count: number }>;
  bySource: Array<{ key: string; count: number }>;      // LEAD SOURCE: de dónde vienen
  byAgent: Array<{ id: string; name: string; email: string; open: number; resolved: number; firstRespMin: number; csat: number }>;
  byPriority: Array<{ key: string; count: number }>;
};

export async function supportMetrics(days = 30): Promise<SupportMetrics> {
  const since = new Date(Date.now() - days * 24 * HR).toISOString();
  const out: SupportMetrics = {
    days,
    totals: { created: 0, resolved: 0, open: 0, backlog: 0, leads: 0 },
    firstResponse: { avgMin: 0, medianMin: 0, measured: 0 },
    resolution: { avgHr: 0, medianHr: 0, measured: 0 },
    reopenRate: 0, escalated: 0,
    csat: { avg: 0, count: 0, promoters: 0, detractors: 0 },
    byCategory: [], bySource: [], byAgent: [], byPriority: [],
  };
  try {
    // Traemos lo necesario con tolerancia: si columnas nuevas no existen, caemos a lo básico.
    let rows: any[] = [];
    const sel = 'id,status,category,priority,source,assignee_id,is_lead,created_at,first_response_at,resolved_at,reopen_count,escalation_level,csat';
    let q = await supabaseAdmin.from('support_tickets').select(sel).gte('created_at', since).limit(5000);
    if ((q as any)?.error) q = await supabaseAdmin.from('support_tickets').select('id,status,category,priority,assignee_id,is_lead,created_at').gte('created_at', since).limit(5000) as any;
    rows = (q as any)?.data || [];

    const frMin: number[] = [], resHr: number[] = [];
    const cat: Record<string, number> = {}, src: Record<string, number> = {}, pri: Record<string, number> = {};
    const agent: Record<string, { open: number; resolved: number; fr: number[]; csat: number[] }> = {};
    let reopened = 0, csatSum = 0;

    for (const t of rows) {
      out.totals.created++;
      if (t.is_lead) out.totals.leads++;
      if (t.status === 'resolved') out.totals.resolved++;
      else { out.totals.open++; if (t.status === 'open' || t.status === 'in_progress') out.totals.backlog++; }
      cat[t.category || 'general'] = (cat[t.category || 'general'] || 0) + 1;
      pri[t.priority || 'normal'] = (pri[t.priority || 'normal'] || 0) + 1;
      src[t.source || 'direct'] = (src[t.source || 'direct'] || 0) + 1;
      if (Number(t.reopen_count || 0) > 0) reopened++;
      if (Number(t.escalation_level || 1) >= 2) out.escalated++;
      if (t.first_response_at) frMin.push((new Date(t.first_response_at).getTime() - new Date(t.created_at).getTime()) / MIN);
      if (t.resolved_at) resHr.push((new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime()) / HR);
      if (typeof t.csat === 'number' && t.csat >= 1) { csatSum += t.csat; out.csat.count++; if (t.csat >= 4) out.csat.promoters++; else if (t.csat <= 2) out.csat.detractors++; }
      const a = t.assignee_id;
      if (a) {
        (agent[a] ||= { open: 0, resolved: 0, fr: [], csat: [] });
        if (t.status === 'resolved') agent[a].resolved++; else agent[a].open++;
        if (t.first_response_at) agent[a].fr.push((new Date(t.first_response_at).getTime() - new Date(t.created_at).getTime()) / MIN);
        if (typeof t.csat === 'number' && t.csat >= 1) agent[a].csat.push(t.csat);
      }
    }

    out.firstResponse = { avgMin: Math.round(avg(frMin)), medianMin: Math.round(median(frMin)), measured: frMin.length };
    out.resolution = { avgHr: +avg(resHr).toFixed(1), medianHr: +median(resHr).toFixed(1), measured: resHr.length };
    out.reopenRate = out.totals.created ? Math.round((reopened / out.totals.created) * 100) : 0;
    out.csat.avg = out.csat.count ? +(csatSum / out.csat.count).toFixed(2) : 0;
    out.byCategory = Object.entries(cat).map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
    out.bySource = Object.entries(src).map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
    out.byPriority = Object.entries(pri).map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);

    // Nombres de los agentes
    const ids = Object.keys(agent);
    const nameBy: Record<string, { name: string; email: string }> = {};
    if (ids.length) {
      const { data: profs } = await supabaseAdmin.from('profiles').select('id,name,email').in('id', ids);
      for (const p of (profs || []) as any[]) nameBy[p.id] = { name: p.name || '', email: p.email || '' };
    }
    out.byAgent = ids.map((id) => ({
      id, name: nameBy[id]?.name || '', email: nameBy[id]?.email || '',
      open: agent[id].open, resolved: agent[id].resolved,
      firstRespMin: Math.round(avg(agent[id].fr)),
      csat: agent[id].csat.length ? +(avg(agent[id].csat)).toFixed(2) : 0,
    })).sort((a, b) => (b.resolved + b.open) - (a.resolved + a.open));
  } catch {}
  return out;
}
