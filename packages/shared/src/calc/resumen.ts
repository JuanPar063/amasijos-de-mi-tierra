// Resumen agregado de un periodo (día, mes, rango arbitrario).
// Compone las funciones puras de costos.ts. Esta es la lógica que alimenta
// el dashboard y los reportes PDF.
import type {
  CompraInsumo,
  Entrega,
  EntregaItem,
  ID,
  Insumo,
  Produccion,
  RecetaItem,
  UnidadBase,
  VentaDirecta,
} from '../domain/entities';
import {
  consumoDeProduccion,
  costoDeProduccion,
  ingresosDeEntrega,
  ingresosDeVentasDirectas,
  type ConsumoInsumo,
} from './costos';

export interface ResumenPeriodo {
  desde: string;
  hasta: string;
  unidadesProducidas: number;
  produccionPorProducto: { productoId: ID; unidades: number }[];
  consumoPorInsumo: ConsumoInsumo[];
  costoProduccion: number;
  /** Dinero realmente pagado en compras de insumos en el periodo (caja gastada). */
  gastoInsumos: number;
  /** Gasto en compras desglosado por insumo. */
  gastoPorInsumo: { insumoId: ID; monto: number }[];
  /** Ingresos por entregas a tiendas. */
  ingresosTiendas: number;
  /** Ingresos por venta directa en el mostrador. */
  ingresosMostrador: number;
  /** Ingresos totales (tiendas + mostrador). */
  ingresos: number;
  margen: number;
  numEntregas: number;
}

export interface ResumenInput {
  desde: string;
  hasta: string;
  producciones: Produccion[];
  recetas: RecetaItem[];
  compras: CompraInsumo[];
  entregas: Entrega[];
  entregaItems: EntregaItem[];
  ventasDirectas: VentaDirecta[];
  /** Insumos, para resolver la unidad base (afecta la distribución de merma). */
  insumos: Pick<Insumo, 'id' | 'unidadBase'>[];
}

function enRango(fecha: string, desde: string, hasta: string): boolean {
  return fecha >= desde && fecha <= hasta;
}

/** Filtra los renglones de receta de un producto. */
export function recetaDe(productoId: ID, recetas: RecetaItem[]): RecetaItem[] {
  return recetas.filter((r) => r.productoId === productoId);
}

/**
 * Inventario de producto terminado: unidades producidas − unidades entregadas,
 * por producto. Sirve para no permitir entregar pan que no se ha producido.
 */
export function inventarioPorProducto(
  producciones: Pick<Produccion, 'productoId' | 'cantidadUnidades'>[],
  entregaItems: Pick<EntregaItem, 'productoId' | 'cantidad'>[],
  ventasDirectas: Pick<VentaDirecta, 'productoId' | 'cantidad'>[] = [],
): Map<ID, number> {
  const m = new Map<ID, number>();
  for (const p of producciones) {
    m.set(p.productoId, (m.get(p.productoId) ?? 0) + p.cantidadUnidades);
  }
  for (const it of entregaItems) {
    m.set(it.productoId, (m.get(it.productoId) ?? 0) - it.cantidad);
  }
  for (const v of ventasDirectas) {
    m.set(v.productoId, (m.get(v.productoId) ?? 0) - v.cantidad);
  }
  return m;
}

export function resumenPeriodo(input: ResumenInput): ResumenPeriodo {
  const { desde, hasta } = input;
  const unidadPorInsumo = new Map<ID, UnidadBase>(
    input.insumos.map((i) => [i.id, i.unidadBase]),
  );

  const producciones = input.producciones.filter((p) => enRango(p.fecha, desde, hasta));
  const entregas = input.entregas.filter((e) => enRango(e.fecha, desde, hasta));
  const entregaIds = new Set(entregas.map((e) => e.id));
  const items = input.entregaItems.filter((it) => entregaIds.has(it.entregaId));

  const unidadesProducidas = producciones.reduce((acc, p) => acc + p.cantidadUnidades, 0);

  const porProducto = new Map<ID, number>();
  const consumo = new Map<ID, number>();
  let costoProduccion = 0;

  for (const p of producciones) {
    porProducto.set(p.productoId, (porProducto.get(p.productoId) ?? 0) + p.cantidadUnidades);
    const receta = recetaDe(p.productoId, input.recetas);
    for (const c of consumoDeProduccion(p, receta, unidadPorInsumo)) {
      consumo.set(c.insumoId, (consumo.get(c.insumoId) ?? 0) + c.cantidad);
    }
    costoProduccion += costoDeProduccion(p, receta, input.compras, unidadPorInsumo);
  }

  // Gasto real en insumos = suma de compras (caja pagada) dentro del rango.
  const gastoPorInsumoMap = new Map<ID, number>();
  let gastoInsumos = 0;
  for (const c of input.compras.filter((c) => enRango(c.fecha, desde, hasta))) {
    gastoInsumos += c.costoTotal;
    gastoPorInsumoMap.set(c.insumoId, (gastoPorInsumoMap.get(c.insumoId) ?? 0) + c.costoTotal);
  }

  const ventas = input.ventasDirectas.filter((v) => enRango(v.fecha, desde, hasta));
  const ingresosTiendas = ingresosDeEntrega(items);
  const ingresosMostrador = ingresosDeVentasDirectas(ventas);
  const ingresos = ingresosTiendas + ingresosMostrador;

  return {
    desde,
    hasta,
    unidadesProducidas,
    produccionPorProducto: [...porProducto].map(([productoId, unidades]) => ({ productoId, unidades })),
    consumoPorInsumo: [...consumo].map(([insumoId, cantidad]) => ({ insumoId, cantidad })),
    costoProduccion,
    gastoInsumos,
    gastoPorInsumo: [...gastoPorInsumoMap].map(([insumoId, monto]) => ({ insumoId, monto })),
    ingresosTiendas,
    ingresosMostrador,
    ingresos,
    margen: ingresos - costoProduccion,
    numEntregas: entregas.length,
  };
}
