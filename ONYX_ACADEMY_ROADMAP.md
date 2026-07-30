# Onyx Academy — Estructura y roadmap (visión de negocio + AI)

Pensado en tres actores: **Onyx (tú)**, el **mentor** y el **estudiante**.

## 1. Estructura de acceso (quién ve qué)

**Usuario de Onyx Trading Live** (trader normal): usa el dashboard, Guardian, Copy, etc.
Onyx Academy le aparece en el menú, pero solo puede **entrar a una academia con
código/enlace/QR** — no hay directorio público (ya es privado).

**Estudiante** (usuario que se unió a una academia): ve la comunidad, aulas, calendario,
miembros, ranking, perfil y chat de ESA academia. Puede estar en varias.

**Mentor** (usuario con capacidad `academy` en su plan): además tiene el Panel del mentor
(aulas, en vivo, cobros, alumnos, comunidad, ajustes) y su propia comunidad.

**Onyx (dueño)**: Admin → Onyx Academy (comisiones por defecto y por mentor, perks,
métricas). La comisión de cada venta entra a tu Stripe automáticamente.

### Academy en los tabs de arriba
Regla propuesta: el tab "Academy" arriba se muestra a **quien esté dentro de al menos una
academia** o sea mentor. A un usuario suelto no le ocupa espacio. Gating por plan: ser
**mentor** requiere `capabilities.academy`; ser estudiante es libre (lo invita el mentor).

## 2. Membresía de pago (el gran cambio)

Hoy el gating es **por curso/nivel**. El modelo Skool que quieres es **membresía mensual
para entrar a la comunidad entera**. Propuesta:

- Cada academia elige: **Gratis** o **De pago** (precio mensual, ej. $99/mes).
- Si es de pago: unirse por código/QR lleva a la **landing de ventas** → Stripe Checkout
  (suscripción con `on_behalf_of` el mentor, tu comisión limpia) → acceso.
- Se mantiene la posibilidad de **niveles internos** (VIP, Bootcamp, Mentoría 1-a-1) como
  upsells por encima de la membresía base (exactamente como Golden: Regular $99, Elite VIP
  $997, Mentoría $2,500).
- Cancelación → se corta el acceso al fin del periodo (webhook ya lo soporta).

## 3. Landing de ventas del mentor (como Skool/Golden)

Página pública `/academia/[code]` convertida en **sales page**:
- **Video de presentación** o foto de portada + logo.
- Cabecera: "Privada · N miembros · desde $X/mes · por [Mentor]".
- Descripción larga (bullets de qué incluye), casos de éxito.
- **Niveles con precio** y botón **JOIN**.
- CTA de contacto (WhatsApp/enlace).
Editable desde Ajustes del mentor (video, portada, precio, bullets).

## 4. AI fundamental (tu diferenciador real)

**Copilot del mentor** (Onyx AI dentro del Panel):
- Genera **títulos, "about", descripciones** de la academia, cursos y lecciones.
- Redacta **posts** para la comunidad (anuncios, motivación, lección del día) y permite
  **programarlos** (scheduler).
- Sugiere estructura de curriculum a partir de un tema ("Curso de fundamentos en 6 clases").
- Redacta las **campañas de email**.

**Asistente del estudiante**: "Pregúntale a la IA sobre esta lección", resúmenes, quiz.

**Moderación con AI**: al subir foto a post/chat, se pasa por moderación de imagen; si es
contenido sexual/indebido, se **bloquea y no se publica**. Texto también (insultos/spam).

## 5. Campañas de email del mentor (ciclo de vida del alumno)

El mentor arma campañas con **schedule**, y Onyx dispara automáticos por evento:
- **Bienvenida** al unirse.
- **Inactividad** (X días sin entrar) → "te extrañamos".
- **Suscripción por expirar** / pago fallido → recuperación.
- **Recordatorio de clase en vivo** (24h y 1h antes).
- **Anuncios y promociones** del mentor (broadcast + programado).
Reutiliza tu infra de Resend + el motor de campañas que ya existe, segmentado por academia.

## 6. Contenido enriquecido en posts y chat
- Campos más grandes (hecho), **emojis** y **subida de fotos** (con moderación AI).
- Adjuntos, enlaces con preview, menciones.

## 7. Ideas para escalar (pensando a futuro)

- **Afiliados del mentor**: cada alumno tiene enlace de invitado; si trae pagos, el mentor
  (o Onyx) reparte comisión. Crecimiento viral dentro de cada academia.
- **Certificados** al completar un curso (PDF con sello Onyx). Gran retención.
- **Cohorts / retos** con fecha de inicio y leaderboard temporal.
- **Marketplace privado de traders verificados**: Onyx conecta capital con traders de
  track record real (tu dato exclusivo). Ingreso por matchmaking.
- **Planes de Onyx para mentores por tamaño**: gratis hasta N alumnos, luego mensualidad —
  además de tu % por transacción (doble ingreso, estilo Skool: plan + fee).
- **App móvil / push** de la academia (ya tienes web push): recordatorios de clase y posts.
- **IA que audita al alumno**: informe semanal automático de su trading para el mentor
  (Fase 2 del mentor que quedó pendiente) — nadie más lo tiene.

## Orden sugerido de construcción
1. **Membresía de pago + landing de ventas** (desbloquea ingresos recurrentes).
2. **Copilot AI del mentor** (títulos/about/descripciones + redactar posts).
3. **Posts/chat con emojis, fotos y moderación AI**.
4. **Scheduler de posts + campañas de email de ciclo de vida**.
5. **Certificados, afiliados y auditoría AI del alumno**.
