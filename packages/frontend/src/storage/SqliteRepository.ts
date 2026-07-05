import {
  CapacitorSQLite,
  SQLiteConnection,
  type SQLiteDBConnection,
} from '@capacitor-community/sqlite';
import { consumoDeProduccion } from '@panaderia/shared';
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
  NuevaVentaDirecta,
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
  UnidadBase,
  VentaDirecta,
  VentaDirectaRepo,
} from '@panaderia/shared';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS insumos (
  id TEXT PRIMARY KEY, nombre TEXT NOT NULL, unidad_base TEXT NOT NULL,
  stock_actual REAL NOT NULL DEFAULT 0, precio_base REAL
);
CREATE TABLE IF NOT EXISTS compras_insumo (
  id TEXT PRIMARY KEY, insumo_id TEXT NOT NULL REFERENCES insumos(id) ON DELETE CASCADE,
  fecha TEXT NOT NULL, cantidad REAL NOT NULL, costo_total REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS productos (
  id TEXT PRIMARY KEY, nombre TEXT NOT NULL, precio_venta REAL NOT NULL DEFAULT 0,
  precio_mostrador REAL, empaque_insumo_id TEXT
);
CREATE TABLE IF NOT EXISTS recetas (
  id TEXT PRIMARY KEY, producto_id TEXT NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  insumo_id TEXT NOT NULL REFERENCES insumos(id) ON DELETE CASCADE, cantidad REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS producciones (
  id TEXT PRIMARY KEY, fecha TEXT NOT NULL, hora TEXT NOT NULL, producto_id TEXT NOT NULL,
  cantidad_unidades REAL NOT NULL, merma_g REAL
);
CREATE TABLE IF NOT EXISTS tiendas (
  id TEXT PRIMARY KEY, nombre TEXT NOT NULL, direccion TEXT, contacto TEXT
);
CREATE TABLE IF NOT EXISTS entregas (
  id TEXT PRIMARY KEY, fecha TEXT NOT NULL, hora TEXT NOT NULL, tienda_id TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS entrega_items (
  id TEXT PRIMARY KEY, entrega_id TEXT NOT NULL REFERENCES entregas(id) ON DELETE CASCADE,
  producto_id TEXT NOT NULL, cantidad REAL NOT NULL, precio_unitario REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS ventas_directas (
  id TEXT PRIMARY KEY, fecha TEXT NOT NULL, producto_id TEXT NOT NULL,
  cantidad REAL NOT NULL, precio_unitario REAL NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_venta_dia ON ventas_directas(fecha, producto_id);
`;

const SEL_INSUMO =
  'id, nombre, unidad_base AS "unidadBase", stock_actual AS "stockActual", precio_base AS "precioBase"';
const SEL_COMPRA = 'id, insumo_id AS "insumoId", fecha, cantidad, costo_total AS "costoTotal"';
const SEL_PRODUCTO =
  'id, nombre, precio_venta AS "precioVenta", precio_mostrador AS "precioMostrador", empaque_insumo_id AS "empaqueInsumoId"';
const SEL_VENTA =
  'id, fecha, producto_id AS "productoId", cantidad, precio_unitario AS "precioUnitario"';
const SEL_RECETA = 'id, producto_id AS "productoId", insumo_id AS "insumoId", cantidad';
const SEL_PRODUCCION =
  'id, fecha, hora, producto_id AS "productoId", cantidad_unidades AS "cantidadUnidades", merma_g AS "mermaG"';
const SEL_TIENDA = 'id, nombre, direccion, contacto';
const SEL_ENTREGA = 'id, fecha, hora, tienda_id AS "tiendaId"';
const SEL_ENTREGA_ITEM =
  'id, entrega_id AS "entregaId", producto_id AS "productoId", cantidad, precio_unitario AS "precioUnitario"';

interface RawProduccion {
  id: ID;
  fecha: string;
  hora: string;
  productoId: ID;
  cantidadUnidades: number;
  mermaG: number | null;
}
interface RawTienda {
  id: ID;
  nombre: string;
  direccion: string | null;
  contacto: string | null;
}

const mapProduccion = (r: RawProduccion): Produccion => ({
  id: r.id,
  fecha: r.fecha,
  hora: r.hora,
  productoId: r.productoId,
  cantidadUnidades: r.cantidadUnidades,
  mermaG: r.mermaG ?? undefined,
});
const mapTienda = (r: RawTienda): Tienda => ({
  id: r.id,
  nombre: r.nombre,
  direccion: r.direccion ?? undefined,
  contacto: r.contacto ?? undefined,
});

const nuevoId = (): string => crypto.randomUUID();
const uno = <T>(filas: T[]): T | null => filas[0] ?? null;

/**
 * Adaptador de almacenamiento local NATIVO (SQLite vía @capacitor-community/sqlite),
 * usado dentro del APK. Implementa el mismo contrato Repository que el adaptador
 * web (Dexie) y reutiliza los cálculos de @panaderia/shared.
 */
export class SqliteRepository implements Repository {
  private db!: SQLiteDBConnection;

  async init(): Promise<void> {
    const sqlite = new SQLiteConnection(CapacitorSQLite);
    const existe = (await sqlite.isConnection('panaderia', false)).result;
    this.db = existe
      ? await sqlite.retrieveConnection('panaderia', false)
      : await sqlite.createConnection('panaderia', false, 'no-encryption', 1, false);
    if (!(await this.db.isDBOpen()).result) await this.db.open();
    await this.db.execute('PRAGMA foreign_keys = ON;');
    await this.db.execute(SCHEMA);
    // Migración para BD ya existentes: agrega columnas si faltan (ignora el error si ya están).
    for (const ddl of [
      'ALTER TABLE productos ADD COLUMN precio_mostrador REAL;',
      'ALTER TABLE productos ADD COLUMN empaque_insumo_id TEXT;',
      'ALTER TABLE insumos ADD COLUMN precio_base REAL;',
    ]) {
      try {
        await this.db.execute(ddl);
      } catch {
        // la columna ya existe
      }
    }
  }

  /** Mapa productoId -> bolsa de domicilio. */
  private async mapaEmpaque(): Promise<Map<ID, ID | undefined>> {
    const filas = await this.q<{ id: ID; empaqueInsumoId: ID | null }>(
      'SELECT id, empaque_insumo_id AS "empaqueInsumoId" FROM productos',
    );
    return new Map(filas.map((f) => [f.id, f.empaqueInsumoId ?? undefined]));
  }

  private async q<T>(stmt: string, values: unknown[] = []): Promise<T[]> {
    const r = await this.db.query(stmt, values);
    return (r.values ?? []) as T[];
  }
  private async run(stmt: string, values: unknown[] = [], txn = true): Promise<void> {
    await this.db.run(stmt, values, txn);
  }
  private async tx<T>(fn: () => Promise<T>): Promise<T> {
    await this.db.beginTransaction();
    try {
      const r = await fn();
      await this.db.commitTransaction();
      return r;
    } catch (e) {
      await this.db.rollbackTransaction();
      throw e;
    }
  }
  private async ajustarStock(insumoId: ID, delta: number): Promise<void> {
    await this.run('UPDATE insumos SET stock_actual = stock_actual + ? WHERE id = ?', [delta, insumoId], false);
  }
  private async mapaUnidades(): Promise<Map<ID, UnidadBase>> {
    const filas = await this.q<{ id: ID; unidadBase: UnidadBase }>(
      'SELECT id, unidad_base AS "unidadBase" FROM insumos',
    );
    return new Map(filas.map((f) => [f.id, f.unidadBase]));
  }
  private recetaDe(productoId: ID): Promise<RecetaItem[]> {
    return this.q<RecetaItem>(`SELECT ${SEL_RECETA} FROM recetas WHERE producto_id = ?`, [productoId]);
  }

  insumos: CrudRepo<Insumo, NuevoInsumo> = {
    list: () => this.q<Insumo>(`SELECT ${SEL_INSUMO} FROM insumos ORDER BY nombre`),
    get: async (id) => uno(await this.q<Insumo>(`SELECT ${SEL_INSUMO} FROM insumos WHERE id = ?`, [id])),
    create: async (data) => {
      const insumo: Insumo = {
        id: nuevoId(),
        nombre: data.nombre.trim(),
        unidadBase: data.unidadBase ?? 'g',
        stockActual: data.stockActual ?? 0,
        ...(data.precioBase != null ? { precioBase: data.precioBase } : {}),
      };
      await this.run(
        'INSERT INTO insumos (id, nombre, unidad_base, stock_actual, precio_base) VALUES (?, ?, ?, ?, ?)',
        [insumo.id, insumo.nombre, insumo.unidadBase, insumo.stockActual, insumo.precioBase ?? null],
      );
      return insumo;
    },
    update: async (id, patch) => {
      const cur = await this.insumos.get(id);
      if (!cur) throw new Error('Insumo no encontrado');
      const next: Insumo = { ...cur, ...patch };
      await this.run(
        'UPDATE insumos SET nombre = ?, unidad_base = ?, stock_actual = ?, precio_base = ? WHERE id = ?',
        [next.nombre, next.unidadBase, next.stockActual, next.precioBase ?? null, id],
      );
      return next;
    },
    delete: async (id) => {
      await this.run('DELETE FROM insumos WHERE id = ?', [id]);
    },
  };

  compras: CrudRepo<CompraInsumo, NuevaCompraInsumo> = {
    list: () => this.q<CompraInsumo>(`SELECT ${SEL_COMPRA} FROM compras_insumo ORDER BY fecha DESC`),
    get: async (id) =>
      uno(await this.q<CompraInsumo>(`SELECT ${SEL_COMPRA} FROM compras_insumo WHERE id = ?`, [id])),
    create: async (data) => {
      const compra: CompraInsumo = { id: nuevoId(), ...data };
      return this.tx(async () => {
        await this.run(
          'INSERT INTO compras_insumo (id, insumo_id, fecha, cantidad, costo_total) VALUES (?, ?, ?, ?, ?)',
          [compra.id, compra.insumoId, compra.fecha, compra.cantidad, compra.costoTotal],
          false,
        );
        await this.ajustarStock(compra.insumoId, compra.cantidad);
        return compra;
      });
    },
    update: async (id, patch) => {
      return this.tx(async () => {
        const prev = uno(await this.q<CompraInsumo>(`SELECT ${SEL_COMPRA} FROM compras_insumo WHERE id = ?`, [id]));
        if (!prev) throw new Error('Compra no encontrada');
        const next: CompraInsumo = { ...prev, ...patch };
        await this.ajustarStock(prev.insumoId, -prev.cantidad);
        await this.ajustarStock(next.insumoId, next.cantidad);
        await this.run(
          'UPDATE compras_insumo SET insumo_id = ?, fecha = ?, cantidad = ?, costo_total = ? WHERE id = ?',
          [next.insumoId, next.fecha, next.cantidad, next.costoTotal, id],
          false,
        );
        return next;
      });
    },
    delete: async (id) => {
      await this.tx(async () => {
        const prev = uno(await this.q<CompraInsumo>(`SELECT ${SEL_COMPRA} FROM compras_insumo WHERE id = ?`, [id]));
        if (!prev) return;
        await this.ajustarStock(prev.insumoId, -prev.cantidad);
        await this.run('DELETE FROM compras_insumo WHERE id = ?', [id], false);
      });
    },
  };

  productos: CrudRepo<Producto, NuevoProducto> = {
    list: () => this.q<Producto>(`SELECT ${SEL_PRODUCTO} FROM productos ORDER BY nombre`),
    get: async (id) => uno(await this.q<Producto>(`SELECT ${SEL_PRODUCTO} FROM productos WHERE id = ?`, [id])),
    create: async (data) => {
      const producto: Producto = {
        id: nuevoId(),
        nombre: data.nombre.trim(),
        precioVenta: data.precioVenta,
        precioMostrador: data.precioMostrador,
        empaqueInsumoId: data.empaqueInsumoId,
      };
      await this.run(
        'INSERT INTO productos (id, nombre, precio_venta, precio_mostrador, empaque_insumo_id) VALUES (?, ?, ?, ?, ?)',
        [
          producto.id,
          producto.nombre,
          producto.precioVenta,
          producto.precioMostrador ?? null,
          producto.empaqueInsumoId ?? null,
        ],
      );
      return producto;
    },
    update: async (id, patch) => {
      const cur = await this.productos.get(id);
      if (!cur) throw new Error('Producto no encontrado');
      const next: Producto = { ...cur, ...patch };
      await this.run(
        'UPDATE productos SET nombre = ?, precio_venta = ?, precio_mostrador = ?, empaque_insumo_id = ? WHERE id = ?',
        [next.nombre, next.precioVenta, next.precioMostrador ?? null, next.empaqueInsumoId ?? null, id],
      );
      return next;
    },
    delete: async (id) => {
      await this.run('DELETE FROM productos WHERE id = ?', [id]);
    },
  };

  recetas: RecetaRepo = {
    list: () => this.q<RecetaItem>(`SELECT ${SEL_RECETA} FROM recetas`),
    getByProducto: (productoId) => this.recetaDe(productoId),
    setByProducto: async (productoId, items: NuevoRecetaItem[]) => {
      return this.tx(async () => {
        await this.run('DELETE FROM recetas WHERE producto_id = ?', [productoId], false);
        for (const it of items) {
          await this.run('INSERT INTO recetas (id, producto_id, insumo_id, cantidad) VALUES (?, ?, ?, ?)', [
            nuevoId(),
            productoId,
            it.insumoId,
            it.cantidad,
          ], false);
        }
        return this.recetaDe(productoId);
      });
    },
  };

  producciones: CrudRepo<Produccion, NuevaProduccion> = {
    list: async () =>
      (await this.q<RawProduccion>(`SELECT ${SEL_PRODUCCION} FROM producciones ORDER BY fecha DESC`)).map(
        mapProduccion,
      ),
    get: async (id) => {
      const r = uno(await this.q<RawProduccion>(`SELECT ${SEL_PRODUCCION} FROM producciones WHERE id = ?`, [id]));
      return r ? mapProduccion(r) : null;
    },
    create: async (data) => {
      const prod: Produccion = { id: nuevoId(), ...data };
      return this.tx(async () => {
        await this.run(
          'INSERT INTO producciones (id, fecha, hora, producto_id, cantidad_unidades, merma_g) VALUES (?, ?, ?, ?, ?, ?)',
          [prod.id, prod.fecha, prod.hora, prod.productoId, prod.cantidadUnidades, prod.mermaG ?? null],
          false,
        );
        const receta = await this.recetaDe(prod.productoId);
        const unidades = await this.mapaUnidades();
        for (const c of consumoDeProduccion(prod, receta, unidades)) {
          await this.ajustarStock(c.insumoId, -c.cantidad);
        }
        return prod;
      });
    },
    update: async (id, patch) => {
      return this.tx(async () => {
        const prev = uno(await this.q<RawProduccion>(`SELECT ${SEL_PRODUCCION} FROM producciones WHERE id = ?`, [id]));
        if (!prev) throw new Error('Producción no encontrada');
        const prevProd = mapProduccion(prev);
        const unidades = await this.mapaUnidades();
        for (const c of consumoDeProduccion(prevProd, await this.recetaDe(prevProd.productoId), unidades)) {
          await this.ajustarStock(c.insumoId, c.cantidad);
        }
        const next: Produccion = { ...prevProd, ...patch };
        await this.run(
          'UPDATE producciones SET fecha = ?, hora = ?, producto_id = ?, cantidad_unidades = ?, merma_g = ? WHERE id = ?',
          [next.fecha, next.hora, next.productoId, next.cantidadUnidades, next.mermaG ?? null, id],
          false,
        );
        for (const c of consumoDeProduccion(next, await this.recetaDe(next.productoId), unidades)) {
          await this.ajustarStock(c.insumoId, -c.cantidad);
        }
        return next;
      });
    },
    delete: async (id) => {
      await this.tx(async () => {
        const prev = uno(await this.q<RawProduccion>(`SELECT ${SEL_PRODUCCION} FROM producciones WHERE id = ?`, [id]));
        if (!prev) return;
        const prevProd = mapProduccion(prev);
        const unidades = await this.mapaUnidades();
        for (const c of consumoDeProduccion(prevProd, await this.recetaDe(prevProd.productoId), unidades)) {
          await this.ajustarStock(c.insumoId, c.cantidad);
        }
        await this.run('DELETE FROM producciones WHERE id = ?', [id], false);
      });
    },
  };

  tiendas: CrudRepo<Tienda, NuevaTienda> = {
    list: async () =>
      (await this.q<RawTienda>(`SELECT ${SEL_TIENDA} FROM tiendas ORDER BY nombre`)).map(mapTienda),
    get: async (id) => {
      const r = uno(await this.q<RawTienda>(`SELECT ${SEL_TIENDA} FROM tiendas WHERE id = ?`, [id]));
      return r ? mapTienda(r) : null;
    },
    create: async (data) => {
      const tienda: Tienda = { id: nuevoId(), ...data, nombre: data.nombre.trim() };
      await this.run('INSERT INTO tiendas (id, nombre, direccion, contacto) VALUES (?, ?, ?, ?)', [
        tienda.id,
        tienda.nombre,
        tienda.direccion ?? null,
        tienda.contacto ?? null,
      ]);
      return tienda;
    },
    update: async (id, patch) => {
      const cur = await this.tiendas.get(id);
      if (!cur) throw new Error('Tienda no encontrada');
      const next: Tienda = { ...cur, ...patch };
      await this.run('UPDATE tiendas SET nombre = ?, direccion = ?, contacto = ? WHERE id = ?', [
        next.nombre,
        next.direccion ?? null,
        next.contacto ?? null,
        id,
      ]);
      return next;
    },
    delete: async (id) => {
      await this.run('DELETE FROM tiendas WHERE id = ?', [id]);
    },
  };

  entregas: EntregaRepo = {
    list: () => this.q<Entrega>(`SELECT ${SEL_ENTREGA} FROM entregas ORDER BY fecha DESC`),
    listItems: () => this.q<EntregaItem>(`SELECT ${SEL_ENTREGA_ITEM} FROM entrega_items`),
    get: async (id) => {
      const entrega = uno(await this.q<Entrega>(`SELECT ${SEL_ENTREGA} FROM entregas WHERE id = ?`, [id]));
      if (!entrega) return null;
      const items = await this.q<EntregaItem>(
        `SELECT ${SEL_ENTREGA_ITEM} FROM entrega_items WHERE entrega_id = ?`,
        [id],
      );
      return { entrega, items };
    },
    create: async (data: NuevaEntrega, items: NuevoEntregaItem[]) => {
      const entrega: Entrega = { id: nuevoId(), ...data };
      const filas: EntregaItem[] = items.map((it) => ({ id: nuevoId(), entregaId: entrega.id, ...it }));
      return this.tx<EntregaConItems>(async () => {
        await this.run('INSERT INTO entregas (id, fecha, hora, tienda_id) VALUES (?, ?, ?, ?)', [
          entrega.id,
          entrega.fecha,
          entrega.hora,
          entrega.tiendaId,
        ], false);
        const empaque = await this.mapaEmpaque();
        for (const it of filas) {
          await this.run(
            'INSERT INTO entrega_items (id, entrega_id, producto_id, cantidad, precio_unitario) VALUES (?, ?, ?, ?, ?)',
            [it.id, it.entregaId, it.productoId, it.cantidad, it.precioUnitario],
            false,
          );
          const bolsa = empaque.get(it.productoId);
          if (bolsa) await this.ajustarStock(bolsa, -it.cantidad);
        }
        return { entrega, items: filas };
      });
    },
    update: async (id, data: Partial<NuevaEntrega>, items: NuevoEntregaItem[]) => {
      return this.tx<EntregaConItems>(async () => {
        const prev = uno(await this.q<Entrega>(`SELECT ${SEL_ENTREGA} FROM entregas WHERE id = ?`, [id]));
        if (!prev) throw new Error('Entrega no encontrada');
        const empaque = await this.mapaEmpaque();
        const viejos = await this.q<EntregaItem>(
          `SELECT ${SEL_ENTREGA_ITEM} FROM entrega_items WHERE entrega_id = ?`,
          [id],
        );
        for (const it of viejos) {
          const bolsa = empaque.get(it.productoId);
          if (bolsa) await this.ajustarStock(bolsa, it.cantidad);
        }
        const entrega: Entrega = { ...prev, ...data };
        await this.run('UPDATE entregas SET fecha = ?, hora = ?, tienda_id = ? WHERE id = ?', [
          entrega.fecha,
          entrega.hora,
          entrega.tiendaId,
          id,
        ], false);
        await this.run('DELETE FROM entrega_items WHERE entrega_id = ?', [id], false);
        const filas: EntregaItem[] = items.map((it) => ({ id: nuevoId(), entregaId: id, ...it }));
        for (const it of filas) {
          await this.run(
            'INSERT INTO entrega_items (id, entrega_id, producto_id, cantidad, precio_unitario) VALUES (?, ?, ?, ?, ?)',
            [it.id, it.entregaId, it.productoId, it.cantidad, it.precioUnitario],
            false,
          );
          const bolsa = empaque.get(it.productoId);
          if (bolsa) await this.ajustarStock(bolsa, -it.cantidad);
        }
        return { entrega, items: filas };
      });
    },
    delete: async (id) => {
      await this.tx(async () => {
        const empaque = await this.mapaEmpaque();
        const items = await this.q<EntregaItem>(
          `SELECT ${SEL_ENTREGA_ITEM} FROM entrega_items WHERE entrega_id = ?`,
          [id],
        );
        for (const it of items) {
          const bolsa = empaque.get(it.productoId);
          if (bolsa) await this.ajustarStock(bolsa, it.cantidad);
        }
        await this.run('DELETE FROM entregas WHERE id = ?', [id], false);
      });
    },
  };

  ventasDirectas: VentaDirectaRepo = {
    list: () => this.q<VentaDirecta>(`SELECT ${SEL_VENTA} FROM ventas_directas ORDER BY fecha DESC`),
    registrar: async (data: NuevaVentaDirecta) => {
      await this.run(
        `INSERT INTO ventas_directas (id, fecha, producto_id, cantidad, precio_unitario)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(fecha, producto_id) DO UPDATE SET cantidad = cantidad + excluded.cantidad`,
        [nuevoId(), data.fecha, data.productoId, data.cantidad, data.precioUnitario],
      );
      const r = uno(
        await this.q<VentaDirecta>(
          `SELECT ${SEL_VENTA} FROM ventas_directas WHERE fecha = ? AND producto_id = ?`,
          [data.fecha, data.productoId],
        ),
      );
      if (!r) throw new Error('Venta no encontrada');
      return r;
    },
    setCantidad: async (id, cantidad) => {
      await this.run('UPDATE ventas_directas SET cantidad = ? WHERE id = ?', [cantidad, id]);
      const r = uno(await this.q<VentaDirecta>(`SELECT ${SEL_VENTA} FROM ventas_directas WHERE id = ?`, [id]));
      if (!r) throw new Error('Venta no encontrada');
      return r;
    },
    delete: async (id) => {
      await this.run('DELETE FROM ventas_directas WHERE id = ?', [id]);
    },
  };

  async exportarBackup(): Promise<BackupJSON> {
    return {
      version: 1,
      exportadoEn: new Date().toISOString(),
      datos: {
        insumos: await this.q<Insumo>(`SELECT ${SEL_INSUMO} FROM insumos`),
        compras: await this.q<CompraInsumo>(`SELECT ${SEL_COMPRA} FROM compras_insumo`),
        productos: await this.q<Producto>(`SELECT ${SEL_PRODUCTO} FROM productos`),
        recetas: await this.q<RecetaItem>(`SELECT ${SEL_RECETA} FROM recetas`),
        producciones: (await this.q<RawProduccion>(`SELECT ${SEL_PRODUCCION} FROM producciones`)).map(mapProduccion),
        tiendas: (await this.q<RawTienda>(`SELECT ${SEL_TIENDA} FROM tiendas`)).map(mapTienda),
        entregas: await this.q<Entrega>(`SELECT ${SEL_ENTREGA} FROM entregas`),
        entregaItems: await this.q<EntregaItem>(`SELECT ${SEL_ENTREGA_ITEM} FROM entrega_items`),
        ventasDirectas: await this.q<VentaDirecta>(`SELECT ${SEL_VENTA} FROM ventas_directas`),
      },
    };
  }

  async importarBackup(data: BackupJSON): Promise<void> {
    const d = data.datos;
    await this.tx(async () => {
      for (const t of ['ventas_directas', 'entrega_items', 'entregas', 'producciones', 'recetas', 'productos', 'compras_insumo', 'tiendas', 'insumos']) {
        await this.run(`DELETE FROM ${t}`, [], false);
      }
      for (const i of d.insumos)
        await this.run(
          'INSERT INTO insumos (id, nombre, unidad_base, stock_actual, precio_base) VALUES (?, ?, ?, ?, ?)',
          [i.id, i.nombre, i.unidadBase, i.stockActual, i.precioBase ?? null],
          false,
        );
      for (const x of d.compras)
        await this.run('INSERT INTO compras_insumo (id, insumo_id, fecha, cantidad, costo_total) VALUES (?, ?, ?, ?, ?)', [x.id, x.insumoId, x.fecha, x.cantidad, x.costoTotal], false);
      for (const p of d.productos)
        await this.run('INSERT INTO productos (id, nombre, precio_venta, precio_mostrador, empaque_insumo_id) VALUES (?, ?, ?, ?, ?)', [p.id, p.nombre, p.precioVenta, p.precioMostrador ?? null, p.empaqueInsumoId ?? null], false);
      for (const r of d.recetas)
        await this.run('INSERT INTO recetas (id, producto_id, insumo_id, cantidad) VALUES (?, ?, ?, ?)', [r.id, r.productoId, r.insumoId, r.cantidad], false);
      for (const p of d.producciones)
        await this.run('INSERT INTO producciones (id, fecha, hora, producto_id, cantidad_unidades, merma_g) VALUES (?, ?, ?, ?, ?, ?)', [p.id, p.fecha, p.hora, p.productoId, p.cantidadUnidades, p.mermaG ?? null], false);
      for (const t of d.tiendas)
        await this.run('INSERT INTO tiendas (id, nombre, direccion, contacto) VALUES (?, ?, ?, ?)', [t.id, t.nombre, t.direccion ?? null, t.contacto ?? null], false);
      for (const e of d.entregas)
        await this.run('INSERT INTO entregas (id, fecha, hora, tienda_id) VALUES (?, ?, ?, ?)', [e.id, e.fecha, e.hora, e.tiendaId], false);
      for (const it of d.entregaItems)
        await this.run('INSERT INTO entrega_items (id, entrega_id, producto_id, cantidad, precio_unitario) VALUES (?, ?, ?, ?, ?)', [it.id, it.entregaId, it.productoId, it.cantidad, it.precioUnitario], false);
      for (const v of d.ventasDirectas ?? [])
        await this.run('INSERT INTO ventas_directas (id, fecha, producto_id, cantidad, precio_unitario) VALUES (?, ?, ?, ?, ?)', [v.id, v.fecha, v.productoId, v.cantidad, v.precioUnitario], false);
    });
  }

  async borrarRegistros(filtro: FiltroBorrado): Promise<void> {
    await this.tx(async () => {
      await this.run('DELETE FROM compras_insumo WHERE fecha <= ?', [filtro.hasta], false);
      await this.run('DELETE FROM producciones WHERE fecha <= ?', [filtro.hasta], false);
      await this.run('DELETE FROM entrega_items WHERE entrega_id IN (SELECT id FROM entregas WHERE fecha <= ?)', [filtro.hasta], false);
      await this.run('DELETE FROM entregas WHERE fecha <= ?', [filtro.hasta], false);
      await this.run('DELETE FROM ventas_directas WHERE fecha <= ?', [filtro.hasta], false);
    });
  }
}
