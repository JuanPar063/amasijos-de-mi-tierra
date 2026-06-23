import { createContext, useContext } from 'react';
import type { Repository } from '@panaderia/shared';

export const RepoContext = createContext<Repository | null>(null);

/** Acceso al repositorio activo desde cualquier componente. */
export function useRepository(): Repository {
  const repo = useContext(RepoContext);
  if (!repo) throw new Error('useRepository debe usarse dentro de <RepoContext.Provider>');
  return repo;
}
