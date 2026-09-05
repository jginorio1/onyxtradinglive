import { supabaseAdmin } from '@/lib/supabaseAdmin';

// ============================================================
// Onyx Bot Factory · Fase 3 — Pipeline de validación de 6 meses en demo.
// Todo automático (lo dispara un cron). El robot avanza de etapa solo cuando
// su score supera el filtro; si al terminar la etapa no lo supera, se archiva.
// El semáforo vigila la salud en vivo y aplica acciones automáticas.
// ============================================================

export const STAGES = [
  { key: 'demo', es: 'Demo temprano', en: 'Early demo', days: 30, gate: 60, minTrades: 20 },
  { key: 'consistencia', es: 'Consistencia', en: 'Consistency', days: 60, gate: 65, minTrades: 60 },
  { key: 'estres', es: 'Estrés', en: 'Stress', days: 45, gate: 65, minTrades: 100 },
  { key: 'prereal', es: 'Pre-real', en: 'Pre-live', days: 45, gate: 70, minTrades: 140 },
];
export const PIPELINE_KEYS = STAGES.map((s) => s.key);
export function stageMeta(i: number) { return STAGES[i] || null; }

const DAY = 86400000;
const r2 = (x: number) => Math.round(x * 100) / 100;

type T = { net_profit: number; close_time: string; open_time?: string };

async function tradesSince(account: string, magic: number, sinceIso?: string): Promise<T[]> {
  let q = supabaseAdmin.from('trades').select('net_profit,open_time,close_time').eq('account_id', account).eq('magic', magic).order('close_time', { ascending: true }).limit(5000);
  if (sinceIso) q = q.gte('close_time', sinceIso);
  const { data } = await q;
  return ((data || []) as any[]).filter((t) => t.close_time);
}

// Encuentra la cuenta con más operaciones para un magic (para conectar la demo).
export async function resolveAccountByMagic(magic: number): Promise<string | null> {
  const { data } = await supabaseAdmin.from('trades').select('account_id').eq('magic', magic).limit(5000);
  const cnt: Record<string, number> = {};
  (data || []).forEach((t: any) => { cnt[t.account_id] = (cnt[t.account_id] || 0) + 1; });
  const best = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
  return best || null;
}

function metrics(rows: T[], startBal = 10000) {
  const n = rows.length;
  let gp = 0, gl = 0, wins = 0, best = 0, net = 0, cum = startBal, peak = startBal, ddAbs = 0;
  for (const t of rows) {
    const p = Number(t.net_profit) || 0; net += p;
    if (p >= 0) { gp += p; wins += 1; } else gl += -p;
    if (p > best) best = p;
    cum += p; if (cum > peak) peak = cum; ddAbs = Math.max(ddAbs, peak - cum);
  }
  const pf = gl > 0 ? gp / gl : (gp > 0 ? 3 : 0);
  const winRate = n ? Math.round((wins / n) * 100) : 0;
  const ddPct = peak > 0 ? Math.round((ddAbs / peak) * 1000) / 10 : 0;
  const expectancy = n ? net / n : 0;
  return { n, net: Math.round(net), pf: r2(pf), winRate, ddPct, expectancy: r2(expectancy) };
}

function scoreStage(m: ReturnType<typeof metrics>, daysInStage: number, stage: typeof STAGES[number]) {
  const cap = (x: number, mx: number) => Math.max(0, Math.min(mx, x));
  const pTrades = cap((m.n / stage.minTrades) * 30, 30);
  const pDays = cap((daysInStage / stage.days) * 20, 20);
  const pPf = m.pf >= 1.4 ? 25 : m.pf >= 1 ? cap(((m.pf - 1) / 0.4) * 25, 25) : 0;
  const pDd = m.ddPct <= 12 ? 15 : cap(15 - (m.ddPct - 12), 15);
  const pExp = m.expectancy > 0 ? 10 : 0;
  return Math.round(pTrades + pDays + pPf + pDd + pExp);
}

// Semáforo: mira SOLO lo reciente (últimas 30 operaciones).
function health(rows: T[]) {
  const recent = rows.slice(-30);
  const m = metrics(recent, 10000);
  let streak = 0; for (let i = recent.length - 1; i >= 0; i--) { if ((Number(recent[i].net_profit) || 0) < 0) streak++; else break; }
  let h: 'green' | 'yellow' | 'orange';
  if (m.pf >= 1.05 && m.ddPct <= 10 && streak < 5) h = 'green';
  else if (m.pf >= 0.85 && m.ddPct <= 18 && streak < 7) h = 'yellow';
  else h = 'orange';
  return { health: h, recentPf: m.pf, recentDd: m.ddPct, streak };
}

// Correlación de retornos diarios entre robots activos (para evitar riesgo apilado).
function daily(rows: T[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of rows) { const d = String(t.close_time).slice(0, 10); out[d] = (out[d] || 0) + (Number(t.net_profit) || 0); }
  return out;
}
function pearson(a: number[], b: number[]) {
  const n = a.length; if (n < 5) return 0;
  const ma = a.reduce((x, y) => x + y, 0) / n, mb = b.reduce((x, y) => x + y, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { const x = a[i] - ma, y = b[i] - mb; num += x * y; da += x * x; db += y * y; }
  const den = Math.sqrt(da * db);
  return den > 0 ? r2(num / den) : 0;
}
export async function correlationMatrix(bots: any[]) {
  const series: { id: string; name: string; d: Record<string, number> }[] = [];
  for (const b of bots) {
    if (!b.live_account || b.live_magic == null) continue;
    const rows = await tradesSince(b.live_account, Number(b.live_magic), new Date(Date.now() - 70 * DAY).toISOString());
    series.push({ id: b.id, name: b.name, d: daily(rows) });
  }
  const matrix: { a: string; b: string; v: number }[] = [];
  const maxBy: Record<string, { v: number; name: string }> = {};
  for (let i = 0; i < series.length; i++) {
    for (let j = i + 1; j < series.length; j++) {
      const days = Array.from(new Set([...Object.keys(series[i].d), ...Object.keys(series[j].d)])).sort();
      const va = days.map((d) => series[i].d[d] || 0), vb = days.map((d) => series[j].d[d] || 0);
      const v = pearson(va, vb);
      matrix.push({ a: series[i].id, b: series[j].id, v });
      if (!maxBy[series[i].id] || Math.abs(v) > Math.abs(maxBy[series[i].id].v)) maxBy[series[i].id] = { v, name: series[j].name };
      if (!maxBy[series[j].id] || Math.abs(v) > Math.abs(maxBy[series[j].id].v)) maxBy[series[j].id] = { v, name: series[i].name };
    }
  }
  return { names: series.map((s) => ({ id: s.id, name: s.name })), matrix, maxBy };
}

async function log(botId: string, ev: string, from: string, to: string, score: number, h: string, note: string) {
  await supabaseAdmin.from('factory_stage_log').insert({ bot_id: botId, from_stage: from, to_stage: to, event: ev, score, health: h, note });
}

// ---- El cron: evalúa TODOS los robots activos del pipeline una vez ----
export async function runPipelineOnce() {
  const { data: active } = await supabaseAdmin.from('factory_bots').select('*')
    .in('stage', PIPELINE_KEYS).eq('real_approved', false).limit(500);
  const bots = (active || []) as any[];
  if (!bots.length) return { evaluated: 0 };

  const corr = await correlationMatrix(bots);
  let evaluated = 0;

  for (const b of bots) {
    if (!b.live_account || b.live_magic == null) continue;
    const idx = Number(b.stage_index) || 0;
    const stage = STAGES[idx]; if (!stage) continue;
    const startBal = 10000;
    const started = b.stage_started_at ? new Date(b.stage_started_at).getTime() : Date.now();
    const rows = await tradesSince(b.live_account, Number(b.live_magic), b.stage_started_at || undefined);
    const m = metrics(rows, startBal);
    const daysInStage = Math.max(0, Math.round((Date.now() - started) / DAY));
    const score = scoreStage(m, daysInStage, stage);
    const hz = health(rows);

    // Correlación: si está muy pegado a otro robot activo, baja exposición.
    const mc = corr.maxBy[b.id];
    let hlth = hz.health;
    let note = '';
    if (mc && Math.abs(mc.v) > 0.7 && hlth === 'green') { hlth = 'yellow'; note = `corr ${mc.v} con ${mc.name}`; }

    // Paper trading (naranja): pausa el riesgo real y, tras 30 ops, decide.
    let paper = !!b.paper;
    let paperStarted = b.paper_started_at;
    if (hlth === 'orange' && !paper) { paper = true; paperStarted = new Date().toISOString(); await log(b.id, 'paper', stage.key, stage.key, score, hlth, 'a paper por bajo rendimiento'); }
    if (paper) {
      const pRows = paperStarted ? rows.filter((t) => new Date(t.close_time).getTime() >= new Date(paperStarted).getTime()) : rows;
      if (pRows.length >= 30) {
        const pm = metrics(pRows, startBal);
        if (pm.pf >= 1.0) { paper = false; paperStarted = null; hlth = 'yellow'; await log(b.id, 'paper_exit', stage.key, stage.key, score, hlth, `recuperó en paper (PF ${pm.pf})`); }
        else { hlth = 'orange'; note = 'sigue en paper, necesita ajustes'; }
      } else hlth = 'orange';
    }
    const risk = paper ? 0 : hlth === 'yellow' ? 0.5 : 1;

    // Compuerta de etapa: solo se decide cuando la etapa cumplió su tiempo.
    const patch: any = {
      score, health: hlth, risk_factor: risk, paper, paper_started_at: paper ? paperStarted : null,
      max_corr: mc ? mc.v : null, corr_with: mc ? mc.name : null, last_pipeline_at: new Date().toISOString(),
    };
    if (b.health !== hlth) await log(b.id, 'health', stage.key, stage.key, score, hlth, note || `salud ${b.health}→${hlth}`);

    if (daysInStage >= stage.days && !paper) {
      const passed = score >= stage.gate && m.n >= Math.round(stage.minTrades * 0.6);
      if (passed) {
        if (idx + 1 < STAGES.length) {
          patch.stage_index = idx + 1; patch.stage = STAGES[idx + 1].key; patch.stage_started_at = new Date().toISOString();
          await log(b.id, 'advance', stage.key, STAGES[idx + 1].key, score, hlth, 'pasó el filtro');
        } else {
          patch.real_ready = true; patch.stage = 'listo'; patch.stage_started_at = new Date().toISOString();
          await log(b.id, 'real', stage.key, 'listo', score, hlth, 'completó el pipeline · listo para real');
        }
      } else {
        patch.status = 'archivado'; patch.stage = 'archived';
        await log(b.id, 'archive', stage.key, 'archived', score, hlth, `no pasó el filtro (${score} < ${stage.gate})`);
      }
    }

    await supabaseAdmin.from('factory_bots').update(patch).eq('id', b.id);
    evaluated++;
  }
  return { evaluated };
}

// ---- Acciones del admin ----

// Conecta un robot a una cuenta demo por magic y arranca el pipeline.
export async function linkDemo(botId: string, magic: number, account?: string) {
  const acc = account || await resolveAccountByMagic(magic);
  if (!acc) throw new Error('No encontré operaciones con ese magic. Corre el robot en la cuenta demo primero.');
  const now = new Date().toISOString();
  await supabaseAdmin.from('factory_bots').update({
    live_account: acc, live_magic: magic, stage_index: 0, stage: STAGES[0].key, status: 'activo',
    stage_started_at: now, pipeline_started_at: now, health: 'green', risk_factor: 1, paper: false, real_ready: false,
  }).eq('id', botId);
  await log(botId, 'advance', 'demo_link', STAGES[0].key, 0, 'green', 'conectado a demo · inicia pipeline');
  return { ok: true, account: acc };
}

export async function stageOverride(botId: string, dir: 'advance' | 'archive') {
  const { data: b } = await supabaseAdmin.from('factory_bots').select('stage_index,stage').eq('id', botId).maybeSingle();
  if (!b) throw new Error('Robot no encontrado.');
  const idx = Number((b as any).stage_index) || 0;
  if (dir === 'archive') { await supabaseAdmin.from('factory_bots').update({ status: 'archivado', stage: 'archived' }).eq('id', botId); await log(botId, 'archive', (b as any).stage, 'archived', 0, 'green', 'archivado manual'); return { ok: true }; }
  if (idx + 1 < STAGES.length) { await supabaseAdmin.from('factory_bots').update({ stage_index: idx + 1, stage: STAGES[idx + 1].key, stage_started_at: new Date().toISOString() }).eq('id', botId); await log(botId, 'advance', STAGES[idx].key, STAGES[idx + 1].key, 0, 'green', 'avance manual'); }
  else { await supabaseAdmin.from('factory_bots').update({ real_ready: true, stage: 'listo' }).eq('id', botId); await log(botId, 'real', STAGES[idx].key, 'listo', 0, 'green', 'listo para real (manual)'); }
  return { ok: true };
}

// Aprobación de 1 clic para pasar a cuenta REAL.
export async function approveReal(botId: string) {
  const { data: b } = await supabaseAdmin.from('factory_bots').select('real_ready').eq('id', botId).maybeSingle();
  if (!b || !(b as any).real_ready) throw new Error('El robot aún no completó el pipeline.');
  await supabaseAdmin.from('factory_bots').update({ real_approved: true, stage: 'real', health: 'green', risk_factor: 1 }).eq('id', botId);
  await log(botId, 'real', 'listo', 'real', 0, 'green', 'aprobado a cuenta real por el admin');
  return { ok: true };
}

// Lo que el EA lee de la nube para autoregularse.
export async function eaControl(account: string, magic: number) {
  const { data } = await supabaseAdmin.from('factory_bots').select('risk_factor,paper,health,stage').eq('live_account', account).eq('live_magic', magic).maybeSingle();
  if (!data) return { risk_factor: 1, paper: false, health: 'green', stage: null };
  const d = data as any;
  return { risk_factor: Number(d.risk_factor ?? 1), paper: !!d.paper, health: d.health || 'green', stage: d.stage };
}

// Datos para el tablero del admin.
export async function pipelineBoard() {
  const { data } = await supabaseAdmin.from('factory_bots').select('*').order('created_at', { ascending: false }).limit(300);
  const bots = (data || []) as any[];
  const inPipe = bots.filter((b) => PIPELINE_KEYS.includes(b.stage) || ['listo', 'real'].includes(b.stage));
  const corr = await correlationMatrix(inPipe.filter((b) => PIPELINE_KEYS.includes(b.stage)));
  return { bots, stages: STAGES, corr };
}
