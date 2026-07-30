import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isEnrolled } from '@/lib/academy';
import { auditStudent } from '@/lib/academyAI';

// ============================================================
// Onyx Academy · Auditoría del alumno como ADD-ON de pago del mentor.
//   Candados de seguridad (no negociables):
//   1) Consentimiento POR-MENTOR, explícito y revocable (academy_audit_consent).
//   2) El mentor solo ve datos si el alumno tiene el add-on 'audit' activo Y dio
//      consentimiento. Al revocar cualquiera de los dos, el acceso se corta.
//   3) La AI audita, no promete: reporte factual, sin señales ni predicciones.
//   El sello "plan verificado" dice "por su mentor" — nunca "por Onyx".
// ============================================================

const nameOf = (p: any) => p?.full_name || (p?.email || '').split('@')[0] || 'Alumno';

// ---- Consentimiento del alumno hacia un mentor ----
export async function auditConsent(mentorId: string, studentId: string) {
  const { data } = await supabaseAdmin.from('academy_audit_consent').select('granted').eq('mentor_id', mentorId).eq('student_id', studentId).maybeSingle();
  return !!(data as any)?.granted;
}
export async function setAuditConsent(mentorId: string, studentId: string, on: boolean) {
  await supabaseAdmin.from('academy_audit_consent').upsert({
    mentor_id: mentorId, student_id: studentId, granted: on,
    granted_at: on ? new Date().toISOString() : undefined,
    revoked_at: on ? null : new Date().toISOString(),
  }, { onConflict: 'mentor_id,student_id' });
  return on;
}

// ---- Add-on de auditoría (producto kind='audit') ----
// ¿Este mentor vende el add-on de auditoría? Devuelve el nivel si existe.
export async function auditAddon(mentorId: string) {
  const { data } = await supabaseAdmin.from('academy_products').select('id,name,description,price_cents,currency,interval,active').eq('mentor_id', mentorId).eq('kind', 'audit').eq('active', true).maybeSingle();
  return (data as any) || null;
}
// ¿Un alumno tiene el add-on de auditoría activo con este mentor?
export async function hasAuditAddon(studentId: string, mentorId: string) {
  const { data: prods } = await supabaseAdmin.from('academy_products').select('id').eq('mentor_id', mentorId).eq('kind', 'audit');
  const ids = (prods || []).map((p: any) => p.id);
  if (!ids.length) return false;
  const { data } = await supabaseAdmin.from('academy_purchases').select('id').eq('student_id', studentId).eq('mentor_id', mentorId).eq('status', 'active').in('product_id', ids).maybeSingle();
  return !!data;
}
// El mentor puede auditar a este alumno: add-on activo + consentimiento dado.
export async function canAudit(mentorId: string, studentId: string) {
  const [addon, consent] = await Promise.all([hasAuditAddon(studentId, mentorId), auditConsent(mentorId, studentId)]);
  return { ok: addon && consent, addon, consent };
}

// ============================================================
// KPIs + disciplina desde los trades reales del alumno (sin exponer $ de terceros:
// se muestran ratios y % — el mentor ya paga por este servicio y hay consentimiento).
// ============================================================
export async function studentKpis(studentId: string, days = 30) {
  const { data: accs } = await supabaseAdmin.from('trading_accounts').select('id').eq('user_id', studentId);
  const ids = (accs || []).map((a: any) => a.id);
  const empty = { trades: 0, winRate: 0, profitFactor: 0, maxDDPct: 0, avgWin: 0, avgLoss: 0, expectancy: 0, discipline: 0, light: 'gray' as const };
  if (!ids.length) return empty;
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const { data: trades } = await supabaseAdmin.from('trades').select('close_time,net_profit,profit,volume')
    .in('account_id', ids).gte('close_time', since).order('close_time', { ascending: true }).limit(5000);
  const rows = (trades || []).map((t: any) => ({ pnl: Number(t.net_profit ?? t.profit ?? 0) || 0, volume: Number(t.volume) || 0 }));
  const n = rows.length;
  if (!n) return empty;
  const wins = rows.filter((r) => r.pnl > 0), losses = rows.filter((r) => r.pnl < 0);
  const grossWin = wins.reduce((s, r) => s + r.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, r) => s + r.pnl, 0));
  const winRate = Math.round((wins.length / n) * 100);
  const profitFactor = grossLoss > 0 ? Math.round((grossWin / grossLoss) * 100) / 100 : (grossWin > 0 ? 99 : 0);
  const avgWin = wins.length ? grossWin / wins.length : 0;
  const avgLoss = losses.length ? grossLoss / losses.length : 0;
  const expectancy = Math.round(((grossWin - grossLoss) / n) * 100) / 100;
  // Max drawdown (%) sobre la curva de equity de P&L acumulado, relativo al pico.
  let peak = 0, cum = 0, maxDD = 0;
  for (const r of rows) { cum += r.pnl; if (cum > peak) peak = cum; const dd = peak - cum; if (dd > maxDD) maxDD = dd; }
  const denom = Math.max(peak, grossWin, 1);
  const maxDDPct = Math.min(100, Math.round((maxDD / denom) * 100));
  // Coeficiente de variación del tamaño de posición (disciplina de riesgo).
  const vols = rows.map((r) => r.volume).filter((v) => v > 0);
  let cov = 0;
  if (vols.length > 2) {
    const mean = vols.reduce((s, v) => s + v, 0) / vols.length;
    const varr = vols.reduce((s, v) => s + (v - mean) ** 2, 0) / vols.length;
    cov = mean > 0 ? Math.sqrt(varr) / mean : 0;
  }
  // Peor pérdida vs pérdida media (señal de "reventar" un stop / revenge trading).
  const worstLoss = losses.length ? Math.max(...losses.map((r) => Math.abs(r.pnl))) : 0;
  const lossRatio = avgLoss > 0 ? worstLoss / avgLoss : 1;
  // Score de disciplina 0-100 (heurística honesta, basada en comportamiento real).
  let d = 100;
  d -= Math.min(35, Math.round(cov * 40));                 // tamaños inconsistentes
  if (profitFactor < 1) d -= 25; else if (profitFactor < 1.3) d -= 10;
  if (lossRatio > 3) d -= 20; else if (lossRatio > 2) d -= 10; // pérdidas fuera de rango
  if (winRate < 35) d -= 10;
  if (maxDDPct > 30) d -= 10;
  const discipline = Math.max(0, Math.min(100, d));
  const light = discipline >= 75 ? 'green' : discipline >= 50 ? 'amber' : 'red';
  return { trades: n, winRate, profitFactor, maxDDPct, avgWin: Math.round(avgWin * 100) / 100, avgLoss: Math.round(avgLoss * 100) / 100, expectancy, discipline, light };
}

// Últimos trades del alumno (para "ver trades" en el panel). Sin exponer balances.
export async function studentTrades(studentId: string, days = 30, limit = 60) {
  const { data: accs } = await supabaseAdmin.from('trading_accounts').select('id').eq('user_id', studentId);
  const ids = (accs || []).map((a: any) => a.id);
  if (!ids.length) return [];
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const { data } = await supabaseAdmin.from('trades').select('close_time,symbol,side,volume,net_profit,profit')
    .in('account_id', ids).gte('close_time', since).order('close_time', { ascending: false }).limit(limit);
  return (data || []).map((t: any) => ({ close_time: t.close_time, symbol: t.symbol, side: t.side, volume: t.volume, pnl: Number(t.net_profit ?? t.profit ?? 0) || 0 }));
}

// ============================================================
// Roster del mentor: alumnos auditables (con add-on) — para el dashboard.
// ============================================================
export async function auditRoster(mentorId: string) {
  const { data: prods } = await supabaseAdmin.from('academy_products').select('id').eq('mentor_id', mentorId).eq('kind', 'audit');
  const audIds = (prods || []).map((p: any) => p.id);
  const addon = audIds.length > 0;
  // Alumnos con el add-on activo.
  let payers: string[] = [];
  if (addon) {
    const { data: buys } = await supabaseAdmin.from('academy_purchases').select('student_id').eq('mentor_id', mentorId).eq('status', 'active').in('product_id', audIds);
    payers = Array.from(new Set((buys || []).map((b: any) => b.student_id)));
  }
  // Cuántos alumnos aún no compraron el add-on (para el "candado").
  const { count: enrolled } = await supabaseAdmin.from('academy_enrollments').select('student_id', { count: 'exact', head: true }).eq('mentor_id', mentorId).eq('status', 'active');
  if (!payers.length) return { addon, waiting: (enrolled || 0), students: [] as any[] };
  const [{ data: profs }, { data: consents }, { data: verifs }, { data: notesRows }] = await Promise.all([
    supabaseAdmin.from('profiles').select('id,full_name,email').in('id', payers),
    supabaseAdmin.from('academy_audit_consent').select('student_id,granted').eq('mentor_id', mentorId).in('student_id', payers),
    supabaseAdmin.from('academy_plan_verified').select('student_id,verified').eq('mentor_id', mentorId).in('student_id', payers),
    supabaseAdmin.from('academy_student_notes').select('student_id,notes').eq('mentor_id', mentorId).in('student_id', payers),
  ]);
  const cMap = new Map((consents || []).map((c: any) => [c.student_id, !!c.granted]));
  const vMap = new Map((verifs || []).map((v: any) => [v.student_id, !!v.verified]));
  const nMap = new Map((notesRows || []).map((r: any) => [r.student_id, r.notes || '']));
  const pMap = new Map((profs || []).map((p: any) => [p.id, p]));
  const students = [] as any[];
  for (const sid of payers) {
    const consent = cMap.get(sid) || false;
    const kpis = consent ? await studentKpis(sid, 30) : null; // sin consentimiento: sin datos
    students.push({
      student_id: sid, name: nameOf(pMap.get(sid)), consent,
      verified: vMap.get(sid) || false, notes: nMap.get(sid) || '',
      kpis,
    });
  }
  // Verde primero, luego ámbar, rojo, y al final los sin consentimiento.
  const order = (s: any) => !s.consent ? 4 : ({ green: 0, amber: 1, red: 2 } as any)[s.kpis?.light] ?? 3;
  students.sort((a, b) => order(a) - order(b));
  return { addon, waiting: Math.max(0, (enrolled || 0) - payers.length), students };
}

// ---- Notas privadas del mentor ----
export async function saveStudentNote(mentorId: string, studentId: string, notes: string) {
  await supabaseAdmin.from('academy_student_notes').upsert({ mentor_id: mentorId, student_id: studentId, notes: String(notes || '').slice(0, 4000), updated_at: new Date().toISOString() }, { onConflict: 'mentor_id,student_id' });
}

// ---- Sello "plan verificado por su mentor" ----
export async function setPlanVerified(mentorId: string, studentId: string, on: boolean) {
  await supabaseAdmin.from('academy_plan_verified').upsert({ mentor_id: mentorId, student_id: studentId, verified: on, verified_at: on ? new Date().toISOString() : null }, { onConflict: 'mentor_id,student_id' });
  return on;
}
export async function planVerified(mentorId: string, studentId: string) {
  const { data } = await supabaseAdmin.from('academy_plan_verified').select('verified').eq('mentor_id', mentorId).eq('student_id', studentId).maybeSingle();
  return !!(data as any)?.verified;
}

// ---- Reporte AI de auditoría (guarda también disciplina + semáforo) ----
export async function generateAuditReport(mentorId: string, studentId: string, period: '30d' | '90d', lang: 'es' | 'en') {
  const days = period === '90d' ? 90 : 30;
  const k = await studentKpis(studentId, days);
  if (k.trades < 5) return { ok: false, error: 'no_data' as const };
  const { data: prof } = await supabaseAdmin.from('profiles').select('full_name,email').eq('id', studentId).maybeSingle();
  const text = await auditStudent(nameOf(prof), { trades: k.trades, winRate: k.winRate, profitFactor: k.profitFactor }, period, lang);
  if (!text) return { ok: false, error: 'ai_error' as const };
  const { data } = await supabaseAdmin.from('academy_audits').insert({ mentor_id: mentorId, student_id: studentId, period, metrics: k, text, discipline: k.discipline, light: k.light }).select('id').single();
  return { ok: true as const, id: (data as any)?.id, text, metrics: k };
}
