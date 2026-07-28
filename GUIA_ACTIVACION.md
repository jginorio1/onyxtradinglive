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

## 8d. "Mi reto" (marcador de reglas de prop firm)

- **Qué es:** una sección nueva en el dashboard (**Mi reto**) que muestra en vivo, por cada cuenta, cuánto margen queda antes de romper la pérdida diaria/total, el avance al objetivo, días operados y consistencia, con un veredicto: En camino / Vigila / Roto. **Solo mide** (para BLOQUEAR de verdad, el trader activa los límites en Onyx Guardian).
- **Sin SQL nuevo:** las reglas se guardan en la config del gestor (JSON). Requiere el plan con Guardian (capability `manager`).
- **Dónde:** dashboard → tarjeta "Mi reto"; el mismo veredicto aparece en el panel del EA dentro de MetaTrader; y avisa por Telegram (usa la alerta de fondeo, una vez al día) cuando una regla está en riesgo o rota.
- **EA:** las plantillas del Guardian (`public/OnyxManager_MT5.mq5` y `_MT4.mq4`) muestran el veredicto del reto. **Como todo cambio en el EA, pruébalo primero en una cuenta demo** antes de usarlo en real; el marcador que dibuja lo calcula el servidor, el EA solo lo pinta.
- **Aviso honesto:** las reglas por firma (FTMO, The5ers, Topstep…) son un punto de partida, no la norma oficial. El trader debe confirmarlas con su contrato.

## 8e. App móvil (PWA) + notificaciones push

**Instalable como app (PWA):** ya viene lista, sin nada que configurar. Al desplegar, el trader puede instalar Onyx en su teléfono:
- Android/Chrome: aviso "Instalar app" o menú ⋮ → Instalar. También hay un botón **"Instalar app"** dentro de Onyx (Mi cuenta → Notificaciones).
- iPhone/Safari: botón Compartir → "Añadir a pantalla de inicio". El botón dentro de Onyx muestra el paso a paso.

**Notificaciones push (opcional, requiere claves):** el interruptor "Notificaciones al teléfono" (Mi cuenta → Notificaciones) **solo aparece si configuras las claves VAPID**. Pasos:

1. Genera las claves una vez (en tu compu, con Node): `npx web-push generate-vapid-keys`. Te da una **Public Key** y una **Private Key**.
2. En Vercel → Settings → Environment Variables añade:
   - `VAPID_PUBLIC_KEY` = la pública
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` = la MISMA pública (esta la usa el navegador)
   - `VAPID_PRIVATE_KEY` = la privada (NO la compartas)
   - `VAPID_SUBJECT` = `mailto:soporte@onyxtradinglive.com`
3. Corre `supabase/push.sql` (tabla de suscripciones).
4. Redespliega. La dependencia `web-push` se instala sola.

Notas honestas: en **iPhone** el push solo funciona con la app **ya instalada** (Compartir → Añadir a pantalla de inicio) y iOS 16.4+. Telegram ya cubre buena parte de los avisos; el push es un extra. Si no pones las claves, no pasa nada: el interruptor simplemente no se muestra.

## 8f. Seguridad: 2FA y admin oculto

- **`/admin` ahora responde 404** a quien no sea administrador (no revela que existe). El login sigue accesible para ti; el candado real es tu rol (`ADMIN_EMAILS` / `is_admin`).
- **Cabeceras de seguridad** activas en todas las respuestas (anti-clickjacking, HTTPS forzado, etc.). Ya vienen en `next.config.js`.
- **Verificación en dos pasos (2FA):**
  - **IMPORTANTE, hazlo una vez:** en Supabase → Authentication → Providers/Settings → **habilita MFA (TOTP)**. Sin esto, el "Activar" del 2FA dará error.
  - **Admin: es obligatorio.** La primera vez que entres a `/admin` tras desplegar, te pedirá activar el 2FA (escanear un QR con Google Authenticator/Authy). Después, cada login pedirá el código. Guarda bien tu app de autenticación: si la pierdes, tendrás que quitar el factor desde Supabase (tabla de MFA) para recuperar el acceso.
  - **Usuarios: opcional.** Cada trader lo activa en Mi cuenta → Seguridad → "Verificación en dos pasos (2FA)".

## 8g. Anti-bots / spam en el registro

- **Honeypot:** campo trampa invisible en el registro. Cero configuración; ya frena bots simples.
- **Limpieza automática:** cada día (`/api/cron/clean-signups`, en `vercel.json`, 04:30 UTC) borra las cuentas creadas hace +7 días que **nunca confirmaron el correo** (bots / abandonadas). Usa tu `CRON_SECRET`. En **Admin → Usuarios** hay una tarjeta "Limpieza de registros basura" para forzarlo a mano y ver cuántas hay.
- **CAPTCHA (Cloudflare Turnstile, gratis) — opcional pero es el que más frena bots:**
  1. Crea cuenta en Cloudflare → Turnstile → añade tu sitio (`onyxtradinglive.com`). Te da **Site Key** y **Secret Key**.
  2. En Supabase → Authentication → Attack Protection → **habilita CAPTCHA**, proveedor **Turnstile**, pega la **Secret Key**.
  3. En Vercel añade `NEXT_PUBLIC_TURNSTILE_SITE_KEY` = tu Site Key. Redespliega.
  4. Aparece la casilla en registro/login y Supabase verifica el token. Si no pones la Site Key, no se muestra y no bloquea nada.
- **Recuerda:** mantén la **confirmación de correo activada** en Supabase — así los bots con correos falsos nunca se vuelven usuarios reales.

## 8h. Correos: ficha de usuario, bandeja de salida y correo con tu dominio

- **Correr SQL:** `supabase/email_log.sql` (registro de correos enviados).
- **Ficha de usuario (Admin → Usuarios → 👁):** muestra quién cambió qué en su cuenta (del registro de admin), los correos que le envió el sistema, y un compositor para escribirle (se envía por Resend y queda registrado).
- **Bandeja de salida (Admin → Correos):** listado de todos los correos que envió el sistema, con búsqueda.
- **Los correos que Onyx ENVÍA** siguen por Resend (transaccional). Esto NO es un buzón para recibir; para conversar con clientes usa el sistema de Tickets/Soporte.

**Buzón con tu dominio (recibir/responder como soporte@onyxtradinglive.com) — recomendado GRATIS con Cloudflare:**
1. En Cloudflare (tu dominio) → **Email → Email Routing** → activa.
2. Crea la dirección `soporte@onyxtradinglive.com` y **reenvíala a tu Gmail** (jerryx35@gmail.com). Confirma el correo de verificación que llega a tu Gmail.
3. Para **responder como** soporte@: en Gmail → Configuración → Cuentas → "Enviar como" → añade soporte@onyxtradinglive.com (usa el SMTP de Resend o de un proveedor). Alternativa sin SMTP: usa **Zoho Mail (plan Free)** como buzón propio.
4. Costo: **$0**. Cuando quieras Gmail nativo con tu dominio, pasa a **Google Workspace (~$7/usuario/mes)**.

## 9. Comprobación final

- [ ] Deploy en verde en Vercel
- [ ] Todos los SQL corridos
- [ ] Workflows creados y probados con Run workflow
- [ ] Reporte de prueba de Telegram recibido (con PDF y gráfico)
- [ ] Backup con una fila real (~47 KB) y botón Descargar activo
- [ ] Plan Elite con Copy trading activado
- [ ] Add-ons con Price ID puestos

---

## 8i · Helpdesk de soporte (ficha del trader, respuestas guardadas, prioridad, aviso al equipo)

Mejoras en Admin → Soporte para que un equipo atienda rápido:

1. **Correr la migración** `supabase/support_helpdesk.sql` en Supabase → SQL Editor.
   Agrega la columna `priority` en `support_tickets` y la tabla `support_canned`
   (respuestas guardadas). Es idempotente: se puede correr sin miedo.

2. **Nada más que configurar.** Todo lo demás funciona con lo que ya tienes:
   - **Ficha del trader** (panel derecho): plan, cuentas MT, si es de fondeo,
     miembro desde, tickets previos, idioma, país y prop firm. Se arma solo con
     los datos del perfil.
   - **Respuestas guardadas**: en la conversación, botón "💬 Respuesta guardada".
     Crea plantillas una vez y reutilízalas en 1 clic. Se guardan por idioma.
   - **Filtros de equipo**: "Mías" (asignadas a ti) y "Sin asignar", además de
     Abiertas / En proceso / Resueltas / Todas. Punto de color = prioridad.
     "Espera respuesta" marca los tickets donde el último mensaje es del trader.
   - **Prioridad**: selector en la cabecera de cada ticket (Alta / Normal / Baja).

3. **Aviso al equipo por Telegram (opcional).** Si tienes `TELEGRAM_BOT_TOKEN`
   configurado y los admins vincularon su Telegram, cada ticket nuevo (de trader
   o lead) le llega al equipo por Telegram. Si no usas Telegram, no pasa nada:
   simplemente no se envía y no rompe nada.

Nota: el correo entrante (respuestas por email que vuelven al hilo del ticket)
NO está montado. Los traders con cuenta responden dentro de la app; las
respuestas por email de los leads llegan a tu buzón de Zoho.

---

## 8j · Automatización con IA (auto-respuesta, triage, /contacto, onboarding)

Objetivo: que la mayoría del soporte y del contacto se resuelva solo.

**Requisito para la IA:** la variable `ANTHROPIC_API_KEY` debe estar en Vercel
(la misma que ya usa el chat Onyx AI). Si falta, la IA no auto-responde — no pasa
nada malo, todos los tickets simplemente esperan a un humano.

1. **Re-corre `supabase/support_helpdesk.sql`.** Ahora también agrega la columna
   `onboarding_emails` en profiles. Es idempotente (seguro correrlo otra vez).

2. **Auto-respuesta con IA (tickets).** Cuando entra un ticket o un lead:
   - **Triage automático**: la IA le pone categoría y prioridad al instante.
   - **Auto-respuesta**: si el tema NO es sensible (nunca dinero, cobros, legal,
     cuentas) y la IA tiene una respuesta clara de la Guía, responde sola por el
     hilo y por correo, y deja una nota "🤖 Respondido por Onyx AI". Si no está
     segura, lo deja para una persona con una nota y el artículo sugerido.
   - **Interruptor**: en Admin → Soporte, arriba, el botón "🤖 Auto-respuesta IA"
     ON/OFF. Viene encendido. Apágalo cuando quieras que todo pase por humano.

3. **Página /contacto.** Nueva página pública (`/contacto`, y `/en/contacto`) con
   un formulario que crea un ticket (no un email suelto) y dispara la auto-respuesta.
   Ya está en el sitemap para SEO. El chat flotante sigue estando en toda la web.

4. **Onboarding por correo (automático).** Un cron diario (16:00 UTC) manda una
   secuencia a los usuarios nuevos: bienvenida (día 0‑3), recordatorio de conectar
   la cuenta si aún no la conectan (día 2‑12) y un tip de Guardian (día 5‑16). Cada
   usuario recibe como mucho un correo por día y nunca el mismo dos veces. Respeta
   el opt‑out (`notify_email`). Ya está en `vercel.json`; solo despliega. Protegido
   con `CRON_SECRET`.

Regla de oro que dejamos programada: **la IA nunca responde sola temas de dinero,
facturación, legal o de cuenta** — esos siempre van a una persona.

---

## 8k · La IA se alimenta sola (auto-aprendizaje)

La IA no se re-entrena: lee el conocimiento EN VIVO en cada pregunta. Por eso ya
aprende solo de dos fuentes, sin desplegar:
- **Precios/planes** (Admin → Planes): cambias un precio y la IA lo usa al instante.
- **Base de conocimiento** (Admin → Base IA): añades/editas un artículo y la IA lo sabe al momento.

Añadido en esta entrega:

1. **Importar la Guía a la Base IA.** En Admin → Base IA hay un botón "📥 Importar
   Guía" que vuelca todos los artículos de la Guía (ES + EN) a la Base IA. A partir
   de ahí puedes editarlos desde el panel SIN desplegar. Es idempotente (puedes
   volver a importar cuando cambie la Guía; reemplaza los importados anteriores).

2. **Aprender de los tickets resueltos.** En cada ticket, botón "💡 Guardar como
   conocimiento": guarda la mejor respuesta (del equipo o de la IA) en la Base IA,
   con el asunto como título. La IA la reutilizará en tickets parecidos. Así mejora
   sola con el uso real.

Requisito: la Base IA usa la tabla kb_articles (ya creada con kb_v1.sql).

---

## 8l · Módulo de Bots (traders algorítmicos) — MVP

Evalúa el rendimiento de cada bot por separado, dividido en "En pruebas" (demo/forward)
y "En vivo" (real/fondeo). Se apoya en las operaciones que ya sincroniza el Guardian;
lo nuevo es etiquetar cada operación con el **magic number** del EA que la abrió.

Pasos para activarlo:

1. **Corre `supabase/bots.sql`** en Supabase → SQL Editor. Añade las columnas
   `magic`/`ea_comment` a trades y open_positions, y la tabla `bots` (config por bot).
   El sync es tolerante: si no corres esto todavía, no se rompe nada (solo no verás bots).

2. **Reinstala el EA que uses** en tus MetaTrader — sirve tanto el Onyx Connector como el Onyx Guardian: los DOS (MT4 y MT5) ya reportan el magic number. Sin reinstalar, no hay datos por bot.

3. **Activa la capacidad `algo`** en los planes que quieras (Admin → Planes → Capacidades →
   "Módulo de bots"). Recomendado: Elite y Black Onyx (o como add-on). Sin la capacidad,
   el trader ve la pantalla de bots con un aviso para mejorar de plan.

Qué incluye el MVP:
- Agrupa operaciones por magic → KPIs por bot: neto, PF, drawdown %, win rate, ops,
  expectancy, recovery, ops/día, y curva mini.
- Split **En pruebas / En vivo** (auto por tipo de cuenta; se puede forzar por bot).
- **Criterios de graduación** (días, ops, PF, DD máx.) con medidor "listo para vivo" y
  botón **Promover a vivo**.
- Estado **activo/inactivo** (si el bot tiene posición abierta).
- Enlace "🤖 Bots" en la barra de arriba (solo si el plan tiene la capacidad).

Fase 3 (pendiente, lo más pesado, para cuando el MVP valide interés):
- Import del reporte del Strategy Tester y **overlay vivo vs backtest** con alarma de sobreajuste.
- **Freno por bot** vía Guardian (pausar un magic si rompe su DD).
- Alertas (Telegram/push): bot parado, ruptura de DD, divergencia vs backtest.
