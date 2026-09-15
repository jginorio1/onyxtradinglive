# Onyx Training — Centro de formación interno

Academia interna para **empleados y vendedores**, montada sobre el mismo estilo de Onyx Academy pero **aislada**: no aparece en el directorio público ni afecta las academias de los mentores (no toca ninguna tabla `academy_*`).

## Qué incluye

- **5 rutas de estudio** con lecciones y examen: conectar los EA + troubleshooting, configurar una cuenta, usar las apps (Dashboard, Guardian, Copy, Mis robots), la Academia, y ventas/comisiones/soporte.
- **Exámenes** con nota mínima, intentos limitados y banco de preguntas (opción de barajar N preguntas al azar).
- **Rendimiento académico**: progreso, promedio de exámenes y certificados por persona.
- **Certificados con caducidad** (recertificación): p. ej. cada 6 meses.
- **Acceso por persona**: interruptor para activar/desactivar a cada empleado y vendedor.
- **Gating por competencia**: opcional, un vendedor no recibe leads automáticos hasta aprobar las rutas marcadas como “requisito para leads”.
- **Auto-alta** desde Ventas (`sales_reps`) y Equipo (`staff`), y alta manual por correo.
- **Recordatorios** por notificación: cursos pendientes y certificados por vencer (cron diario).
- **Bilingüe** ES/EN.

## Despliegue

1. En Supabase, corre en orden:
   - `supabase/training_v1.sql` (tablas + ajustes).
   - `supabase/training_seed.sql` (contenido inicial de las 5 rutas).
2. Sube el ZIP a tu repo y despliega (Vercel).
3. El cron `/api/cron/training` ya está en `vercel.json` (una vez al día). Usa el mismo `CRON_SECRET` que el resto.

## Cómo se usa

- **Empleado / vendedor**: entra por el menú del avatar → **Centro de formación** (o directo en `/entrenamiento`). Estudia cada ruta, marca lecciones y presenta el examen. Al aprobar recibe su certificado.
- **Tú / RRHH (admin)**: **Panel → Equipo → Formación**.
  - **Personas**: activar/desactivar acceso por persona, cambiar su rol, alta por correo, auto-alta de ventas/equipo, y ver progreso + promedio.
  - **Rutas y exámenes**: crear/editar rutas, lecciones (con video opcional) y preguntas; fijar nota mínima, intentos, caducidad del certificado, prerrequisito, roles obligatorios y si es requisito para leads.
  - **Ajustes**: nombre del área, valores por defecto, recordatorios, auto-alta y gating.

## Notas

- Todo el contenido sembrado es editable desde el panel; cámbialo a tu voz de marca.
- El acceso lo controlas tú: nadie ve el área si no está activo.
- Los certificados llevan folio (`OT-XXXXXX`) y fecha de emisión/caducidad.
