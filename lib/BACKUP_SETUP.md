# Copias de seguridad — cómo dejarlo listo

Tu app trae dos formas de backup:

## 1. Exportación manual (ya funciona)
En **Admin → Copias de seguridad** tienes:
- **Exportar todo (JSON)** — descarga todos los datos (usuarios, cuentas, operaciones, tickets…).
- **Operaciones (CSV)** — descarga las operaciones en una hoja de cálculo.

No necesita configurar nada. Solo lo ve el Owner.

## 2. Backup automático semanal (requiere 6 secretos, una sola vez)

El archivo `.github/workflows/backup.yml` hace un volcado comprimido de la base de datos cada domingo y lo sube a tu almacén. Para activarlo:

1. Crea una cuenta gratuita en **Backblaze B2** (10 GB gratis) y un **bucket** privado. Genera una **Application Key** (te da `keyID` y `applicationKey`).
2. En tu repositorio de GitHub → **Settings → Secrets and variables → Actions → New repository secret**, crea:

   | Secreto | De dónde sale |
   |---|---|
   | `DATABASE_URL` | Supabase → Project Settings → Database → Connection string → **URI (Direct connection, puerto 5432)** |
   | `B2_KEY_ID` | Backblaze → tu Application Key (keyID) |
   | `B2_APP_KEY` | Backblaze → tu Application Key (applicationKey) |
   | `B2_BUCKET` | El nombre de tu bucket |
   | `APP_URL` | `https://www.onyxtradinglive.com` |
   | `CRON_SECRET` | El mismo valor que ya tienes en Vercel |

3. Ve a la pestaña **Actions → Backup → Run workflow** para probarlo. Si sale verde, la fecha aparecerá en **Admin → Copias de seguridad**.

> ¿Prefieres AWS S3, Google Drive o similar? Cambia solo el paso "Subir a Backblaze B2" del workflow por tu proveedor. Todo lo demás queda igual.

## Recomendado
- Sube Supabase a **plan Pro** (backups diarios, 7 días de retención).
- Deja el backup automático semanal como copia **fuera** de Supabase.
- **Prueba una restauración** una vez para confirmar que el volcado sirve.
- Guarda aparte (en un gestor de contraseñas) la lista de **variables de entorno** de Vercel: no entran en ningún backup.
