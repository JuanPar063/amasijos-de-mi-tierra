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

El APK queda en `packages/mobile/android/app/build/outputs/apk/`. Instálalo en el
teléfono habilitando "instalar de fuentes desconocidas" (sin Play Store).

> **Nota (pnpm):** Capacitor descubre los plugins leyendo `node_modules`. Si
> `cap sync` no encuentra los plugins por los enlaces simbólicos de pnpm, crea un
> `.npmrc` en la raíz con `node-linker=hoisted` y reinstala (`pnpm install`).

## Cambios de web a nativo (resumen)

| Aspecto | Web (PWA) | APK (nativo) |
|---|---|---|
| Almacenamiento | IndexedDB (Dexie) | SQLite (`@capacitor-community/sqlite`) |
| Guardar PDF / respaldo | Descarga del navegador | Filesystem + Share |
| Selección | `VITE_STORAGE_MODE` | `Capacitor.isNativePlatform()` |
