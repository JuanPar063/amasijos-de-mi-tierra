// Hooks de datos: envuelven el repositorio con React Query.
// Las consultas son por entidad; las mutaciones invalidan todo (los cambios de
// stock/consumo cruzan varias entidades, así que recargar todo es lo más simple
// y correcto para una app local pequeña).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { Repository } from '@panaderia/shared';
import { useRepository } from '../storage/repo-context';

export const qk = {
  insumos: ['insumos'] as const,
  compras: ['compras'] as const,
  productos: ['productos'] as const,
  recetas: ['recetas'] as const,
  producciones: ['producciones'] as const,
  tiendas: ['tiendas'] as const,
  entregas: ['entregas'] as const,
  entregaItems: ['entregaItems'] as const,
};

function useInvalidarTodo(): () => void {
  const qc = useQueryClient();
  return useCallback(() => {
    void qc.invalidateQueries();
  }, [qc]);
}

/** Mutación genérica contra el repositorio que invalida todas las consultas. */
export function useAccion<TArgs = void, TResult = unknown>(
  fn: (repo: Repository, args: TArgs) => Promise<TResult>,
) {
  const repo = useRepository();
  const invalidar = useInvalidarTodo();
  return useMutation<TResult, Error, TArgs>({
    mutationFn: (args: TArgs) => fn(repo, args),
    onSuccess: invalidar,
  });
}

// --- Consultas de lista ---

export function useInsumos() {
  const repo = useRepository();
  return useQuery({ queryKey: qk.insumos, queryFn: () => repo.insumos.list() });
}
export function useCompras() {
  const repo = useRepository();
  return useQuery({ queryKey: qk.compras, queryFn: () => repo.compras.list() });
}
export function useProductos() {
  const repo = useRepository();
  return useQuery({ queryKey: qk.productos, queryFn: () => repo.productos.list() });
}
export function useRecetas() {
  const repo = useRepository();
  return useQuery({ queryKey: qk.recetas, queryFn: () => repo.recetas.list() });
}
export function useRecetaDeProducto(productoId?: string) {
  const repo = useRepository();
  return useQuery({
    queryKey: [...qk.recetas, productoId ?? '∅'],
    queryFn: () => (productoId ? repo.recetas.getByProducto(productoId) : Promise.resolve([])),
    enabled: Boolean(productoId),
  });
}
export function useProducciones() {
  const repo = useRepository();
  return useQuery({ queryKey: qk.producciones, queryFn: () => repo.producciones.list() });
}
export function useTiendas() {
  const repo = useRepository();
  return useQuery({ queryKey: qk.tiendas, queryFn: () => repo.tiendas.list() });
}
export function useEntregas() {
  const repo = useRepository();
  return useQuery({ queryKey: qk.entregas, queryFn: () => repo.entregas.list() });
}
export function useEntregaItems() {
  const repo = useRepository();
  return useQuery({ queryKey: qk.entregaItems, queryFn: () => repo.entregas.listItems() });
}
