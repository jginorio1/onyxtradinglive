# Red de Ventas · Desempeño + Atención + Reseñas + Evaluaciones (v530)

## 1) Base de datos (Supabase → SQL Editor)
Corre **una vez**, en orden, lo que aún no hayas corrido:
1. `supabase/sales_v4.sql`  (si no lo habías corrido: columna del CV + bucket `sales-cv`)
2. `supabase/sales_v5.sql`  ← **NUEVO** (reseñas, evaluaciones, bitácora de acciones, permisos por rep)

## 2) Desplegar
Sube el código a Vercel (deploy normal). No hay variables de entorno nuevas.
La IA del plan de manejo usa la misma `ANTHROPIC_API_KEY` que ya tienes; si falta, cae a
recomendaciones por reglas (no se rompe nada).

## 3) Qué se agregó

### Nombres de las posiciones (en inglés, por defecto)
Director → Lead → Advisor. Se editan en **Admin → Ventas → Ajustes**.

### Cómo crear vendedores y darles permisos
- **Admin → Ventas → La red**: “Añadir representante” (por correo, debe tener cuenta) o aprueba
  una solicitud en la pestaña **Solicitudes**.
- En cada tarjeta de rep, botón **Editar → Permisos personalizados**: activa/desactiva por rep
  (dar pruebas, descuentos, gestionar clientes, atender tickets, reclutar, ver equipo).
  Si no personalizas, hereda los permisos por defecto del nivel (editables en Ajustes).

### Sobre qué servicios cobra el equipo (Ajustes → “Sobre qué servicios se paga comisión”)
Por defecto: Suscripciones + Add-ons + Guardian **activados**; Academia, Bot Lab y Copy
**apagados** (esos ya pagan a mentores/creadores). Son interruptores.

### Desempeño (Admin → Ventas → Desempeño)
Tablero con tarjetas de color por tier (Estrella / Sólido / En riesgo), anillo de puntaje 0-100,
y por rep: clientes activos, conversión de pruebas, tickets abiertos, tiempo de respuesta,
comisión y disponible. Click en **“Ver desempeño + IA”** abre el detalle con:
- Lectura de la IA (veredicto + resumen + acciones sugeridas) — **la IA recomienda, tú decides**.
- Desglose del puntaje (reseñas, conversión, actividad, atención, retención).
- Reseñas de clientes, evaluaciones 360 y bitácora.
- Botones del **plan de manejo**: Felicitar, Coaching, Advertir, Pausar/Reanudar pagos,
  Ascender, Bajar nivel (todo queda registrado).

### Reseñas de clientes (internas)
El cliente ve una tarjeta en **Mi cuenta** (“¿Cómo te atendió tu asesor?”) después de N días
(configurable en Ajustes). Solo las ven el **supervisor** de ese vendedor y **tú (admin)**.

### Evaluaciones 360
- El **supervisor** evalúa a su equipo y el **vendedor** evalúa a su supervisor, desde el panel
  del vendedor → pestaña **Evaluar**. Criterios editables en Ajustes.
- Tú (admin) también puedes evaluar a cualquiera desde el detalle del rep.

### Panel del vendedor (nuevo)
- **Mi desempeño**: su tarjeta, puntaje, reseñas recibidas y un botón “Generar consejo” (IA).
- **Evaluar**: evaluar a su supervisor y/o a su equipo.

## 4) El “plan de manejo” según las evaluaciones (resumen)
- **Estrella (≥75):** reconocer, considerar ascenso, darle más cuentas/mentoría.
- **Sólido:** mantener, fijar meta para subir a Estrella.
- **En riesgo (<45):** plan de mejora a 30 días, coaching, seguimiento; si no mejora, pausar/bajar.
Los umbrales (75 / 45) se editan en Ajustes.
