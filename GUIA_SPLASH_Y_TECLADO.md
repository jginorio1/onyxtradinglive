# Splash (logo de arranque) + teclado del chat — v600

Dos arreglos para el próximo build de App Store. El código ya está hecho y compila;
lo único manual es reemplazar la **imagen** del splash (vive en el proyecto nativo,
no en este repo) y volver a sincronizar Capacitor.

---

## 1 · Splash: una sola aparición, con el logo naranja de marca

### Qué cambió en el código (ya hecho)
- `capacitor.config.ts` → `SplashScreen.launchAutoHide:false` + `launchFadeOutDuration:250`.
  El splash nativo ya **no se oculta solo**: lo escondemos nosotros cuando la web pintó.
- `app/NativeInit.tsx` → oculta el splash **después** del primer pintado (dos `requestAnimationFrame`
  + colchón), con fundido. Red de seguridad a 2.5 s. Esto elimina el doble destello
  (logo → flash → logo).

### Lo que TIENES que hacer: cambiar la imagen (era violeta)
El logo violeta venía de los **assets del proyecto nativo** (no de este repo). Ya te dejé
el PNG correcto, naranja de marca sobre `#0b0f1a`:

- `public/splash-onyx.png` — 2732×2732 (splash universal)
- `public/splash-onyx-icon1024.png` — 1024×1024 (por si lo quieres como foreground del ícono)

**Forma recomendada (plugin oficial, automático para iOS + Android):**

```bash
npm i -D @capacitor/assets
# Crea la carpeta de assets y copia el splash (y, si quieres, un icono):
mkdir -p assets
cp public/splash-onyx.png assets/splash.png
cp public/splash-onyx.png assets/splash-dark.png
# (opcional) icono: cp public/splash-onyx-icon1024.png assets/icon.png
npx @capacitor/assets generate --splashBackgroundColor "#0b0f1a" --splashBackgroundColorDark "#0b0f1a"
npx cap sync
```

Eso regenera **todos** los tamaños de splash para iPhone/iPad/Android y deja el fondo `#0b0f1a`.

**A mano (si no usas el plugin):**
- iOS → en Xcode, `App/App/Assets.xcassets/Splash.imageset` → reemplaza las 3 imágenes
  (1x/2x/3x) por `splash-onyx.png`. El `LaunchScreen.storyboard` ya usa ese imageset y
  el color de fondo `#0b0f1a`.
- Android → `android/app/src/main/res/drawable*/splash.png` (y `values/styles.xml`
  con `windowSplashScreenBackground` = `#0b0f1a`).

> El ícono de la app (home screen) es un asset aparte. Si también se ve violeta, repite
> con `assets/icon.png` = `splash-onyx-icon1024.png` (o tu ícono naranja) y vuelve a
> correr `@capacitor/assets generate`.

---

## 2 · Teclado del chat pegado (nativo, sin hueco)

### Qué cambió en el código (ya hecho)
- `app/NativeInit.tsx`:
  - `Keyboard.setResizeMode('none')` (acorde a la config; el header no se mueve).
  - `Keyboard.setAccessoryBarVisible(false)` → quita la barra "Done" que dejaba un hueco gris.
  - Publica la **altura real** del teclado a la web: CSS var `--onyx-kb` en `<html>` + evento `onyxkb`.
- `app/SupportWidget.tsx`:
  - En la app nativa usa esa altura real para fijar el alto del panel (ventana − teclado),
    así el campo de escribir queda **pegado al teclado**, sin hueco.
  - Transición suave al abrir/cerrar el teclado (se siente nativo).
  - En web (navegador móvil) sigue usando `visualViewport` como antes.

No hay nada manual aquí: entra con el build.

---

## Checklist del build
1. `npm run build` del front (como siempre) y *Promote to Production* (la web remota es
   la que carga la app; el teclado del chat va por ahí).
2. Regenera el splash con `@capacitor/assets` (o reemplaza a mano) → `npx cap sync`.
3. Sube el build a App Store Connect.

Pendiente aparte (cuando digas): **ficha ASO** (título, subtítulo, keywords, promo y
descripción) en App Store, ES + EN.
