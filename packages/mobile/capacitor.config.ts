import type { CapacitorConfig } from '@capacitor/cli';

// Capacitor envuelve el build del frontend (packages/frontend/dist).
// El APK usa el adaptador SQLite nativo (detrás del mismo contrato Repository).
const config: CapacitorConfig = {
  appId: 'com.panaderia.app',
  appName: 'Panadería',
  webDir: '../frontend/dist',
  plugins: {
    CapacitorSQLite: {
      androidIsEncryption: false,
    },
  },
};

export default config;
