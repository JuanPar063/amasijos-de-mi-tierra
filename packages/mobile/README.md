# @panaderia/mobile

Proyecto Capacitor que envuelve el build del frontend para generar el APK de
Android. **Se implementa en la Fase 4.**

Sustituirá el almacenamiento local web (Dexie/IndexedDB) por SQLite nativo
(`@capacitor-community/sqlite`) detrás de la misma interfaz `Repository`, sin
cambiar el resto del frontend. Incluirá los plugins Filesystem y Share para
guardar/compartir el PDF desde el teléfono.
