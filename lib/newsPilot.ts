import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { newsPilotSettings, blogKeywordsSettings, getSetting, saveSetting, type NewsPilot } from '@/lib/settings';
import { NEWS_SOURCES, mergedSources, fetchFeed, type NewsItem, type NewsSource } from '@/lib/newsSources';
import { generateNewsArticle } from '@/lib/blogAI';
import { gscOpportunities } from '@/lib/seoSearchConsole';
import { savePost } from '@/lib/blog';
import { sendBlogEmailNow } from '@/lib/blogEmail';
import { logError } from '@/lib/errlog';

// SEO ligero para noticias: elige UNA frase clave de marca (de la lista manual del
// blog o de las oportunidades reales de Search Console) para tejerla SOLO si encaja.
// El foco principal sigue siendo el evento; esto es un extra opcional.
async function pickSeoKeyword(): Promise<string | undefined> {
  try {
    const s = await blogKeywordsSettings();
    if (!s.enabled) return undefined;
    if (s.useGsc) {
      const opps = await gscOpportunities(90, 3);
      if (opps[0]?.query) return opps[0].query;
    }
    const first = (s.es || [])[0] || (s.en || [])[0];
    return first || undefined;
  } catch { return undefined; }
}

// ============================================================
// Piloto de NOTICIAS: vigila fuentes financieras, detecta lo importante y (en
// modo auto) escribe + publica + envía por email al instante. Con tope diario,
// separación mínima y anti-duplicados (tabla news_seen).
// ============================================================

// Palabras clave por familia de tema. Para medios (wire) exigimos que el titular
// contenga alguna; las fuentes primarias (Fed/BLS/ECB) se consideran importantes
// por sí mismas.
const KW: Record<string, string[]> = {
  macro: ['fed', 'federal reserve', 'fomc', 'rate cut', 'rate hike', 'interest rate', 'rates', 'cpi', 'inflation', 'pce', 'gdp', 'jobs', 'payroll', 'nonfarm', 'non-farm', 'unemployment', 'jobless', 'ecb', 'boe', 'boj', 'recession', 'tariff', 'powell', 'treasury', 'yields', 'central bank'],
  markets: ['s&p', 'nasdaq', 'dow', 'stocks', 'sell-off', 'selloff', 'rally', 'wall street', 'futures', 'vix', 'oil', 'crude', 'gold', 'dollar', 'bond', 'plunge', 'surge', 'record high'],
  earnings: ['earnings', 'revenue', 'profit', 'guidance', 'quarterly results', 'beats estimates', 'misses estimates', 'results'],
  crypto: ['bitcoin', 'btc', 'ethereum', 'eth', 'crypto', 'stablecoin', 'binance', 'coinbase', 'etf approval', 'spot etf'],
};

function hashOf(s: string): string {
  let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return 'n' + (h >>> 0).toString(36);
}
const norm = (s: string) => String(s || '').toLowerCase();

// Firma del TÍTULO para anti-duplicados por CONTENIDO (no por URL). La MISMA historia
// llega por varias fuentes con enlaces distintos → sin esto se publicaba varias veces.
// Quita acentos, puntuación y palabras vacías; ordena las palabras significativas.
const STOP = new Set(['the', 'a', 'an', 'of', 'to', 'in', 'on', 'for', 'and', 'or', 'de', 'la', 'el', 'los', 'las', 'un', 'una', 'y', 'o', 'en', 'del', 'al', 'que', 'con', 'por', 'se', 'su']);
function titleSig(title: string): string {
  const words = String(title || '')
    .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')   // sin acentos
    .replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
  return Array.from(new Set(words)).sort().slice(0, 10).join(' ');
}
// ¿Ya hay un artículo con este MISMO título (por firma) publicado hace poco?
async function titlePostedRecently(title: string, hours = 72): Promise<boolean> {
  try {
    const sig = titleSig(title); if (!sig) return false;
    const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();
    const { data } = await supabaseAdmin.from('blog_posts').select('title_es,title_en').gte('created_at', since).limit(200);
    return (data || []).some((p: any) => titleSig(p.title_es) === sig || titleSig(p.title_en) === sig);
  } catch { return false; }
}

// Familia de tema activa según los toggles del dueño.
function topicOn(cat: NewsSource['cat'], t: NewsPilot['topics']): boolean {
  return (cat === 'macro' && t.macro) || (cat === 'markets' && t.markets) || (cat === 'earnings' && t.earnings) || (cat === 'crypto' && t.crypto);
}

// Puntúa la importancia de un item. Fuente primaria pesa mucho; cada keyword suma.
function score(item: NewsItem): number {
  const title = norm(item.title);
  let s = item.tier === 'primary' ? 100 : 0;
  for (const cat of Object.keys(KW)) for (const k of KW[cat]) if (title.includes(k)) s += 6;
  return s;
}
// ¿Es "importante"? Primaria siempre; wire solo si engancha alguna keyword.
function important(item: NewsItem): boolean {
  if (item.tier === 'primary') return true;
  const title = norm(item.title);
  return Object.values(KW).some((arr) => arr.some((k) => title.includes(k)));
}

// Cuántos artículos del piloto se han publicado HOY (UTC) y cuándo fue el último.
// FUENTE DE VERDAD: los artículos REALES en blog_posts (is_news), no news_seen.
// Antes se contaba news_seen.posted; si esa marca no se grababa, el tope daba 0 y
// el piloto republicaba la misma noticia decenas de veces. Contar el blog real
// hace que el tope diario y la separación NO se puedan romper.
async function todayStats(): Promise<{ count: number; lastMs: number }> {
  // Cuenta los artículos de HOY para respetar el tope diario y la separación mínima.
  // A PRUEBA DE INUNDACIÓN: el bug anterior filtraba por is_news y, si esa columna
  // no existía / no se grababa en la BD, la consulta salía vacía -> contaba 0 ->
  // el tope NUNCA frenaba y publicaba en CADA corrida (decenas al día). Ahora:
  //  1) contamos por published_at si existe, con created_at de respaldo,
  //  2) NO dependemos de is_news (si podemos, preferimos noticias; si no, contamos
  //     todo lo publicado hoy, que para un tope de seguridad es lo correcto),
  //  3) si TODO falla, devolvemos un conteo ALTO para NO publicar (falla cerrada:
  //     mejor no publicar que inundar el blog).
  const since = new Date(); since.setUTCHours(0, 0, 0, 0);
  const sinceIso = since.toISOString();
  const lastMsOf = (rows: any[]) => {
    let m = 0;
    for (const r of rows) {
      const t = new Date(r.published_at || r.created_at || 0).getTime();
      if (Number.isFinite(t) && t > m) m = t;
    }
    return m;
  };
  try {
    // CONTAMOS TODO LO PUBLICADO HOY (no solo is_news) usando created_at, que SIEMPRE
    // se graba en el insert. Antes se filtraba por is_news+published_at: si eso quedaba
    // corto, el tope y la separación mínima no frenaban contra el volumen real y se
    // publicaba de más (se vieron 180/día con tope 3). Al contar por created_at el tope
    // coincide con "Publicados hoy" del panel y SIEMPRE frena.
    const r = await supabaseAdmin.from('blog_posts')
      .select('created_at,published_at').eq('status', 'published').gte('created_at', sinceIso);
    if (!r.error && r.data) return { count: r.data.length, lastMs: lastMsOf(r.data) };
    // Respaldo: si por lo que sea created_at fallara, probamos published_at.
    const r2 = await supabaseAdmin.from('blog_posts')
      .select('created_at,published_at').eq('status', 'published').gte('published_at', sinceIso);
    if (!r2.error && r2.data) return { count: r2.data.length, lastMs: lastMsOf(r2.data) };
    return { count: 9999, lastMs: Date.now() }; // falla cerrada: mejor no publicar
  } catch {
    // Si algo revienta, NO publicamos (falla cerrada).
    return { count: 9999, lastMs: Date.now() };
  }
}

// ===== CANDADO ATÓMICO (Postgres) — la garantía definitiva del tope =====
// El tope diario y la separación mínima se hacen cumplir dentro de la BD con
// SELECT ... FOR UPDATE (función news_pilot_claim del archivo sql/news_pilot_atomic.sql).
// Postgres serializa las corridas concurrentes del cron, así que es IMPOSIBLE pasar
// del tope aunque caigan muchas a la vez. Estos helpers llaman a esas funciones.
// Si la función SQL aún no está instalada, devuelven null/valor de respaldo y el
// motor usa una red LEGACY (tope por blog + cerrojo) para no quedar desprotegido.

// Estado de hoy (publicados + hora del último) para el pre-chequeo y el panel.
export async function pilotStatus(): Promise<{ count: number; lastMs: number }> {
  try {
    const { data, error } = await supabaseAdmin.rpc('news_pilot_status');
    if (!error && data && typeof (data as any).count !== 'undefined') {
      const la = (data as any).last_at ? new Date((data as any).last_at).getTime() : 0;
      return { count: Number((data as any).count) || 0, lastMs: Number.isFinite(la) ? la : 0 };
    }
  } catch {}
  // Respaldo: cuenta directa del blog.
  try { const t = await todayStats(); return { count: t.count, lastMs: t.lastMs }; } catch { return { count: 9999, lastMs: Date.now() }; }
}

// Reserva atómica de un turno. { ok:true } concede; { ok:false, reason } deniega;
// null = la función SQL no está instalada (el llamador usa la red legacy).
async function pilotClaim(maxPerDay: number, gapMin: number): Promise<{ ok: boolean; reason?: string } | null> {
  try {
    const { data, error } = await supabaseAdmin.rpc('news_pilot_claim', { p_max: maxPerDay, p_gap_min: gapMin });
    if (!error && data && typeof (data as any).ok === 'boolean') return { ok: (data as any).ok, reason: (data as any).reason };
  } catch {}
  return null;
}

// Devuelve un turno reservado si tras reservar falló la generación/guardado.
async function pilotRelease(): Promise<void> {
  try { await supabaseAdmin.rpc('news_pilot_release'); } catch {}
}

export type Candidate = { title: string; source: string; cat: string; ageMin: number };
export type PilotResult = { ran: boolean; reason?: string; posted?: number; seen?: number; candidate?: string; feeds?: number; feedsOk?: number; fetched?: number; important?: number; fresh?: number; candidates?: Candidate[] };

// Envoltorio público: corre el ciclo y DEJA CONSTANCIA de la última corrida
// (hora + motivo + si publicó) para que el panel muestre si el cron está vivo.
export async function runNewsPilot(force = false, via: 'cron' | 'test' = 'cron', dryRun = false): Promise<PilotResult> {
  let res: PilotResult;
  try { res = await runCycle(force, dryRun); }
  catch (e: any) { res = { ran: false, reason: 'error: ' + (e?.message || 'error') }; }
  const now = Date.now();
  // En SIMULACIÓN no tocamos ningún registro (es solo una vista previa).
  if (dryRun) return res;
  try {
    const { saveSetting, getSetting } = await import('@/lib/settings');
    // Guardamos el EMBUDO completo de la última corrida para que el panel lo dibuje.
    await saveSetting('news_pilot_last', { at: new Date(now).toISOString(), via, reason: res.reason || '', posted: res.posted || 0, candidate: res.candidate || '', feeds: res.feeds || 0, feedsOk: res.feedsOk || 0, fetched: res.fetched || 0, important: res.important || 0, fresh: res.fresh || 0 });
    // LOG de las últimas 20 corridas (hora, tipo, motivo, si publicó) para el historial.
    try {
      const log = await getSetting<{ runs: any[] }>('news_pilot_log', { runs: [] });
      const runs = [{ at: now, via, reason: res.reason || '', posted: res.posted || 0, candidate: (res.candidate || '').slice(0, 120) }, ...(log.runs || [])].slice(0, 20);
      await saveSetting('news_pilot_log', { runs });
    } catch {}
    // Contador de LATIDOS del cron: guardamos la marca de cada corrida automática
    // (via='cron') de las últimas 3 h. Así el panel puede decir cuántas veces disparó
    // Vercel de verdad (esperado ~20/h con */3) y saber si el cron está vivo o no.
    if (via === 'cron') {
      const prev = await getSetting<{ hits: number[] }>('news_pilot_cron', { hits: [] });
      const hits = [...(prev.hits || []), now].filter((t) => now - t <= 3 * 3600 * 1000).slice(-240);
      await saveSetting('news_pilot_cron', { hits });
    }
  } catch {}
  return res;
}

// Ejecuta un ciclo del piloto. Devuelve un resumen para logs/panel.
async function runCycle(force = false, dryRun = false): Promise<PilotResult> {
  const cfg = await newsPilotSettings();
  if (!cfg.enabled && !force) return { ran: false, reason: 'disabled' };

  const maxPerDay = cfg.maxPerDay || 3;
  const gapMin = Math.max(cfg.minMinutesBetween || 60, 0);
  // "Publish now" (force) sí puede saltarse la SEPARACIÓN para probar, pero NUNCA el
  // tope diario (por eso effGap=0 solo afecta a la separación, no al máximo por día).
  const effGap = force ? 0 : gapMin;

  // ===== PRE-CHEQUEO BARATO =====
  // El tope y la separación se hacen cumplir de forma ATÓMICA justo antes de generar
  // (candado en Postgres, más abajo). Aquí solo evitamos gastar llamadas a los feeds
  // y a la IA cuando ya se llegó al tope o falta para la próxima ventana.
  if (!dryRun) {
    const st = await pilotStatus();
    if (st.count >= maxPerDay) return { ran: true, reason: 'cap_reached', posted: 0 };
    if (effGap && st.lastMs && Date.now() - st.lastMs < effGap * 60000) return { ran: true, reason: 'too_soon', posted: 0 };
  }

  // Fuentes activas (por toggle y por tema). Incluye las custom del dueño.
  const all = mergedSources(cfg.custom_sources);
  const active = all.filter((s) => cfg.sources[s.id] !== false && topicOn(s.cat, cfg.topics));
  if (!active.length) return { ran: true, reason: 'no_sources', posted: 0 };

  // Descarga feeds en paralelo y junta items frescos e importantes.
  const results = await Promise.all(active.map((s) => fetchFeed(s)));
  // Ventana de frescura. Piso de 48 h: los fines de semana los feeds casi no
  // publican, así que en lunes la noticia más reciente puede tener 2-3 días. Con
  // anti-duplicados (news_seen) + tope diario + separación mínima, una ventana amplia
  // NO satura; solo garantiza que SIEMPRE haya candidatas. El orden por importancia
  // y luego por frescura (más abajo) hace que se publiquen las MEJORES y más nuevas
  // primero. (Antes el default de 45 min descartaba todo y solo publicaba con Test.)
  const maxAge = Math.max(cfg.maxAgeMin || 2880, 2880) * 60000;
  const flat = results.flat();
  // Diagnóstico (se ve en la respuesta del cron): cuántos feeds respondieron con
  // items, cuántos items en total, cuántos importantes y cuántos frescos. Así
  // sabemos si el problema es que las fuentes vienen vacías (bloqueadas) o el filtro.
  const feedsOk = results.filter((r) => r.length > 0).length;
  const importantCount = flat.filter((it) => important(it)).length;
  const diag = { feeds: active.length, feedsOk, fetched: flat.length, important: importantCount };
  const fresh = flat.filter((it) => Date.now() - it.published <= maxAge && important(it));
  if (!fresh.length) return { ran: true, reason: 'no_fresh', posted: 0, seen: 0, fresh: 0, ...diag };

  // Ordena por importancia y frescura.
  fresh.sort((a, b) => (score(b) - score(a)) || (b.published - a.published));

  // SIMULACIÓN: devolvemos los CANDIDATOS que se publicarían (frescos, importantes y
  // no vistos), SIN generar ni guardar nada. Perfecto para probar sin ensuciar el blog.
  if (dryRun) {
    const cands: Candidate[] = [];
    for (const it of fresh.slice(0, 30)) {
      const sig = titleSig(it.title);
      const h = sig ? hashOf('t:' + sig) : hashOf(norm(it.link) || norm(it.title));
      const { data: seen } = await supabaseAdmin.from('news_seen').select('hash').eq('hash', h).maybeSingle();
      if (seen) continue;
      cands.push({ title: it.title, source: it.sourceName, cat: it.cat, ageMin: Math.round((Date.now() - it.published) / 60000) });
      if (cands.length >= 8) break;
    }
    return { ran: true, reason: cands.length ? 'dry_run' : 'all_seen', posted: 0, fresh: fresh.length, candidates: cands, ...diag };
  }

  // Salta los ya vistos (anti-duplicados). Toma el primero nuevo.
  // La clave de "visto" es la FIRMA DEL TÍTULO (contenido), no la URL: así la misma
  // historia que llega por varias fuentes con enlaces distintos NO se publica varias
  // veces. Además, respaldo: si ya hay un artículo con ese título en el blog (últimas
  // 72 h), se salta aunque news_seen no lo tenga (carreras entre crons).
  let pick: NewsItem | null = null; let pickHash = '';
  for (const it of fresh.slice(0, 25)) {
    const sig = titleSig(it.title);
    const h = sig ? hashOf('t:' + sig) : hashOf(norm(it.link) || norm(it.title));
    const { data: seen } = await supabaseAdmin.from('news_seen').select('hash').eq('hash', h).maybeSingle();
    if (seen) continue;
    if (await titlePostedRecently(it.title)) {
      // Ya publicada por otra vía: márcala vista para no reevaluarla y sigue.
      try { await supabaseAdmin.from('news_seen').insert({ hash: h, source: it.sourceId, title: it.title.slice(0, 300), url: it.link, posted: true }); } catch {}
      continue;
    }
    // Registra como visto de inmediato (aunque no lo publiquemos) para no reevaluarlo.
    try { await supabaseAdmin.from('news_seen').insert({ hash: h, source: it.sourceId, title: it.title.slice(0, 300), url: it.link, posted: false }); } catch {}
    pick = it; pickHash = h; break;
  }
  if (!pick) return { ran: true, reason: 'all_seen', posted: 0, fresh: fresh.length, ...diag };

  // ===== CANDADO ATÓMICO: reserva el turno del día ANTES de generar =====
  // Este es el punto que hace IMPOSIBLE pasarse del tope. La reserva vive en la BD
  // (news_pilot_claim, con FOR UPDATE): si otra corrida ya llenó el tope o publicó
  // hace menos que la separación, aquí se DENIEGA. Al denegar, soltamos la noticia
  // (borramos su marca de "vista") para reintentarla en la próxima ventana.
  let claimedAtomic = false;
  if (!dryRun) {
    const claim = await pilotClaim(maxPerDay, effGap);
    if (claim && claim.ok === false) {
      try { await supabaseAdmin.from('news_seen').delete().eq('hash', pickHash); } catch {}
      return { ran: true, reason: claim.reason === 'gap' ? 'too_soon' : 'cap_reached', posted: 0, fresh: fresh.length, ...diag };
    }
    if (claim && claim.ok === true) {
      claimedAtomic = true;   // turno reservado atómicamente; si algo falla, lo devolvemos
    } else {
      // Red LEGACY (mientras el archivo sql/news_pilot_atomic.sql no esté instalado):
      // tope por conteo real del blog + cerrojo en app_settings. No es atómica, pero
      // protege hasta que corras el SQL; después manda el candado de arriba.
      const { count: c2 } = await todayStats();
      if (c2 >= maxPerDay) { try { await supabaseAdmin.from('news_seen').delete().eq('hash', pickHash); } catch {} return { ran: true, reason: 'cap_reached', posted: 0, fresh: fresh.length, ...diag }; }
      const gate = await getSetting<{ at: number }>('news_pilot_gate', { at: 0 });
      if (effGap && gate.at && Date.now() - gate.at < effGap * 60000) { try { await supabaseAdmin.from('news_seen').delete().eq('hash', pickHash); } catch {} return { ran: true, reason: 'too_soon', posted: 0, fresh: fresh.length, ...diag }; }
      try { await saveSetting('news_pilot_gate', { at: Date.now() }); } catch {}
    }
  }

  // SEO ligero (opcional): una keyword de marca para tejer solo si encaja.
  const keyword = cfg.seo ? await pickSeoKeyword() : undefined;
  // Escribe el artículo con la IA.
  const gen = await generateNewsArticle({ headline: pick.title, summary: pick.summary, sourceName: pick.sourceName, sourceUrl: pick.link, category: pick.cat, keyword });
  if (!gen.ok || !gen.article) {
    // IMPORTANTE: si la IA falla (429/timeout transitorio), LIBERAMOS la noticia
    // (borramos el registro "visto") para que el siguiente ciclo del cron la
    // reintente y llegue a publicarse sola. Antes se quedaba "quemada" para siempre.
    try { await supabaseAdmin.from('news_seen').delete().eq('hash', pickHash); } catch {}
    if (claimedAtomic) await pilotRelease();   // devuelve el cupo: la IA falló, no publicamos
    await logError('news_pilot_gen', new Error(gen.reason || 'gen_failed'));
    return { ran: true, reason: 'gen_failed', posted: 0, candidate: pick.title, fresh: fresh.length, ...diag };
  }

  // Candado final anti-duplicado por el TÍTULO YA GENERADO. La IA crea un título
  // propio (distinto al titular crudo del feed), así que solo comparando ese título
  // contra los del blog se detecta la MISMA historia ya publicada. Si ya existe,
  // no volvemos a publicarla: marcamos la noticia como vista y salimos.
  if (await titlePostedRecently(gen.article.title_es || '') || await titlePostedRecently(gen.article.title_en || '')) {
    try { await supabaseAdmin.from('news_seen').update({ posted: true }).eq('hash', pickHash); } catch {}
    if (claimedAtomic) await pilotRelease();   // no publicamos (duplicada): devuelve el cupo
    return { ran: true, reason: 'dup_title', posted: 0, candidate: pick.title, fresh: fresh.length, ...diag };
  }

  const auto = cfg.mode !== 'draft';
  // Publica (auto) o deja borrador. En auto, activa el email inmediato (inglés).
  // Si por lo que sea el guardado falla, LIBERAMOS la noticia (borramos el "visto")
  // para que el próximo ciclo la reintente, y no congelamos el piloto.
  let saved: { id: string; slug?: string };
  try {
    saved = await savePost({
      ...gen.article,
      status: auto ? 'published' : 'draft', is_news: true,
      email_enabled: auto, email_when: 'now', email_segment: cfg.emailSegment || 'all',
    });
  } catch (e: any) {
    try { await supabaseAdmin.from('news_seen').delete().eq('hash', pickHash); } catch {}
    if (claimedAtomic) await pilotRelease();   // guardado falló: devuelve el cupo
    await logError('news_pilot_save', e);
    return { ran: true, reason: 'save_failed', posted: 0, candidate: pick.title, fresh: fresh.length, ...diag };
  }

  // Marca el registro como publicado (para tope diario y separación).
  try { await supabaseAdmin.from('news_seen').update({ posted: auto, post_id: saved.id }).eq('hash', pickHash); } catch {}

  // Envío por email inmediato solo en modo auto.
  if (auto) {
    try {
      const { data: post } = await supabaseAdmin.from('blog_posts').select('*').eq('id', saved.id).maybeSingle();
      if (post) await sendBlogEmailNow(post, cfg.emailSegment || 'all');
    } catch (e) { await logError('news_pilot_email', e); }
  }

  // El cupo del día ya quedó contado en el candado atómico (news_pilot_claim).
  return { ran: true, reason: auto ? 'posted' : 'drafted', posted: auto ? 1 : 0, candidate: pick.title, fresh: fresh.length, ...diag };
}
