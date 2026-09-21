import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requirePerm } from '@/lib/admin';
import { payrollSettings, staffByUser, staffById, computePay } from '@/lib/payroll';
import { payslipPdf } from '@/lib/payslip';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · recibo de nómina en PDF. Lo puede pedir el propio empleado (su pago) o
// un admin con permiso de Equipo (view).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const paymentId = url.searchParams.get('payment_id') || '';
  if (!paymentId) return NextResponse.json({ error: 'falta payment_id' }, { status: 400 });

  const { data: pay } = await supabaseAdmin.from('staff_payments').select('*').eq('id', paymentId).maybeSingle();
  if (!pay) return NextResponse.json({ error: 'no existe' }, { status: 404 });
  const staff = await staffById((pay as any).staff_id);
  if (!staff) return NextResponse.json({ error: 'no existe' }, { status: 404 });

  // Autorización: dueño del pago o admin.
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const mine = user && (await staffByUser(user.id))?.id === staff.id;
  let allowed = !!mine;
  if (!allowed) { const { ok } = await requirePerm('equipo', 'view'); allowed = ok; }
  if (!allowed) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });

  const s = await payrollSettings();
  // Usa el desglose guardado; si el pago es viejo y no lo tiene, lo recalcula.
  let gross = Number((pay as any).gross), net = Number((pay as any).net);
  let items: any[] = (pay as any).deductions || [];
  if (!gross || !items.length) {
    const src = (staff.deductions && staff.deductions.length) ? staff.deductions : (s.deductions || []);
    const c = computePay(staff.salary, src); gross = c.gross; net = c.net; items = c.applied;
  }

  const DL: Record<string, string> = { dev: 'Desarrollo', management: 'Gerencia', marketing: 'Marketing', design: 'Diseño', ops: 'Operaciones', other: 'Equipo' };
  const bytes = await payslipPdf({
    company: s.company_name || 'Onyx Trading Live', employeeName: staff.name,
    department: DL[staff.department] || staff.department, position: staff.position || undefined,
    period: (pay as any).period, currency: (pay as any).currency || staff.currency || 'USD',
    gross, net, items, method: (pay as any).method, status: (pay as any).status, paidAt: (pay as any).paid_at,
  });

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `inline; filename="recibo-${staff.name.replace(/[^\w]+/g, '_')}-${(pay as any).period}.pdf"`,
    },
  });
}
