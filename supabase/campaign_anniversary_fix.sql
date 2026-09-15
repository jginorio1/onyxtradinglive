-- ============================================================
-- Arregla el CTA del correo de Aniversario: ya no manda a /pricing (página de
-- venta) a un cliente que lleva un año. Ahora es un gracias cálido → /dashboard.
-- Solo toca la campaña si SIGUE con el texto por defecto (contiene /pricing),
-- para no pisar un copy que el dueño haya editado a mano. Idempotente.
-- ============================================================
update campaigns
set
  body_es = 'Hola {{nombre}},

Hoy cumples un año más con Onyx Trading Live. Gracias de corazón por confiar en nosotros para cuidar tu trading todo este tiempo.

Seguimos aquí para lo que necesites. Tu panel te espera:
{{sitio}}/dashboard

— Equipo de Onyx',
  body_en = 'Hi {{nombre}},

Today marks another year with Onyx Trading Live. Thank you from the heart for trusting us to look after your trading all this time.

We''re here for whatever you need. Your dashboard is waiting:
{{sitio}}/dashboard

— The Onyx team'
where key = 'anniversary'
  and (body_es like '%/pricing%' or body_en like '%/pricing%');
