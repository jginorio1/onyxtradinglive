# Onyx Trading Live — Guía de activación paso a paso

Orden recomendado. Marca cada paso al terminarlo.

---

## 1. Subir el código (siempre primero)

1. Descarga el último ZIP y descomprímelo.
2. Copia TODO su contenido dentro de la carpeta de tu proyecto, reemplazando los archivos.
3. Abre **GitHub Desktop** → verás los archivos cambiados.
4. Escribe un mensaje (ej. "actualización") → **Commit to main** → **Push origin**.
5. Ve a **Vercel → Deployments**. Espera a que el último quede en verde **Ready**.
   - Si sale en rojo **Error**, abre el log, cópiame la parte roja y lo arreglo.

> Regla de oro: si "no se ven los cambios", casi siempre es que el deploy no terminó
> o falló. Revisa Deployments antes que nada, y refresca con Ctrl/Cmd+Shift+R.

---

## 2. SQL en Supabase (Supabase → SQL Editor → pega y Run)

Corre estos, en cualquier orden. Todos usan `if not exists`, así que es seguro repetirlos:

- `supabase/telegram_log.sql`   → registro de envíos de Telegram
- `supabase/optimize_v1.sql`    → función de mantenimiento
- `supabase/optimize_v2.sql`    → tamaño de la base y tablas
- `supabase/tg_report.sql`      → preferencia de reporte del trader
- `supabase/copy_trading.sql`   → copy trading + columna `extra_slaves`
- `supabase/copy_v2.sql`        → Fase 2: claves Copy identificadas, pausa remota, PIN de copy y controles de riesgo
- `supabase/black_onyx.sql`     → plan tope "Black Onyx" (todo ilimitado, copy ilimitado). Ajusta el precio y crea su Price ID de Stripe en Admin → Planes.

---

## 3. Variables de entorno en Vercel (Project → Settings → Environment Variables)

Ponlas ahí (nunca en el código). Tras añadirlas, **Redeploy**.

- `STRIPE_SECRET_KEY`   — tu clave de Stripe (test o live)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — clave pública de Stripe (empieza por `pk_`). Necesaria para el cambio de tarjeta y el checkout embebido dentro de Onyx.
- `RESEND_API_KEY`      — para correos (reportes, tickets)
- `TELEGRAM_BOT_TOKEN`  — token del bot (revócalo en BotFather si se expuso)
- `CRON_SECRET`         — un valor aleatorio propio (el mismo que usan las tareas)
- `B2_KEY_ID`, `B2_APP_KEY`, `B2_BUCKET` — para descargar backups desde el panel

---

## 4. Tareas programadas en GitHub (repo → .github/workflows → Add file)

Crea cada archivo con el contenido que está en el ZIP. Usan `APP_URL` y `CRON_SECRET`.

- `backup.yml`          → copia de seguridad (diaria)
- `alerts.yml`          → alertas de negocio por Telegram (diaria)
- `trader-reports.yml`  → reportes del trader por Telegram (diaria)
- `audit.yml`           → auditoría de código y velocidad
- `optimize.yml`        → optimización semanal

Para probar cualquiera al momento: **Actions → (nombre) → Run workflow**.

---

## 5. Stripe (Dashboard de Stripe → Products)

1. Crea un **precio recurrente mensual** para cada plan y pega los Price ID en
   **Admin → Planes** (cada plan, campo Price ID mensual/anual).
2. Add-on cuentas MT extra: crea un precio recurrente por unidad → **Admin → Retención → Cuentas MT extra** (precio + Price ID).
3. Add-on esclavas extra (copy trading): crea otro precio recurrente por unidad → **Admin → Retención → Copy trading: esclavas extra** (precio + Price ID + activar).
4. Add-on master extra (copy trading): crea otro precio recurrente por unidad → **Admin → Retención → Copy trading: master extra** (precio + Price ID + activar). La base es 1 master; con esto el trader puede tener varias masters, cada una con sus esclavas.

> Recuerda pasar de **modo test** a **live** en Stripe cuando vayas a cobrar de verdad.

---

## 6. Configuración en el panel Admin

- **Planes**: en Elite activa el toggle **Copy trading** y pon el nº de esclavas base (ej. 2).
- **Ajustes → Bloqueo por inactividad**: pon tu PIN de 6 dígitos (y cada empleado el suyo).
- **Ajustes → Barra de descuentos**: texto, colores y fecha si quieres promo en el landing.
- **Ajustes → Alertas**: enciéndelas y ajusta los límites (pagos fallidos, backup viejo, etc.).
- **Ajustes → Modo beta**: PIN si quieres una vista beta dentro del sitio.
- **Equipo**: al añadir un empleado se le manda un PIN temporal por correo; él lo cambia al entrar.

---

## 7. Telegram del trader (Mi cuenta → Telegram)

1. Conectar Telegram (abre el bot con el enlace y pega el código).
2. Elegir el **Reporte de rendimiento**: Semanal (lunes) o Mensual (día 1).
3. Botón **"Enviarme un reporte de prueba ahora"** para comprobar que llega la tarjeta con PDF, gráfico y CSV.
4. Comandos del bot: `/estado`, `/report`, `/mes`, `/stop`.

---

## 8. Copy trading (MetaTrader — lo hace tu desarrollador MQL)

La web ya está lista (Fase 2 incluida). Para que copie de verdad:

1. Las EAs ya están **completas** (MT5: `OnyxCopyMaster.mq5` / `OnyxCopySlave.mq5`; MT4: `OnyxCopyMaster.mq4` / `OnyxCopySlave.mq4`): la master envía las operaciones y la esclava parsea, resuelve el símbolo, calcula el lote, aplica los límites y abre/cierra. Los 4 están en `public/ea/` para descarga desde el asistente (selector MT4/MT5).

   **Prueba obligatoria en DEMO antes de usar dinero real:**
   - Abre 2 cuentas demo (una será master, otra esclava) y conéctalas en **Cuentas**.
   - En **Onyx Copy**: genera la clave Copy de cada una (botón Instalar) y pon la EA correspondiente en un gráfico de cada cuenta (master en la master, esclava en la esclava).
   - Autoriza `https://www.onyxtradinglive.com` en WebRequest y enciende Algo Trading en las dos.
   - Crea el enlace master → esclava con el modo que quieras.
   - Abre una operación pequeña en la master y comprueba que aparece en la esclava y en el log “Replicación en vivo”. Prueba también cerrarla.
   - Verifica lotes, símbolos raros (oro, índices) y el spread antes de pasar a real.
2. En MT5 → Opciones → Expert Advisors, permite **WebRequest** a `https://www.onyxtradinglive.com`.
3. En cada EA, pega la **clave Copy** de esa cuenta (empieza por `onyx_copy_`). El trader la genera en **/dashboard/copy → Claves Copy → Instalar**. Son claves separadas de las del Guardian: revocar una no afecta a la otra.
4. El trader crea sus enlaces master→esclava en **/dashboard/copy** y ahí mismo configura los **controles de riesgo** (lote máx, pérdida diaria, drawdown, spread, sesión, símbolos) sin tocar la EA.

**Control remoto (nuevo):** el trader puede pausar/reanudar toda la copia, o cuenta por cuenta, desde la web (móvil) o por Telegram con `/copy`, `/copyoff`, `/copyon`. Pausar es instantáneo; reanudar pide el **PIN de copy** (se pone en el tab). Las EAs (`public/ea/`) ya están servidas para descarga desde el asistente.

> Aviso: copiar entre cuentas puede violar las reglas de las prop firms. Cada trader
> es responsable de cumplir los términos de su firma. Onyx es un gestor multicuenta,
> no una herramienta de evasión.

---

## 8b. Stripe · webhook y cambio de plan

- **Webhook (importante):** en Stripe (modo correcto: Test o Live) → Developers → Webhooks, el endpoint debe apuntar a `https://www.onyxtradinglive.com/api/stripe/webhook` (con `www`; sin www da 308 y falla). Eventos: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`, `charge.refunded`. El `STRIPE_WEBHOOK_SECRET` en Vercel debe ser el de ese endpoint y del mismo modo.
- **Precios:** en modo live, cada precio debe ser ≥ $0.50 (mínimo de Stripe). Para pruebas usa modo test con la tarjeta `4242 4242 4242 4242`.

## 8c. Cambio de plan (subir / bajar) — comportamiento

- **Correr SQL:** `supabase/plan_change.sql` (una vez). Añade el estado del cambio pendiente y `plan_paused` a las cuentas.
- **Subir de plan:** inmediato, cobra la diferencia prorrateada. Si el plan nuevo ya incluye add-ons (p. ej. Black Onyx ilimitado), esos add-ons pagados se **quitan automáticamente** para no cobrar doble.
- **Bajar de plan:** **no quita nada al instante.** Se programa con un *Subscription Schedule* para el final del periodo ya pagado; el trader conserva su plan actual y todas sus funciones hasta esa fecha. En el corte, Stripe cambia al plan menor, el webhook aplica los límites (pausa —sin borrar— el copy y las cuentas que sobren) y avisa al trader.
- **Elegir cuentas:** si el plan menor permite menos cuentas MT, el trader elige en Mi cuenta → Cuentas cuáles conservar; las demás se pausan (no se borran) y se reactivan al subir.
- **Cancelar un cambio programado:** botón "Cancelar cambio" en Mi cuenta → Suscripción (libera el schedule).
- **Avisos:** al programar el cambio, 3 días antes (cron), y el día del corte → por correo y Telegram. Pago fallido → aviso "plan en riesgo" (no se quita nada hasta que Stripe cancele).
- **Cron nuevo:** `/api/cron/plan-reminders` (ya en `vercel.json`, diario 15:00 UTC). Usa el mismo `CRON_SECRET`.
- **Price IDs:** cada plan debe tener su Price ID en Admin → Planes para poder cambiar hacia él.

## 9. Comprobación final

- [ ] Deploy en verde en Vercel
- [ ] Todos los SQL corridos
- [ ] Workflows creados y probados con Run workflow
- [ ] Reporte de prueba de Telegram recibido (con PDF y gráfico)
- [ ] Backup con una fila real (~47 KB) y botón Descargar activo
- [ ] Plan Elite con Copy trading activado
- [ ] Add-ons con Price ID puestos
