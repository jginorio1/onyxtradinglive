# Correo de los vendedores con tu dominio (v531)

## Qué se hizo en la app
Los correos automáticos que el vendedor manda a sus clientes (respuestas de
tickets) ahora pueden salir **con el correo de trabajo del vendedor en tu dominio**
como remitente, y con "responder a" a ese mismo correo. Se sigue enviando por
Resend (entrega confiable), pero el cliente ve `Juan Pérez <juan@onyxtradinglive.com>`.

- **Dónde se pone:** Admin → Ventas → La red → tarjeta del vendedor → **Editar** →
  campo **"correo de trabajo"** (ej. `juan@onyxtradinglive.com`) → Guardar.
- Si lo dejas vacío, el correo sale con el remitente genérico de Onyx (como antes).

## Base de datos
Corre en Supabase (SQL Editor): **`supabase/sales_v6.sql`** (agrega la columna
`work_email`). Es lo único nuevo de esta versión.

## Requisito para que NO caiga en spam
La dirección que pongas debe ser de **onyxtradinglive.com** y el dominio debe estar
**verificado en Resend** (SPF, DKIM, DMARC). Ya lo tienes verificado para los demás
correos; estas direcciones usan el mismo dominio, así que funcionan igual.

## Crear el buzón real en Zoho (para que el vendedor reciba y escriba)
El buzón de verdad se crea en Zoho, no en la app. Ya tienes cuenta:

1. Entra al panel de administración de Zoho Mail: **https://mailadmin.zoho.com**
   (o desde https://www.zoho.com/mail → "Sign In" → Admin Console).
2. Menú **Users → Add** (Usuarios → Agregar).
3. Pon el nombre del vendedor y el correo `nombre@onyxtradinglive.com`, asigna una
   licencia (Mail Lite ~$1/usuario/mes) y crea.
4. Dale al vendedor su usuario/contraseña. Él entra en **https://mail.zoho.com**.
5. En la app, pon ese mismo correo en el campo "correo de trabajo" del vendedor.

Con eso: los automáticos salen con su dirección de dominio, y si el cliente le
responde, le llega a su bandeja Zoho; además el vendedor puede escribirle
directo desde Zoho cuando quiera.

## Enlaces útiles de Zoho
- Iniciar sesión (correo): **https://mail.zoho.com**
- Consola de administración: **https://mailadmin.zoho.com**
- Precios: **https://www.zoho.com/mail/zohomail-pricing.html**
