-- =====================================================================
-- Onyx Training · contenido inicial (5 rutas). Idempotente por IDs fijos.
-- Corre DESPUÉS de training_v1.sql. Se puede editar todo desde el panel.
-- =====================================================================

-- ---------------- RUTAS ----------------
insert into training_tracks (id, slug, title_es, title_en, summary_es, summary_en, icon, sort, required_for, pass_score, max_attempts, exam_count, cert_months, prereq_track_id, gate_leads, active) values
 ('a1000000-0000-4000-8000-000000000001','conectar-ea','Conectar los EA y solución de problemas','Connecting the EAs & troubleshooting','Instalar Onyx Connect, vincular la cuenta y resolver los fallos más comunes.','Install Onyx Connect, link the account and fix common issues.','link',1, '{vendedor,staff,support,instalador}',80,3,0,6,null,true,true),
 ('a1000000-0000-4000-8000-000000000002','configurar-cuenta','Configurar una cuenta de trading','Setting up a trading account','Dar de alta la cuenta, pegar la clave y verificar que sincroniza.','Create the account, paste the key and verify it syncs.','settings',2, '{vendedor,staff,support}',80,3,0,6,'a1000000-0000-4000-8000-000000000001',true,true),
 ('a1000000-0000-4000-8000-000000000003','usar-apps','Usar nuestras aplicaciones','Using our apps','Dashboard, Onyx Guardian, Copy y Mis robots: qué hace cada uno.','Dashboard, Onyx Guardian, Copy and My robots: what each does.','performance',3, '{vendedor,staff,support}',80,3,0,0,'a1000000-0000-4000-8000-000000000002',false,true),
 ('a1000000-0000-4000-8000-000000000004','la-academia','La Academia: cómo funciona y cómo venderla','The Academy: how it works and how to sell it','Membresías, mentores y beneficios que puedes explicar a un cliente.','Memberships, mentors and perks you can explain to a client.','graduation',4, '{vendedor,staff}',80,3,0,0,null,false,true),
 ('a1000000-0000-4000-8000-000000000005','ventas-comisiones','Ventas, comisiones y atención al cliente','Sales, commissions and support','Cómo cobras, qué ve el cliente y cómo dar un buen servicio.','How you get paid, what the client sees and good service.','money',5, '{vendedor}',80,3,0,0,null,true,true)
on conflict (id) do nothing;

-- ---------------- LECCIONES ----------------
insert into training_lessons (id, track_id, title_es, title_en, body_es, sort) values
 -- Ruta 1: Conectar EA
 ('b1000000-0000-4000-8001-000000000001','a1000000-0000-4000-8000-000000000001','¿Qué es Onyx Connect?','What is Onyx Connect?',
  'Onyx Connect es nuestro EA (Expert Advisor) que se instala en MetaTrader 4/5 o el cBot en cTrader. Sirve para dos cosas:\n- Sincronizar la cuenta con la plataforma (para ver estadísticas, robots y el reto).\n- Activar Onyx Guardian y la copia de operaciones.\n\nUn solo EA cubre todo: el usuario no necesita instalar varios.',1),
 ('b1000000-0000-4000-8001-000000000002','a1000000-0000-4000-8000-000000000001','Instalación paso a paso (MT4/MT5)','Step-by-step install (MT4/MT5)',
  '1. Descarga el EA desde la página de instalación de la cuenta.\n2. En MetaTrader abre: Archivo → Abrir carpeta de datos.\n3. Copia el archivo .ex5 (MT5) o .ex4 (MT4) en MQL5/Experts (o MQL4/Experts).\n4. Reinicia MetaTrader.\n5. Arrastra "Onyx Connect" a un gráfico cualquiera.\n6. Activa "AutoTrading" (botón verde arriba).\n7. En Opciones → Expert Advisors marca "Permitir WebRequest" y agrega la URL que indica la guía.',2),
 ('b1000000-0000-4000-8001-000000000003','a1000000-0000-4000-8000-000000000001','Vincular con la clave','Linking with the key',
  'Cada cuenta tiene una clave única. En los parámetros del EA (pestaña Inputs) se pega la clave y el número de cuenta.\n- La clave ata el EA a ESA cuenta: si el número no coincide, el EA no sincroniza (es una protección, no un error).\n- Cuando conecta, el panel del EA muestra en verde "Conectado".',3),
 ('b1000000-0000-4000-8001-000000000004','a1000000-0000-4000-8000-000000000001','Solución de problemas (troubleshooting)','Troubleshooting',
  'Si no conecta, revisa en este orden:\n- AutoTrading apagado: enciende el botón verde de MetaTrader.\n- Cara triste en la esquina del gráfico: el EA no tiene permiso de operar; vuelve a arrastrarlo y acepta el diálogo.\n- "WebRequest not allowed": falta la URL en Opciones → Expert Advisors → Permitir WebRequest.\n- No sincroniza pero conecta: revisa que el número de cuenta pegado coincida exactamente con el de la plataforma.\n- Sin conexión a internet o VPS caído: comprueba que la terminal tiene señal (barra abajo a la derecha).\n- Sufijos en símbolos (EURUSD.m): el EA los detecta solo; si falla, revisa la tabla de símbolos en la nube.',4)
on conflict (id) do nothing;

insert into training_lessons (id, track_id, title_es, title_en, body_es, sort) values
 -- Ruta 2: Configurar cuenta
 ('b1000000-0000-4000-8002-000000000001','a1000000-0000-4000-8000-000000000002','Dar de alta la cuenta','Creating the account',
  'En "Conectar cuenta" el usuario elige primero la plataforma (MT4, MT5 o cTrader) y luego el bróker o prop firm. Después registra el número de cuenta. El sistema genera la clave que se pega en el EA.',1),
 ('b1000000-0000-4000-8002-000000000002','a1000000-0000-4000-8000-000000000002','Límite de cuentas por plan','Accounts per plan',
  'Cada plan permite un número de cuentas. Si el usuario necesita más, existe el add-on de cuentas extra. Antes de conectar, verifica que no haya llegado a su límite; si llega, ofrécele subir de plan o el add-on.',2),
 ('b1000000-0000-4000-8002-000000000003','a1000000-0000-4000-8000-000000000002','Verificar que sincroniza','Verify it syncs',
  'Tras pegar la clave y activar AutoTrading, en el dashboard debe aparecer la cuenta con su balance y operaciones. Si dice "AutoTrading apagado", es un aviso: la cuenta está conectada pero el EA no puede operar hasta encender el botón verde.',3)
on conflict (id) do nothing;

insert into training_lessons (id, track_id, title_es, title_en, body_es, sort) values
 -- Ruta 3: Usar apps
 ('b1000000-0000-4000-8003-000000000001','a1000000-0000-4000-8000-000000000003','El Dashboard','The Dashboard',
  'Es la cabina: estadísticas en vivo, rendimiento, costos, ganancia neta y el reto de prop firm. Se actualiza solo. Cada cuenta puede tener un apodo para reconocerla.',1),
 ('b1000000-0000-4000-8003-000000000002','a1000000-0000-4000-8000-000000000003','Onyx Guardian','Onyx Guardian',
  'Es el protector de la cuenta: aplica límites de riesgo (pérdida máxima, drawdown) y puede frenar la operativa. Se activa desde el gestor y se refleja en el panel del EA. No es solo "sincronizar": hay que ACTIVARLO.',2),
 ('b1000000-0000-4000-8003-000000000003','a1000000-0000-4000-8000-000000000003','Copy y Mis robots','Copy and My robots',
  'Copy: replica operaciones de una cuenta maestra a esclavas, con filtros de riesgo. Mis robots: agrupa por cuenta y magic number, muestra estados (operando, en espera, detenido) y KPIs de cada robot.',3)
on conflict (id) do nothing;

insert into training_lessons (id, track_id, title_es, title_en, body_es, sort) values
 -- Ruta 4: La Academia
 ('b1000000-0000-4000-8004-000000000001','a1000000-0000-4000-8000-000000000004','Qué es Onyx Academy','What Onyx Academy is',
  'Es la plataforma de formación estilo comunidad: cursos, clases en vivo, comunidad y certificados. Los mentores pueden crear su propia academia; nosotros ofrecemos la oficial.',1),
 ('b1000000-0000-4000-8004-000000000002','a1000000-0000-4000-8000-000000000004','Membresías y beneficios','Memberships and perks',
  'Hay membresías de pago (mensual/anual) con acceso a cursos, comunidad y, según el nivel, beneficios VIP como Copy o Guardian incluidos. Explica al cliente el valor: formación + herramientas en un solo lugar.',2)
on conflict (id) do nothing;

insert into training_lessons (id, track_id, title_es, title_en, body_es, sort) values
 -- Ruta 5: Ventas y comisiones
 ('b1000000-0000-4000-8005-000000000001','a1000000-0000-4000-8000-000000000005','Cómo ganas comisión','How you earn commission',
  'Cada cliente que traes queda atado a ti de por vida. Ganas un porcentaje de sus pagos según tu nivel (Asesor, Lead, Director). El extracto de tu panel muestra cada comisión y su estado (pendiente, disponible, pagada).',1),
 ('b1000000-0000-4000-8005-000000000002','a1000000-0000-4000-8000-000000000005','Pruebas y descuentos sin abuso','Trials and discounts, no abuse',
  'Puedes dar pruebas y descuentos, pero hay candados: máximo por cliente, tope de días gratis y un límite diario. Los descuentos afectan la ganancia, así que úsalos con criterio.',2),
 ('b1000000-0000-4000-8005-000000000003','a1000000-0000-4000-8000-000000000005','Atención al cliente','Customer service',
  'Un buen servicio retiene clientes: responde rápido, ayuda con la conexión del EA y usa la Guía. Tus clientes ven tu página personal (/v/tu-código) donde apareces como su asesor.',3)
on conflict (id) do nothing;

-- ---------------- PREGUNTAS (examen) ----------------
insert into training_questions (id, track_id, prompt_es, options_es, correct, explain_es, sort) values
 ('c1000000-0000-4000-8001-000000000001','a1000000-0000-4000-8000-000000000001','¿Cuántos EA necesita instalar el usuario para sincronizar y usar Guardian/Copy?','["Uno solo (Onyx Connect)","Uno por cada función","Ninguno, es automático","Tres EA distintos"]'::jsonb,0,'Un solo EA cubre todo.',1),
 ('c1000000-0000-4000-8001-000000000002','a1000000-0000-4000-8000-000000000001','El EA conecta pero no sincroniza la cuenta. ¿Qué revisas primero?','["Que el número de cuenta pegado coincida","Reinstalar Windows","Cambiar de bróker","Nada, es normal"]'::jsonb,0,'La clave ata el EA a esa cuenta; si el número no coincide, no sincroniza.',2),
 ('c1000000-0000-4000-8001-000000000003','a1000000-0000-4000-8000-000000000001','Aparece "WebRequest not allowed". ¿Qué falta?','["Agregar la URL en Permitir WebRequest","Pagar el plan","Un segundo monitor","Reiniciar el router"]'::jsonb,0,'Hay que habilitar la URL en Opciones → Expert Advisors.',3),
 ('c1000000-0000-4000-8001-000000000004','a1000000-0000-4000-8000-000000000001','El botón AutoTrading está en rojo. ¿Qué significa?','["El EA no puede operar hasta activarlo","La cuenta está baneada","El internet está caído","El EA está actualizado"]'::jsonb,0,'AutoTrading debe estar en verde.',4)
on conflict (id) do nothing;

insert into training_questions (id, track_id, prompt_es, options_es, correct, explain_es, sort) values
 ('c1000000-0000-4000-8002-000000000001','a1000000-0000-4000-8000-000000000002','¿Qué se elige primero al conectar una cuenta?','["La plataforma (MT4/MT5/cTrader)","El color del tema","El idioma","La contraseña del bróker"]'::jsonb,0,'Primero la plataforma, luego el bróker.',1),
 ('c1000000-0000-4000-8002-000000000002','a1000000-0000-4000-8000-000000000002','El usuario llegó al límite de cuentas de su plan. ¿Qué ofreces?','["Subir de plan o el add-on de cuentas","Borrar sus operaciones","Otra cuenta gratis siempre","Nada se puede hacer"]'::jsonb,0,'Existe el add-on de cuentas extra o subir de plan.',2),
 ('c1000000-0000-4000-8002-000000000003','a1000000-0000-4000-8000-000000000002','El dashboard dice "AutoTrading apagado". ¿Está mal conectada la cuenta?','["No; está conectada, solo falta encender AutoTrading","Sí, hay que reinstalar","Sí, la clave es inválida","Sí, cambió de bróker"]'::jsonb,0,'Es un aviso, no un error de conexión.',3)
on conflict (id) do nothing;

insert into training_questions (id, track_id, prompt_es, options_es, correct, explain_es, sort) values
 ('c1000000-0000-4000-8003-000000000001','a1000000-0000-4000-8000-000000000003','¿Para qué sirve Onyx Guardian?','["Aplicar límites de riesgo y frenar la operativa","Enviar correos","Crear robots nuevos","Cambiar el idioma"]'::jsonb,0,'Es el protector de riesgo de la cuenta.',1),
 ('c1000000-0000-4000-8003-000000000002','a1000000-0000-4000-8000-000000000003','¿Basta con que el EA sincronice para tener Guardian activo?','["No, hay que activar Guardian aparte","Sí, es automático","Solo en MT5","Solo con plan Black"]'::jsonb,0,'Sincronizar no es lo mismo que activar Guardian.',2),
 ('c1000000-0000-4000-8003-000000000003','a1000000-0000-4000-8000-000000000003','En "Mis robots", ¿cómo se agrupan los robots?','["Por cuenta y magic number","Por color","Por fecha de pago","Al azar"]'::jsonb,0,'Se agrupan por cuenta y magic, con estados y KPIs.',3)
on conflict (id) do nothing;

insert into training_questions (id, track_id, prompt_es, options_es, correct, explain_es, sort) values
 ('c1000000-0000-4000-8004-000000000001','a1000000-0000-4000-8000-000000000004','¿Un mentor puede crear su propia academia?','["Sí, además de la oficial de Onyx","No, solo existe una","Solo si es empleado","Solo en inglés"]'::jsonb,0,'Los mentores crean sus academias; la formación interna es aparte.',1),
 ('c1000000-0000-4000-8004-000000000002','a1000000-0000-4000-8000-000000000004','¿Qué valor destacas de una membresía al cliente?','["Formación y herramientas en un solo lugar","Solo el precio","Que es gratis siempre","Nada en particular"]'::jsonb,0,'El valor es formación + herramientas juntas.',2)
on conflict (id) do nothing;

insert into training_questions (id, track_id, prompt_es, options_es, correct, explain_es, sort) values
 ('c1000000-0000-4000-8005-000000000001','a1000000-0000-4000-8000-000000000005','¿Por cuánto tiempo queda atado a ti un cliente que traes?','["De por vida","Un mes","Una semana","Hasta que renueve"]'::jsonb,0,'La atribución es de por vida.',1),
 ('c1000000-0000-4000-8005-000000000002','a1000000-0000-4000-8000-000000000005','¿Los descuentos afectan tu ganancia?','["Sí, por eso hay que usarlos con criterio","No, nunca","Solo los martes","Solo en plan Black"]'::jsonb,0,'El descuento reduce la base de comisión.',2),
 ('c1000000-0000-4000-8005-000000000003','a1000000-0000-4000-8000-000000000005','¿Dónde ve el cliente que eres su asesor?','["En tu página personal /v/tu-código","En la bolsa","En su bróker","En ningún lado"]'::jsonb,0,'Tu página personal te muestra como su asesor.',3)
on conflict (id) do nothing;

-- Copiar opciones EN = ES cuando estén vacías (para bilingüe sin duplicar trabajo).
update training_questions set options_en = options_es where options_en = '[]'::jsonb or options_en is null;
update training_questions set prompt_en = prompt_es where prompt_en = '' or prompt_en is null;
update training_lessons  set body_en   = body_es   where body_en   = '' or body_en   is null;
update training_lessons  set title_en  = title_es  where title_en  = '' or title_en  is null;
