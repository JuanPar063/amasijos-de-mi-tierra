/// <reference types="vite/client" />

interface ImportMetaEnv {
  // 'local' = datos en el dispositivo | 'api' = backend en la nube
  readonly VITE_STORAGE_MODE: 'local' | 'api';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
