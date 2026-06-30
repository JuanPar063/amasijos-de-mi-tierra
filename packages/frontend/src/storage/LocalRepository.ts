import { consumoDeProduccion } from '@panaderia/shared';
import type {
  BackupJSON,
  CompraInsumo,
  CrudRepo,
  Entrega,
  EntregaConItems,
  EntregaRepo,
  FiltroBorrado,
  ID,
  Insumo,
  NuevaCompraInsumo,
  NuevaProduccion,
  NuevaTienda,
  NuevaVentaDirecta,
  NuevoInsumo,
  NuevoProducto,
  NuevoRecetaItem,
  Produccion,
  Producto,
  RecetaItem,
  Repository,
  Tienda,
  VentaDirecta,
  VentaDirectaRepo,
} from '@panaderia/shared';
import { db } from './db';

const nuevoId = (): string => crypto.randomUUID();

/** Suma `delta` (en la unidad base del insumo) al stock (dentro de la transacción activa). */
async function ajustarStock(insumoId: ID, delta: number): Promise<void> {
  const insumo = await db.insumos.get(insumoId);
  if (!insumo) return;
  await db.insumos.update(insumoId, { stockActual: insumo.stockActual + delta });
}

/** Mapa insumoId -> unidad base, para resolver la merma por tipo de insumo. */
async function mapaUnidades(): Promise<Map<ID, 'g' | 'u'>> {
  const insumos = await db.insumos.toArray();
  return new Map(insumos.map((i) => [i.id, i.unidadBase]));
}

/** Mapa productoId -> bolsa de domicilio (empaqueInsumoId). */
async function mapaEmpaque(): Promise<Map<ID, ID | undefined>> {
  const productos = await db.productos.toArray();
  return new Map(productos.map((p) => [p.id, p.empaqueInsumoId]));
}

/**
 * Adaptador local de almacenamiento contra Dexie/IndexedDB.
 * Implementa el contrato `Repository`. El frontend solo conoce la interfaz.
 */
export class LocalRepository implements Repository {
  insumos: CrudRepo<Insumo, NuevoInsumo> = {
    list: () => db.insumos.orderBy('nombre').toArray(),
    get: async (id) => (await db.insumos.get(id)) ?? null,
    create: async (data) => {
      const insumo: Insumo = {
        id: nuevoId(),
        nombre: data.nombre.trim(),
        unidadBase: data.unidadBase ?? 'g',
        stockActual: data.stockActual ?? 0,
      };
      await db.insumos.add(insumo);
      return insumo;
    },
    update: async (id, patch) => {
      await db.insumos.update(id, patch as Partial<Insumo>);
      const r = await db.insumos.get(id);
      if (!r) throw new Error('Insumo no encontrado');
      return r;
    },
    delete: async (id) => {
      await db.transaction('rw', db.insumos, db.recetas, async () => {
        await db.recetas.where('insumoId').equals(id).delete();
        await db.insumos.delete(id);
      });
    },
  };

  compras: CrudRepo<CompraInsumo, NuevaCompraInsumo> = {
    list: () => db.compras.orderBy('fecha').reverse().toArray(),
    get: async (id) => (await db.compras.get(id)) ?? null,
    create: async (data) => {
      const compra: CompraInsumo = { id: nuevoId(), ...data };
      await db.transaction('rw', db.compras, db.insumos, async () => {
        await db.compras.add(compra);
        await ajustarStock(compra.insumoId, compra.cantidad);
      });
      return compra;
    },
    update: async (id, patch) => {
      await db.transaction('rw', db.compras, db.insumos, async () => {
        const prev = await db.compras.get(id);
        if (!prev) throw new Error('Compra no encontrada');
        const next: CompraInsumo = { ...prev, ...patch };
        await ajustarStock(prev.insumoId, -prev.cantidad);
        await ajustarStock(next.insumoId, next.cantidad);
        await db.compras.put(next);
      });
      const r = await db.compras.get(id);
      if (!r) throw new Error('Compra no encontrada');
      return r;
    },
    delete: async (id) => {
      await db.transaction('rw', db.compras, db.insumos, async () => {
        const prev = await db.compras.get(id);
        if (!prev) return;
        await ajustarStock(prev.insumoId, -prev.cantidad);
        await db.compras.delete(id);
      });
    },
  };

  productos: CrudRepo<Producto, NuevoProducto> = {
    list: () => db.productos.orderBy('nombre').toArray(),
    get: async (id) => (await db.productos.get(id)) ?? null,
    create: async (data) => {
      const producto: Producto = {
        id: nuevoId(),
        nombre: data.nombre.trim(),
        precioVenta: data.precioVenta,
        precioMostrador: data.precioMostrador,
        empaqueInsumoId: data.empaqueInsumoId,
      };
      await db.productos.add(producto);
      return producto;
    },
    update: async (id, patch) => {
      await db.productos.update(id, patch as Partial<Producto>);
      const r = await db.productos.get(id);
      if (!r) throw new Error('Producto no encontrado');
      return r;
    },
    delete: async (id) => {
      await db.transaction('rw', db.productos, db.recetas, async () => {
        await db.recetas.where('productoId').equals(id).delete();
        await db.productos.delete(id);
      });
    },
  };

  recetas = {
    list: () => db.recetas.toArray(),
    getByProducto: (productoId: ID) =>
      db.recetas.where('productoId').equals(productoId).toArray(),
    setByProducto: async (productoId: ID, items: NuevoRecetaItem[]) => {
      await db.transaction('rw', db.recetas, async () => {
        await db.recetas.where('productoId').equals(productoId).delete();
        const filas: RecetaItem[] = items.map((it) => ({
          id: nuevoId(),
          productoId,
          insumoId: it.insumoId,
          cantidad: it.cantidad,
        }));
        await db.recetas.bulkAdd(filas);
      });
      return db.recetas.where('productoId').equals(productoId).toArray();
    },
  };

  producciones: CrudRepo<Produccion, NuevaProduccion> = {
    list: () => db.producciones.orderBy('fecha').reverse().toArray(),
    get: async (id) => (await db.producciones.get(id)) ?? null,
    create: async (data) => {
      const prod: Produccion = { id: nuevoId(), ...data };
      await db.transaction('rw', db.producciones, db.recetas, db.insumos, async () => {
        await db.producciones.add(prod);
        const receta = await db.recetas.where('productoId').equals(prod.productoId).toArray();
        const unidades = await mapaUnidades();
        for (const c of consumoDeProduccion(prod, receta, unidades)) {
          await ajustarStock(c.insumoId, -c.cantidad);
        }
      });
      return prod;
    },
    update: async (id, patch) => {
      await db.transaction('rw', db.producciones, db.recetas, db.insumos, async () => {
        const prev = await db.producciones.get(id);
        if (!prev) throw new Error('Producción no encontrada');
        const unidades = await mapaUnidades();
        // revertir consumo anterior
        const recetaPrev = await db.recetas.where('productoId').equals(prev.productoId).toArray();
        for (const c of consumoDeProduccion(prev, recetaPrev, unidades)) {
          await ajustarStock(c.insumoId, c.cantidad);
        }
        const next: Produccion = { ...prev, ...patch };
        await db.producciones.put(next);
        // aplicar consumo nuevo
        const recetaNext = await db.recetas.where('productoId').equals(next.productoId).toArray();
        for (const c of consumoDeProduccion(next, recetaNext, unidades)) {
          await ajustarStock(c.insumoId, -c.cantidad);
        }
      });
      const r = await db.producciones.get(id);
      if (!r) throw new Error('Producción no encontrada');
      return r;
    },
    delete: async (id) => {
      await db.transaction('rw', db.producciones, db.recetas, db.insumos, async () => {
        const prev = await db.producciones.get(id);
        if (!prev) return;
        const receta = await db.recetas.where('productoId').equals(prev.productoId).toArray();
        const unidades = await mapaUnidades();
        for (const c of consumoDeProduccion(prev, receta, unidades)) {
          await ajustarStock(c.insumoId, c.cantidad);
        }
        await db.producciones.delete(id);
      });
    },
  };

  tiendas: CrudRepo<Tienda, NuevaTienda> = {
    list: () => db.tiendas.orderBy('nombre').toArray(),
    get: async (id) => (await db.tiendas.get(id)) ?? null,
    create: async (data) => {
      const tienda: Tienda = { id: nuevoId(), ...data, nombre: data.nombre.trim() };
      await db.tiendas.add(tienda);
      return tienda;
    },
    update: async (id, patch) => {
      await db.tiendas.update(id, patch as Partial<Tienda>);
      const r = await db.tiendas.get(id);
      if (!r) throw new Error('Tienda no encontrada');
      return r;
    },
    delete: async (id) => {
      await db.tiendas.delete(id);
    },
  };

  entregas: EntregaRepo = {
    list: () => db.entregas.orderBy('fecha').reverse().toArray(),
    listItems: () => db.entregaItems.toArray(),
    get: async (id) => {
      const entrega = await db.entregas.get(id);
      if (!entrega) return null;
      const items = await db.entregaItems.where('entregaId').equals(id).toArray();
      return { entrega, items };
    },
    create: async (data, items) => {
      const entrega: Entrega = { id: nuevoId(), ...data };
      const filas = items.map((it) => ({ id: nuevoId(), entregaId: entrega.id, ...it }));
      await db.transaction('rw', db.entregas, db.entregaItems, db.productos, db.insumos, async () => {
        await db.entregas.add(entrega);
        await db.entregaItems.bulkAdd(filas);
        const empaque = await mapaEmpaque();
        for (const it of filas) {
          const bolsa = empaque.get(it.productoId);
          if (bolsa) await ajustarStock(bolsa, -it.cantidad);
        }
      });
      return { entrega, items: filas };
    },
    update: async (id, data, items) => {
      let resultado: EntregaConItems;
      await db.transaction('rw', db.entregas, db.entregaItems, db.productos, db.insumos, async () => {
        const prev = await db.entregas.get(id);
        if (!prev) throw new Error('Entrega no encontrada');
        const empaque = await mapaEmpaque();
        // reponer bolsas de los items anteriores
        const viejos = await db.entregaItems.where('entregaId').equals(id).toArray();
        for (const it of viejos) {
          const bolsa = empaque.get(it.productoId);
          if (bolsa) await ajustarStock(bolsa, it.cantidad);
        }
        const entrega: Entrega = { ...prev, ...data };
        await db.entregas.put(entrega);
        await db.entregaItems.where('entregaId').equals(id).delete();
        const filas = items.map((it) => ({ id: nuevoId(), entregaId: id, ...it }));
        await db.entregaItems.bulkAdd(filas);
        // descontar bolsas de los items nuevos
        for (const it of filas) {
          const bolsa = empaque.get(it.productoId);
          if (bolsa) await ajustarStock(bolsa, -it.cantidad);
        }
        resultado = { entrega, items: filas };
      });
      return resultado!;
    },
    delete: async (id) => {
      await db.transaction('rw', db.entregas, db.entregaItems, db.productos, db.insumos, async () => {
        const empaque = await mapaEmpaque();
        const items = await db.entregaItems.where('entregaId').equals(id).toArray();
        for (const it of items) {
          const bolsa = empaque.get(it.productoId);
          if (bolsa) await ajustarStock(bolsa, it.cantidad);
        }
        await db.entregaItems.where('entregaId').equals(id).delete();
        await db.entregas.delete(id);
      });
    },
  };

  ventasDirectas: VentaDirectaRepo = {
    list: () => db.ventasDirectas.orderBy('fecha').reverse().toArray(),
    registrar: async (data: NuevaVentaDirecta) => {
      let resultado: VentaDirecta;
      await db.transaction('rw', db.ventasDirectas, async () => {
        const existente = await db.ventasDirectas
          .where('[fecha+productoId]')
          .equals([data.fecha, data.productoId])
          .first();
        if (existente) {
          const actualizada: VentaDirecta = {
            ...existente,
            cantidad: existente.cantidad + data.cantidad,
          };
          await db.ventasDirectas.put(actualizada);
          resultado = actualizada;
        } else {
          const nueva: VentaDirecta = { id: nuevoId(), ...data };
          await db.ventasDirectas.add(nueva);
          resultado = nueva;
        }
      });
      return resultado!;
    },
    setCantidad: async (id, cantidad) => {
      await db.ventasDirectas.update(id, { cantidad });
      const r = await db.ventasDirectas.get(id);
      if (!r) throw new Error('Venta no encontrada');
      return r;
    },
    delete: async (id) => {
      await db.ventasDirectas.delete(id);
    },
  };

  // -------------------------------------------------------------------------
  // Mantenimiento de datos (UI completa en la Fase 2)
  // -------------------------------------------------------------------------

  async exportarBackup(): Promise<BackupJSON> {
    return {
      version: 1,
      exportadoEn: new Date().toISOString(),
      datos: {
        insumos: await db.insumos.toArray(),
        compras: await db.compras.toArray(),
        productos: await db.productos.toArray(),
        recetas: await db.recetas.toArray(),
        producciones: await db.producciones.toArray(),
        tiendas: await db.tiendas.toArray(),
        entregas: await db.entregas.toArray(),
        entregaItems: await db.entregaItems.toArray(),
        ventasDirectas: await db.ventasDirectas.toArray(),
      },
    };
  }

  async importarBackup(data: BackupJSON): Promise<void> {
    await db.transaction(
      'rw',
      [
        db.insumos,
        db.compras,
        db.productos,
        db.recetas,
        db.producciones,
        db.tiendas,
        db.entregas,
        db.entregaItems,
        db.ventasDirectas,
      ],
      async () => {
        await Promise.all([
          db.insumos.clear(),
          db.compras.clear(),
          db.productos.clear(),
          db.recetas.clear(),
          db.producciones.clear(),
          db.tiendas.clear(),
          db.entregas.clear(),
          db.entregaItems.clear(),
          db.ventasDirectas.clear(),
        ]);
        await db.insumos.bulkAdd(data.datos.insumos);
        await db.compras.bulkAdd(data.datos.compras);
        await db.productos.bulkAdd(data.datos.productos);
        await db.recetas.bulkAdd(data.datos.recetas);
        await db.producciones.bulkAdd(data.datos.producciones);
        await db.tiendas.bulkAdd(data.datos.tiendas);
        await db.entregas.bulkAdd(data.datos.entregas);
        await db.entregaItems.bulkAdd(data.datos.entregaItems);
        await db.ventasDirectas.bulkAdd(data.datos.ventasDirectas ?? []);
      },
    );
  }

  async borrarRegistros(filtro: FiltroBorrado): Promise<void> {
    // Cierre de mes: borra transacciones hasta la fecha; conserva catálogos y
    // el stock vigente (saldo de cierre que pasa al periodo siguiente).
    await db.transaction(
      'rw',
      db.compras,
      db.producciones,
      db.entregas,
      db.entregaItems,
      db.ventasDirectas,
      async () => {
        await db.compras.where('fecha').belowOrEqual(filtro.hasta).delete();
        await db.producciones.where('fecha').belowOrEqual(filtro.hasta).delete();
        const entregaIds = await db.entregas
          .where('fecha')
          .belowOrEqual(filtro.hasta)
          .primaryKeys();
        await db.entregaItems.where('entregaId').anyOf(entregaIds).delete();
        await db.entregas.where('fecha').belowOrEqual(filtro.hasta).delete();
        await db.ventasDirectas.where('fecha').belowOrEqual(filtro.hasta).delete();
      },
    );
  }
}
