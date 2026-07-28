import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSetting, saveSetting } from '@/lib/settings';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Tablas que entran en la exportación manual. Tolerante: si una no existe, se salta.
const TABLES = ['profiles', 'trading_accounts', 'trades', 'api_keys', 'manager_configs', 'support_tickets', 'support_messages', 'kb_articles', 'app_settings', 'telegram_log'];

type Copy = { at: string; size: number; file: string; dest: string };
type Backup = { last_at: string | null; size: number; dest: string; history: Copy[] };
const BK0: Backup = { last_at: null, size: 0, dest: '', history: [] };

// Trae todas las filas de una tabla, por páginas (Supabase corta en 1000).
async function dumpTable(table: string): Promise<any[]> {
  const rows: any[] = [];
  const step = 1000;
  for (let from = 0; ; from += step) {
    const { data, error } = await supabaseAdmin.from(table).select('*').range(from, from + step - 1);
    if (error || !data || !data.length) break;
    rows.push(...data);
    if (data.length < step || rows.length > 200000) break;
  }
  return rows;
}

// Oculta valores sensibles antes de exportar (nunca salen del sistema en claro).
// - Columnas de nivel superior: secretos, tokens, contraseñas, hashes, claves.
//   Ojo: 'key' es sensible en api_keys (es la clave API) pero NO en app_settings
//   (ahí 'key' es el nombre del ajuste), así que se trata por tabla.
// - Además baja de forma recursiva dentro de los JSON (jsonb) y oculta claves
//   sensibles anidadas como 'pin', 'salt', etc.
const TOP_SENSITIVE = /(secret|token|password|passwd|hash|private|_key$|apikey)/i;
const NESTED_SENSITIVE = /^(pin|secret|token|password|passwd|hash|salt|apikey|private_key)$/i;

function deepRedact(v: any): any {
  if (Array.isArray(v)) return v.map(deepRedact);
  if (v && typeof v === 'object') {
    const o: any = {};
    for (const k of Object.keys(v)) o[k] = NESTED_SENSITIVE.test(k) ? '***REDACTED***' : deepRedact(v[k]);
    return o;
  }
  return v;
}

function redactRow(table: string, row: any): any {
  const out: any = {};
  for (const k of Object.keys(row)) {
    const topSensitive = TOP_SENSITIVE.test(k) || (table === 'api_keys' && k === 'key');
    out[k] = topSensitive ? '***REDACTED***' : deepRedact(row[k]);
  }
  return out;
}

function toCsv(rows: any[]): string {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const esc = (v: any) => {
    const s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}

// GET · estado (por defecto) o exportación (?export=json | ?export=csv)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const exp = searchParams.get('export');
  const day = new Date().toISOString().slice(0, 10);

  if (exp) {
    // Autorización: el Owner con sesión, O una tarea automática con secreto
    // (BACKUP_SECRET o CRON_SECRET). Esto permite que un Google Apps Script
    // baje la copia y la guarde en tu Drive sin iniciar sesión.
    const secret = req.headers.get('x-cron-secret') || searchParams.get('key') || searchParams.get('secret') || '';
    const secretOk = (!!process.env.BACKUP_SECRET && secret === process.env.BACKUP_SECRET)
      || (!!process.env.CRON_SECRET && secret === process.env.CRON_SECRET);
    let authed = secretOk;
    if (!authed) { const { ok } = await requirePerm('ajustes', 'manage'); authed = ok; }
    if (!authed) return NextResponse.json({ error: 'Solo el Owner (o la tarea automática con secreto) puede exportar todos los datos.' }, { status: 403 });

    if (exp === 'csv') {
      const rows = await dumpTable('trades');
      return new NextResponse(toCsv(rows.map((r) => redactRow('trades', r))), {
        headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="onyx-operaciones-${day}.csv"` },
      });
    }
    // Volcado JSON, siempre con los campos sensibles ocultos (nunca salen secretos/tokens/PINs).
    const out: any = { app: 'Onyx Trading Live', exported_at: new Date().toISOString(), tables: {} };
    for (const t of TABLES) { try { out.tables[t] = (await dumpTable(t)).map((r) => redactRow(t, r)); } catch { /* tabla ausente */ } }
    return new NextResponse(JSON.stringify(out, null, 2), {
      headers: { 'content-type': 'application/json; charset=utf-8', 'content-disposition': `attachment; filename="onyx-backup-${day}.json"` },
    });
  }

  // Estado para el panel: última copia + conteos rápidos.
  const { ok } = await requirePerm('ajustes', 'view');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const backup = await getSetting<Backup>('backup', BK0);
  const counts: Record<string, number> = {};
  for (const t of ['profiles', 'trading_accounts', 'trades', 'support_tickets']) {
    try { const { count } = await supabaseAdmin.from(t).select('*', { count: 'exact', head: true }); counts[t] = count || 0; } catch {}
  }
  return NextResponse.json({ backup, counts });
}

// POST · lo llama la tarea automática (GitHub Actions) tras subir el volcado.
// No usa sesión: se valida con CRON_SECRET.
export async function POST(req: Request) {
  const secret = req.headers.get('x-cron-secret') || new URL(req.url).searchParams.get('secret') || '';
  const ok = (!!process.env.BACKUP_SECRET && secret === process.env.BACKUP_SECRET)
    || (!!process.env.CRON_SECRET && secret === process.env.CRON_SECRET);
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const at = new Date().toISOString();
  const size = Number(b.size) || 0;
  const dest = String(b.dest || 'externo');
  const file = String(b.file || '');
  const prev = await getSetting<Backup>('backup', BK0);
  const history = [{ at, size, file, dest }, ...(prev.history || [])].slice(0, 12); // últimas 12
  await saveSetting('backup', { last_at: at, size, dest, history });
  return NextResponse.json({ ok: true });
}
