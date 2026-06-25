/// <reference types="vite/client" />

interface ImportMetaEnv {
  // 'local' = datos en el dispositivo | 'api' = backend en la nube
  readonly VITE_STORAGE_MODE: 'local' | 'api';
  // URL base del backend cuando VITE_STORAGE_MODE=api (por defecto '/api')
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
