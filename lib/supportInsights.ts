// ============================================================
// Onyx AI · Insights de soporte.
// Lee las conversaciones (leads SIN login + usuarios CON login) de un período y
// produce:
//   · KPIs deterministas (contados en la BD): conversaciones, leads vs usuarios,
//     % resueltas solo por IA, % atendidas por persona, 1ª respuesta media,
//     idiomas y horas pico.
//   · Insights con IA (muestra acotada + caché): temas más preguntados, dónde
//     mejorar y qué añadir. La IA NO lee todo cada vez; toma la primera pregunta
//     de cada conversación (tope) y el resultado se cachea en app_settings.
// Todo es tolerante a columnas ausentes para no romper nunca el panel.
// ============================================================
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSetting, saveSetting } from '@/lib/settings';

export type InsightTopic = { label: string; count: number; trend?: 'up' | 'down' | 'flat' };
export type SupportKpis = {
  from: string; to: string;
  total: number; leads: number; users: number;
  aiResolved: number; aiResolvedPct: number;   // resueltas sin que entrara una persona
  human: number; humanPct: number;             // entró una persona a responder
  firstRespMin: number | null;                 // 1ª respuesta humana media (min)
  langs: Array<{ lang: string; count: number }>;
  countries: Array<{ country: string; count: number }>;   // de dónde escriben (por IP)
  peakHours: Array<{ hour: number; count: number }>;
  questionsSample: string[];                    // primeras preguntas (para la IA)
};
export type SupportAiInsights = { topics: InsightTopic[]; improve: string[]; add: string[] };

// ---- Helper Claude (igual patrón que lib/translate.ts) --------------------
async function anthropicJson(system: string, user: string, maxTokens = 1400): Promise<any | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  try {
    const model = process.env.ONYX_AI_MODEL || 'claude-haiku-4-5-20251001';
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user.slice(0, 12000) }] }),
    });
    if (!r.ok) return null;
    const data = await r.json();
    import('@/lib/aiCost').then((m) => m.logAiUsage('support_insights', data)).catch(() => {});
    const txt = (data?.content || []).map((c: any) => c.text || '').join('\n').trim();
    if (!txt) return null;
    try { return JSON.parse(txt.replace(/```json|```/g, '').trim()); } catch { return null; }
  } catch { return null; }
}

function dayStart(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString(); }

// Divide un arreglo en lotes (para consultas .in() que no admiten miles de ids).
function chunk<T>(arr: T[], n: number): T[][] { const out: T[][] = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; }

// ---- KPIs deterministas ---------------------------------------------------
export async function computeKpis(fromISO: string, toISO: string): Promise<SupportKpis> {
  const empty: SupportKpis = { from: fromISO, to: toISO, total: 0, leads: 0, users: 0, aiResolved: 0, aiResolvedPct: 0, human: 0, humanPct: 0, firstRespMin: null, langs: [], countries: [], peakHours: [], questionsSample: [] };
  // Tickets del período (tolerante a client_lang / is_lead / country ausentes).
  let tickets: any[] = [];
  {
    const sel = 'id,user_id,is_lead,status,client_lang,country,created_at';
    let r = await supabaseAdmin.from('support_tickets').select(sel).gte('created_at', fromISO).lte('created_at', toISO).order('created_at', { ascending: false }).limit(4000);
    if (r.error) r = await supabaseAdmin.from('support_tickets').select('id,user_id,status,created_at').gte('created_at', fromISO).lte('created_at', toISO).order('created_at', { ascending: false }).limit(4000) as any;
    tickets = r.data || [];
  }
  if (!tickets.length) return empty;

  const ids = tickets.map((t) => t.id);
  const ticketById = new Map(tickets.map((t) => [t.id, t]));
  // Agregados por ticket a partir de sus mensajes.
  type Agg = { hasAi: boolean; hasAdmin: boolean; firstUser?: { body: string; at: string }; firstAdminAt?: string };
  const agg = new Map<string, Agg>();
  for (const id of ids) agg.set(id, { hasAi: false, hasAdmin: false });

  for (const ch of chunk(ids, 200)) {
    let r = await supabaseAdmin.from('support_messages').select('ticket_id,sender,body,created_at').in('ticket_id', ch).neq('sender', 'note').order('created_at', { ascending: true }).limit(20000);
    if (r.error) r = await supabaseAdmin.from('support_messages').select('ticket_id,sender,body,created_at').in('ticket_id', ch).order('created_at', { ascending: true }).limit(20000) as any;
    for (const m of (r.data || [])) {
      const a = agg.get((m as any).ticket_id); if (!a) continue;
      const sender = (m as any).sender;
      if (sender === 'ai') a.hasAi = true;
      else if (sender === 'admin') { a.hasAdmin = true; if (!a.firstAdminAt) a.firstAdminAt = (m as any).created_at; }
      else if (sender === 'user') { if (!a.firstUser && String((m as any).body || '').trim()) a.firstUser = { body: String((m as any).body).trim().slice(0, 240), at: (m as any).created_at }; }
    }
  }

  let leads = 0, users = 0, aiResolved = 0, human = 0;
  const langMap = new Map<string, number>();
  const countryMap = new Map<string, number>();
  const hourMap = new Map<number, number>();
  const respMins: number[] = [];
  const questions: Array<{ q: string; at: string }> = [];

  for (const t of tickets) {
    const isLead = t.is_lead != null ? !!t.is_lead : !t.user_id;
    if (isLead) leads++; else users++;
    const a = agg.get(t.id)!;
    if (a.hasAdmin) human++;
    if (a.hasAi && !a.hasAdmin) aiResolved++;   // la IA resolvió sin que entrara una persona
    if (a.firstAdminAt) { const dm = (new Date(a.firstAdminAt).getTime() - new Date(t.created_at).getTime()) / 60000; if (dm >= 0 && dm < 60 * 24 * 7) respMins.push(dm); }
    const lang = String(t.client_lang || '').toLowerCase().slice(0, 5) || 'es';
    langMap.set(lang, (langMap.get(lang) || 0) + 1);
    const cc = String(t.country || '').toUpperCase().slice(0, 2);
    if (/^[A-Z]{2}$/.test(cc)) countryMap.set(cc, (countryMap.get(cc) || 0) + 1);
    const h = new Date(t.created_at).getHours();
    hourMap.set(h, (hourMap.get(h) || 0) + 1);
    if (a.firstUser) questions.push({ q: a.firstUser.body, at: a.firstUser.at });
  }

  const total = tickets.length;
  const langs = [...langMap.entries()].map(([lang, count]) => ({ lang, count })).sort((a, b) => b.count - a.count).slice(0, 6);
  const countries = [...countryMap.entries()].map(([country, count]) => ({ country, count })).sort((a, b) => b.count - a.count).slice(0, 6);
  const peakHours = [...hourMap.entries()].map(([hour, count]) => ({ hour, count })).sort((a, b) => b.count - a.count).slice(0, 4);
  const firstRespMin = respMins.length ? Math.round(respMins.reduce((s, x) => s + x, 0) / respMins.length) : null;
  // Muestra de preguntas para la IA: las más recientes, tope 250.
  const questionsSample = questions.sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 250).map((x) => x.q);

  return {
    from: fromISO, to: toISO, total, leads, users,
    aiResolved, aiResolvedPct: total ? Math.round((aiResolved / total) * 100) : 0,
    human, humanPct: total ? Math.round((human / total) * 100) : 0,
    firstRespMin, langs, countries, peakHours, questionsSample,
  };
}

// ---- Insights con IA (temas / mejorar / añadir) ---------------------------
export async function aiInsights(questions: string[], en: boolean): Promise<SupportAiInsights> {
  const fallback: SupportAiInsights = { topics: [], improve: [], add: [] };
  if (!questions.length) return fallback;
  const sys = en
    ? 'You analyze customer-support questions for a trading platform (Onyx Trading Live). Group them into clear topics, then find where the product/help is failing and what to add. Respond ONLY with valid JSON: {"topics":[{"label":"...","count":N}],"improve":["..."],"add":["..."]}. Up to 7 topics sorted by count, up to 5 items each in improve and add. Be concrete and actionable. No prose outside JSON.'
    : 'Analizas preguntas de soporte al cliente de una plataforma de trading (Onyx Trading Live). Agrúpalas en temas claros, detecta dónde falla el producto/la ayuda y qué conviene añadir. Responde SOLO con JSON válido: {"topics":[{"label":"...","count":N}],"improve":["..."],"add":["..."]}. Hasta 7 temas ordenados por cantidad, hasta 5 puntos en improve y en add. Concreto y accionable. Nada fuera del JSON.';
  const user = (en ? 'Questions (one per line):\n' : 'Preguntas (una por línea):\n') + questions.map((q) => '- ' + q).join('\n');
  const j = await anthropicJson(sys, user, 1500);
  if (!j || typeof j !== 'object') return fallback;
  const topics: InsightTopic[] = Array.isArray(j.topics) ? j.topics.slice(0, 7).map((t: any) => ({ label: String(t?.label || '').slice(0, 80), count: Math.max(0, Math.round(Number(t?.count) || 0)) })).filter((t: InsightTopic) => t.label) : [];
  const clean = (arr: any) => (Array.isArray(arr) ? arr.slice(0, 5).map((s: any) => String(s || '').slice(0, 240)).filter(Boolean) : []);
  return { topics, improve: clean(j.improve), add: clean(j.add) };
}

// ---- Redactar un artículo completo de Base IA desde una sugerencia ---------
// Convierte un tema/sugerencia ("Tutorial de conexión MT4/MT5…") en un artículo
// listo para publicar: título limpio + cuerpo con pasos/estructura. Devuelve
// { title, body }. Si no hay clave de IA, devuelve el tema como título y un
// cuerpo mínimo (semilla) para que el equipo lo complete a mano.
export async function draftArticle(topic: string, en: boolean): Promise<{ title: string; body: string }> {
  const t = String(topic || '').trim().slice(0, 200);
  if (!t) return { title: '', body: '' };
  const sys = en
    ? 'You write help-center articles for Onyx Trading Live (a trading platform: accounts, copy trading, trading robots/EAs for MT4/MT5/cTrader, prop-firm challenges, Onyx Guardian risk tool, ambassadors). Given a topic, write ONE clear, accurate, practical article. Use simple language and concrete steps. If the topic implies a how-to, write numbered steps. Do NOT invent product features you are unsure about; keep it general where needed and tell the reader where to look. Respond ONLY with valid JSON: {"title":"<short clear title>","body":"<the article, plain text with line breaks, you may use short headings and - bullet points>"}. No text outside JSON.'
    : 'Escribes artículos de centro de ayuda para Onyx Trading Live (plataforma de trading: cuentas, copy trading, robots/EAs para MT4/MT5/cTrader, retos de prop firm, Onyx Guardian de gestión de riesgo, embajadores). Dado un tema, redacta UN artículo claro, preciso y práctico. Lenguaje simple y pasos concretos. Si el tema es un "cómo hacer", usa pasos numerados. NO inventes funciones del producto que no tengas claras; mantenlo general donde haga falta e indica al lector dónde mirar. Responde SOLO con JSON válido: {"title":"<título corto y claro>","body":"<el artículo, texto plano con saltos de línea; puedes usar títulos cortos y viñetas con - >"}. Nada fuera del JSON.';
  const j = await anthropicJson(sys, (en ? 'Topic: ' : 'Tema: ') + t, 1600);
  const title = String(j?.title || t).slice(0, 120);
  const body = String(j?.body || '').trim();
  return { title, body: body || t };
}

// ---- Caché del resultado de IA en app_settings ----------------------------
const CACHE_KEY = 'support_insights_cache';
type Cache = { at: string; from: string; to: string; lang: string; data: SupportAiInsights };

// Mínimo de preguntas REALES para que la IA sugiera. Por debajo de esto, NO
// inventamos: la IA extrapolaría genéricos sin base real. Mejor avisar.
const MIN_QUESTIONS = 8;

// Saludos/pruebas que NO son preguntas reales (varios idiomas). Si el mensaje ES
// solo esto (o casi), no cuenta como pregunta de cliente.
const JUNK = /^(hola|hi|hey|hello|holaa+|buenas|buenos dias|buenas tardes|buenas noches|test|testing|prueba|probando|ok|okay|ola|yo|hru|sup|gm|gn|si|no|yes|thanks|gracias|ty|\.|,|\?|¿)+[\s!.¡¿?]*$/i;

// Deja solo preguntas con contenido real: largo mínimo, no saludo/prueba, y
// sin duplicados (texto normalizado). Esto evita que el tráfico de pruebas
// dispare sugerencias inventadas.
function meaningfulQuestions(sample: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of sample) {
    const q = String(raw || '').trim();
    if (q.length < 12) continue;                 // muy corto → no es consulta real
    if (JUNK.test(q)) continue;                  // saludo/prueba
    const words = q.split(/\s+/).filter(Boolean);
    if (words.length < 3) continue;              // menos de 3 palabras → descartar
    const key = q.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
    if (seen.has(key)) continue;                 // duplicado
    seen.add(key); out.push(q);
  }
  return out;
}

export async function getInsights(fromISO: string, toISO: string, en: boolean, refresh: boolean): Promise<{ kpis: SupportKpis; ai: SupportAiInsights; aiAt: string | null; lowData?: boolean }> {
  const kpis = await computeKpis(fromISO, toISO);
  // Solo preguntas reales (sin saludos/pruebas/duplicados).
  const real = meaningfulQuestions(kpis.questionsSample);
  // Pocas conversaciones reales → no fabricamos temas/sugerencias (serían inventados).
  if (real.length < MIN_QUESTIONS) {
    return { kpis, ai: { topics: [], improve: [], add: [] }, aiAt: null, lowData: true };
  }
  const lang = en ? 'en' : 'es';
  let cache = await getSetting<Cache | null>(CACHE_KEY, null as any);
  const sameRange = cache && cache.from === fromISO && cache.to === toISO && cache.lang === lang;
  const fresh = cache && sameRange && (Date.now() - new Date(cache.at).getTime()) < 12 * 3600 * 1000;
  if (!refresh && fresh && cache) return { kpis, ai: cache.data, aiAt: cache.at };
  // Regenerar (o primera vez / rango distinto / forzado). La IA solo ve preguntas reales.
  const ai = await aiInsights(real, en);
  const payload: Cache = { at: new Date().toISOString(), from: fromISO, to: toISO, lang, data: ai };
  try { await saveSetting(CACHE_KEY, payload); } catch {}
  return { kpis, ai, aiAt: payload.at };
}

// Rango por preset de días (hasta hoy, inclusive).
export function rangeForDays(days: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - (days - 1) * 86400000);
  return { from: dayStart(from), to: to.toISOString() };
}
