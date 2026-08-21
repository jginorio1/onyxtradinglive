// Onyx AI INTERNO para el equipo. A diferencia del Onyx de cara al cliente
// (que nunca da datos privados), este vive SOLO dentro del panel y solo lo usan
// empleados con permiso. Sirve para preguntas de CONJUNTO que no ves de un
// vistazo en un ticket: pendientes, patrones por categoría, historial de un
// cliente, etc. Nunca revela secretos ni da consejo financiero.
import { supabaseAdmin } from '@/lib/supabaseAdmin';

import type { Lang } from './navText';
import { aiLangDirective, enBase, LANG_NAME } from '@/lib/i18n';
const H = 3600 * 1000;

function nameOf(p: any) { return (p?.full_name || (p?.email || '').split('@')[0] || 'cliente'); }

const CAT_ES: any = { general: 'General', conexion: 'Conexión', instalacion: 'Instalación', guardian: 'Guardian', facturacion: 'Facturación' };
const CAT_EN: any = { general: 'General', conexion: 'Connection', instalacion: 'Install', guardian: 'Guardian', facturacion: 'Billing' };

// Resumen diario del turno (determinista, sin modelo → siempre sale y es barato).
// Pendientes de anoche, leads nuevos, lo que espera respuesta, sin asignar.
export async function teamDigest(lang: Lang): Promise<string> {
  const en = enBase(lang);
  const { data: tickets } = await supabaseAdmin.from('support_tickets')
    .select('id,email,subject,category,status,is_lead,priority,assignee_id,created_at,updated_at')
    .order('updated_at', { ascending: false }).limit(200);
  const rows = (tickets || []) as any[];
  const ids = rows.map((t) => t.id);
  const lastSender: Record<string, string> = {};
  const lastAt: Record<string, string> = {};
  if (ids.length) {
    const { data: msgs } = await supabaseAdmin.from('support_messages')
      .select('ticket_id,sender,created_at').in('ticket_id', ids).order('created_at', { ascending: true });
    for (const m of (msgs || []) as any[]) { lastSender[m.ticket_id] = m.sender; lastAt[m.ticket_id] = m.created_at; }
  }
  const dayAgo = Date.now() - 24 * H;
  const waiting: any[] = [];
  const newLeads: any[] = [];
  let newTickets = 0, unassigned = 0;
  const byCat: Record<string, number> = {};
  for (const t of rows) {
    const created = new Date(t.created_at).getTime();
    if (created > dayAgo) { newTickets++; if (t.is_lead) newLeads.push(t); }
    if (t.status !== 'resolved') {
      byCat[t.category || 'general'] = (byCat[t.category || 'general'] || 0) + 1;
      if (!t.assignee_id) unassigned++;
      if (lastSender[t.id] === 'user') {
        const hrs = Math.round((Date.now() - new Date(lastAt[t.id] || t.updated_at).getTime()) / H);
        waiting.push({ subject: t.subject, email: t.email, hrs, priority: t.priority });
      }
    }
  }
  waiting.sort((a, b) => b.hrs - a.hrs);
  const CAT = en ? CAT_EN : CAT_ES;
  const date = new Date().toLocaleDateString(en ? 'en-US' : 'es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

  const lines: string[] = [];
  lines.push(en ? `☀️ Shift digest — ${date}` : `☀️ Resumen del turno — ${date}`);
  lines.push('');
  lines.push(en ? `🕒 Awaiting our reply: ${waiting.length}` : `🕒 Esperan nuestra respuesta: ${waiting.length}`);
  waiting.slice(0, 8).forEach((w) => lines.push(`   • "${(w.subject || '').slice(0, 50)}" · ${w.email || '—'} · ${w.hrs}h${w.priority === 'high' ? (en ? ' · HIGH' : ' · ALTA') : ''}`));
  lines.push('');
  lines.push(en ? `🆕 New leads (24h): ${newLeads.length}` : `🆕 Leads nuevos (24h): ${newLeads.length}`);
  newLeads.slice(0, 8).forEach((t) => lines.push(`   • ${t.email || '—'} — "${(t.subject || '').slice(0, 50)}"`));
  lines.push('');
  lines.push(en ? `📨 New tickets (24h): ${newTickets}` : `📨 Tickets nuevos (24h): ${newTickets}`);
  lines.push(en ? `🗂️ Unassigned: ${unassigned}` : `🗂️ Sin asignar: ${unassigned}`);
  const catStr = Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${CAT[k] || k}=${v}`).join(' · ');
  lines.push((en ? `📊 Open by category: ` : `📊 Sin resolver por categoría: `) + (catStr || '—'));
  lines.push('');
  lines.push(en ? 'Have a great shift 💪' : 'Buen turno 💪');
  return lines.join('\n');
}

// ── Texto plano: quita asteriscos, #, backticks y normaliza viñetas ──
function stripMd(s: string): string {
  return String(s || '')
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/`/g, ''))
    .replace(/\*\*(.*?)\*\*/g, '$1').replace(/__(.*?)__/g, '$1')
    .replace(/(^|[^*])\*(?!\s)([^*\n]+?)\*(?!\*)/g, '$1$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*[-*•]\s+/gm, '· ')
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function fmtDT(iso: string, en: boolean, tz?: string): string {
  try { return new Date(iso).toLocaleString(en ? 'en-US' : 'es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, ...(tz ? { timeZone: tz } : {}) }); } catch { return iso; }
}

// ── Fechas conscientes de la ZONA HORARIA del admin ──────────────────
// Sin librerías: usamos Intl para saber cuánto va adelantada la zona respecto
// a UTC en un instante dado, y con eso calculamos "hoy/ayer/semana" en su hora.
function zOffMs(date: Date, tz: string): number {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const p: any = {}; for (const x of dtf.formatToParts(date)) if (x.type !== 'literal') p[x.type] = x.value;
    const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour === 24 ? 0 : +p.hour, +p.minute, +p.second);
    return asUTC - date.getTime();
  } catch { return 0; }
}
// Partes de reloj de pared (en tz) de un instante: {y,m,d,H,dow}
function zWall(date: Date, tz: string) {
  const l = new Date(date.getTime() + zOffMs(date, tz));
  return { y: l.getUTCFullYear(), m: l.getUTCMonth(), d: l.getUTCDate(), H: l.getUTCHours(), dow: l.getUTCDay() };
}
// Instante UTC para la medianoche (en tz) del día y-m-d de pared.
function zToUTC(y: number, m: number, d: number, tz: string): Date {
  const guess = Date.UTC(y, m, d, 0, 0, 0);
  let off = zOffMs(new Date(guess), tz); let inst = guess - off;
  const off2 = zOffMs(new Date(inst), tz); if (off2 !== off) inst = guess - off2;
  return new Date(inst);
}
// Inicio del día (en tz) desplazado N días hacia atrás.
function zStartOfDay(now: Date, tz: string, minusDays: number): Date {
  const w = zWall(now, tz); const local = new Date(Date.UTC(w.y, w.m, w.d)); local.setUTCDate(local.getUTCDate() - minusDays);
  return zToUTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), tz);
}

const STATUS_LABEL: any = { open: { es: 'Abierto', en: 'Open' }, in_progress: { es: 'En curso', en: 'In progress' }, resolved: { es: 'Resuelto', en: 'Resolved' } };
const WEEKDAYS = ['domingo|sunday', 'lunes|monday', 'martes|tuesday', 'miércoles|miercoles|wednesday', 'jueves|thursday', 'viernes|friday', 'sábado|sabado|saturday'];

// Interpreta la pregunta: extrae email, nombre, rango de días/horas, estado,
// categoría y banderas (pendientes / sin asignar / leads / "muéstrame").
function parseQuery(question: string, tz: string) {
  const q = ' ' + question.toLowerCase() + ' ';
  const now = new Date();
  const dow0 = zWall(now, tz).dow; // día de la semana (0=domingo) en la zona del admin
  let from: Date | undefined, to: Date | undefined, windowLabel = '';

  const email = (question.match(/[\w.+-]+@[\w-]+\.[\w.-]+/) || [])[0]?.toLowerCase();

  if (/\bhoy\b|\btoday\b/.test(q)) { from = zStartOfDay(now, tz, 0); to = now; windowLabel = 'hoy'; }
  else if (/\banteayer\b|\bantes de ayer\b/.test(q)) { from = zStartOfDay(now, tz, 2); to = zStartOfDay(now, tz, 1); windowLabel = 'anteayer'; }
  else if (/\bayer\b|\byesterday\b/.test(q)) { from = zStartOfDay(now, tz, 1); to = zStartOfDay(now, tz, 0); windowLabel = 'ayer'; }
  else if (/semana pasada|last week/.test(q)) { const mondayThis = (dow0 + 6) % 7; from = zStartOfDay(now, tz, mondayThis + 7); to = zStartOfDay(now, tz, mondayThis); windowLabel = 'la semana pasada'; }
  else if (/esta semana|this week/.test(q)) { const mondayThis = (dow0 + 6) % 7; from = zStartOfDay(now, tz, mondayThis); to = now; windowLabel = 'esta semana'; }
  else if (/este mes|this month/.test(q)) { const w = zWall(now, tz); from = zToUTC(w.y, w.m, 1, tz); to = now; windowLabel = 'este mes'; }
  else { const m = q.match(/(?:últim[oa]s?|ultim[oa]s?|last|en los últimos|hace)\s+(\d{1,3})\s*(d[ií]as?|days?|horas?|hours?|h)\b/); if (m) { const n = parseInt(m[1], 10); const unitH = /hora|hour|^h$/.test(m[2]); if (unitH) { from = new Date(now.getTime() - n * H); } else { from = zStartOfDay(now, tz, n - 1); } to = now; windowLabel = `últim${unitH ? 'as ' + n + 'h' : 'os ' + n + ' días'}`; } }
  if (!from) { for (let i = 0; i < 7; i++) { if (new RegExp('\\b(' + WEEKDAYS[i] + ')\\b').test(q)) { const diff = (dow0 - i + 7) % 7 || 7; from = zStartOfDay(now, tz, diff); to = zStartOfDay(now, tz, diff - 1); windowLabel = 'el ' + WEEKDAYS[i].split('|')[0]; break; } } }

  // Rango de horas: "entre las 14 y 16", "de 2 a 4 pm", "a las 3 pm"
  let hFrom: number | undefined, hTo: number | undefined;
  const to24 = (h: number, tag: string) => { if (/pm|tarde|noche/.test(tag) && h < 12) h += 12; if (/am|mañana|manana/.test(tag) && h === 12) h = 0; return h; };
  let hm = q.match(/(?:entre (?:las? )?|de )\s*(\d{1,2})\s*(?:y|a|-|hasta)\s*(?:las? )?(\d{1,2})\s*(am|pm|de la tarde|de la mañana|de la noche)?/);
  if (hm) { const tag = hm[3] || ''; hFrom = to24(parseInt(hm[1], 10), tag); hTo = to24(parseInt(hm[2], 10), tag); }
  else { const hm2 = q.match(/a las?\s*(\d{1,2})\s*(am|pm|de la tarde|de la mañana|de la noche)?/); if (hm2) { const tag = hm2[2] || ''; hFrom = to24(parseInt(hm2[1], 10), tag); hTo = hFrom + 1; } }

  let status: string | undefined;
  if (/resuelt|resolved|cerrad|closed/.test(q)) status = 'resolved';
  else if (/en curso|in progress|in_progress|proceso/.test(q)) status = 'in_progress';
  else if (/abiert|open\b/.test(q)) status = 'open';

  let category: string | undefined;
  if (/conexi|connection|no conecta/.test(q)) category = 'conexion';
  else if (/instalaci|install/.test(q)) category = 'instalacion';
  else if (/guardian/.test(q)) category = 'guardian';
  else if (/factura|billing|pago|cobr/.test(q)) category = 'facturacion';

  const waiting = /esperan|esperando|sin responder|sin contestar|pendient|waiting|unanswer|unreplied|no hemos/.test(q);
  const unassigned = /sin asignar|unassigned|nadie/.test(q);
  const leadsOnly = /\bleads?\b|prospecto/.test(q);
  const lookup = /mu[eé]strame|mu[eé]stra|d[aá]me|list[ae]|listar|ver los|qu[eé] escrib|qu[eé] dijo|what did|show|list|ense[ñn]ame|todos los de|todo de/.test(q);

  // Nombres candidatos (si no hay email): "de Juan", "cliente Ana", o Mayúsculas
  const names: string[] = [];
  if (!email) {
    const re = /(?:de|del|cliente|usuario|user|from|of)\s+([A-Za-zÁÉÍÓÚÑáéíóúñ][\wáéíóúñ]{1,}(?:\s+[A-ZÁÉÍÓÚÑ][\wáéíóúñ]+)?)/g;
    let m; while ((m = re.exec(question))) { const c = m[1].trim(); if (c && !/^(ayer|hoy|esta|este|semana|mes|los|las|todos|todo)$/i.test(c)) names.push(c); }
    if (!names.length) { const caps = question.match(/\b[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,}\b/g) || []; const stop = /^(Onyx|Muéstrame|Muestra|Dame|Lista|Qué|Que|Cuántos|Cuantos|Ayer|Hoy|Esta|Este|Semana|Mes|Lunes|Martes|Miércoles|Jueves|Viernes|Sábado|Domingo)$/; for (const c of caps) if (!stop.test(c)) names.push(c); }
  }

  return { email, names: Array.from(new Set(names)).slice(0, 3), from, to, hFrom, hTo, status, category, waiting, unassigned, leadsOnly, lookup, windowLabel };
}

// Nombre → correos (busca en profiles.full_name). Para atar tickets al cliente.
async function resolveNameEmails(names: string[]): Promise<string[]> {
  const emails = new Set<string>();
  for (const n of names) {
    try {
      const { data } = await supabaseAdmin.from('profiles').select('email').ilike('full_name', `%${n}%`).limit(10);
      (data || []).forEach((p: any) => { if (p.email) emails.add(String(p.email).toLowerCase()); });
    } catch {}
  }
  return Array.from(emails);
}

// Arma la respuesta del Onyx interno. Recupera PRIMERO los tickets/mensajes
// exactos según los filtros de la pregunta (email, nombre, día, hora, estado,
// categoría) y responde con datos precisos y en texto plano (sin asteriscos).
export async function onyxTeamAnswer(opts: { question: string; lang: Lang; tz?: string }): Promise<string> {
  const { question, lang } = opts;
  const en = enBase(lang);
  const tz = opts.tz || 'UTC'; // zona horaria del admin (del navegador); si falta, UTC
  const P = parseQuery(question, tz);
  const hasFilter = !!(P.email || P.names.length || P.from || P.status || P.category || P.hFrom !== undefined || P.leadsOnly);

  // ============ RUTA PRECISA: hay filtros → traer tickets + mensajes exactos ============
  if (hasFilter) {
    let emails = P.email ? [P.email] : [];
    if (!emails.length && P.names.length) emails = await resolveNameEmails(P.names);

    let query = supabaseAdmin.from('support_tickets')
      .select('id,email,subject,category,status,is_lead,priority,assignee_id,created_at,updated_at')
      .order('created_at', { ascending: false }).limit(80);
    if (emails.length === 1) query = query.ilike('email', emails[0]);
    else if (emails.length > 1) query = query.in('email', emails);
    if (P.from) query = query.gte('created_at', P.from.toISOString());
    if (P.to) query = query.lte('created_at', P.to.toISOString());
    if (P.status) query = query.eq('status', P.status);
    if (P.category) query = query.eq('category', P.category);
    if (P.leadsOnly) query = query.eq('is_lead', true);
    let { data: trows } = await query;
    let rows = (trows || []) as any[];
    // Nombre sin correo en profiles → intenta por la parte local del email del ticket
    if (!rows.length && P.names.length && !P.email) {
      const orlike = P.names.map((n) => `email.ilike.%${n}%`).join(',');
      let q2 = supabaseAdmin.from('support_tickets').select('id,email,subject,category,status,is_lead,priority,assignee_id,created_at,updated_at').or(orlike).order('created_at', { ascending: false }).limit(80);
      if (P.from) q2 = q2.gte('created_at', P.from.toISOString());
      if (P.to) q2 = q2.lte('created_at', P.to.toISOString());
      const r2 = await q2; rows = (r2.data || []) as any[];
    }
    // Filtro por hora (en la zona horaria del admin)
    if (P.hFrom !== undefined && P.hTo !== undefined) {
      rows = rows.filter((t) => { const h = zWall(new Date(t.created_at), tz).H; return h >= P.hFrom! && h < P.hTo!; });
    }

    // Mensajes de esos tickets (texto completo)
    const ids = rows.map((t) => t.id);
    const msgsByTicket: Record<string, any[]> = {};
    const lastSender: Record<string, string> = {};
    if (ids.length) {
      const { data: msgs } = await supabaseAdmin.from('support_messages')
        .select('ticket_id,sender,body,created_at').in('ticket_id', ids).order('created_at', { ascending: true });
      for (const m of (msgs || []) as any[]) { (msgsByTicket[m.ticket_id] ||= []).push(m); lastSender[m.ticket_id] = m.sender; }
    }
    if (P.waiting) rows = rows.filter((t) => t.status !== 'resolved' && (lastSender[t.id] === 'user' || !lastSender[t.id]));
    if (P.unassigned) rows = rows.filter((t) => !t.assignee_id);

    const who = P.email || (P.names.length ? P.names.join(', ') : '') || '';
    const win = P.windowLabel ? ` ${P.windowLabel}` : '';
    const hourTxt = P.hFrom !== undefined ? ` entre las ${P.hFrom}:00 y ${P.hTo}:00` : '';

    if (!rows.length) {
      return en ? `No tickets found for that${who ? ' (' + who + ')' : ''}${win}${hourTxt}.` : `No encontré tickets${who ? ' de ' + who : ''}${win}${hourTxt}.`;
    }

    // Contexto exacto (para el modelo o para el listado directo)
    const lines: string[] = [];
    rows.slice(0, 15).forEach((t) => {
      const cliente = t.email || (en ? 'lead' : 'lead');
      const st = STATUS_LABEL[t.status]?.[en ? 'en' : 'es'] || t.status;
      lines.push(`· "${t.subject || '—'}" — ${cliente} — ${fmtDT(t.created_at, en, tz)} — ${st}${t.category ? ' — ' + t.category : ''}`);
      const ms = (msgsByTicket[t.id] || []).slice(-4);
      ms.forEach((m) => lines.push(`    ${m.sender === 'user' ? (en ? 'Cliente' : 'Cliente') : (en ? 'Support' : 'Soporte')} ${fmtDT(m.created_at, en, tz)}: "${String(m.body || '').replace(/\s+/g, ' ').slice(0, 400)}"`));
    });
    const facts = lines.join('\n');

    // Búsqueda directa ("muéstrame ...") → respuesta determinista, exacta y barata.
    if (P.lookup) {
      const head = en
        ? `${rows.length} ticket(s)${who ? ' from ' + who : ''}${win}${hourTxt}:`
        : `${rows.length} ticket(s)${who ? ' de ' + who : ''}${win}${hourTxt}:`;
      return stripMd(head + '\n' + facts);
    }

    // Pregunta abierta con filtros → el modelo, pero con los datos EXACTOS.
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return stripMd(facts);
    const system = (en
      ? `You are Onyx AI for the internal SUPPORT TEAM (staff-only). Answer using ONLY the exact ticket data below. Be precise and specific: cite subjects, clients and times when relevant. Plain text only: no asterisks, no markdown, no #, no bold. Use "· " for lists. If the data does not answer, say so. Never reveal secrets. No sign-off.`
      : `Eres Onyx AI para el EQUIPO de soporte interno (solo empleados). Responde usando SOLO los datos exactos de tickets de abajo. Sé preciso y específico: cita asuntos, clientes y horas cuando aplique. Texto plano: sin asteriscos, sin markdown, sin #, sin negritas. Usa "· " para listas. Si los datos no responden, dilo. Nunca reveles secretos. Sin despedida.`)
      + `\n\n=== ${en ? 'EXACT TICKETS' : 'TICKETS EXACTOS'} (${rows.length}) ===\n${facts}` + aiLangDirective(lang);
    try {
      const model = process.env.ONYX_AI_MODEL || 'claude-haiku-4-5-20251001';
      const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model, max_tokens: 800, system, messages: [{ role: 'user', content: question.slice(0, 1500) }] }) });
      if (!r.ok) return stripMd(facts);
      const data = await r.json();
      import('@/lib/aiCost').then((m) => m.logAiUsage('equipo', data)).catch(() => {});
      const answer = (data?.content || []).map((c: any) => c.text || '').join('\n').trim();
      return stripMd(answer || facts);
    } catch { return stripMd(facts); }
  }

  // ============ RUTA AGREGADA: pregunta general (cuántos, panorama) ============
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return en ? '⚠️ AI not configured: ANTHROPIC_API_KEY is missing in Vercel.' : '⚠️ IA no configurada: falta ANTHROPIC_API_KEY en Vercel.';

  const { data: tickets } = await supabaseAdmin.from('support_tickets')
    .select('id,email,subject,category,status,is_lead,priority,assignee_id,created_at,updated_at')
    .order('updated_at', { ascending: false }).limit(150);
  const rows = (tickets || []) as any[];
  const ids = rows.map((t) => t.id);
  const lastSender: Record<string, string> = {}; const lastAt: Record<string, string> = {};
  if (ids.length) {
    const { data: msgs } = await supabaseAdmin.from('support_messages').select('ticket_id,sender,created_at').in('ticket_id', ids).order('created_at', { ascending: true });
    for (const m of (msgs || []) as any[]) { lastSender[m.ticket_id] = m.sender; lastAt[m.ticket_id] = m.created_at; }
  }
  const byStatus: any = { open: 0, in_progress: 0, resolved: 0 }; const byCat: Record<string, number> = {};
  let leads = 0, unassigned = 0; const waiting: any[] = [];
  for (const t of rows) {
    byStatus[t.status] = (byStatus[t.status] || 0) + 1;
    if (t.status !== 'resolved') byCat[t.category || 'general'] = (byCat[t.category || 'general'] || 0) + 1;
    if (t.is_lead) leads++;
    if (!t.assignee_id && t.status !== 'resolved') unassigned++;
    if (lastSender[t.id] === 'user' && t.status !== 'resolved') { const hrs = Math.round((Date.now() - new Date(lastAt[t.id] || t.updated_at).getTime()) / H); waiting.push({ subject: t.subject, email: t.email, hrs, priority: t.priority }); }
  }
  waiting.sort((a, b) => b.hrs - a.hrs);
  let ctx = `RESUMEN (${rows.length} tickets recientes):\n- Abiertos: ${byStatus.open || 0} · En curso: ${byStatus.in_progress || 0} · Resueltos: ${byStatus.resolved || 0}\n- Sin asignar: ${unassigned} · Leads: ${leads}\n- Por categoría (sin resolver): ${Object.entries(byCat).map(([k, v]) => `${k}=${v}`).join(', ') || '—'}\n- Esperan respuesta: ${waiting.length}${waiting.length ? ` (más viejo: ${waiting[0].hrs}h)` : ''}\n`;
  if (waiting.length) ctx += `\nPENDIENTES (del más viejo):\n` + waiting.slice(0, 12).map((w) => `· "${w.subject}" · ${w.email || '—'} · ${w.hrs}h${w.priority === 'high' ? ' · ALTA' : ''}`).join('\n') + '\n';

  const system = (en
    ? `You are Onyx AI for the internal SUPPORT TEAM (staff-only). Answer with the aggregate SUPPORT DATA below. Real numbers, short lists. Plain text only: no asterisks, no markdown, no #, no bold. Use "· " for lists. If data lacks the answer, say so. Never reveal secrets. No sign-off.`
    : `Eres Onyx AI para el EQUIPO de soporte interno (solo empleados). Responde con los DATOS agregados de abajo. Cifras reales, listas cortas. Texto plano: sin asteriscos, sin markdown, sin #, sin negritas. Usa "· " para listas. Si faltan datos, dilo. Nunca reveles secretos. Sin despedida.`)
    + `\n\n=== ${en ? 'SUPPORT DATA' : 'DATOS DE SOPORTE'} ===\n${ctx}` + aiLangDirective(lang);
  try {
    const model = process.env.ONYX_AI_MODEL || 'claude-haiku-4-5-20251001';
    const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model, max_tokens: 700, system, messages: [{ role: 'user', content: question.slice(0, 1500) }] }) });
    if (!r.ok) return en ? 'Sorry, I could not process that right now.' : 'Perdona, no pude procesar eso ahora mismo.';
    const data = await r.json();
    import('@/lib/aiCost').then((m) => m.logAiUsage('equipo', data)).catch(() => {});
    const answer = (data?.content || []).map((c: any) => c.text || '').join('\n').trim();
    return stripMd(answer || (en ? 'No data for that.' : 'Sin datos para eso.'));
  } catch { return en ? 'Sorry, I could not process that right now.' : 'Perdona, no pude procesar eso ahora mismo.'; }
}
