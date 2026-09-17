# Arreglos de la app móvil (v590)

## Qué se arregló
1. **Botón atrás en la app.** Con sesión, el atrás ya no cae en el login: en el panel
   principal minimiza la app, y en subpáginas retrocede normal. Además, si por lo que
   sea aterrizas en /login estando logueado, te rebota directo al panel.
2. **Compartir (nativo).** "Compartir" abre la hoja de compartir real de Android/iPhone
   (WhatsApp, guardar en fotos, etc.), ya no solo copia el enlace.
3. **Descargar (nativo).** Descargar QR o imagen de rendimiento ahora funciona: en la app
   guarda/comparte el archivo por la hoja nativa; en web descarga normal. También los
   botones de "Ver reporte / Imprimir / Abrir PDF" abren en el navegador del sistema.
4. **PDF del aula.** Visor con zoom (−/+ hasta 300 %), botón "Ajustar" y "Pantalla completa"
   para abrirlo en el visor del teléfono. Ya se puede leer y acercar.
5. **Calendario de operaciones.** Los importes de 5–6 dígitos ya no se desbordan (formato
   compacto +$13K y ajuste a la celda).
6. **Iconos de lotaje.** Se corrige el texto literal que aparecía en vez del icono
   (`<OnyxIcon .../>`), causado por un reemplazo mal hecho. También en el mapa de calor,
   la tabla de operaciones, el coach y un botón de la fábrica.

## IMPORTANTE: esto SÍ requiere recompilar la app
Compartir y descargar usan dos plugins nativos nuevos de Capacitor. Ya están en
`package.json`. Antes de compilar en Codemagic (o local) hay que instalarlos y sincronizar:

```
npm install
npx cap sync android      # y/o: npx cap sync ios
```

Plugins añadidos:
- `@capacitor/share` (hoja de compartir nativa)
- `@capacitor/filesystem` (guardar el archivo antes de compartir)
- `@capacitor/browser` (abrir PDFs/reportes en el navegador del sistema)

Codemagic corre `npm install` solo, así que basta con subir este ZIP al repo de la app
(`onyx-android`) y lanzar el build; `cap sync` lo hace el flujo de build.

## Lo que se ve solo con desplegar a Vercel (sin recompilar)
Los arreglos 4, 5 y 6 (PDF, calendario, iconos) y el rebote de login son web: se ven al
subir a Vercel. Los 2 y 3 (compartir/descargar nativos) necesitan el nuevo APK/IPA.
