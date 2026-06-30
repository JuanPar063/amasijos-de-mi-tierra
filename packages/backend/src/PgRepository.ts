import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
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
import { enTransaccion, query } from './db.js';

// Listas de columnas con alias para que las filas vuelvan con las claves del dominio.
const SEL_INSUMO = 'id, nombre, unidad_base AS "unidadBase", stock_actual AS "stockActual"';
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

const uno = <T>(filas: T[]): T | null => filas[0] ?? null;

async function ajustarStock(client: PoolClient, insumoId: ID, delta: number): Promise<void> {
  await client.query('UPDATE insumos SET stock_actual = stock_actual + $1 WHERE id = $2', [
    delta,
    insumoId,
  ]);
}

async function mapaUnidades(client: PoolClient): Promise<Map<ID, UnidadBase>> {
  const r = await client.query<{ id: ID; unidad_base: UnidadBase }>(
    'SELECT id, unidad_base FROM insumos',
  );
  return new Map(r.rows.map((row) => [row.id, row.unidad_base]));
}

async function recetaDe(client: PoolClient, productoId: ID): Promise<RecetaItem[]> {
  const r = await client.query<RecetaItem>(
    `SELECT ${SEL_RECETA} FROM recetas WHERE producto_id = $1`,
    [productoId],
  );
  return r.rows;
}

/** Mapa productoId -> bolsa de domicilio (empaque). */
async function mapaEmpaque(client: PoolClient): Promise<Map<ID, ID | undefined>> {
  const r = await client.query<{ id: ID; empaqueInsumoId: ID | null }>(
    'SELECT id, empaque_insumo_id AS "empaqueInsumoId" FROM productos',
  );
  return new Map(r.rows.map((row) => [row.id, row.empaqueInsumoId ?? undefined]));
}

/** Adaptador de almacenamiento contra PostgreSQL. Implementa el mismo contrato Repository. */
export class PgRepository implements Repository {
  insumos: CrudRepo<Insumo, NuevoInsumo> = {
    list: () => query<Insumo>(`SELECT ${SEL_INSUMO} FROM insumos ORDER BY nombre`),
    get: async (id) => uno(await query<Insumo>(`SELECT ${SEL_INSUMO} FROM insumos WHERE id = $1`, [id])),
    create: async (data) => {
      const insumo: Insumo = {
        id: randomUUID(),
        nombre: data.nombre.trim(),
        unidadBase: data.unidadBase ?? 'g',
        stockActual: data.stockActual ?? 0,
      };
      await query(
        'INSERT INTO insumos (id, nombre, unidad_base, stock_actual) VALUES ($1, $2, $3, $4)',
        [insumo.id, insumo.nombre, insumo.unidadBase, insumo.stockActual],
      );
      return insumo;
    },
    update: async (id, patch) => {
      const cur = await this.insumos.get(id);
      if (!cur) throw new Error('Insumo no encontrado');
      const next: Insumo = { ...cur, ...patch };
      await query('UPDATE insumos SET nombre = $2, unidad_base = $3, stock_actual = $4 WHERE id = $1', [
        id,
        next.nombre,
        next.unidadBase,
        next.stockActual,
      ]);
      return next;
    },
    delete: async (id) => {
      await query('DELETE FROM insumos WHERE id = $1', [id]); // cascada: compras y recetas
    },
  };

  compras: CrudRepo<CompraInsumo, NuevaCompraInsumo> = {
    list: () => query<CompraInsumo>(`SELECT ${SEL_COMPRA} FROM compras_insumo ORDER BY fecha DESC`),
    get: async (id) =>
      uno(await query<CompraInsumo>(`SELECT ${SEL_COMPRA} FROM compras_insumo WHERE id = $1`, [id])),
    create: async (data) => {
      const compra: CompraInsumo = { id: randomUUID(), ...data };
      return enTransaccion(async (c) => {
        await c.query(
          'INSERT INTO compras_insumo (id, insumo_id, fecha, cantidad, costo_total) VALUES ($1, $2, $3, $4, $5)',
          [compra.id, compra.insumoId, compra.fecha, compra.cantidad, compra.costoTotal],
        );
        await ajustarStock(c, compra.insumoId, compra.cantidad);
        return compra;
      });
    },
    update: async (id, patch) => {
      return enTransaccion(async (c) => {
        const prev = uno(
          (await c.query<CompraInsumo>(`SELECT ${SEL_COMPRA} FROM compras_insumo WHERE id = $1`, [id]))
            .rows,
        );
        if (!prev) throw new Error('Compra no encontrada');
        const next: CompraInsumo = { ...prev, ...patch };
        await ajustarStock(c, prev.insumoId, -prev.cantidad);
        await ajustarStock(c, next.insumoId, next.cantidad);
        await c.query(
          'UPDATE compras_insumo SET insumo_id = $2, fecha = $3, cantidad = $4, costo_total = $5 WHERE id = $1',
          [id, next.insumoId, next.fecha, next.cantidad, next.costoTotal],
        );
        return next;
      });
    },
    delete: async (id) => {
      await enTransaccion(async (c) => {
        const prev = uno(
          (await c.query<CompraInsumo>(`SELECT ${SEL_COMPRA} FROM compras_insumo WHERE id = $1`, [id]))
            .rows,
        );
        if (!prev) return;
        await ajustarStock(c, prev.insumoId, -prev.cantidad);
        await c.query('DELETE FROM compras_insumo WHERE id = $1', [id]);
      });
    },
  };

  productos: CrudRepo<Producto, NuevoProducto> = {
    list: () => query<Producto>(`SELECT ${SEL_PRODUCTO} FROM productos ORDER BY nombre`),
    get: async (id) =>
      uno(await query<Producto>(`SELECT ${SEL_PRODUCTO} FROM productos WHERE id = $1`, [id])),
    create: async (data) => {
      const producto: Producto = {
        id: randomUUID(),
        nombre: data.nombre.trim(),
        precioVenta: data.precioVenta,
        precioMostrador: data.precioMostrador,
        empaqueInsumoId: data.empaqueInsumoId,
      };
      await query(
        'INSERT INTO productos (id, nombre, precio_venta, precio_mostrador, empaque_insumo_id) VALUES ($1, $2, $3, $4, $5)',
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
      await query(
        'UPDATE productos SET nombre = $2, precio_venta = $3, precio_mostrador = $4, empaque_insumo_id = $5 WHERE id = $1',
        [id, next.nombre, next.precioVenta, next.precioMostrador ?? null, next.empaqueInsumoId ?? null],
      );
      return next;
    },
    delete: async (id) => {
      await query('DELETE FROM productos WHERE id = $1', [id]); // cascada: recetas
    },
  };

  recetas: RecetaRepo = {
    list: () => query<RecetaItem>(`SELECT ${SEL_RECETA} FROM recetas`),
    getByProducto: (productoId) =>
      query<RecetaItem>(`SELECT ${SEL_RECETA} FROM recetas WHERE producto_id = $1`, [productoId]),
    setByProducto: async (productoId, items: NuevoRecetaItem[]) => {
      return enTransaccion(async (c) => {
        await c.query('DELETE FROM recetas WHERE producto_id = $1', [productoId]);
        for (const it of items) {
          await c.query(
            'INSERT INTO recetas (id, producto_id, insumo_id, cantidad) VALUES ($1, $2, $3, $4)',
            [randomUUID(), productoId, it.insumoId, it.cantidad],
          );
        }
        return (await c.query<RecetaItem>(`SELECT ${SEL_RECETA} FROM recetas WHERE producto_id = $1`, [
          productoId,
        ])).rows;
      });
    },
  };

  producciones: CrudRepo<Produccion, NuevaProduccion> = {
    list: async () =>
      (await query<RawProduccion>(`SELECT ${SEL_PRODUCCION} FROM producciones ORDER BY fecha DESC`)).map(
        mapProduccion,
      ),
    get: async (id) => {
      const r = uno(
        await query<RawProduccion>(`SELECT ${SEL_PRODUCCION} FROM producciones WHERE id = $1`, [id]),
      );
      return r ? mapProduccion(r) : null;
    },
    create: async (data) => {
      const prod: Produccion = { id: randomUUID(), ...data };
      return enTransaccion(async (c) => {
        await c.query(
          'INSERT INTO producciones (id, fecha, hora, producto_id, cantidad_unidades, merma_g) VALUES ($1, $2, $3, $4, $5, $6)',
          [prod.id, prod.fecha, prod.hora, prod.productoId, prod.cantidadUnidades, prod.mermaG ?? null],
        );
        const receta = await recetaDe(c, prod.productoId);
        const unidades = await mapaUnidades(c);
        for (const cons of consumoDeProduccion(prod, receta, unidades)) {
          await ajustarStock(c, cons.insumoId, -cons.cantidad);
        }
        return prod;
      });
    },
    update: async (id, patch) => {
      return enTransaccion(async (c) => {
        const prev = uno(
          (await c.query<RawProduccion>(`SELECT ${SEL_PRODUCCION} FROM producciones WHERE id = $1`, [id]))
            .rows,
        );
        if (!prev) throw new Error('Producción no encontrada');
        const prevProd = mapProduccion(prev);
        const unidades = await mapaUnidades(c);
        // revertir consumo anterior
        for (const cons of consumoDeProduccion(prevProd, await recetaDe(c, prevProd.productoId), unidades)) {
          await ajustarStock(c, cons.insumoId, cons.cantidad);
        }
        const next: Produccion = { ...prevProd, ...patch };
        await c.query(
          'UPDATE producciones SET fecha = $2, hora = $3, producto_id = $4, cantidad_unidades = $5, merma_g = $6 WHERE id = $1',
          [id, next.fecha, next.hora, next.productoId, next.cantidadUnidades, next.mermaG ?? null],
        );
        // aplicar consumo nuevo
        for (const cons of consumoDeProduccion(next, await recetaDe(c, next.productoId), unidades)) {
          await ajustarStock(c, cons.insumoId, -cons.cantidad);
        }
        return next;
      });
    },
    delete: async (id) => {
      await enTransaccion(async (c) => {
        const prev = uno(
          (await c.query<RawProduccion>(`SELECT ${SEL_PRODUCCION} FROM producciones WHERE id = $1`, [id]))
            .rows,
        );
        if (!prev) return;
        const prevProd = mapProduccion(prev);
        const unidades = await mapaUnidades(c);
        for (const cons of consumoDeProduccion(prevProd, await recetaDe(c, prevProd.productoId), unidades)) {
          await ajustarStock(c, cons.insumoId, cons.cantidad);
        }
        await c.query('DELETE FROM producciones WHERE id = $1', [id]);
      });
    },
  };

  tiendas: CrudRepo<Tienda, NuevaTienda> = {
    list: async () =>
      (await query<RawTienda>(`SELECT ${SEL_TIENDA} FROM tiendas ORDER BY nombre`)).map(mapTienda),
    get: async (id) => {
      const r = uno(await query<RawTienda>(`SELECT ${SEL_TIENDA} FROM tiendas WHERE id = $1`, [id]));
      return r ? mapTienda(r) : null;
    },
    create: async (data) => {
      const tienda: Tienda = { id: randomUUID(), ...data, nombre: data.nombre.trim() };
      await query('INSERT INTO tiendas (id, nombre, direccion, contacto) VALUES ($1, $2, $3, $4)', [
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
      await query('UPDATE tiendas SET nombre = $2, direccion = $3, contacto = $4 WHERE id = $1', [
        id,
        next.nombre,
        next.direccion ?? null,
        next.contacto ?? null,
      ]);
      return next;
    },
    delete: async (id) => {
      await query('DELETE FROM tiendas WHERE id = $1', [id]);
    },
  };

  entregas: EntregaRepo = {
    list: () => query<Entrega>(`SELECT ${SEL_ENTREGA} FROM entregas ORDER BY fecha DESC`),
    listItems: () => query<EntregaItem>(`SELECT ${SEL_ENTREGA_ITEM} FROM entrega_items`),
    get: async (id) => {
      const entrega = uno(
        await query<Entrega>(`SELECT ${SEL_ENTREGA} FROM entregas WHERE id = $1`, [id]),
      );
      if (!entrega) return null;
      const items = await query<EntregaItem>(
        `SELECT ${SEL_ENTREGA_ITEM} FROM entrega_items WHERE entrega_id = $1`,
        [id],
      );
      return { entrega, items };
    },
    create: async (data: NuevaEntrega, items: NuevoEntregaItem[]) => {
      const entrega: Entrega = { id: randomUUID(), ...data };
      const filas: EntregaItem[] = items.map((it) => ({ id: randomUUID(), entregaId: entrega.id, ...it }));
      return enTransaccion<EntregaConItems>(async (c) => {
        await c.query('INSERT INTO entregas (id, fecha, hora, tienda_id) VALUES ($1, $2, $3, $4)', [
          entrega.id,
          entrega.fecha,
          entrega.hora,
          entrega.tiendaId,
        ]);
        const empaque = await mapaEmpaque(c);
        for (const it of filas) {
          await c.query(
            'INSERT INTO entrega_items (id, entrega_id, producto_id, cantidad, precio_unitario) VALUES ($1, $2, $3, $4, $5)',
            [it.id, it.entregaId, it.productoId, it.cantidad, it.precioUnitario],
          );
          const bolsa = empaque.get(it.productoId);
          if (bolsa) await ajustarStock(c, bolsa, -it.cantidad);
        }
        return { entrega, items: filas };
      });
    },
    update: async (id, data: Partial<NuevaEntrega>, items: NuevoEntregaItem[]) => {
      return enTransaccion<EntregaConItems>(async (c) => {
        const prev = uno(
          (await c.query<Entrega>(`SELECT ${SEL_ENTREGA} FROM entregas WHERE id = $1`, [id])).rows,
        );
        if (!prev) throw new Error('Entrega no encontrada');
        const empaque = await mapaEmpaque(c);
        const viejos = (
          await c.query<EntregaItem>(
            `SELECT ${SEL_ENTREGA_ITEM} FROM entrega_items WHERE entrega_id = $1`,
            [id],
          )
        ).rows;
        for (const it of viejos) {
          const bolsa = empaque.get(it.productoId);
          if (bolsa) await ajustarStock(c, bolsa, it.cantidad);
        }
        const entrega: Entrega = { ...prev, ...data };
        await c.query('UPDATE entregas SET fecha = $2, hora = $3, tienda_id = $4 WHERE id = $1', [
          id,
          entrega.fecha,
          entrega.hora,
          entrega.tiendaId,
        ]);
        await c.query('DELETE FROM entrega_items WHERE entrega_id = $1', [id]);
        const filas: EntregaItem[] = items.map((it) => ({ id: randomUUID(), entregaId: id, ...it }));
        for (const it of filas) {
          await c.query(
            'INSERT INTO entrega_items (id, entrega_id, producto_id, cantidad, precio_unitario) VALUES ($1, $2, $3, $4, $5)',
            [it.id, it.entregaId, it.productoId, it.cantidad, it.precioUnitario],
          );
          const bolsa = empaque.get(it.productoId);
          if (bolsa) await ajustarStock(c, bolsa, -it.cantidad);
        }
        return { entrega, items: filas };
      });
    },
    delete: async (id) => {
      await enTransaccion(async (c) => {
        const empaque = await mapaEmpaque(c);
        const items = (
          await c.query<EntregaItem>(
            `SELECT ${SEL_ENTREGA_ITEM} FROM entrega_items WHERE entrega_id = $1`,
            [id],
          )
        ).rows;
        for (const it of items) {
          const bolsa = empaque.get(it.productoId);
          if (bolsa) await ajustarStock(c, bolsa, it.cantidad);
        }
        await c.query('DELETE FROM entregas WHERE id = $1', [id]); // cascada: entrega_items
      });
    },
  };

  ventasDirectas: VentaDirectaRepo = {
    list: () => query<VentaDirecta>(`SELECT ${SEL_VENTA} FROM ventas_directas ORDER BY fecha DESC`),
    registrar: async (data: NuevaVentaDirecta) => {
      const rows = await query<VentaDirecta>(
        `INSERT INTO ventas_directas (id, fecha, producto_id, cantidad, precio_unitario)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (fecha, producto_id) DO UPDATE
           SET cantidad = ventas_directas.cantidad + EXCLUDED.cantidad
         RETURNING ${SEL_VENTA}`,
        [randomUUID(), data.fecha, data.productoId, data.cantidad, data.precioUnitario],
      );
      return rows[0];
    },
    setCantidad: async (id, cantidad) => {
      const rows = await query<VentaDirecta>(
        `UPDATE ventas_directas SET cantidad = $2 WHERE id = $1 RETURNING ${SEL_VENTA}`,
        [id, cantidad],
      );
      if (!rows[0]) throw new Error('Venta no encontrada');
      return rows[0];
    },
    delete: async (id) => {
      await query('DELETE FROM ventas_directas WHERE id = $1', [id]);
    },
  };

  async exportarBackup(): Promise<BackupJSON> {
    return {
      version: 1,
      exportadoEn: new Date().toISOString(),
      datos: {
        insumos: await query<Insumo>(`SELECT ${SEL_INSUMO} FROM insumos`),
        compras: await query<CompraInsumo>(`SELECT ${SEL_COMPRA} FROM compras_insumo`),
        productos: await query<Producto>(`SELECT ${SEL_PRODUCTO} FROM productos`),
        recetas: await query<RecetaItem>(`SELECT ${SEL_RECETA} FROM recetas`),
        producciones: (await query<RawProduccion>(`SELECT ${SEL_PRODUCCION} FROM producciones`)).map(
          mapProduccion,
        ),
        tiendas: (await query<RawTienda>(`SELECT ${SEL_TIENDA} FROM tiendas`)).map(mapTienda),
        entregas: await query<Entrega>(`SELECT ${SEL_ENTREGA} FROM entregas`),
        entregaItems: await query<EntregaItem>(`SELECT ${SEL_ENTREGA_ITEM} FROM entrega_items`),
        ventasDirectas: await query<VentaDirecta>(`SELECT ${SEL_VENTA} FROM ventas_directas`),
      },
    };
  }

  async importarBackup(data: BackupJSON): Promise<void> {
    const d = data.datos;
    await enTransaccion(async (c) => {
      await c.query(
        'TRUNCATE ventas_directas, entrega_items, entregas, producciones, recetas, productos, compras_insumo, tiendas, insumos',
      );
      for (const i of d.insumos)
        await c.query(
          'INSERT INTO insumos (id, nombre, unidad_base, stock_actual) VALUES ($1, $2, $3, $4)',
          [i.id, i.nombre, i.unidadBase, i.stockActual],
        );
      for (const x of d.compras)
        await c.query(
          'INSERT INTO compras_insumo (id, insumo_id, fecha, cantidad, costo_total) VALUES ($1, $2, $3, $4, $5)',
          [x.id, x.insumoId, x.fecha, x.cantidad, x.costoTotal],
        );
      for (const p of d.productos)
        await c.query(
          'INSERT INTO productos (id, nombre, precio_venta, precio_mostrador, empaque_insumo_id) VALUES ($1, $2, $3, $4, $5)',
          [p.id, p.nombre, p.precioVenta, p.precioMostrador ?? null, p.empaqueInsumoId ?? null],
        );
      for (const r of d.recetas)
        await c.query(
          'INSERT INTO recetas (id, producto_id, insumo_id, cantidad) VALUES ($1, $2, $3, $4)',
          [r.id, r.productoId, r.insumoId, r.cantidad],
        );
      for (const p of d.producciones)
        await c.query(
          'INSERT INTO producciones (id, fecha, hora, producto_id, cantidad_unidades, merma_g) VALUES ($1, $2, $3, $4, $5, $6)',
          [p.id, p.fecha, p.hora, p.productoId, p.cantidadUnidades, p.mermaG ?? null],
        );
      for (const t of d.tiendas)
        await c.query('INSERT INTO tiendas (id, nombre, direccion, contacto) VALUES ($1, $2, $3, $4)', [
          t.id,
          t.nombre,
          t.direccion ?? null,
          t.contacto ?? null,
        ]);
      for (const e of d.entregas)
        await c.query('INSERT INTO entregas (id, fecha, hora, tienda_id) VALUES ($1, $2, $3, $4)', [
          e.id,
          e.fecha,
          e.hora,
          e.tiendaId,
        ]);
      for (const it of d.entregaItems)
        await c.query(
          'INSERT INTO entrega_items (id, entrega_id, producto_id, cantidad, precio_unitario) VALUES ($1, $2, $3, $4, $5)',
          [it.id, it.entregaId, it.productoId, it.cantidad, it.precioUnitario],
        );
      for (const v of d.ventasDirectas ?? [])
        await c.query(
          'INSERT INTO ventas_directas (id, fecha, producto_id, cantidad, precio_unitario) VALUES ($1, $2, $3, $4, $5)',
          [v.id, v.fecha, v.productoId, v.cantidad, v.precioUnitario],
        );
    });
  }

  async borrarRegistros(filtro: FiltroBorrado): Promise<void> {
    // Cierre de mes: borra transacciones hasta la fecha; conserva catálogos y stock.
    await enTransaccion(async (c) => {
      await c.query('DELETE FROM compras_insumo WHERE fecha <= $1', [filtro.hasta]);
      await c.query('DELETE FROM producciones WHERE fecha <= $1', [filtro.hasta]);
      await c.query(
        'DELETE FROM entrega_items WHERE entrega_id IN (SELECT id FROM entregas WHERE fecha <= $1)',
        [filtro.hasta],
      );
      await c.query('DELETE FROM entregas WHERE fecha <= $1', [filtro.hasta]);
      await c.query('DELETE FROM ventas_directas WHERE fecha <= $1', [filtro.hasta]);
    });
  }
}
