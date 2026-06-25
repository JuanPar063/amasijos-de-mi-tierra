// Conversión y formateo de cantidades.
// Insumos de peso usan GRAMOS como unidad base; insumos de conteo usan UNIDADES
// enteras (p. ej. huevos).
//
// LIBRA = 500 g: en esta panadería (uso comercial colombiano) la "libra" es la
// libra métrica de 500 g, no la libra imperial (453.59237 g). Así lo fija el
// documento de datos del negocio (docs/datos-panaderia-insumos-unidades.md).
import type { UnidadBase } from '../domain/entities';

export const GRAMOS_POR_LIBRA = 500;
export const GRAMOS_POR_KILO = 1000;

export function gramosALibras(gramos: number): number {
  return gramos / GRAMOS_POR_LIBRA;
}

export function librasAGramos(libras: number): number {
  return libras * GRAMOS_POR_LIBRA;
}

export function gramosAKilos(gramos: number): number {
  return gramos / GRAMOS_POR_KILO;
}

export function kilosAGramos(kilos: number): number {
  return kilos * GRAMOS_POR_KILO;
}

/** Formatea gramos de forma legible (g hasta 1 kg, luego kg). */
export function formatGramos(gramos: number): string {
  if (Math.abs(gramos) >= GRAMOS_POR_KILO) {
    return `${gramosAKilos(gramos).toLocaleString('es-CO', { maximumFractionDigits: 2 })} kg`;
  }
  return `${Math.round(gramos).toLocaleString('es-CO')} g`;
}

/** Formatea gramos como libras (presentación para el panadero). */
export function formatLibras(gramos: number): string {
  return `${gramosALibras(gramos).toLocaleString('es-CO', { maximumFractionDigits: 2 })} lb`;
}

/** Formatea una cantidad de conteo como unidades enteras. */
export function formatUnidades(cantidad: number): string {
  const n = Math.round(cantidad * 100) / 100;
  return `${n.toLocaleString('es-CO', { maximumFractionDigits: 2 })} u`;
}

/** Formato corto de una cantidad según la unidad base del insumo. */
export function formatCantidad(cantidad: number, unidadBase: UnidadBase): string {
  return unidadBase === 'u' ? formatUnidades(cantidad) : formatGramos(cantidad);
}

/** Formato detallado: para peso agrega el equivalente en libras. */
export function formatCantidadDetalle(cantidad: number, unidadBase: UnidadBase): string {
  if (unidadBase === 'u') return formatUnidades(cantidad);
  return `${formatGramos(cantidad)} · ${formatLibras(cantidad)}`;
}

/** Etiqueta legible de la unidad base. */
export function nombreUnidad(unidadBase: UnidadBase): string {
  return unidadBase === 'u' ? 'unidades' : 'peso';
}
