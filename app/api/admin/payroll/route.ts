import { NextResponse } from 'next/server';
import { requirePerm, logAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  payrollSettings, savePayrollSettings, listStaff, upsertStaff, staffPaidTotals,
  buildPayrun, paymentsForPeriod, markPaymentManual, payrollSummary, thisPeriod,
} from '@/lib/payroll';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · equipo con sueldos + resumen + pagos del periodo actual + ajustes.
export async function GET(req: Request) {
  const { ok } = await requirePerm('equipo', 'view');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const url = new URL(req.url);
  const period = url.searchParams.get('period') || thisPeriod();

  const settings = await payrollSettings();
  const staffRaw = await listStaff();
  const staff: any[] = [];
  for (const s of staffRaw) {
    const t = await staffPaidTotals(s.id);
    staff.push({ ...s, paid_ytd: t.ytd, paid_total: t.total, last_paid: t.last });
  }
  const payments = await paymentsForPeriod(period);
  const summary = await payrollSummary(period);
  return NextResponse.json({ settings, staff, payments, summary, period });
}

// POST · acciones de gestión.
export async function POST(req: Request) {
  const { ok, user } = await requirePerm('equipo', 'manage');
  if (!ok) return NextResponse.json({ error: 'Solo quien gestiona el equipo puede tocar la nómina.' }, { status: 403 });
  const b = await req.json().catch(() => ({} as any));
  const action = String(b.action || '');

  try {
    if (action === 'save_settings') {
      const s = await savePayrollSettings(b.settings || {});
      return NextResponse.json({ ok: true, settings: s });
    }
    // Crear/editar empleado.
    if (action === 'save_staff') {
      const r = await upsertStaff(b.staff || {});
      await logAdmin(user?.email || '', 'payroll_save_staff', r.id || '', {});
      return NextResponse.json(r);
    }
    // Cambiar estado / freno rápido.
    if (action === 'set_staff' && b.staff_id) {
      const patch: any = {};
      if (b.status && ['active', 'paused', 'ended'].includes(b.status)) patch.status = b.status;
      if (b.on_hold !== undefined) patch.on_hold = !!b.on_hold;
      if (b.salary !== undefined) patch.salary = Math.max(0, Number(b.salary) || 0);
      if (Object.keys(patch).length) await supabaseAdmin.from('staff').update(patch).eq('id', b.staff_id);
      return NextResponse.json({ ok: true });
    }
    // Armar la nómina del periodo (crea los pagos pendientes).
    if (action === 'build_payrun') {
      const r = await buildPayrun(b.period);
      await logAdmin(user?.email || '', 'payroll_build', r.period, { created: r.created });
      return NextResponse.json({ ok: true, ...r });
    }
    // Pagar un pago por Stripe.
    if (action === 'pay_stripe' && b.payment_id) {
      const { payStaffStripe } = await import('@/lib/payrollPayout');
      const r = await payStaffStripe(b.payment_id);
      await logAdmin(user?.email || '', 'payroll_pay_stripe', b.payment_id, { ok: r.ok });
      return NextResponse.json(r);
    }
    // Marcar pago manual (USDT / transferencia / efectivo).
    if (action === 'pay_manual' && b.payment_id) {
      const r = await markPaymentManual(b.payment_id, String(b.method || 'manual'), String(b.ref || ''));
      await logAdmin(user?.email || '', 'payroll_pay_manual', b.payment_id, {});
      return NextResponse.json(r);
    }
    // Saltar un pago del periodo (ej. permiso/ausencia).
    if (action === 'skip_payment' && b.payment_id) {
      await supabaseAdmin.from('staff_payments').update({ status: 'skipped', note: String(b.note || '').slice(0, 300) || null }).eq('id', b.payment_id);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: 'acción desconocida' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500 });
  }
}
