-- =====================================================================
-- Onyx Training · v2 — integridad de examen + escalado + arreglo de saltos.
-- Corre DESPUÉS de training_v1.sql y training_seed.sql. Idempotente.
-- =====================================================================

-- Integridad: guardamos IP, navegador y la atestación al enviar el examen.
alter table training_attempts add column if not exists ip text;
alter table training_attempts add column if not exists user_agent text;
alter table training_attempts add column if not exists attested boolean not null default false;

-- Nivel de aviso de vencimiento ya enviado (para el escalado del cron).
alter table training_certificates add column if not exists remind_level int not null default 0;

-- Arreglo: el seed v1 guardó "\n" literal en el cuerpo de las lecciones (las
-- comillas simples de SQL no interpretan el escape). Los convertimos a saltos
-- reales. Seguro de re-ejecutar.
update training_lessons set body_es = replace(body_es, '\n', chr(10)) where body_es like '%\n%';
update training_lessons set body_en = replace(body_en, '\n', chr(10)) where body_en like '%\n%';
