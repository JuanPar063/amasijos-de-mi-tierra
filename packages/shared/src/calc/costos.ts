// Cálculos de consumo y costos. Funciones puras y testeables.
import type {
  CompraInsumo,
  EntregaItem,
  ID,
  Produccion,
  RecetaItem,
  UnidadBase,
} from '../domain/entities';

/** Costo por unidad base de una compra (derivado, no se almacena). */
export function costoPorBase(compra: Pick<CompraInsumo, 'cantidad' | 'costoTotal'>): number {
  return compra.cantidad > 0 ? compra.costoTotal / compra.cantidad : 0;
}

export interface ConsumoInsumo {
  insumoId: ID;
  /** Cantidad consumida en la unidad base del insumo. */
  cantidad: number;
}

/**
 * Consumo de insumos de una producción = receta × unidades, ajustado por merma.
 * La merma (gramos perdidos) se distribuye proporcionalmente SOLO entre los
 * insumos de peso ('g'); los insumos de conteo ('u', p. ej. huevos) no se ven
 * afectados. Si no se provee el mapa de unidades, se asume que todo es peso.
 */
export function consumoDeProduccion(
  produccion: Pick<Produccion, 'cantidadUnidades' | 'mermaG'>,
  receta: RecetaItem[],
  unidadPorInsumo?: Map<ID, UnidadBase>,
): ConsumoInsumo[] {
  const unidades = produccion.cantidadUnidades;
  const base = receta.map((r) => ({ insumoId: r.insumoId, cantidad: r.cantidad * unidades }));
  const merma = produccion.mermaG ?? 0;
  if (merma <= 0) return base;

  const esPeso = (id: ID): boolean =>
    unidadPorInsumo ? unidadPorInsumo.get(id) !== 'u' : true;
  const totalPeso = base.reduce((acc, b) => acc + (esPeso(b.insumoId) ? b.cantidad : 0), 0);
  if (totalPeso <= 0) return base;

  return base.map((b) =>
    esPeso(b.insumoId)
      ? { insumoId: b.insumoId, cantidad: b.cantidad + merma * (b.cantidad / totalPeso) }
      : b,
  );
}

/**
 * Costo por unidad base de un insumo "vigente en esa fecha": el de la última
 * compra en esa fecha o antes. Sin compras previas usa la más antigua; sin
 * ninguna, 0.
 */
export function costoPorBaseVigente(insumoId: ID, fecha: string, compras: CompraInsumo[]): number {
  const delInsumo = compras.filter((c) => c.insumoId === insumoId);
  if (delInsumo.length === 0) return 0;
  const previas = delInsumo
    .filter((c) => c.fecha <= fecha)
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  if (previas.length > 0) return costoPorBase(previas[0]);
  const masAntigua = [...delInsumo].sort((a, b) => (a.fecha < b.fecha ? -1 : 1))[0];
  return costoPorBase(masAntigua);
}

/** Costo total de una producción = Σ (consumo de cada insumo × costo vigente). */
export function costoDeProduccion(
  produccion: Produccion,
  receta: RecetaItem[],
  compras: CompraInsumo[],
  unidadPorInsumo?: Map<ID, UnidadBase>,
): number {
  return consumoDeProduccion(produccion, receta, unidadPorInsumo).reduce(
    (acc, c) => acc + c.cantidad * costoPorBaseVigente(c.insumoId, produccion.fecha, compras),
    0,
  );
}

/** Ingresos de una entrega = Σ (cantidad × precio_unitario) de sus renglones. */
export function ingresosDeEntrega(items: EntregaItem[]): number {
  return items.reduce((acc, it) => acc + it.cantidad * it.precioUnitario, 0);
}
