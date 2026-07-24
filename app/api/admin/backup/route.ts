import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSetting, saveSetting } from '@/lib/settings';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Tablas que entran en la exportación manual. Tolerante: si una no existe, se salta.
const TABLES = ['profiles', 'trading_accounts', 'trades', 'api_keys', 'manager_configs', 'support_tickets', 'support_messages', 'kb_articles', 'app_settings', 'telegram_log'];

type Backup = { last_at: string | null; size: number; dest: string };
const BK0: Backup = { last_at: null, size: 0, dest: '' };

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
    // Exportar TODOS los datos: solo el Owner (ajustes: gestionar).
    const { ok } = await requirePerm('ajustes', 'manage');
    if (!ok) return NextResponse.json({ error: 'Solo el Owner puede exportar todos los datos.' }, { status: 403 });

    if (exp === 'csv') {
      const rows = await dumpTable('trades');
      return new NextResponse(toCsv(rows), {
        headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="onyx-operaciones-${day}.csv"` },
      });
    }
    const out: any = { app: 'Onyx Trading Live', exported_at: new Date().toISOString(), tables: {} };
    for (const t of TABLES) { try { out.tables[t] = await dumpTable(t); } catch { /* tabla ausente */ } }
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
  const secret = req.headers.get('x-cron-secret') || new URL(req.url).searchParams.get('secret');
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  }
  const b = await req.json().catch(() => ({}));
  await saveSetting('backup', { last_at: new Date().toISOString(), size: Number(b.size) || 0, dest: String(b.dest || 'externo') });
  return NextResponse.json({ ok: true });
}
