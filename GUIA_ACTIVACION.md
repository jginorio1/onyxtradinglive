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

---

## 3. Variables de entorno en Vercel (Project → Settings → Environment Variables)

Ponlas ahí (nunca en el código). Tras añadirlas, **Redeploy**.

- `STRIPE_SECRET_KEY`   — tu clave de Stripe (test o live)
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

1. Termina las EAs (MT5: `ea/OnyxCopyMaster.mq5` y `ea/OnyxCopySlave.mq5`; MT4: `ea/OnyxCopyMaster.mq4` y `ea/OnyxCopySlave.mq4`) — parseo JSON, ejecución, reintentos — y pruébalas en **demo**. Las esclavas ya traen las funciones de límites listas para conectar (`ApplyMaxLot`, `SpreadTooHigh`, `RiskStop`). Los 4 archivos ya están servidos en `public/ea/` para descarga desde el asistente (selector MT4/MT5).
2. En MT5 → Opciones → Expert Advisors, permite **WebRequest** a `https://www.onyxtradinglive.com`.
3. En cada EA, pega la **clave Copy** de esa cuenta (empieza por `onyx_copy_`). El trader la genera en **/dashboard/copy → Claves Copy → Instalar**. Son claves separadas de las del Guardian: revocar una no afecta a la otra.
4. El trader crea sus enlaces master→esclava en **/dashboard/copy** y ahí mismo configura los **controles de riesgo** (lote máx, pérdida diaria, drawdown, spread, sesión, símbolos) sin tocar la EA.

**Control remoto (nuevo):** el trader puede pausar/reanudar toda la copia, o cuenta por cuenta, desde la web (móvil) o por Telegram con `/copy`, `/copyoff`, `/copyon`. Pausar es instantáneo; reanudar pide el **PIN de copy** (se pone en el tab). Las EAs (`public/ea/`) ya están servidas para descarga desde el asistente.

> Aviso: copiar entre cuentas puede violar las reglas de las prop firms. Cada trader
> es responsable de cumplir los términos de su firma. Onyx es un gestor multicuenta,
> no una herramienta de evasión.

---

## 9. Comprobación final

- [ ] Deploy en verde en Vercel
- [ ] Todos los SQL corridos
- [ ] Workflows creados y probados con Run workflow
- [ ] Reporte de prueba de Telegram recibido (con PDF y gráfico)
- [ ] Backup con una fila real (~47 KB) y botón Descargar activo
- [ ] Plan Elite con Copy trading activado
- [ ] Add-ons con Price ID puestos
