# Montar la base de BETA — método profesional (snapshot + restore)

**Idea clave:** no se re-ejecutan las migraciones desde cero. Se toma una **copia
del esquema de producción** (que ya está bien) y se **restaura** en la beta.
Postgres exporta todo en orden de dependencias, así que **no hay errores de orden**.

`supabase/_SETUP_ALL.sql` queda solo como **referencia/histórico**, no como forma
de montar la base.

---

## Opción A — "Restore to a new project" (la más simple, cero SQL) ✅ recomendada

1. Supabase → proyecto **onyx-prod** → **Database → Backups**.
2. Elige un backup reciente y usa **Restore to a new project** (restaurar a un
   proyecto nuevo). Nómbralo **onyx-beta**.
3. Espera a que termine. Ya tienes beta con el **mismo esquema exacto** que prod.
4. **Vacía los datos personales** de beta (privacidad) — deja las tablas de
   catálogo/planes, borra usuarios reales. Ejemplo mínimo:
   ```sql
   -- en la BETA, no en prod
   truncate table trades, trading_accounts, api_keys,
     academy_purchases, tickets, notifications restart identity cascade;
   delete from auth.users where email <> 'jerryx35@gmail.com';
   ```
5. Copia `URL`, `anon key` y `service_role key` de beta (Settings → API) a las
   variables de Vercel-beta.

> Si tu plan de Supabase no muestra "Restore to a new project", usa la Opción B.

---

## Opción B — `supabase db dump` (un comando, respaldo de A)

Necesitas la [Supabase CLI](https://supabase.com/docs/reference/cli/introduction)
y las cadenas de conexión de prod y beta (Settings → Database → Connection string).

```bash
# 1) exportar SOLO el esquema de prod (orden de dependencias automático)
supabase db dump --db-url "postgresql://postgres:PASS@db.ONYX-PROD.supabase.co:5432/postgres" \
  -f schema.sql

# 2) (opcional) exportar datos SOLO de tablas de catálogo/planes
supabase db dump --db-url "postgresql://...PROD..." --data-only \
  --schema public -f seed.sql   # luego recorta a mano lo que no quieras

# 3) cargar el esquema en la beta ya creada (vacía)
psql "postgresql://postgres:PASS@db.ONYX-BETA.supabase.co:5432/postgres" -f schema.sql
```

`pg_dump` (lo que usa `db dump`) ordena `create table` por dependencias, así que
tablas como `ambassadors` se crean **antes** de quien las referencia. Fin de los
errores tipo *relation "X" does not exist*.

---

## Después de montar beta (ambas opciones)

- `NEXT_PUBLIC_APP_ENV=beta` en Vercel-beta (muestra la franja de pruebas).
- Stripe **test** + webhook a la URL de beta.
- Bot de Telegram **separado** para beta.
- Prueba: un registro + un pago test + una sync de EA en beta antes de tocar prod.

## Cada vez que saques algo nuevo con SQL

1. Corre la SQL nueva **en beta**, prueba.
2. Cuando esté bien, corre **la misma SQL en prod**.
3. Guarda ese punto como *stable* (`git tag stable-vNN`).

Así nunca vuelves a montar desde cero: prod es siempre la fuente de verdad y beta
se refresca con un restore cuando lo necesites.
