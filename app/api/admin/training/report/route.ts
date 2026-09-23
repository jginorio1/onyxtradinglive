import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { complianceReport, trainingSettings } from '@/lib/training';
import { compliancePdf } from '@/lib/trainingCert';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const esc = (v: any) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

// Reporte de cumplimiento para auditoría: CSV o PDF (?format=pdf).
export async function GET(req: Request) {
  const { ok } = await requirePerm('equipo', 'view');
  if (!ok) return new NextResponse('No autorizado', { status: 403 });
  const sp = new URL(req.url).searchParams;
  const en = sp.get('lang') === 'en';
  const rep = await complianceReport();

  if (sp.get('format') === 'pdf') {
    const s = await trainingSettings();
    const pdf = await compliancePdf({ brand: s.brand_name, lang: en ? 'en' : 'es', tracks: rep.tracks, people: rep.people, summary: rep.summary });
    return new NextResponse(Buffer.from(pdf), { headers: { 'content-type': 'application/pdf', 'content-disposition': 'attachment; filename="cumplimiento-formacion.pdf"' } });
  }
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
