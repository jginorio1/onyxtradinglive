# Onyx Trading Live — App móvil (Capacitor) · Google Play

Esta app envuelve tu web en vivo (`https://www.onyxtradinglive.com`) en una app
nativa. **No reescribe nada**: la app abre tu web real, así que login, Stripe,
APIs y todas las funciones siguen igual, pero con ícono propio, splash, barra de
estado nativa, botón atrás y presencia en Google Play.

Ya está en el repo: `capacitor.config.ts`, los plugins en `package.json`, el
arranque nativo (`app/NativeInit.tsx`) y las áreas seguras en el CSS. Solo falta
generar el proyecto Android y compilar/firmar/subir — eso se hace **en tu Mac**.

---

## 0. Requisitos (una sola vez)

- **Node** (ya lo tienes).
- **Android Studio** → https://developer.android.com/studio (trae el SDK de Android y Gradle).
- **JDK 17** (Android Studio ya lo incluye; si no, instálalo).
- **Cuenta de Google Play Console** → https://play.google.com/console (pago único de $25).

---

## 1. Instalar dependencias y generar el proyecto Android

Desde la carpeta del proyecto (donde está `package.json`):

```bash
npm install
npx cap add android          # crea la carpeta android/ (solo la 1ª vez)
npx cap sync                 # copia la config y los plugins al proyecto android
```

## 2. Ícono y splash de la app

Pon tu logo cuadrado en `resources/icon.png` (idealmente **1024×1024 px**, fondo
transparente) y una imagen para el splash en `resources/splash.png`
(idealmente **2732×2732 px**, con el logo centrado). Ya dejé una versión de
arranque; reemplázala por la de alta resolución cuando la tengas. Luego:

```bash
npx @capacitor/assets generate --android \
  --iconBackgroundColor '#0b0f1a' \
  --splashBackgroundColor '#0b0f1a'
npx cap sync
```

Esto genera todos los tamaños de ícono (incluido el adaptativo de Android) y el
splash automáticamente.

## 3. Abrir en Android Studio

```bash
npx cap open android
```

Espera a que Gradle termine de sincronizar (barra inferior). Para **probarla**:
conecta un teléfono Android con "Depuración USB" activada, o usa un emulador, y
pulsa ▶ (Run). La app abre tu web dentro del envoltorio nativo.

## 4. Firmar la app (keystore) — esto lo haces tú, no lo compartas

Google Play exige que el `.aab` vaya firmado. Crea tu llave **una sola vez**:

```bash
keytool -genkey -v -keystore onyx-release.keystore \
  -alias onyx -keyalg RSA -keysize 2048 -validity 10000
```

Guarda **`onyx-release.keystore` y las contraseñas en un lugar seguro** (si las
pierdes, no podrás volver a actualizar la app en Play). No las subas al repo ni
me las envíes.

En Android Studio: **Build → Generate Signed Bundle / APK → Android App Bundle**,
elige tu keystore, y marca *release*. O por consola dentro de `android/`:

```bash
./gradlew bundleRelease
```

El archivo queda en `android/app/build/outputs/bundle/release/app-release.aab`.

## 5. Subir a Google Play

1. En Play Console: **Crear app** → nombre "Onyx Trading Live", idioma, tipo App, gratis/pago.
2. Rellena la ficha: descripción, capturas (teléfono), ícono 512×512, gráfico de cabecera 1024×500.
3. **Política de privacidad** (obligatoria): usa tu página `/terms` o una URL de privacidad.
4. Completa los cuestionarios: **contenido**, **seguridad de datos**, **anuncios** (no), público objetivo.
5. **Producción → Crear nueva versión** → sube el `.aab` → revisa y **envía a revisión**.

La primera revisión suele tardar de unas horas a unos días. Cuentas nuevas de
Play a veces piden un periodo de prueba cerrada con testers antes de producción;
si te lo pide, crea una **prueba cerrada**, añade correos de testers y luego
promueves a producción.

## 6. Actualizar la app más adelante

Como la app carga tu web en vivo, **la mayoría de cambios NO requieren nueva
versión en Play**: actualizas la web (Vercel) y la app los ve al instante. Solo
subes un `.aab` nuevo cuando cambies algo nativo (ícono, permisos, plugins,
versión). Al hacerlo, incrementa `versionCode` en `android/app/build.gradle`.

---

## Fase 2 (siguiente) — Notificaciones push nativas (FCM)

Hoy la app ya está lista para la tienda. Las **notificaciones push nativas** de
Android necesitan Firebase Cloud Messaging (FCM), que requiere tu cuenta de
Firebase. Cuando quieras, lo montamos así:

1. Crear proyecto en https://console.firebase.google.com y una app Android con el
   package `com.onyxtradinglive.app`.
2. Descargar `google-services.json` y ponerlo en `android/app/`.
3. El plugin `@capacitor/push-notifications` ya está en `package.json`: registrar
   el token en el arranque y enviarlo a un endpoint nuevo (`/api/push/native`).
4. En el servidor, enviar los avisos vía FCM (además del web-push actual).

Avísame y te dejo esa fase montada (cliente + endpoint + envío desde el servidor).

---

## Notas técnicas

- **Enfoque**: `server.url` apunta a la web en vivo; `allowNavigation` limita la
  navegación interna a los dominios de Onyx (Stripe y externos se abren fuera).
- **iOS** (App Store) reutiliza este mismo setup: `npx cap add ios` + Xcode, cuando
  quieras dar ese paso.
- **App ID**: `com.onyxtradinglive.app` — no lo cambies después de publicar (es la identidad de la app en Play).
