# Caché y actualizaciones — para no volver a decir "borra tu caché"

## Qué se hizo
1. **Auto-recuperación** (`app/ChunkReload.tsx`): si tras publicar una versión una
   pestaña vieja pide una pieza que ya no existe, la app recarga sola **una vez**.
2. **Service worker versionado** (`public/sw.js` + `lib/version.ts` + `scripts/gen-version.mjs`):
   cada build genera una versión única; el SW usa esa versión como clave de caché
   y borra las cachés viejas al activarse. Se registra con `updateViaCache:'none'`.
3. **Aviso "Actualizar app"** (`app/UpdateToast.tsx`): cuando hay versión nueva,
   aparece un aviso; al tocarlo se activa la nueva y la página se recarga una vez.
4. **`sw.js` nunca se cachea** (`next.config.js`): así las mejoras del SW llegan enseguida.
5. **Compatibilidad**: `-webkit-backdrop-filter` para Safari y un respaldo global
   `@supports not (color-mix())` con colores sólidos para navegadores anteriores a ~2023.

## Cómo funciona la versión (automático)
En cada `npm run build`, el `prebuild` corre `scripts/gen-version.mjs`, que escribe
`lib/version.ts` con una versión única:
- Usa `NEXT_PUBLIC_APP_VERSION` si existe, o
- el commit de Vercel (`VERCEL_GIT_COMMIT_SHA`), o
- una marca de tiempo `AAAAMMDDHHmm`.

No hay que tocar nada a mano. Opcional: en Vercel puedes fijar
`NEXT_PUBLIC_APP_VERSION = $VERCEL_GIT_COMMIT_SHA` para versiones por commit.

## Resultado
El usuario ya no necesita borrar el caché: la app se auto-repara y ofrece
"Actualizar" cuando toca. En navegadores viejos, los colores se ven bien con los
respaldos sólidos (en los modernos, igual que antes).
