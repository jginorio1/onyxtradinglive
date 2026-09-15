# TradingView → Onyx → EA (señales que ejecuta tu EA de Copy)

Las alertas de TradingView se ejecutan en la cuenta real del trader usando el
**mismo EA de Copy** que ya tiene instalado. No hay que cambiar ni reinstalar el EA.

## Cómo funciona (resumen técnico)

1. El trader crea una alerta en TradingView con **webhook** apuntando a Onyx.
2. Onyx recibe el JSON, valida el token, aplica límites (lote máx., lista blanca) y
   mete un comando en la cola `copy_commands` con `source = 'tradingview'`.
3. El EA esclavo de Copy que el trader ya tiene lo lee y lo ejecuta en su cuenta.
4. **Onyx Guardian sigue vigilando** esa cuenta: si el límite de pérdida diaria está
   alcanzado, el EA no abre aunque llegue la señal.

## Pasos para activarlo (una sola vez)

### 1. Base de datos (Supabase)
Abre Supabase → SQL Editor → pega y ejecuta el archivo:
`supabase/tradingview.sql`

### 2. Activar la función por plan (Admin → Planes)
En cada plan de pago que deba incluir TradingView, edita sus **capacidades (JSON)**
y añade:
```json
"tv": true
```
(Los planes que ya tienen `"copy": true` también lo tendrán, porque la función
depende del EA de Copy.)

### 3. El trader lo configura en su panel
En el dashboard aparece la sección **TradingView** (icono 📈), donde:
- Activa la función.
- Copia su **URL de webhook** (única y secreta).
- Copia el **mensaje JSON** para pegar en la alerta.
- Fija lote por defecto, lote máximo y símbolos permitidos.

## La alerta en TradingView (lado del trader)

- **Webhook URL:** la que copia de su panel
  (`https://TU-DOMINIO/api/tradingview/webhook?token=tv_xxxx`).
- **Mensaje:**
```json
{
  "action": "{{strategy.order.action}}",
  "symbol": "{{ticker}}",
  "lots": 0.10
}
```
- Para **cerrar**: `"action": "close"`.
- El webhook de TradingView requiere que el trader tenga **TradingView de pago**
  (los webhooks no están en el plan gratuito de TradingView).

## Seguridad

- El token del webhook **no es la clave del EA**: solo permite mandar señales, con
  tope de lote y lista blanca. Se puede **rotar** con un clic (la URL vieja deja de
  servir).
- El kill switch global de Copy y la pausa por cuenta también frenan las señales.
