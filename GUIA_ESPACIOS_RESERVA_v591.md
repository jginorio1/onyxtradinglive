# Reserva de espacios publicitarios (cupo fijo + calendario) · v591

Sistema para que tus **vendedores vendan espacios** de banner y ganen **comisión
sobre el espacio vendido** (no por clic). Cupo fijo modificable, calendario de
fechas disponibles, y activación **automática** por fechas.

## 1) Corre el SQL
En Supabase → SQL Editor, ejecuta:

- `supabase/ads_v6_booking.sql`  (columnas nuevas en `ad_campaigns`: vendedor,
  importe, hold, datos del comprador; índices). Es aditivo, no rompe nada.

## 2) Configúralo en Admin
Admin → menú **Anuncios (Ads)** → abajo aparece **Reserva de espacios**:

- **Cupo por defecto** y **cupo por ubicación**: cuántos anunciantes pueden
  rotar a la vez en cada espacio (editable).
- **Comisión vendedor %**: lo que gana el vendedor por cada espacio vendido.
- **Reserva sin pagar (min)**: cuánto se aparta una fecha mientras el cliente
  paga (si no paga, se libera sola).
- **Maduración comisión (días)**: cuánto queda "en espera" la comisión antes de
  estar disponible para cobro.

## 3) El vendedor vende (panel del vendedor)
Dashboard del vendedor → pestaña **Espacios**:

1. Elige la **ubicación** (ve cupo y precio).
2. Revisa el **calendario**: verde = con cupo, rojo = lleno. Pone las fechas.
3. Escribe los datos del **anunciante** (empresa, contacto, correo, enlace) y el
   **precio total**. Ve su comisión estimada.
4. **Vista previa PDF** / **Enviar propuesta por correo** (profesional, con su
   nombre y su correo) / **Reservar espacio**.

## 4) Confirmar el pago (Admin)
Cuando el cliente paga, en Admin → Ads → Reserva de espacios → la reserva →
**Confirmar pago**. Eso activa el espacio (o lo deja **programado** si la fecha
es futura) y acredita la **comisión del vendedor** (con maduración; se revierte
si hay reembolso, al **Cancelar**).

## 5) Automático (sin tocar nada)
- **Fecha inmediata:** al confirmar el pago, el banner entra en la rotación en
  vivo al instante.
- **Fecha futura:** queda programado y **se enciende solo el día de inicio** y se
  **apaga al terminar**. Lo maneja el cron `/api/cron/ads-booking` (cada 15 min,
  ya en `vercel.json`) + el propio servidor de anuncios por ventana de fechas.

## Sobre el correo de las propuestas (recomendación)
Todas las propuestas salen por **Resend** desde tu **dominio verificado**, con:
- **Remitente** = nombre del vendedor + su **correo de trabajo con tu dominio**
  (ej. `juan@onyxtradinglive.com`) si lo tiene; si no, remitente genérico de Onyx
  con su nombre.
- **Responder a (Reply-To)** = el correo del vendedor, para que la respuesta del
  cliente le llegue a él.

Para darle correo propio a cada vendedor: Admin → Ventas → La red → tarjeta del
vendedor → **Editar** → **"correo de trabajo"** (`nombre@onyxtradinglive.com`).
El buzón real se crea en Zoho (~$1/mes) — ver `CORREO_VENDEDORES_Zoho_v531.md`.
