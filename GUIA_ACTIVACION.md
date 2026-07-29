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

---

## 8m · Bots Fase 3 (métricas avanzadas, backtest, portafolio, alertas)

Requisitos: re-corre `supabase/bots.sql` (añade la columna `backtest`). Lo demás
ya funciona con lo del MVP.

1. **Métricas avanzadas por bot** — en cada bot, botón "📊 Métricas": Sharpe,
   Sortino, MAR/Calmar (retorno anualizado sobre drawdown), SQN, Payoff,
   duración del drawdown (días), máx. pérdidas seguidas, % meses positivos,
   exposición, anualizado, y ganancia/pérdida media.

2. **Vivo vs backtest** — en "⚙️ Config" de cada bot puedes meter el PF, win% y
   DD% **esperados** (cópialos del reporte del Strategy Tester). Los bots en vivo
   muestran un aviso: "en línea", "algo por debajo" o "⚠ divergencia — revisa
   sobreoptimización" según cuánto se aleja el PF real del esperado.

3. **Portafolio + correlación** — abajo, matriz de correlación entre tus bots en
   vivo (baja/verde = diversifican; alta/rojo = bajan juntos) y curva combinada.

4. **Alertas automáticas** — un cron cada 6h (`/api/cron/bots-check`, ya en
   vercel.json, protegido con CRON_SECRET) avisa por Telegram/push, una vez al
   día, cuando un bot en vivo rompe su DD máximo o diverge del backtest.

Pendiente (a propósito, por seguridad): el **freno por bot** (pausar/cerrar un
magic desde la web) requiere tocar el bucle de comandos del Guardian, que protege
dinero real. Lo dejo para una pasada enfocada y probada, no a ciegas.

---

## 8n · Módulo de bots como ADD-ON ($15/mes) + incluido en Black

El módulo de bots se puede tener de dos formas: **incluido en el plan** (capacidad
`algo`) o **comprado como add-on** de $15/mes.

Configurar (una vez):
1. Re-corre `supabase/bots.sql` (añade `addon_algo` en profiles).
2. En Stripe crea un **precio recurrente** de $15/mes para el add-on y copia su `price_...`.
3. Admin → Planes → sección Add-ons → **🤖 Módulo de bots**: pega el `price_id`,
   pon el precio (15) y déjalo **activado**.
4. Incluirlo GRATIS en Black: Admin → Planes → Black Onyx → Capacidades →
   "Módulo de bots" ON. (Así los de Black lo tienen sin pagar aparte.)

Cómo se vende:
- Cuando un usuario sin acceso entra a **🤖 Bots**, ve la pantalla con el botón
  **"Añadir por $15/mes"** (checkout del add-on, se prorratea en su suscripción)
  y la nota "o incluido en Black Onyx".
- Necesita un plan de pago activo para añadir el add-on (si es free, se le manda a Planes).

Nota honesta: dar de baja el add-on hoy se hace desde **Gestionar pago** (portal de
Stripe), que quita el item. Un toggle de "quitar" dentro de Mi cuenta se puede
añadir después; no lo puse para no tocar pantallas grandes sin necesidad.

---

## 9 · Campañas de correo (seguimiento automático + envíos manuales)

Sistema de campañas montado sobre Resend (el mismo que ya envías). Correos de
seguimiento automáticos a tu base de traders + un compositor para mandar promos
y noticias a mano, con plantillas editables y borrador con IA. Panel en
**Admin → Campañas** (grupo Crecimiento).

Configurar (una vez):
1. Corre `supabase/campaigns.sql` en Supabase (crea `campaigns`, `campaign_sends`
   y añade `marketing_emails` + `unsub_token` en `profiles`).
2. Ya está en `vercel.json` el cron `"/api/cron/campaigns"` (diario 17:00 UTC).
   Requiere `CRON_SECRET` (el mismo que ya usas; nunca lo publiques).
3. Para el borrador con IA: `ANTHROPIC_API_KEY` en Vercel (el mismo del soporte).
4. Para que salgan correos: `RESEND_API_KEY` + `SUPPORT_FROM_EMAIL` (ya los tienes).

Cómo funciona:
- **Automáticas** (se crean solas la 1ª vez, empiezan APAGADAS): "No conectó su
  cuenta", "Trader inactivo", "Prueba por expirar", "Newsletter semanal". Las
  enciendes con el interruptor y editas el texto (ES/EN) con ✏️ Editar. El cron
  las envía al segmento correcto; cada trader recibe cada campaña de disparo una
  sola vez (dedupe en `campaign_sends`); el boletín programado sale como mucho una
  vez cada ~6 días.
- **Envío manual (promos y noticias)**: eliges segmento, escribes o pulsas
  ✨ Borrador (la IA redacta ES/EN con el cerebro de Onyx), 👁 Ver cuántos lo
  recibirán, 📧 Prueba a tu correo, y 🚀 Enviar ahora.
- **Segmentos dinámicos** (se calculan en vivo): todos, gratis, de pago, Black,
  con cuenta conectada, sin conectar, inactivos, prueba por expirar.
- **Baja**: cada correo lleva enlace de baja de un clic (`/unsub`). Apaga solo el
  marketing (`marketing_emails=false`); los transaccionales (facturación, soporte)
  siguen. El opt-out se respeta en todos los segmentos.

Seguridad/anti-spam: tope de 200 envíos por corrida del cron, nunca repite una
campaña de disparo al mismo usuario, y respeta la baja. Los secretos van solo en
variables de entorno de Vercel, nunca en el código.

---

## 9b · Aperturas/clics reales (webhook Resend) + programar promos

Dos añadidos al módulo de campañas:

**A) Métricas reales de apertura y clic.** El panel muestra tasa de apertura y de
clic por campaña, con datos reales de Resend (no estimados).
1. Corre otra vez `supabase/campaigns.sql` (añade `resend_id`, `opened_at`,
   `clicked_at`, `delivered_at` en `campaign_sends` y `scheduled_at` en `campaigns`).
   Es idempotente: puedes correrlo sin miedo.
2. En Resend → **Webhooks** → *Add endpoint*: URL
   `https://www.onyxtradinglive.com/api/webhooks/resend`. Marca los eventos
   `email.delivered`, `email.opened`, `email.clicked`, `email.bounced`,
   `email.complained`.
3. Copia el **Signing secret** (empieza por `whsec_`) y ponlo en Vercel como
   `RESEND_WEBHOOK_SECRET`. (Si no lo pones, el webhook igual funciona pero sin
   verificar firma; para producción, ponlo.)
4. Activa el *open tracking* y *click tracking* en tu dominio de Resend.

Extra: si un correo rebota o marca spam, el sistema pone `marketing_emails=false`
a ese usuario automáticamente (higiene de lista).

**B) Programar una promo a fecha/hora.** En **Admin → Campañas → Envío manual**,
además de "Enviar ahora" hay "🕒 O prográmala": eliges fecha/hora y queda en
**Promos programadas**, donde puedes editarla o cancelarla antes de que salga.
- El cron `/api/cron/campaigns` ahora corre **cada hora** (en `vercel.json`) para
  entregar las programadas cerca de su hora.
- NOTA: en Vercel plan **Hobby** los cron corren como mucho 1 vez al día, así que
  las programadas saldrían en la corrida diaria, no a la hora exacta. Con Vercel
  **Pro** sí corre cada hora. (Los secretos van solo en variables de entorno.)

---

## 10 · Backups automáticos a tu Google Drive (Apps Script)

Copia diaria de tu base de datos en el Drive de tu Gmail, gratis y sin llaves de
Google en el servidor. El script corre en TU cuenta de Google.

**En el código (ya hecho):** el export del backup (`/api/admin/backup?export=json`)
ahora acepta un secreto además de la sesión, y **oculta los campos sensibles**
(secretos, tokens, hashes, PINs, claves API) — nunca salen en claro.

**Pasos:**
1. En Vercel, decide el secreto: usa el `CRON_SECRET` que ya tienes, o crea uno
   nuevo `BACKUP_SECRET` (Settings → Environment Variables) con un valor largo al azar.
2. Abre `backups/onyx-drive-backup.gs` (viene en el ZIP). Copia TODO su contenido.
3. Ve a https://script.google.com → **Nuevo proyecto** → borra lo que haya y **pega**.
4. Rellena el bloque `CONFIG`: tu `SITE`, el `SECRET` (el mismo del paso 1),
   el nombre de carpeta y cuántas copias conservar (KEEP).
5. Ejecuta la función **`backupNow`** una vez (acepta los permisos). Debe crear el
   primer `onyx-backup-*.json` en tu Drive → compruébalo.
6. Ejecuta **`instalarDisparadorDiario`** una vez → a partir de ahí corre solo cada día.

Lo verás también en **Admin → Backups** (el script avisa al panel para el historial).

**Recuerda (importante):** esta copia en Drive es tu **segunda** red de seguridad.
La principal deben ser los **backups automáticos de Supabase** (plan Pro: copias
diarias + recuperación a un punto en el tiempo). Actívalos en Supabase → Database →
Backups. Mantén la carpeta de Drive **privada** (contiene datos de usuarios).

---

## 11 · Diagnóstico reforzado (auto-test + monitor externo)

Tres mejoras al diagnóstico:

**1. Puesto al día.** Admin → Diagnóstico ahora vigila también: `RESEND_WEBHOOK_SECRET`
(webhook de aperturas/clics), la **frescura del último backup** (avisa si tiene
más de 2 días), y las tablas nuevas (campañas, tracking, bots). Si falta algo,
sale en el semáforo.

**2. Auto-test diario.** Nuevo cron `/api/cron/selftest` (ya en `vercel.json`,
diario 08:00 UTC). Ejecuta solo las pruebas — BD, Onyx AI, Telegram, presencia de
Resend/Stripe, backup fresco — y **solo te avisa por correo + Telegram si algo
falla**. Si todo va bien, no molesta. Usa `CRON_SECRET` (ya lo tienes).

**3. Monitor externo (lo activas tú, gratis).** El auto-test no puede detectar una
caída TOTAL del sitio (si Vercel se cae, el cron también). Para eso:
   - Entra a **uptimerobot.com**, crea cuenta gratis.
   - **Add New Monitor** → tipo **HTTPS** → URL `https://www.onyxtradinglive.com`
     → intervalo 5 min.
   - En **Alert Contacts** pon tu correo (y/o Telegram/SMS).
   Si el sitio deja de responder, te escriben en minutos. Es la única pieza que el
   diagnóstico interno no puede cubrir por diseño.

---

## 12 · Kit de reclutamiento de embajadores con AI (bilingüe)

Dos superficies nuevas, ambas en ES/EN, reusando el cerebro de Onyx (ONYX_BRIEF).

**Lado admin — Admin → Embajadores → "Reclutar":** mini-CRM de prospectos
(Nuevo → Contactado → Respondió → Se unió → Descartado). Añades un creador
(nombre, plataforma, nicho, correo), pulsas **✨ Generar** y la IA redacta la
invitación personalizada (con el ángulo prop-firm, tu comisión y el cupón); la
editas y la **envías por correo** (Resend). Al enviar, el prospecto pasa a
"Contactado" solo. Permiso: área **Embajadores** (marketing/owner).

**Lado embajador — Mi cuenta → Embajador → "Generar publicaciones con AI":**
el creador aprobado elige plataforma (YouTube/Instagram/TikTok/Telegram) y la IA
le crea un post listo con **su enlace y código ya insertados**; puede pedir otra
versión, copiar, y **descargar un banner** con su código (`/api/ambassador/banner`).
Debajo siguen las plantillas estáticas por si no hay IA configurada.

**Activar:**
1. Corre `supabase/ambassador_kit.sql` (tabla `ambassador_prospects`).
2. Requiere `ANTHROPIC_API_KEY` (el mismo que ya usas) para redactar, y
   `RESEND_API_KEY` para enviar invitaciones. Sin IA, las plantillas estáticas
   siguen funcionando.

Nota: la IA **redacta**, no busca creadores por su cuenta (no navega la web).
Los prospectos los añades tú. Nunca inventa funciones ni promete ganancias.

---

## 13 · Entornos: Beta separado de Producción (+ cómo volver al estable)

Idea clave: **Beta y Producción son dos webs distintas, con dos bases de datos
distintas.** Así puedes romper lo que quieras en Beta sin tocar a un cliente real.
El botón de "cambiar" solo te lleva de una URL a la otra — el aislamiento vive en
la infraestructura, no en un interruptor.

### A) Montar el entorno Beta (una vez)

1. **Rama en tu repo:** crea una rama `beta` (en GitHub, botón de ramas → New
   branch `beta`). Vercel la desplegará sola.
2. **Segunda base de datos:** en Supabase → New project → "onyx-beta". Copia su
   URL y sus claves. (Es una base VACÍA de pruebas, aparte de la real.)
3. **Stripe en modo prueba:** en Stripe, activa "Test mode" (interruptor arriba a
   la derecha) y usa esas claves `sk_test_...` / `pk_test_...` para Beta.
4. **En Vercel → Settings → Environment Variables**, usa el selector de entorno:
   - Para **Preview/beta** pon las claves de la base beta + Stripe test, y además:
     `NEXT_PUBLIC_APP_ENV=beta`, `NEXT_PUBLIC_BETA_URL=<url de beta>`,
     `NEXT_PUBLIC_PROD_URL=https://www.onyxtradinglive.com`, `BETA_SWITCH_PIN=<un pin>`.
   - Para **Production** deja las claves reales y `NEXT_PUBLIC_APP_ENV=production`
     (o vacío), más las mismas `NEXT_PUBLIC_BETA_URL` / `NEXT_PUBLIC_PROD_URL` / `BETA_SWITCH_PIN`.
5. (Opcional) Un dominio bonito: en Vercel → Domains, apunta `beta.onyxtradinglive.com`
   a la rama `beta`.

Con eso, la web beta muestra sola la franja morada "ENTORNO DE PRUEBAS", y en
**Admin → Ajustes → Entorno** tienes el botón para saltar (pide PIN + alerta).

### B) Cómo paso un cambio de un estado a otro (promover)

El cambio siempre baja por el tubo, nunca al revés:

1. Trabajas/pruebas en la rama **`beta`** (se despliega solo en la web beta).
2. Cuando funciona, **fusionas `beta` → `main`** (en GitHub: Pull request de
   `beta` a `main` → Merge). Eso, y solo eso, actualiza **Producción**.

Nunca edites producción a mano: todo pasa primero por beta.

### C) SI PRODUCCIÓN FALLA — cómo vuelvo al estable (esto es lo importante)

Vercel guarda **todos** los despliegues anteriores. Volver a la última versión
buena tarda ~15 segundos y no borra nada:

1. Vercel → tu proyecto → pestaña **Deployments**.
2. Busca el último despliegue que **sí funcionaba** (marca verde "Ready", el de
   antes del que rompió).
3. En sus tres puntos **⋯ → "Promote to Production"** (o "Instant Rollback").
4. Confirma. En segundos, producción vuelve a esa versión estable. Tus usuarios
   dejan de ver el fallo.

Eso es tu botón de "deshacer". La base de datos no se toca con un rollback de
código; si además tocaste datos, para eso tienes los **backups de Supabase** y tu
copia en Drive.

Resumen del ciclo seguro: **beta (rompes) → merge a main (produces) → si algo
sale mal, Promote al despliegue anterior (vuelves al estable).**

---

## 14 · Balance real (gastos operacionales vs ganancias) · Pro+

Nueva sección en el dashboard del trader: apunta sus gastos (retos de fondeo, VPS,
software, internet, suscripciones…) y ve su **neto real** = ganancia de trading −
gastos. Disponible en **Pro y superiores** (capacidad `expenses`). Bilingüe.

**Activar:**
1. Corre `supabase/expenses.sql` (tabla `expenses`).
2. Enciende la capacidad **"Balance real"** (`expenses`) en **Admin → Planes** →
   Capacidades, para **Pro, Elite y Black Onyx**. (Igual que hiciste con el módulo
   de bots.) También puedes correr el UPDATE que viene comentado en el .sql.

Cuando está activa, al trader le aparece **🧮 Balance real** en el menú. Ahí:
- Tarjetas Ganancia bruta / Gastos / **Neto real** por mes (‹ mes ›).
- Añadir gasto con lista predefinida (o "Otro…" manual) y check **Mensual**
  (los recurrentes cuentan cada mes solos).
- Desglose por categoría y lista de gastos, con borrar.

El bruto de trading sale de sus operaciones cerradas del mes; los gastos, de lo
que apunte. Nada se envía a ningún lado — es su registro privado.

---

## 15 · AI de cara al trader: Coach + Analizador + Lector de reglas

Tres integraciones de AI, todas reusando el cerebro de Onyx y con la LÍNEA ROJA:
nunca predicen el mercado, dan señales ni prometen ganancias.

**1. Coach AI (repaso del rendimiento)** — Pro+. Tarjeta 🧠 en el dashboard: el
trader pulsa "Generar repaso" y el AI le escribe qué hace bien/mal y un hábito a
corregir, leyendo sus últimos ~90 días. Gateado por la capacidad **`coach`**
(actívala en Admin → Planes → Capacidades para Pro/Elite/Black).

**2. Analiza tu cuenta gratis (imán de leads)** — público, `/analiza` (enlace en
el menú de invitado). El visitante pega su reporte/operaciones, el AI le da 3
hallazgos y lo invita a crear cuenta. Sin registro para probar.

**3. Lector de reglas de prop firm** — dentro de "Mi reto". El trader pega las
reglas de su firma y ✨ "Leer con AI" prellena los campos (pérdida diaria/total,
objetivo, días, consistencia); él revisa y guarda. Requiere el plan con Guardian.

**Activar:** solo necesita `ANTHROPIC_API_KEY` (el mismo que ya usas). Para el
Coach, enciende la capacidad `coach` en los planes de pago. Sin IA, el analizador
y el lector avisan con elegancia y el resto sigue funcionando.

---

## 16 · Balance real v2 (prop firm, reembolso, ROI por firma)

Amplía el control de gastos pensando como trader de prop firms.
1. Corre `supabase/expenses_v2.sql` (DESPUÉS de `expenses.sql`): añade columnas
   firm, tamaño, tipo, cuenta vinculada, reembolsable, recuperado y proveedor.
2. No necesita nada más — usa la misma capacidad `expenses`.

Novedades para el trader:
- Al elegir "Cuenta de fondeo" se abren campos: **prop firm, tamaño, tipo
  (Reto F1/F2, Fondeada, Reset), cuenta MT vinculada** y **Reembolsable** + cuánto
  recuperó. El **neto** ahora usa el **costo real** (pagado − recuperado).
- **ROI por prop firm** (este año): gastado vs. recuperado vs. ganado con esa firma
  → "¿qué firma me sale a cuenta?". El "ganado" cuenta si vinculó el reto a su cuenta MT.
- **Punto de equilibrio**: "te faltan $X de ganancia para cubrir los gastos del mes".
- Campo **proveedor/detalle** en toda categoría, **fecha exacta**, y **editar** un gasto.

---

## 17 · Capa AI de Balance real (lector de recibos + coach de gasto)

Dos usos de AI dentro de Balance real (Pro+, misma capacidad `expenses`, tu
`ANTHROPIC_API_KEY`). No requiere SQL nuevo.

- **Lector de recibos:** en "Añadir gasto", caja "Pega tu recibo y lo apunto con AI".
  Pegas el correo de compra del reto / cargo / renovación y ✨ "Leer con AI" rellena
  categoría, prop firm, tamaño, tipo, monto, reembolsable y proveedor. Revisas y guardas.
- **Coach de gasto:** tarjeta 🧠 con "Generar lectura" — el AI cruza tus gastos con
  tu trading (del año) y te dice dónde se va el dinero y si los retos se pagan (ROI).

Ambos respetan la línea roja: analizan tu gasto, no predicen el mercado.

---

## 18 · Centro de mensajes (trader) + aviso sticky de leads (admin)

1. Corre `supabase/notifications.sql` (tabla `notifications`).

**Trader — campana 🔔** en la barra: badge con no leídas y una nota sticky con
pin (se queda fija) y "Marcar todo leído". Por ahora la alimenta la **respuesta
de soporte**: cuando el equipo responde el ticket de un trader con cuenta, le
llega el mensaje a su campana (además del correo). El helper `notify(userId,…)`
en `lib/notify.ts` permite sumar más eventos (fondeo, EA caído, meta) donde ya
se disparan las alertas.

**Admin — aviso de leads:** cuando entra una consulta de cliente/lead, salta una
nota **desde el borde derecho, centrada vertical**, solo a empleados marcados
"Disponible". Botones Abrir / Visto / Siguiente; con → se oculta al borde como
pestañita con contador; con 📌 se fija. No necesita nada extra: lee los tickets.

---

## 19 · Chat estilo WhatsApp: soporte + chat de equipo

Un solo motor de chat (burbujas, avatar, separadores por día, **palomitas de
leído**, "escribiendo…", **adjuntos** de foto/documento, **emojis** y
**@menciones**) sirve para: el Centro de soporte del trader, la bandeja del admin,
y el nuevo **Chat de equipo**.

### 19.1 · Pasos de activación (una sola vez)

1. **SQL.** En Supabase → SQL Editor, corre `supabase/chat.sql`. Añade las
   palomitas y adjuntos al soporte y crea las tablas del chat de equipo
   (`chat_channels`, `chat_members`, `chat_messages`, `chat_reads`). Es
   idempotente: se puede correr varias veces.

2. **Bucket de Storage.** En Supabase → Storage → **New bucket**:
   - Nombre exacto: `chat-uploads`
   - **Public**: ON
   Sin esto, subir fotos/documentos dará error (la API lo avisa).

3. **Realtime.** Ya viene activo en Supabase. El chat usa *broadcast* y
   *presence* (efímeros, no tocan la base de datos), así que **no** hay que
   configurar RLS ni "replication". Si algún día no ves el "en línea" o el
   "escribiendo…", revisa que Realtime esté habilitado en el proyecto.

No hay variables nuevas en Vercel.

### 19.2 · Chat de equipo (empleados)

Nuevo tab **💬 Chat equipo** en el panel (grupo *Operación*). Permiso nuevo
`Chat de equipo`: activo por defecto para Owner, Admin, Soporte y Marketing (lo
ajustas en Equipo → permisos).

- **Canales** abiertos a todo el equipo (`#general` se crea solo) y **mensajes
  directos** (doble clic sobre un compañero en la lista *Equipo*).
- **@menciones**: escribe `@` para etiquetar a un **compañero**, un **cliente** o
  un **ticket**. Al mencionar a alguien le llega aviso en su campana.
- **@Onyx AI**: escribe `@Onyx` y la IA responde en el canal (usa la misma base de

- **@Onyx interno (equipo):** ahora responde preguntas **de conjunto** con datos reales — «¿cuántas consultas de fondeo hay?», «¿qué tickets llevan más de 24h esperando?», «historial de cliente@correo.com». Solo lee tickets/clientes del equipo; nunca revela secretos ni da consejo financiero.
  conocimiento del soporte; nunca da datos privados de un cliente).
- **Adjuntar** fotos y documentos (📎) y **emojis** (😊).
- **Buscar por día**: el selector de fecha filtra los mensajes de esa jornada
  (los chats quedan guardados por día).
- **Añadir a un compañero** a la conversación con **＋ Añadir**; se ve el
  **nombre y el rol** de cada miembro.
- **Varios chats a la vez**: con ⧉ (o *Ventana*) abres la conversación como una
  **ventana acoplada** abajo a la derecha; puedes tener hasta 3 abiertas.

### 19.3 · Soporte con look WhatsApp

- **Trader** (Centro de soporte): el ticket abierto es ahora un chat con
  burbujas, adjuntos, emojis y palomitas. Al abrirlo se marcan como leídos los
  mensajes del equipo (el admin ve ✓✓).
- **Admin** (bandeja): las respuestas muestran ✓✓ (verde cuando el cliente las
  leyó), se pueden **adjuntar** archivos, y ves cuándo el cliente **está
  escribiendo**. Se conservan las respuestas guardadas, el borrador con IA, las
  notas internas y la invitación de compañeros.
