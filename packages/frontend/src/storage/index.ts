import { Capacitor } from '@capacitor/core';
import type { Repository } from '@panaderia/shared';
import { LocalRepository } from './LocalRepository';
import { ApiRepository } from './ApiRepository';

let instancia: Repository | null = null;

/**
 * Crea el adaptador de almacenamiento adecuado:
 * - Nativo (APK)  -> SQLite (@capacitor-community/sqlite), carga diferida.
 * - Web 'local'   -> IndexedDB (Dexie), offline.
 * - Web 'api'     -> backend REST (versión nube).
 */
export async function crearRepositorio(): Promise<Repository> {
  if (instancia) return instancia;

  if (Capacitor.isNativePlatform()) {
    const { SqliteRepository } = await import('./SqliteRepository');
    const repo = new SqliteRepository();
    await repo.init();
    instancia = repo;
    return instancia;
  }

  const modo = import.meta.env.VITE_STORAGE_MODE ?? 'local';
  instancia = modo === 'api' ? new ApiRepository() : new LocalRepository();
  return instancia;
}
