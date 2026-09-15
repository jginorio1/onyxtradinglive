# 🚀 Cómo activar la Red de Ventas (orden exacto)

Sigue esto de arriba hacia abajo. Es seguro: hasta el paso 2, nada cambia para tus clientes actuales.

## 1) Base de datos (Supabase → SQL Editor)
Ejecuta estos 3 archivos **en orden**, uno por uno (están dentro del ZIP, carpeta `supabase/`):

1. `sales_v1.sql`  ← tablas principales + ajustes
2. `sales_v2.sql`  ← reclutamiento + correo de marca
3. `sales_v3.sql`  ← método de cobro (Stripe/USDT)

Cada uno termina con “Success”. Si ya corriste uno, no pasa nada al repetirlo (usa `if not exists`).

## 2) Desplegar el código
Copia el ZIP completo al repo → commit → push → espera el verde en Vercel (igual que siempre).

## 3) Configurar en el panel (Admin → Red de ventas → Ajustes)
- Revisa los **%** por nivel (por defecto: Vendedor 20, N1 7, N2 4). Ajusta a tu gusto.
- Revisa **topes**: días de prueba, % de descuento, retención (días), mínimo para pagar.
- Deja **Programa activo** encendido. **Pago automático** encendido paga solo por Stripe.

## 4) Crear tu primer supervisor / vendedor
Dos formas:
- **Solicitud**: comparte el enlace `…/unete-ventas` (está en Admin → Red de ventas, arriba). La persona aplica, tú la apruebas eligiendo nivel y supervisor.
- **Manual**: en la pestaña “La red” → “Añadir representante” con su correo (debe tener cuenta en la app).

> El candidato **debe tener una cuenta** en Onyx (con ese correo) antes de convertirse en vendedor.

## 5) Que empiecen a vender
Cada vendedor entra a **`/dashboard/ventas`**, copia su enlace y lo comparte. Dales la guía `Guia_Red_de_Ventas.html`.

---

## 💵 Cobros
- **Stripe**: el vendedor conecta su cuenta en su panel (Cobros). El cron paga solo cada día lo que ya maduró.
- **USDT**: el vendedor guarda su billetera; tú marcas el pago desde **Admin → Red de ventas → Pagos → “Marcar pagado (USDT)”** con la referencia (txid).
- Frenos: puedes **pausar** los pagos de un vendedor, o activar “revisar antes de pagar” (freno global).

## ✉️ Correo con el dominio (aparte)
El sistema ya puede *enviar* correos de marca a los clientes. Para que cada vendedor tenga un **buzón real** (ej. `juan@onyxtradinglive.com`) necesitas un servicio de correo (Google Workspace o Zoho) — eso se configura en el proveedor/DNS, no en la app. Pídemelo cuando quieras y te guío ese paso.

## 🔒 Seguridad (ya incluida)
Mismo esquema que Embajadores: maduración anti-reembolso, **reversa automática** si el cliente pide reembolso, idempotencia (no duplica comisiones), y frenos. Todo bajo tu control desde el panel.
