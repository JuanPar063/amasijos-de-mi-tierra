import type { Repository } from '@panaderia/shared';
import { LocalRepository } from './LocalRepository';

let instancia: Repository | null = null;

/**
 * Selecciona el adaptador de almacenamiento según VITE_STORAGE_MODE.
 * 'local' (por defecto) -> IndexedDB en el dispositivo.
 * 'api' -> backend REST (se implementa en la Fase 3).
 */
export function getRepository(): Repository {
  if (instancia) return instancia;
  const modo = import.meta.env.VITE_STORAGE_MODE ?? 'local';
  if (modo === 'api') {
    throw new Error(
      'El adaptador de API (VITE_STORAGE_MODE=api) se implementa en la Fase 3. Usa "local".',
    );
  }
  instancia = new LocalRepository();
  return instancia;
}
