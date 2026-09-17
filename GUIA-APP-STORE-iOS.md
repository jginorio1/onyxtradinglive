# Onyx Trading Live — Guía para publicar en la App Store (iPhone + iPad)

Esta guía te lleva de cero a "app enviada a revisión" en la App Store. La app iOS es la
misma que la de Android: una envoltura (Capacitor) que carga el sitio en vivo
(`https://www.onyxtradinglive.com`). Por eso, igual que en Android, **los cambios de la web
se despliegan por Vercel y la app los ve al reabrir**; solo necesitas recompilar en Xcode
cuando cambie la parte nativa (versión, íconos, plugins).

La app es **universal**: el mismo binario corre en iPhone y iPad.

---

## 0. Requisitos (una sola vez)

- Una **Mac** con **Xcode** instalado (desde la App Store). Ábrelo una vez y acepta la
  instalación de componentes.
- **Apple Developer Program activo** (99 USD/año). ✅ Ya lo tienes.
- Las **Command Line Tools**: en Terminal, `xcode-select --install` (si ya están, dirá que
  no hace falta).
- **CocoaPods** (lo usa Capacitor para las dependencias iOS):
  `sudo gem install cocoapods` — o con Homebrew: `brew install cocoapods`.
- Node y npm instalados (los mismos que usas para el proyecto web).

---

## 1. Preparar el proyecto (en tu Mac, dentro de la carpeta del proyecto)

Descomprime el ZIP más reciente y, en la carpeta del proyecto:

```bash
npm install                 # instala @capacitor/ios (ya agregado al package.json)
npm run build               # genera la web (Next.js)
npm run cap:add:ios         # crea la carpeta ios/ (solo la primera vez)
npm run cap:assets          # genera íconos y splash para iOS y Android
npm run cap:sync            # copia config + plugins a iOS (y Android)
npm run cap:open:ios        # abre el proyecto en Xcode
```

Notas:
- `cap:add:ios` solo se corre **una vez**. Después, para actualizar la parte nativa usa
  `npm run cap:sync:ios`.
- Como la app carga el sitio en vivo, **no necesitas** `npm run build` cada vez que cambias
  la web; solo cuando toques algo nativo. El primer `build` es para que Capacitor tenga la
  carpeta `public` de respaldo.
- Los íconos salen del ícono maestro del proyecto (el mismo que usa Android). Si quieres uno
  distinto para iOS, reemplaza el archivo fuente antes de `cap:assets`.

---

## 2. Firmar la app en Xcode

Con Xcode abierto (target **App**):

1. Panel izquierdo → selecciona el proyecto **App** → pestaña **Signing & Capabilities**.
2. Marca **Automatically manage signing**.
3. En **Team**, elige tu equipo de Apple Developer (tu cuenta ya activa).
4. **Bundle Identifier**: debe ser `com.onyxtradinglive.app` (ya viene de la config). Si
   Xcode dice que no está disponible, es que hay que crearlo (ver paso 4) o cambiarlo por uno
   único tuyo — pero manténlo idéntico al del `capacitor.config`.
5. Xcode generará el perfil de aprovisionamiento solo.

### iPad (universal)
En la pestaña **General** → **Deployment Info**:
- **iPhone Orientation**: Portrait (y las que quieras).
- **iPad**: déjalo **marcado** (así la app es universal). Si prefieres, marca también
  Landscape para iPad.
- Apple exige que en iPad la app soporte varias orientaciones **o** marques "Requires full
  screen". Para evitar rechazos: en **Deployment Info → iPad**, activa Portrait y Landscape,
  o marca **Requires full screen** (Info.plist: `UIRequiresFullScreen = YES`).

### Versión y número de compilación
En **General → Identity**:
- **Version** (ej. `1.0.0`) — la que ve el usuario.
- **Build** (ej. `1`) — súbelo en +1 en **cada** subida a App Store Connect, aunque no cambies
  la versión.

### Notificaciones push (solo si las vas a usar en iOS)
Si quieres push nativo en iOS: **Signing & Capabilities → + Capability → Push Notifications**
y también **Background Modes → Remote notifications**. Requiere configurar APNs
(Apple Push) en App Store Connect. Si por ahora no usas push en iOS, **omite este paso** para
no complicar la primera aprobación.

---

## 3. Nombre visible, permisos y detalles (Info.plist)

En Xcode, target App → pestaña **Info**:
- **Bundle display name**: `Onyx Trading Live` (lo que aparece bajo el ícono).
- Como la app carga por **HTTPS**, no necesitas excepciones de ATS. No añadas
  `NSAllowsArbitraryLoads`.
- Si en algún momento la web pide **cámara** (subir capturas) o **fotos**, iOS exige un texto
  de motivo o rechaza:
  - `NSCameraUsageDescription` → "Se usa para adjuntar capturas a soporte."
  - `NSPhotoLibraryUsageDescription` → "Se usa para adjuntar imágenes."
  Añádelos solo si aplica.

---

## 4. Crear la app en App Store Connect

1. Entra a **https://appstoreconnect.apple.com** con tu cuenta.
2. (Si el Bundle ID no existía) ve a **https://developer.apple.com/account → Certificates,
   Identifiers & Profiles → Identifiers → +** y crea un **App ID** con el bundle
   `com.onyxtradinglive.app`.
3. En App Store Connect → **Apps → +** → **New App**:
   - Plataforma: **iOS**.
   - Nombre: **Onyx Trading Live** (debe estar libre; si no, ajusta).
   - Idioma principal, y el **Bundle ID** que creaste.
   - **SKU**: cualquier código interno tuyo (ej. `onyx-ios-01`).
4. Completa la **ficha (App Information / Pricing)**:
   - **Categoría**: Finanzas (Finance) — o Negocios.
   - **Precio**: Gratis (la suscripción es aparte, ver sección de riesgos).
   - **URL de soporte** y **URL de política de privacidad** (obligatoria): usa tus páginas
     legales del sitio.
   - **Privacidad de datos ("App Privacy")**: declara qué datos recoges (correo, uso, etc.).
     Es un cuestionario; sé honesto (cuenta/correo, datos de uso, diagnósticos).

---

## 5. Capturas de pantalla (obligatorias)

Necesitas capturas para al menos:
- **iPhone 6.7"** (ej. iPhone 15 Pro Max) — obligatorio.
- **iPad 12.9"** (Pro) — obligatorio porque la app es universal.
- (Opcional recomendado) iPhone 6.5" y 5.5".

La forma fácil: corre la app en el **Simulador** de Xcode (iPhone 15 Pro Max y iPad Pro 12.9")
y toma capturas con **⌘S** (se guardan en el Escritorio). Sube 3–5 por dispositivo mostrando
el panel, Guardian, Copy, etc.

---

## 6. Compilar y subir (Archive)

En Xcode:
1. Arriba, en el selector de dispositivo, elige **Any iOS Device (arm64)** (no un simulador).
2. Menú **Product → Archive**. Espera a que compile.
3. Al terminar se abre el **Organizer**. Selecciona el archivo → **Distribute App** →
   **App Store Connect** → **Upload**. Deja las opciones por defecto → **Upload**.
4. La compilación aparece en App Store Connect en unos minutos (procesándose).

---

## 7. Probar en TestFlight (recomendado)

En App Store Connect → tu app → pestaña **TestFlight**:
- Cuando la build termine de procesar, agrégate como **probador interno** (tu propio correo).
- Instala **TestFlight** en tu iPhone/iPad y prueba el login, navegación (los tabs, el botón
  de panel), pagos, etc. antes de enviar a revisión.

---

## 8. Enviar a revisión

En la pestaña de la versión (**1.0**):
1. Elige la **Build** que subiste.
2. Rellena: descripción, palabras clave, capturas, texto de "novedades".
3. **Export compliance**: normalmente la app solo usa HTTPS estándar → responde que **no**
   usa cifrado no exento (o marca la excepción estándar de HTTPS).
4. **Notas para revisión**: incluye un **usuario y contraseña de prueba** (una cuenta demo)
   para que el revisor pueda entrar. Esto acelera mucho la aprobación.
5. **Submit for Review**.

Revisión de Apple: suele tardar de **1 a 3 días**.

---

## 9. ⚠️ Riesgos de aprobación (léelo antes de enviar)

Apple es más estricto que Google con apps que "envuelven" un sitio web. Dos reglas te pueden
frenar; vale la pena anticiparse:

### 9.1 — Guideline 4.2 "Minimum functionality"
Apple rechaza apps que son **solo un sitio web** sin valor nativo. Para pasar:
- Resalta lo nativo: **notificaciones push**, ícono/splash propios, integración con el sistema.
- En las notas de revisión explica que la app da acceso a una **plataforma completa** (panel de
  trading, Guardian, Copy, notificaciones), no un folleto.
- Si la rechazan por 4.2, la solución típica es **activar push nativo** y/o añadir alguna
  función que use el dispositivo. Por eso dejé el plugin de Push listo en el proyecto.

### 9.2 — Guideline 3.1.1 "In-App Purchase" (el punto más delicado)
Si la app **vende suscripciones digitales que se usan dentro de la app**, Apple exige que se
paguen con **su** sistema de compras (In-App Purchase, con su comisión), **no** con Stripe/tarjeta
externa. Opciones para no chocar con esto:
- **Opción A (más segura para aprobar rápido):** que la app **no muestre precios ni botón de
  pagar/suscribirse**. El usuario que ya tiene cuenta entra y usa el servicio; si quiere
  contratar/cambiar plan, lo hace en el sitio web desde su navegador. Dentro de la app no hay
  "Comprar". Esto encaja como app de servicio/negocio.
- **Opción B:** integrar **In-App Purchase de Apple** para las suscripciones (más trabajo:
  crear los productos en App Store Connect, plugin de compras, conciliar con Stripe). Es lo
  correcto si quieres vender suscripciones **dentro** del iPhone.
- **Opción C:** acogerte a excepciones específicas de Apple (apps "reader"/multiplataforma,
  o el enlace externo permitido en algunas regiones). Es terreno más fino y cambia por país.

**Estado:** ya está implementada la **Opción A** en **Mi cuenta**. Solo en la app de iOS se
ocultan cambiar tarjeta, subir/bajar de plan, el complemento de cuentas extra y el checkout;
se muestra el plan actual y un aviso con botón para gestionarlo en onyxtradinglive.com. En
Android y en el navegador no cambia nada.

Pendiente (recomendado antes de enviar): ocultar también en iOS los precios y el botón de
suscribirse en la página **/pricing** y en la píldora del plan de la barra superior, para que
no quede ninguna vía de compra visible dentro de la app. Avísame y lo dejo igual que Mi cuenta.

---

## 10. Actualizaciones futuras

- **Cambios de la web** (colores, textos, arreglos, funciones): se despliegan por **Vercel**.
  El usuario reabre la app y ya. **No** hay que resubir a la App Store.
- **Cambios nativos** (ícono, splash, versión, plugins nuevos, permisos): sube el **Build**
  en +1, **Product → Archive → Upload**, y envía la nueva versión a revisión.

---

## Resumen de comandos

```bash
npm install
npm run build
npm run cap:add:ios      # solo la 1ª vez
npm run cap:assets       # íconos + splash
npm run cap:sync:ios     # cada vez que cambie lo nativo
npm run cap:open:ios     # abre Xcode
# En Xcode: Signing (Team) → Any iOS Device → Product > Archive > Distribute > Upload
```
