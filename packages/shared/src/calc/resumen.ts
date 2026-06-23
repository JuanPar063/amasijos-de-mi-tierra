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
} from '../domain/entities';
import {
  consumoDeProduccion,
  costoDeProduccion,
  ingresosDeEntrega,
  type ConsumoInsumo,
} from './costos';

export interface ResumenPeriodo {
  desde: string;
  hasta: string;
  unidadesProducidas: number;
  produccionPorProducto: { productoId: ID; unidades: number }[];
  consumoPorInsumo: ConsumoInsumo[];
  costoProduccion: number;
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

  const ingresos = ingresosDeEntrega(items);

  return {
    desde,
    hasta,
    unidadesProducidas,
    produccionPorProducto: [...porProducto].map(([productoId, unidades]) => ({ productoId, unidades })),
    consumoPorInsumo: [...consumo].map(([insumoId, cantidad]) => ({ insumoId, cantidad })),
    costoProduccion,
    ingresos,
    margen: ingresos - costoProduccion,
    numEntregas: entregas.length,
  };
}
