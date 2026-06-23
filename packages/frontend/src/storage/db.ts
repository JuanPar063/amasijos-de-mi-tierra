import Dexie, { type Table } from 'dexie';
import type {
  CompraInsumo,
  Entrega,
  EntregaItem,
  Insumo,
  Produccion,
  Producto,
  RecetaItem,
  Tienda,
} from '@panaderia/shared';

/** Base de datos local (IndexedDB) de la versión práctica/offline. */
export class PanaderiaDB extends Dexie {
  insumos!: Table<Insumo, string>;
  compras!: Table<CompraInsumo, string>;
  productos!: Table<Producto, string>;
  recetas!: Table<RecetaItem, string>;
  producciones!: Table<Produccion, string>;
  tiendas!: Table<Tienda, string>;
  entregas!: Table<Entrega, string>;
  entregaItems!: Table<EntregaItem, string>;

  constructor() {
    super('panaderia');

    const stores = {
      insumos: 'id, nombre',
      compras: 'id, insumoId, fecha',
      productos: 'id, nombre',
      recetas: 'id, productoId, insumoId',
      producciones: 'id, fecha, productoId',
      tiendas: 'id, nombre',
      entregas: 'id, fecha, tiendaId',
      entregaItems: 'id, entregaId, productoId',
    };

    // v1: modelo original (todo en gramos).
    this.version(1).stores(stores);

    // v2: unidad base por insumo ('g' | 'u'). Renombra los campos de cantidad.
    this.version(2)
      .stores(stores)
      .upgrade(async (tx) => {
        await tx
          .table('insumos')
          .toCollection()
          .modify((i: Record<string, unknown>) => {
            i.stockActual = i.stockActual ?? i.stockActualG ?? 0;
            i.unidadBase = i.unidadBase ?? 'g';
            delete i.stockActualG;
          });
        await tx
          .table('compras')
          .toCollection()
          .modify((c: Record<string, unknown>) => {
            c.cantidad = c.cantidad ?? c.cantidadG ?? 0;
            delete c.cantidadG;
          });
        await tx
          .table('recetas')
          .toCollection()
          .modify((r: Record<string, unknown>) => {
            r.cantidad = r.cantidad ?? r.cantidadG ?? 0;
            delete r.cantidadG;
          });
      });
  }
}

export const db = new PanaderiaDB();
