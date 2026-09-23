-- =====================================================================
-- Onyx Training · banco de preguntas ampliado (5 más por ruta = ~9 c/u).
-- Corre DESPUÉS de training_seed.sql. Idempotente (IDs fijos).
-- Con más preguntas + "Preguntas al azar" en la ficha, cada examen es distinto.
-- =====================================================================

-- ---- Ruta 1: Conectar EA ----
insert into training_questions (id, track_id, prompt_es, options_es, correct, explain_es, sort) values
 ('c2000000-0000-4000-8001-000000000001','a1000000-0000-4000-8000-000000000001','¿Dónde se copia el archivo del EA en MetaTrader?','["En MQL5/Experts (o MQL4/Experts)","En el escritorio","En la carpeta de descargas","En Documentos"]'::jsonb,0,'Archivo → Abrir carpeta de datos → MQL5/Experts.',5),
 ('c2000000-0000-4000-8001-000000000002','a1000000-0000-4000-8000-000000000001','Una carita triste en la esquina del gráfico significa que…','["El EA no tiene permiso de operar","La cuenta perdió dinero","El mercado está cerrado","El bróker está caído"]'::jsonb,0,'Vuelve a arrastrar el EA y acepta el diálogo de permisos.',6),
 ('c2000000-0000-4000-8001-000000000003','a1000000-0000-4000-8000-000000000001','El símbolo aparece como EURUSD.m con sufijo. ¿Qué hace el EA?','["Lo detecta automáticamente","Se detiene siempre","Pide cambiar de bróker","Ignora el símbolo"]'::jsonb,0,'Detecta sufijos solo; si falla, se revisa la tabla de símbolos en la nube.',7),
 ('c2000000-0000-4000-8001-000000000004','a1000000-0000-4000-8000-000000000001','¿Qué NO hace Onyx Connect?','["Retirar dinero de la cuenta","Sincronizar estadísticas","Activar Guardian","Habilitar la copia"]'::jsonb,0,'El EA solo sincroniza y habilita Guardian/Copy; nunca mueve fondos.',8),
 ('c2000000-0000-4000-8001-000000000005','a1000000-0000-4000-8000-000000000001','El panel del EA muestra "Conectado" en verde. ¿Qué significa?','["El EA está enlazado con la cuenta","Ganaste una operación","El plan se renovó","El VPS se reinició"]'::jsonb,0,'Verde = enlace correcto con la cuenta.',9)
on conflict (id) do nothing;

-- ---- Ruta 2: Configurar cuenta ----
insert into training_questions (id, track_id, prompt_es, options_es, correct, explain_es, sort) values
 ('c2000000-0000-4000-8002-000000000001','a1000000-0000-4000-8000-000000000002','¿Qué genera el sistema al registrar el número de cuenta?','["La clave que se pega en el EA","Una factura","Un contrato","Un cupón"]'::jsonb,0,'La clave ata el EA a esa cuenta.',4),
 ('c2000000-0000-4000-8002-000000000002','a1000000-0000-4000-8000-000000000002','Si el usuario quiere conectar más cuentas de las que permite su plan…','["Ofreces el add-on o subir de plan","Le dices que no se puede","Borras una cuenta vieja sin avisar","Cambias su contraseña"]'::jsonb,0,'Add-on de cuentas extra o upgrade.',5),
 ('c2000000-0000-4000-8002-000000000003','a1000000-0000-4000-8000-000000000002','¿En qué orden se conecta una cuenta?','["Plataforma → bróker/firm → número de cuenta","Número → plataforma → color","Contraseña → plan → bróker","Idioma → cuenta → tema"]'::jsonb,0,'Primero la plataforma, luego el bróker y el número.',6),
 ('c2000000-0000-4000-8002-000000000004','a1000000-0000-4000-8000-000000000002','La cuenta aparece en el dashboard con su balance. Eso indica que…','["Sincroniza correctamente","Hay un error","El EA se borró","La clave caducó"]'::jsonb,0,'Ver balance y operaciones = sincroniza bien.',7),
 ('c2000000-0000-4000-8002-000000000005','a1000000-0000-4000-8000-000000000002','El aviso "AutoTrading apagado" se resuelve…','["Encendiendo el botón verde en MetaTrader","Reinstalando la app","Cambiando de plan","Esperando 24 horas"]'::jsonb,0,'Es solo el botón verde de AutoTrading.',8)
on conflict (id) do nothing;

-- ---- Ruta 3: Usar apps ----
insert into training_questions (id, track_id, prompt_es, options_es, correct, explain_es, sort) values
 ('c2000000-0000-4000-8003-000000000001','a1000000-0000-4000-8000-000000000003','¿Qué muestra el Dashboard?','["Estadísticas, rendimiento, costos y el reto","Solo el saldo","Solo noticias","Solo el chat"]'::jsonb,0,'Es la cabina con todo en vivo.',4),
 ('c2000000-0000-4000-8003-000000000002','a1000000-0000-4000-8000-000000000003','¿Qué hace la copia (Copy)?','["Replica operaciones de una maestra a esclavas","Crea robots","Cambia el tema","Envía correos"]'::jsonb,0,'Copia con filtros de riesgo.',5),
 ('c2000000-0000-4000-8003-000000000003','a1000000-0000-4000-8000-000000000003','¿Para qué sirve poner un apodo a la cuenta?','["Para reconocerla fácil","Para operar más rápido","Para bajar comisiones","Para cambiar de bróker"]'::jsonb,0,'Ayuda a identificarla en el panel.',6),
 ('c2000000-0000-4000-8003-000000000004','a1000000-0000-4000-8000-000000000003','En "Mis robots", los estados posibles incluyen…','["Operando, en espera y detenido","Rojo, azul y verde","Gratis y pago","Nuevo y viejo"]'::jsonb,0,'Tres estados por robot.',7),
 ('c2000000-0000-4000-8003-000000000005','a1000000-0000-4000-8000-000000000003','El Guardian se activa desde…','["El gestor, y se refleja en el panel del EA","El bróker","La App Store","El correo"]'::jsonb,0,'Se activa en el gestor; no basta con sincronizar.',8)
on conflict (id) do nothing;

-- ---- Ruta 4: La Academia ----
insert into training_questions (id, track_id, prompt_es, options_es, correct, explain_es, sort) values
 ('c2000000-0000-4000-8004-000000000001','a1000000-0000-4000-8000-000000000004','La Academia estilo comunidad incluye…','["Cursos, clases en vivo, comunidad y certificados","Solo videos","Solo un chat","Solo un PDF"]'::jsonb,0,'Plataforma de formación completa.',3),
 ('c2000000-0000-4000-8004-000000000002','a1000000-0000-4000-8000-000000000004','Según el nivel de membresía, el cliente puede recibir…','["Beneficios VIP como Copy o Guardian incluidos","Dinero en efectivo","Una laptop","Acciones de la empresa"]'::jsonb,0,'Perks VIP según el nivel.',4),
 ('c2000000-0000-4000-8004-000000000003','a1000000-0000-4000-8000-000000000004','Las membresías de pago suelen ser…','["Mensuales o anuales","Solo de por vida","Solo gratuitas","Solo semanales"]'::jsonb,0,'Mensual o anual.',5),
 ('c2000000-0000-4000-8004-000000000004','a1000000-0000-4000-8000-000000000004','La formación interna del equipo respecto a las academias de mentores está…','["Aislada, no las afecta","Mezclada con ellas","Publicada en el directorio","A cargo de los mentores"]'::jsonb,0,'El área interna es aparte.',6),
 ('c2000000-0000-4000-8004-000000000005','a1000000-0000-4000-8000-000000000004','¿Cómo resumirías el valor de la Academia a un cliente?','["Formación y herramientas en un solo lugar","Solo entretenimiento","Un regalo puntual","Un descuento temporal"]'::jsonb,0,'Formación + herramientas juntas.',7)
on conflict (id) do nothing;

-- ---- Ruta 5: Ventas y comisiones ----
insert into training_questions (id, track_id, prompt_es, options_es, correct, explain_es, sort) values
 ('c2000000-0000-4000-8005-000000000001','a1000000-0000-4000-8000-000000000005','Tu comisión depende de…','["Tu nivel (Asesor, Lead, Director)","El clima","El color de tu página","La hora del día"]'::jsonb,0,'El % va por nivel.',4),
 ('c2000000-0000-4000-8005-000000000002','a1000000-0000-4000-8000-000000000005','Los estados de una comisión en tu extracto son…','["Pendiente, disponible y pagada","Roja, verde y azul","Nueva y vieja","Gratis y pago"]'::jsonb,0,'Tres estados en el extracto.',5),
 ('c2000000-0000-4000-8005-000000000003','a1000000-0000-4000-8000-000000000005','Los candados de pruebas y descuentos existen para…','["Evitar el abuso","Subir comisiones","Bloquear clientes","Cambiar de plan"]'::jsonb,0,'Máximo por cliente, tope de días y límite diario.',6),
 ('c2000000-0000-4000-8005-000000000004','a1000000-0000-4000-8000-000000000005','Un buen servicio al cliente ayuda sobre todo a…','["Retener clientes","Pagar menos impuestos","Cerrar la cuenta","Bajar el precio"]'::jsonb,0,'Retención = ingresos recurrentes.',7),
 ('c2000000-0000-4000-8005-000000000005','a1000000-0000-4000-8000-000000000005','Ante un cliente con problemas para conectar el EA, lo mejor es…','["Ayudarlo y usar la Guía","Ignorarlo","Pedirle su contraseña","Cerrar su cuenta"]'::jsonb,0,'Acompañarlo con la Guía.',8)
on conflict (id) do nothing;

-- Copiar EN = ES cuando falten (bilingüe sin duplicar trabajo).
update training_questions set options_en = options_es where options_en = '[]'::jsonb or options_en is null;
update training_questions set prompt_en  = prompt_es  where prompt_en  = '' or prompt_en  is null;

-- Activar barajado de preguntas: cada examen toma 5 al azar del banco.
update training_tracks set exam_count = 5 where exam_count = 0 and slug in ('conectar-ea','configurar-cuenta','usar-apps','la-academia','ventas-comisiones');
