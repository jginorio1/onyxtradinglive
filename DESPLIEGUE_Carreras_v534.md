# Plazas disponibles / Carreras (v534)

Página pública **/carreras** con las vacantes, bonita y bilingüe (ES/EN), que
configuras desde **Admin → Carreras** (en el grupo de Equipo). Los candidatos se
postulan con su CV en PDF.

## 1) Base de datos
Corre en Supabase (SQL Editor): **`supabase/careers_v1.sql`** (tablas
`job_openings` y `job_applications` + ajustes + bucket privado `careers-cv`).

## 2) Desplegar
Deploy normal en Vercel. Sin variables nuevas.

## 3) Cómo se usa (Admin → Carreras)
- **Plazas → + Nueva plaza**: título, área, tipo (tiempo completo/medio/contrato/
  prácticas), ubicación, rango salarial (opcional), resumen (sale en la tarjeta),
  descripción completa, etiquetas y estado (Publicada / Borrador / Cerrada).
- **Publicar/Cerrar** con un clic; ordena con el campo "Orden".
- **Postulaciones**: ves cada candidato con su **CV** (enlace firmado) y le cambias
  el estado (Nueva → En revisión → Entrevista → Contratado / Descartado).
- **Ajustes**: título/subtítulo de la página (ES y EN), activarla, y cómo se
  postulan: **Formulario en la app con CV** (recomendado), enviar **correo**, o
  **enlace externo**.

## 4) La página pública
En **/carreras**: hero con tu título, contador de plazas, **filtro por área**, y
**tarjetas** por vacante (área con color, ubicación, tipo, salario, etiquetas).
Al abrir una plaza ve la descripción y el botón **Postularme** con formulario + CV.
Cada postulación te llega a Admin → Carreras y te avisa por correo (a la dirección
de soporte/rrhh configurada en Direcciones de correo).

## 5) Enlazarla desde tu landing
La página vive en `/carreras`. Si quieres, te agrego un botón/sección
"Trabaja con nosotros" en el landing principal o en el pie de página que lleve ahí
(dime y lo hago). El enlace también está copiable desde el panel.
