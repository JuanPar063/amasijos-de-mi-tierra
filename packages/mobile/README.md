# @panaderia/mobile

Proyecto **Capacitor** que envuelve el build del frontend para generar el **APK
de Android**. En el APK, el almacenamiento usa **SQLite nativo**
(`@capacitor-community/sqlite`) detrás del mismo contrato `Repository` — el resto
del frontend no cambia (`SqliteRepository` se selecciona automáticamente cuando
`Capacitor.isNativePlatform()`). El PDF y el respaldo se guardan/comparten con los
plugins **Filesystem** y **Share**.

- `capacitor.config.ts` — `webDir: '../frontend/dist'` (envuelve el build web).

## Generar el APK

Requisitos del autor: **Android Studio** + SDK de Android y **JDK 17**.

```bash
# 1) Construir el frontend (el APK usa SQLite, no importa VITE_STORAGE_MODE)
pnpm --filter @panaderia/frontend build

# 2) Desde packages/mobile: crear el proyecto Android y sincronizar
pnpm --filter @panaderia/mobile add:android   # genera android/ (solo la 1ª vez)
pnpm --filter @panaderia/mobile sync          # copia web + plugins nativos

# 3) Abrir en Android Studio y generar el APK…
pnpm --filter @panaderia/mobile open:android
#    …o por línea de comandos:
cd packages/mobile/android && ./gradlew assembleRelease
```

**Atajo (APK de depuración, sin firma):** una vez creado `android/` con
`add:android`, un solo comando construye la web, sincroniza y genera el APK
instalable:

```bash
pnpm --filter @panaderia/mobile apk:debug
```

> Este atajo usa `gradlew` (Windows). En macOS/Linux corre `./gradlew assembleDebug`
> dentro de `packages/mobile/android`.

El APK queda en `packages/mobile/android/app/build/outputs/apk/` (`debug/app-debug.apk`
o `release/…`). Instálalo en el teléfono habilitando "instalar de fuentes
desconocidas" (sin Play Store).

> **Nota (pnpm):** Capacitor descubre los plugins leyendo `node_modules`. El
> `.npmrc` de la raíz ya fija `node-linker=hoisted` para que `cap sync` los
> encuentre; si cambias ese archivo, reinstala con `pnpm install`.

## Cambios de web a nativo (resumen)

| Aspecto | Web (PWA) | APK (nativo) |
|---|---|---|
| Almacenamiento | IndexedDB (Dexie) | SQLite (`@capacitor-community/sqlite`) |
| Guardar PDF / respaldo | Descarga del navegador | Filesystem + Share |
| Selección | `VITE_STORAGE_MODE` | `Capacitor.isNativePlatform()` |
