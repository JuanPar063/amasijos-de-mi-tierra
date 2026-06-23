// Contrato de almacenamiento. Ambos adaptadores lo implementan:
//   - LocalRepository  -> Dexie/IndexedDB (web) y SQLite nativo (Fase 4)
//   - ApiRepository    -> REST contra el backend (Fase 3)
// El frontend depende solo de esta interfaz; nunca sabe cuál está activo.
import type {
  CompraInsumo,
  Entrega,
  EntregaItem,
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
  Tienda,
} from '../domain/entities';

/** CRUD genérico. `N` es el tipo de datos para crear (sin id ni campos derivados). */
export interface CrudRepo<T extends { id: ID }, N> {
  list(): Promise<T[]>;
  get(id: ID): Promise<T | null>;
  create(data: N): Promise<T>;
  update(id: ID, data: Partial<N>): Promise<T>;
  delete(id: ID): Promise<void>;
}

/** La receta se gestiona como un conjunto por producto (reemplazo completo). */
export interface RecetaRepo {
  list(): Promise<RecetaItem[]>;
  getByProducto(productoId: ID): Promise<RecetaItem[]>;
  setByProducto(productoId: ID, items: NuevoRecetaItem[]): Promise<RecetaItem[]>;
}

export interface EntregaConItems {
  entrega: Entrega;
  items: EntregaItem[];
}

/** Una entrega es un encabezado + sus renglones; se crean/editan juntos. */
export interface EntregaRepo {
  list(): Promise<Entrega[]>;
  listItems(): Promise<EntregaItem[]>;
  get(id: ID): Promise<EntregaConItems | null>;
  create(data: NuevaEntrega, items: NuevoEntregaItem[]): Promise<EntregaConItems>;
  update(id: ID, data: Partial<NuevaEntrega>, items: NuevoEntregaItem[]): Promise<EntregaConItems>;
  delete(id: ID): Promise<void>;
}

/** Respaldo completo de todos los datos (JSON). */
export interface BackupJSON {
  version: 1;
  exportadoEn: string;
  datos: {
    insumos: Insumo[];
    compras: CompraInsumo[];
    productos: Producto[];
    recetas: RecetaItem[];
    producciones: Produccion[];
    tiendas: Tienda[];
    entregas: Entrega[];
    entregaItems: EntregaItem[];
  };
}

/**
 * Filtro de borrado para "cerrar el mes": elimina registros transaccionales
 * (compras, producciones, entregas) con fecha <= `hasta`. No toca los
 * catálogos (insumos, productos, recetas, tiendas) ni el stock vigente.
 */
export interface FiltroBorrado {
  hasta: string;
}

export interface Repository {
  insumos: CrudRepo<Insumo, NuevoInsumo>;
  compras: CrudRepo<CompraInsumo, NuevaCompraInsumo>;
  productos: CrudRepo<Producto, NuevoProducto>;
  recetas: RecetaRepo;
  producciones: CrudRepo<Produccion, NuevaProduccion>;
  tiendas: CrudRepo<Tienda, NuevaTienda>;
  entregas: EntregaRepo;

  // Mantenimiento de datos
  exportarBackup(): Promise<BackupJSON>;
  importarBackup(data: BackupJSON): Promise<void>;
  borrarRegistros(filtro: FiltroBorrado): Promise<void>;
}
