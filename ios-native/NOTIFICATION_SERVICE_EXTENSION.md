# iOS — Logo de Onyx dentro del push (Notification Service Extension)

En iOS, el **ícono chico** de una notificación es SIEMPRE el ícono de la app (Apple
no deja cambiarlo por notificación). Para que aparezca el **logo de Onyx como
imagen grande** dentro del aviso hay que añadir una *Notification Service Extension*
al proyecto iOS. El servidor ya manda `mutable-content: 1` + la URL del logo
(`https://www.onyxtradinglive.com/icon-512.png`, el aro azul con el punto morado);
esta extensión la descarga y la adjunta.

## Qué se añadió al repo

- `ios-native/OnyxNotificationService/NotificationService.swift` — descarga la
  imagen y la adjunta.
- `ios-native/OnyxNotificationService/Info.plist` — config del target.
- `scripts/ios_add_nse.rb` — **inyecta el target** en el `App.xcodeproj` que
  Capacitor genera (porque `ios/` está en `.gitignore` y se regenera en cada build).
  Es **idempotente** (si el target ya existe, no hace nada).
- `package.json` → scripts `ios:nse` y `ios:prepare`.
- Backend ya listo (`lib/fcm.ts`): `mutable-content:1`, `apns.fcm_options.image`,
  `data.image`, y `android.notification.image`. No hay que tocar backend.

---

## Cómo encaja en Codemagic (automático)

El orden correcto en el build iOS es:

```
npm ci
npm run build                 # Next.js
npx cap sync ios              # genera/actualiza ios/App/App.xcodeproj
gem install xcodeproj         # (si el runner no la trae; CocoaPods suele incluirla)
ruby scripts/ios_add_nse.rb   # ← inyecta la Notification Service Extension
# ... luego pod install (si aplica) y el archivado/firma de siempre
```

Equivalente con el atajo: `npm run build && npm run ios:prepare` (hace
`cap sync ios` + el script).

### Si usas codemagic.yaml

Añade en los `scripts:` del workflow de iOS, justo después del `cap sync ios` y
ANTES de `pod install` / `xcode-project build-ipa`:

```yaml
    - name: Add Notification Service Extension
      script: |
        gem install xcodeproj --no-document || true
        ruby scripts/ios_add_nse.rb
```

### Si tu Codemagic está configurado por la UI (sin yaml)

En **App settings → Build → Post-clone o Pre-build script** (o el "Build script"
donde ya corres `cap sync`), añade estas dos líneas después de `npx cap sync ios`:

```
gem install xcodeproj --no-document || true
ruby scripts/ios_add_nse.rb
```

> Firma: con **firma automática** (API key de App Store Connect en Codemagic) el
> App ID de la extensión `com.onyxtradinglive.app.OnyxNotificationService` se
> registra solo. Si usas perfiles manuales, crea ese App ID y su provisioning
> profile, y añádelo al build. Opcional: define la variable `DEVELOPMENT_TEAM`
> (tu Team ID) y el script la escribe en el target.

---

## Cómo probar

1. Lanza el build en Codemagic y revisa el log: debe aparecer
   `✓ Extensión OnyxNotificationService añadida …`.
2. Sube a TestFlight e instala.
3. Acepta notificaciones (ya se pide en NativeInit) y dispara una push de prueba
   (Admin → Notificaciones, o `/api/push/diag`).
4. Desliza hacia abajo / mantén pulsada la notificación: debe verse el aro azul
   con el punto morado como imagen.
   - El ícono chico de la esquina seguirá siendo el ícono de la app (normal en iOS).

---

## Notas

- Android ya muestra el logo sin extensión (`android.notification.image`).
- Para cambiar el logo del push: cambia `public/icon-512.png` (o la URL en
  `lib/fcm.ts`). La extensión no necesita recompilarse por eso.
- Alternativa manual (una sola vez, si prefieres commitear `ios/`): en Xcode,
  File → New → Target → *Notification Service Extension*, bundle
  `com.onyxtradinglive.app.OnyxNotificationService`, y pega los dos archivos de
  `ios-native/OnyxNotificationService/`. Pero con el script no hace falta.
