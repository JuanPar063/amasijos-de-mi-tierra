import type {
  BackupJSON,
  CompraInsumo,
  CrudRepo,
  Entrega,
  EntregaConItems,
  EntregaItem,
  EntregaRepo,
  FiltroBorrado,
  ID,
  Insumo,
  NuevaCompraInsumo,
  NuevaEntrega,
  NuevaProduccion,
  NuevaTienda,
  NuevoEntregaItem,
  NuevoInsumo,
  NuevoProducto,
  NuevoRecetaItem,
  Produccion,
  Producto,
  RecetaItem,
  RecetaRepo,
  Repository,
  Tienda,
} from '@panaderia/shared';

const BASE = import.meta.env.VITE_API_URL ?? '/api';
type Metodo = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

async function http<T>(metodo: Metodo, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: metodo,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`API ${metodo} ${path} → ${res.status}`);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

async function getNullable<T>(path: string): Promise<T | null> {
  const res = await fetch(`${BASE}${path}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API GET ${path} → ${res.status}`);
  return (await res.json()) as T;
}

function crud<T extends { id: ID }, N>(base: string): CrudRepo<T, N> {
  return {
    list: () => http<T[]>('GET', base),
    get: (id) => getNullable<T>(`${base}/${id}`),
    create: (data) => http<T>('POST', base, data),
    update: (id, data) => http<T>('PATCH', `${base}/${id}`, data),
    delete: (id) => http<void>('DELETE', `${base}/${id}`),
  };
}

/** Adaptador de almacenamiento contra el backend REST (versión nube). */
export class ApiRepository implements Repository {
  insumos = crud<Insumo, NuevoInsumo>('/insumos');
  compras = crud<CompraInsumo, NuevaCompraInsumo>('/compras');
  productos = crud<Producto, NuevoProducto>('/productos');
  tiendas = crud<Tienda, NuevaTienda>('/tiendas');
  producciones = crud<Produccion, NuevaProduccion>('/producciones');

  recetas: RecetaRepo = {
    list: () => http<RecetaItem[]>('GET', '/recetas'),
    getByProducto: (productoId) => http<RecetaItem[]>('GET', `/productos/${productoId}/receta`),
    setByProducto: (productoId, items: NuevoRecetaItem[]) =>
      http<RecetaItem[]>('PUT', `/productos/${productoId}/receta`, items),
  };

  entregas: EntregaRepo = {
    list: () => http<Entrega[]>('GET', '/entregas'),
    listItems: () => http<EntregaItem[]>('GET', '/entregas/items'),
    get: (id) => getNullable<EntregaConItems>(`/entregas/${id}`),
    create: (data: NuevaEntrega, items: NuevoEntregaItem[]) =>
      http<EntregaConItems>('POST', '/entregas', { data, items }),
    update: (id, data: Partial<NuevaEntrega>, items: NuevoEntregaItem[]) =>
      http<EntregaConItems>('PUT', `/entregas/${id}`, { data, items }),
    delete: (id) => http<void>('DELETE', `/entregas/${id}`),
  };

  exportarBackup = () => http<BackupJSON>('GET', '/backup');
  importarBackup = (data: BackupJSON) => http<void>('POST', '/backup', data);
  borrarRegistros = (filtro: FiltroBorrado) => http<void>('POST', '/mantenimiento/borrar', filtro);
}
