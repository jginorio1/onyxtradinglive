# Sistema de auditoría — cómo dejarlo listo

Tu app ahora trae una auditoría automática que corre en **GitHub Actions** en cada
despliegue y muestra el resultado en **Admin → Auditoría**.

## Qué revisa
- **Lighthouse** — velocidad (Rendimiento), Accesibilidad, SEO y Buenas prácticas, más Core Web Vitals (LCP, INP/TBT, CLS).
- **Playwright** — un robot de navegador que recorre los botones y páginas clave (inicio, precios, guía, registro con nombre, cambio de idioma, widget de soporte) y marca cada uno verde o rojo.
- **TypeScript** — errores de tipos.
- **npm audit** — dependencias con vulnerabilidades conocidas.

## Cómo activarlo (una sola vez)
1. En GitHub → **Settings → Secrets and variables → Actions**, confirma que existen:
   - `APP_URL` → `https://www.onyxtradinglive.com`
   - `CRON_SECRET` → el mismo valor que en Vercel (ya lo pusiste para el backup).
2. El archivo `.github/workflows/audit.yml` ya corre solo en cada push a `main`.
   Para lanzarlo a mano: **Actions → Audit → Run workflow**.
3. Cuando termine, el resultado aparece en **Admin → Auditoría** (notas, tiempos y flujos).

## Dependabot
El archivo `.github/dependabot.yml` abre solo un PR cuando hay actualizaciones de
dependencias (incluidas las de seguridad). Las revisas y las fusionas cuando quieras.

## Complemento sin código
En Vercel (plan Pro) puedes activar **Speed Insights** con un clic: te da los Web
Vitals de usuarios reales, además de estas pruebas de laboratorio.
