// Tipos de dominio de la panadería.
//
// Regla de unidades: cada insumo tiene una UNIDAD BASE:
//   - 'g' (peso): se almacena en gramos; la libra/kg es solo presentación.
//   - 'u' (conteo): se almacena en unidades enteras (p. ej. huevos).
// Todas las cantidades de un insumo (stock, compras, receta, consumo) usan SU
// unidad base. Las fechas son ISO 'YYYY-MM-DD' y las horas 'HH:MM'.

/** Identificador único (UUID generado por el adaptador de almacenamiento). */
export type ID = string;

/** Unidad base de medida de un insumo: gramos (peso) o unidades (conteo). */
export type UnidadBase = 'g' | 'u';

// ---------------------------------------------------------------------------
// Entidades almacenadas
// ---------------------------------------------------------------------------

export interface Insumo {
  id: ID;
  nombre: string;
  unidadBase: UnidadBase;
  /** Stock vigente en la unidad base. Lo mantiene el repositorio (compras suman, producciones restan). */
  stockActual: number;
}

export interface CompraInsumo {
  id: ID;
  insumoId: ID;
  fecha: string;
  /** Cantidad comprada en la unidad base del insumo. */
  cantidad: number;
  costoTotal: number;
  // costo por unidad base es derivado: costoTotal / cantidad (ver calc/costos).
}

export interface Producto {
  id: ID;
  nombre: string;
  /** Precio a tiendas (entregas). Suele ser el menor. */
  precioVenta: number;
  /** Precio al público en el mostrador (venta directa). Por defecto = precioVenta. */
  precioMostrador?: number;
  /** Insumo "bolsa" que se gasta (1 por unidad) al entregar este producto a domicilio. */
  empaqueInsumoId?: ID;
}

/**
 * Venta directa en el local (mostrador). Acumulado por día y producto:
 * existe a lo sumo una fila por (fecha, productoId); registrar una venta suma
 * a la cantidad del día en vez de crear un registro nuevo.
 */
export interface VentaDirecta {
  id: ID;
  fecha: string;
  productoId: ID;
  cantidad: number;
  precioUnitario: number;
}

/** Un renglón de la receta (lista de materiales) de un producto. */
export interface RecetaItem {
  id: ID;
  productoId: ID;
  insumoId: ID;
  /** Cantidad por unidad producida, en la unidad base del insumo. */
  cantidad: number;
}

export interface Produccion {
  id: ID;
  fecha: string;
  hora: string;
  productoId: ID;
  cantidadUnidades: number;
  /** Merma opcional en gramos (materia prima de peso perdida en el proceso). */
  mermaG?: number;
}

export interface Tienda {
  id: ID;
  nombre: string;
  direccion?: string;
  contacto?: string;
}

export interface Entrega {
  id: ID;
  fecha: string;
  hora: string;
  tiendaId: ID;
}

export interface EntregaItem {
  id: ID;
  entregaId: ID;
  productoId: ID;
  cantidad: number;
  precioUnitario: number;
}

// ---------------------------------------------------------------------------
// Tipos de creación (sin id ni campos derivados/gestionados)
// ---------------------------------------------------------------------------

export interface NuevoInsumo {
  nombre: string;
  /** Unidad base. Por defecto 'g' (peso). */
  unidadBase?: UnidadBase;
  /** Stock inicial en la unidad base. Por defecto 0. */
  stockActual?: number;
}

export interface NuevaCompraInsumo {
  insumoId: ID;
  fecha: string;
  cantidad: number;
  costoTotal: number;
}

export interface NuevoProducto {
  nombre: string;
  precioVenta: number;
  precioMostrador?: number;
  empaqueInsumoId?: ID;
}

export interface NuevaVentaDirecta {
  fecha: string;
  productoId: ID;
  cantidad: number;
  precioUnitario: number;
}

export interface NuevoRecetaItem {
  insumoId: ID;
  cantidad: number;
}

export interface NuevaProduccion {
  fecha: string;
  hora: string;
  productoId: ID;
  cantidadUnidades: number;
  mermaG?: number;
}

export interface NuevaTienda {
  nombre: string;
  direccion?: string;
  contacto?: string;
}

export interface NuevaEntrega {
  fecha: string;
  hora: string;
  tiendaId: ID;
}

export interface NuevoEntregaItem {
  productoId: ID;
  cantidad: number;
  precioUnitario: number;
}
