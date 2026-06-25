import type { Repository } from '@panaderia/shared';
import { LocalRepository } from './LocalRepository';
import { ApiRepository } from './ApiRepository';

let instancia: Repository | null = null;

/**
 * Selecciona el adaptador de almacenamiento según VITE_STORAGE_MODE.
 * 'local' (por defecto) -> IndexedDB en el dispositivo (offline).
 * 'api' -> backend REST (versión nube).
 */
export function getRepository(): Repository {
  if (instancia) return instancia;
  const modo = import.meta.env.VITE_STORAGE_MODE ?? 'local';
  instancia = modo === 'api' ? new ApiRepository() : new LocalRepository();
  return instancia;
}
