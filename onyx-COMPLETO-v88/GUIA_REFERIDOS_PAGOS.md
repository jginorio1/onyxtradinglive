# Pagos a los referidos del mentor (rieles A + B)

## 1) Base de datos
Corre en Supabase: `supabase/academy_v24.sql`
(añade ciclo de vida de recompensas, ajustes de afiliado por mentor, y método de cobro del referido).

## 2) Cron (una vez al día)
Programa un GET a `/api/cron/academy-rewards?key=CRON_SECRET`.
Hace dos cosas: pasa las recompensas de "en espera" → "por cobrar" al vencer la ventana,
y en riel A (crédito) aplica el saldo automáticamente al referido.

## 3) Webhook
No hay cambios de configuración. Usa el mismo webhook de academia
(`/api/academy/webhook`) que ya tienes. Solo asegúrate de que reciba:
`checkout.session.completed`, `invoice.paid`, `charge.refunded`.

## Cómo funciona
- **Atribución**: el enlace del referido (`?ref=<userId>`) registra quién trajo a quién.
- **Al pagar el referido**: se crea una recompensa "en espera" (ventana anti-reembolso).
  Monto = fijo o % de la venta, según lo elija el mentor. Renovaciones opcionales.
- **Al vencer la espera**: pasa a "por cobrar".
  - Riel A (crédito): se aplica sola como crédito en la cuenta del referido.
  - Riel B (manual): el mentor paga por fuera (PayPal/Zelle/efectivo) y pulsa "Marcar pagado".
- **Reembolso/disputa**: la recompensa se anula automáticamente si aún no se pagó.

## Dónde se ve
- **Mentor** → Academia → Cobros → "Afiliados y pagos": ajustes, métricas
  (por cobrar / en espera / pagado), lista por referido con "Marcar pagado", CSV e historial.
- **Referido** → dentro de la academia, tarjeta "Invita y gana" → "Mis pagos":
  disponible / en espera / pagado, cómo le pagan (editar método) e historial completo.

## Ajustes del mentor
Tipo (fijo $ o %), monto/porcentaje, días de espera, mínimo, riel por defecto
(crédito o manual) y "pagar también en renovaciones".
