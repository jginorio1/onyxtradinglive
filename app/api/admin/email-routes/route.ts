import { NextResponse } from 'next/server';
import { getAdmin } from '@/lib/admin';
import { mailRoutes, saveSetting } from '@/lib/settings';
import { mailFromDomain } from '@/lib/mail';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim());

// GET · direcciones de correo por función (solo Owner). Devuelve también el
// dominio verificado en Resend para avisar si el remitente sale de ese dominio.
export async function GET() {
  const { isAdmin, role } = await getAdmin();
  if (!isAdmin || role !== 'owner') return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const routes = await mailRoutes();
  return NextResponse.json({ routes, domain: mailFromDomain() });
}

// POST · guarda las direcciones. Valida formato; el remitente DEBE estar en el
// dominio verificado en Resend (si no, Resend rechaza el envío).
export async function POST(req: Request) {
  const { isAdmin, role } = await getAdmin();
  if (!isAdmin || role !== 'owner') return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const cur = await mailRoutes();
  const domain = mailFromDomain();

  const from_addr = String(b.from_addr ?? cur.from_addr).trim();
  if (from_addr && !isEmail(from_addr)) return NextResponse.json({ error: 'La dirección de envío no es válida.' }, { status: 400 });
  if (from_addr && domain && from_addr.split('@')[1]?.toLowerCase() !== domain.toLowerCase())
    return NextResponse.json({ error: `La dirección de envío debe usar el dominio verificado en Resend (${domain}).` }, { status: 400 });

  const clean = (v: any, fallback: string) => { const s = String(v ?? fallback).trim(); return isEmail(s) ? s : fallback; };
  const next = {
    from_name: String(b.from_name ?? cur.from_name).replace(/[<>"]/g, '').trim().slice(0, 60) || 'Onyx Trading Live',
    from_addr: from_addr || cur.from_addr,
    support: clean(b.support, cur.support),
    billing: clean(b.billing, cur.billing),
    botlab: clean(b.botlab, cur.botlab),
    alerts: clean(b.alerts, cur.alerts),
  };
  await saveSetting('email_routes', next);
  return NextResponse.json({ ok: true, routes: next });
}
