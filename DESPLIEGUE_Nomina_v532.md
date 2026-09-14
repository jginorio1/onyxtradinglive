# Nómina del equipo interno (v532)

Sistema de nómina integrado **encima del área Equipo**. Empleados internos
(desarrollo, gerencia, marketing…) con sueldo fijo mensual, pagados por Stripe
Connect o USDT/manual. Reutiliza el mismo nodo Stripe que ventas/embajadores.

> Nota: Stripe no es un producto de nómina con impuestos. Aquí se paga como a
> **contratistas** (pago fijo, sin retención). Para el tema fiscal consulta a tu
> contador.

## 1) Base de datos
Corre en Supabase (SQL Editor): **`supabase/payroll_v1.sql`** (tablas `staff` y
`staff_payments` + ajustes por defecto). Es lo único nuevo.

## 2) Desplegar
Deploy normal en Vercel. Sin variables nuevas. Se añadió un cron diario
`/api/cron/payroll` (revisa si hoy es día de pago y, si está en automático,
arma la nómina y paga). Usa tu `CRON_SECRET` como los demás.

## 3) Cómo se usa (Admin → Equipo → Nómina)
1. **Equipo → + Añadir empleado**: nombre, correo (opcional, para su panel),
   departamento, puesto, sueldo mensual, moneda, método de cobro (Stripe/USDT/
   manual) y fecha de inicio.
   - Si pones un correo que ya tiene cuenta en la app, se liga solo y esa persona
     puede entrar a **su panel** en `/staff`.
   - Si NO le pones cuenta (o no tiene), solo se puede pagar manual.
2. **Corrida del mes → Armar nómina**: crea un pago pendiente por cada empleado
   activo con su sueldo. Es idempotente (no duplica si ya lo armaste).
3. Pagas uno por uno: **Pagar por Stripe** (si conectó su cuenta), **Marcar
   pagado** (USDT/manual con referencia) o **Saltar**.
4. **Ajustes**: día de pago, moneda base, y frenos:
   - "Revisar antes de pagar" (recomendado, activo): arma la nómina pero tú
     apruebas cada pago.
   - "Pago automático por Stripe el día de pago": si lo activas y desactivas el
     freno anterior, el cron paga solo el día indicado.

## 4) Panel del empleado (`/staff`)
Quien tenga cuenta ligada entra a `/staff` y ve su sueldo, su historial de pagos,
y conecta su cobro: **Stripe** (botón Conectar) o guarda su **billetera USDT**.
No entra al panel de administración ni ve datos del negocio.

## 5) Permisos
La nómina usa el permiso del área **Equipo**. Solo quien puede *gestionar*
Equipo (owner o permiso `manage`) puede añadir empleados y pagar; quien solo
tiene `view` la ve pero no toca nada.

## Enlaces Zoho (buzones del equipo, aparte)
- Correo: https://mail.zoho.com · Admin: https://mailadmin.zoho.com
