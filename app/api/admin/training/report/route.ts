import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { complianceReport } from '@/lib/training';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const esc = (v: any) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

// CSV de cumplimiento para auditoría: una fila por persona × ruta obligatoria.
export async function GET(req: Request) {
  const { ok } = await requirePerm('equipo', 'view');
  if (!ok) return new NextResponse('No autorizado', { status: 403 });
  const en = new URL(req.url).searchParams.get('lang') === 'en';
  const rep = await complianceReport();
  const trackTitle: Record<string, string> = {}; for (const t of rep.tracks) trackTitle[t.id] = t.title;
  const stTxt = (s: string) => en ? (s === 'ok' ? 'OK' : s === 'expired' ? 'Expired' : 'Pending') : (s === 'ok' ? 'Al dia' : s === 'expired' ? 'Vencido' : 'Pendiente');

  const head = en ? ['Person', 'Email', 'Role', 'Access', 'Track', 'Status', 'Score', 'Expires'] : ['Persona', 'Correo', 'Rol', 'Acceso', 'Ruta', 'Estado', 'Nota', 'Vence'];
  const lines = [head.map(esc).join(',')];
  for (const p of rep.people) {
    for (const tid of Object.keys(p.items)) {
      const it = p.items[tid];
      lines.push([p.name || '', p.email || '', p.role, p.active ? (en ? 'On' : 'Activo') : (en ? 'Off' : 'Inactivo'), trackTitle[tid] || tid, stTxt(it.status), it.score || '', it.expires ? new Date(it.expires).toISOString().slice(0, 10) : ''].map(esc).join(','));
    }
  }
  const csv = '﻿' + lines.join('\n');
  return new NextResponse(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="cumplimiento-formacion.csv"` } });
}
