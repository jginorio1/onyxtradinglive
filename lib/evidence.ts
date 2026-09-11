// ============================================================
// Evidencia de pagos para defender chargebacks. Registra cada checkout con
// IP/navegador/términos, apunta la entrega/descarga, y cuando Stripe abre una
// disputa arma y GUARDA la evidencia (como borrador) para que la revises y
// envíes desde el panel de Stripe. No maneja datos de tarjeta.
// ============================================================
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { stripe } from '@/lib/stripe';
import { disputeConfig } from '@/lib/settings';

export const TERMS_VERSION = (process.env.TERMS_VERSION || '2026-01').trim();

// Lee IP y user-agent de una petición (best-effort, detrás de proxy/Vercel).
export function reqMeta(req: Request): { ip: string; ua: string } {
  const h = req.headers;
  const ip = (h.get('x-forwarded-for') || '').split(',')[0].trim() || h.get('x-real-ip') || '';
  const ua = h.get('user-agent') || '';
  return { ip, ua };
}

type RecordArgs = {
  sessionId: string; userId?: string | null; email?: string | null;
  kind: string; productId?: string | null; productDescription?: string | null;
  amountCents?: number | null; currency?: string | null;
  ip?: string; ua?: string; consent?: boolean;
};

// Guarda (o actualiza) la evidencia al CREAR el checkout. Nunca lanza.
export async function recordCheckout(a: RecordArgs) {
  try {
    if (!a.sessionId) return;
    await supabaseAdmin.from('payment_evidence').upsert({
      session_id: a.sessionId,
      user_id: a.userId || null,
      email: a.email || null,
      kind: a.kind,
      product_id: a.productId || null,
      product_description: a.productDescription || null,
      amount_cents: a.amountCents ?? null,
      currency: (a.currency || 'usd').toLowerCase(),
      ip: a.ip || null,
      user_agent: a.ua || null,
      terms_version: TERMS_VERSION,
      terms_accepted_at: a.consent ? new Date().toISOString() : null,
      consent: !!a.consent,
      status: 'created',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'session_id' });
  } catch { /* no romper el checkout por la evidencia */ }
}

// Al confirmarse el pago (webhook): atar payment_intent/charge y marcar pagado.
export async function markPaid(sessionId: string, fields: { payment_intent?: string | null; charge_id?: string | null }) {
  try {
    if (!sessionId) return;
    await supabaseAdmin.from('payment_evidence').update({
      payment_intent: fields.payment_intent || null,
      charge_id: fields.charge_id || null,
      status: 'paid',
      updated_at: new Date().toISOString(),
    }).eq('session_id', sessionId);
  } catch {}
}

// Apunta una entrega/descarga (que el comprador SÍ recibió el producto).
export async function logDelivery(a: { userId?: string | null; productId?: string | null; paymentIntent?: string | null; ip?: string; ua?: string; what: string }) {
  try {
    let q = supabaseAdmin.from('payment_evidence').select('id,delivery_log').eq('status', 'paid');
    if (a.paymentIntent) q = q.eq('payment_intent', a.paymentIntent);
    else if (a.userId && a.productId) q = q.eq('user_id', a.userId).eq('product_id', a.productId);
    else return;
    const { data } = await q.order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (!data) return;
    const log = Array.isArray((data as any).delivery_log) ? (data as any).delivery_log : [];
    log.push({ at: new Date().toISOString(), ip: a.ip || '', ua: a.ua || '', what: a.what });
    await supabaseAdmin.from('payment_evidence').update({
      delivery_log: log.slice(-50),
      delivery_at: (data as any).delivery_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', (data as any).id);
  } catch {}
}

// Arma el objeto de evidencia que entiende Stripe a partir de nuestra fila.
export function buildEvidence(row: any) {
  const deliveries = Array.isArray(row.delivery_log) ? row.delivery_log : [];
  const accessLog = deliveries.length
    ? deliveries.map((d: any) => `${d.at} · ${d.what}${d.ip ? ` · IP ${d.ip}` : ''}`).join('\n')
    : (row.delivery_at ? `Entregado ${row.delivery_at}` : 'Producto digital entregado en la cuenta del comprador.');
  const uncategorized = [
    `Producto: ${row.product_description || row.product_id || 'producto digital'}.`,
    row.consent ? `El comprador aceptó los Términos (versión ${row.terms_version || ''}) el ${row.terms_accepted_at || ''}.` : `Compra realizada en la cuenta autenticada del comprador.`,
    row.ip ? `Compra desde IP ${row.ip}.` : '',
    row.user_agent ? `Navegador: ${row.user_agent}.` : '',
    'Producto digital entregado inmediatamente en la cuenta del comprador; entrega registrada abajo.',
  ].filter(Boolean).join(' ');
  const evidence: any = {
    product_description: (row.product_description || 'Producto/servicio digital de Onyx').slice(0, 900),
    customer_email_address: row.email || undefined,
    customer_purchase_ip: row.ip || undefined,
    access_activity_log: accessLog.slice(0, 900),
    refund_policy_disclosure: 'Política de reembolso y términos mostrados y aceptados en el checkout; producto digital.',
    uncategorized_text: uncategorized.slice(0, 900),
  };
  Object.keys(evidence).forEach((k) => evidence[k] === undefined && delete evidence[k]);
  return evidence;
}

// Revisa/actualiza la evidencia de una disputa desde el admin y, si submit=true,
// la ENVÍA a Stripe (esto ya no se puede deshacer). Devuelve la disputa fresca.
export async function submitEvidence(disputeId: string, submit: boolean): Promise<{ ok: boolean; note: string; dispute?: any }> {
  try {
    if (!disputeId) return { ok: false, note: 'Falta el ID de la disputa.' };
    const { data: row } = await supabaseAdmin.from('payment_evidence').select('*').eq('dispute_id', disputeId).maybeSingle();
    let evidence: any = null;
    if (row) evidence = buildEvidence(row);
    const upd: any = {};
    if (evidence) upd.evidence = evidence;
    if (submit) upd.submit = true;
    upd.metadata = { onyx: submit ? 'submitted_from_admin' : 'draft_from_admin' };
    const dispute = await stripe.disputes.update(disputeId, upd);
    if (row) {
      await supabaseAdmin.from('payment_evidence').update({
        status: submit ? 'evidence_submitted' : 'disputed',
        updated_at: new Date().toISOString(),
      }).eq('id', (row as any).id);
    }
    return { ok: true, note: submit ? 'Evidencia enviada a Stripe.' : 'Borrador de evidencia guardado en Stripe.', dispute };
  } catch (e: any) {
    return { ok: false, note: `Stripe: ${e?.message || 'error al enviar la evidencia'}` };
  }
}

// Respaldo automático (lo llama un cron diario): para cada disputa cuyo plazo
// esté por vencer y que TÚ no hayas enviado, comprueba en Stripe que sigue
// esperando respuesta y envía la evidencia armada. Devuelve un resumen.
export async function autoSubmitDueDisputes(): Promise<{ checked: number; submitted: number; notes: string[] }> {
  const notes: string[] = [];
  let checked = 0, submitted = 0;
  try {
    const cfg = await disputeConfig();
    if (!cfg.auto_submit) return { checked: 0, submitted: 0, notes: ['Respaldo automático desactivado.'] };
    const days = Math.max(0, Math.min(30, Number(cfg.days_before) || 2));
    const limit = new Date(Date.now() + days * 864e5).toISOString();
    // Disputas todavía abiertas (no enviadas) con fecha límite dentro de la ventana.
    const { data } = await supabaseAdmin.from('payment_evidence')
      .select('id,dispute_id,due_by,status').eq('status', 'disputed')
      .not('dispute_id', 'is', null).not('due_by', 'is', null).lte('due_by', limit);
    for (const row of (data || []) as any[]) {
      checked++;
      try {
        // Confirmar con Stripe que sigue necesitando respuesta (no resuelta ni ya enviada).
        const d: any = await stripe.disputes.retrieve(row.dispute_id);
        if (d.status !== 'needs_response') { notes.push(`${row.dispute_id}: estado ${d.status}, se omite.`); continue; }
        const r = await submitEvidence(row.dispute_id, true);
        if (r.ok) { submitted++; notes.push(`${row.dispute_id}: evidencia enviada (respaldo).`); }
        else notes.push(`${row.dispute_id}: ${r.note}`);
      } catch (e: any) { notes.push(`${row.dispute_id}: error ${e?.message || ''}`); }
    }
  } catch (e: any) { notes.push(`error general: ${e?.message || ''}`); }
  return { checked, submitted, notes };
}

// Cuando Stripe abre una disputa: encuentra la fila, marca disputada y GUARDA la
// evidencia como borrador (sin enviar) para que la revises y envíes tú. Devuelve
// un resumen para avisarte. Nunca lanza.
export async function handleDispute(dispute: any): Promise<{ ok: boolean; note: string }> {
  try {
    const pi = typeof dispute.payment_intent === 'string' ? dispute.payment_intent : (dispute.payment_intent?.id || '');
    const ch = typeof dispute.charge === 'string' ? dispute.charge : (dispute.charge?.id || '');
    let row: any = null;
    if (pi) { const { data } = await supabaseAdmin.from('payment_evidence').select('*').eq('payment_intent', pi).maybeSingle(); row = data; }
    if (!row && ch) { const { data } = await supabaseAdmin.from('payment_evidence').select('*').eq('charge_id', ch).maybeSingle(); row = data; }
    if (row) {
      const dueBy = dispute.evidence_details?.due_by ? new Date(dispute.evidence_details.due_by * 1000).toISOString() : null;
      await supabaseAdmin.from('payment_evidence').update({ status: 'disputed', dispute_id: dispute.id, due_by: dueBy, updated_at: new Date().toISOString() }).eq('id', row.id);
      // Guardamos la evidencia como BORRADOR (submit lo haces tú en Stripe tras revisar).
      try { await stripe.disputes.update(dispute.id, { evidence: buildEvidence(row), metadata: { onyx: 'auto_evidence' } } as any); } catch {}
      return { ok: true, note: `Disputa ${dispute.id} por ${(dispute.amount || 0) / 100} ${(dispute.currency || 'usd').toUpperCase()}. Evidencia guardada como borrador en Stripe; revísala y envíala antes de ${dispute.evidence_details?.due_by ? new Date(dispute.evidence_details.due_by * 1000).toISOString().slice(0, 10) : 'la fecha límite'}.` };
    }
    return { ok: false, note: `Disputa ${dispute.id} sin evidencia local (pago antiguo). Responde manualmente en Stripe.` };
  } catch (e: any) {
    return { ok: false, note: `Disputa ${dispute.id}: error al armar evidencia (${e?.message || 'desconocido'}).` };
  }
}
