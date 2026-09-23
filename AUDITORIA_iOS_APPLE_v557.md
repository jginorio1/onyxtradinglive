# Auditoría iOS · sin precios ni compra en la app (Apple 2.1(b) / 3.1.1) — v557

Objetivo: que en la app de iOS **no aparezca ningún precio ni botón que empuje a
comprar**, para no darle a Apple motivo de rechazo. La compra sigue solo en la web.

## Ya estaba bien (verificado)
- **Página `/pricing`** en iOS: muestra "consulta los planes en la web", sin precios ni checkout.
- **Menú superior**: "Planes" solo aparece SIN sesión (la app siempre va con sesión → no se ve).
- **Píldora del plan**: en iOS lleva a *Mi cuenta*, no a comprar.
- **Regla global de CSS** (`html.ios-app`): oculta en iOS **todos** los enlaces a `/pricing`
  (`a[href^="/pricing"]`) y cualquier elemento con la clase `.ios-pay-hide`.
- Ya ocultos por esa vía: Nudge, popup de prueba, Guardian upsell, Onyx Copy (seguir),
  Bots (add-on), Academy (desbloquear/activar), Bot Lab (comprar), portal de facturación.
- Todos los botones "Ver planes / Mejorar" del dashboard enlazan a `/pricing` → **ocultos en iOS**
  (incluido el del dashboard que mostraba `Upgrade · $X/mo`).

## Se corrigió en esta versión
Botones de compra que usaban `onClick`/enlace a `/account` y **mostraban precio** sin estar ocultos:
1. **Claves → add-on "cuenta extra"** (`app/dashboard/keys/page.tsx`): botón con precio → `ios-pay-hide`.
2. **Copy → comprar esclava extra** (`app/dashboard/copy/CopyClient.tsx`): stepper de compra con precio → `ios-pay-hide`.
3. **Copy → comprar master extra** (`app/dashboard/copy/CopyClient.tsx`): stepper de compra con precio → `ios-pay-hide`.
4. **Mi cuenta → "gestionar en la web"** (`app/account/ManageOnWeb.tsx`): se quitó la frase de *steering*
   ("subir/bajar de plan → ve a la web"); ahora solo dice que la suscripción/facturación se gestiona en la web.

## Se corrigió también (v558 · barrido de textos de upsell)
En iOS se neutralizaron los textos que nombraban un plan de pago o decían "desbloquea/mejora"
(el botón ya estaba oculto; ahora el texto tampoco empuja a comprar):
- **Dashboard**: candado "Available in Pro" → "No disponible en tu plan actual" (sin nombre de plan ni botón); franja "solo 30 días… desbloquea con Pro" → "En tu plan ves solo los últimos 30 días".
- **Ganancia neta (Expenses)**: "Disponible en Pro y superiores" → "No disponible en tu plan actual" (sin botón Ver planes).
- **Plan y hábitos**: "Repaso con IA (Pro) · Disponible en Pro" → "Repaso con IA · No disponible en tu plan actual"; popup Guardian sin botón "Ver planes".
- **Gestor (Manager)**: pastilla "Disponible en Elite" → "Función avanzada".
- **Claves**: "…o mejora tu plan para conectar más cuentas" → "Revoca una clave para liberar un cupo…".
- **Mis robots (Bots)**: se ocultó el texto "o incluido en Black Onyx".

Nota: la **Academia** (contenido de terceros/mentores) tiene sus botones de compra ya ocultos en iOS
(`ios-pay-hide`); sus precios de niveles son de mentores y quedan como área aparte si Apple lo pidiera.

## Resultado
En iOS: no hay precios de planes ni add-ons, ni botones/enlaces que lleven a comprar, ni textos que empujen a suscribirse.
La pantalla de Suscripción muestra el estado de la propia cuenta (plan, renovación, crédito)
y un aviso neutro de que la facturación se gestiona en la web.

## Al desplegar
El ZIP **no incluye `.env`** (solo `.env.*.example`). Conserva tu propio `.env`.
Vuelve a compilar la app iOS (`npm run build` + Capacitor sync) para que los cambios entren en el nuevo build.
