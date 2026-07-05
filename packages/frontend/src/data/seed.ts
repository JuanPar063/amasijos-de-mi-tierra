// Catálogo inicial del negocio (insumos, precios y recetas).
// Fuente: docs/datos-panaderia-insumos-unidades.md (notas del negocio, jun-2026).
//
// Notas de modelado:
// - Cada insumo de peso se siembra con una compra de referencia de 1 libra
//   (500 g) al precio de la lista, para registrar el costo vigente. Esa compra
//   también fija un stock inicial = cantidad de referencia (ajustable).
// - Las recetas del documento están por lote de 500 g de harina + un rendimiento
//   (unidades por lote); aquí se guardan POR UNIDAD producida (lote ÷ rendimiento).
// - "Mantequilla" en las fórmulas se mapea al insumo "Margarina"; "Esencias" a
//   "Esencia de vainilla" (el documento no especifica cuál).
import type { Repository, UnidadBase } from '@panaderia/shared';

interface SeedInsumo {
  nombre: string;
  unidadBase: UnidadBase;
  /** Precio de referencia por `cantidadRef` (COP) para fijar el precio por unidad base. null = sin precio en la lista. */
  precio: number | null;
  /** Cantidad de referencia del precio, en la unidad base (500 g = 1 libra). */
  cantidadRef: number;
}

const LIBRA = 500; // gramos

const INSUMOS: SeedInsumo[] = [
  { nombre: 'Harina de trigo', unidadBase: 'g', precio: 1100, cantidadRef: LIBRA },
  { nombre: 'Azúcar', unidadBase: 'g', precio: 1750, cantidadRef: LIBRA },
  { nombre: 'Margarina', unidadBase: 'g', precio: 3600, cantidadRef: LIBRA },
  { nombre: 'Levadura', unidadBase: 'g', precio: 12000, cantidadRef: LIBRA },
  { nombre: 'Sal', unidadBase: 'g', precio: 800, cantidadRef: LIBRA },
  { nombre: 'Harina repostera', unidadBase: 'g', precio: 2200, cantidadRef: LIBRA },
  { nombre: 'Margarina Vitina', unidadBase: 'g', precio: 7000, cantidadRef: LIBRA },
  { nombre: 'Margarina Hojaldrina', unidadBase: 'g', precio: 5200, cantidadRef: LIBRA },
  { nombre: 'Esencia de vainilla', unidadBase: 'g', precio: 8000, cantidadRef: LIBRA },
  { nombre: 'Esencia mantequilla', unidadBase: 'g', precio: 8000, cantidadRef: LIBRA },
  { nombre: 'Esencia queso', unidadBase: 'g', precio: 8000, cantidadRef: LIBRA },
  { nombre: 'Esencia canela', unidadBase: 'g', precio: null, cantidadRef: LIBRA },
  { nombre: 'Esencia coco', unidadBase: 'g', precio: null, cantidadRef: LIBRA },
  { nombre: 'Harina integral', unidadBase: 'g', precio: 2200, cantidadRef: LIBRA },
  { nombre: 'Queso semiduro', unidadBase: 'g', precio: 9500, cantidadRef: LIBRA },
  { nombre: 'Queso duro', unidadBase: 'g', precio: 13000, cantidadRef: LIBRA },
  { nombre: 'Uvas pasas', unidadBase: 'g', precio: 8000, cantidadRef: LIBRA },
  { nombre: 'Bocadillo', unidadBase: 'g', precio: 3700, cantidadRef: LIBRA },
  { nombre: 'Arequipe', unidadBase: 'g', precio: 6000, cantidadRef: LIBRA },
  { nombre: 'Polvo para hornear', unidadBase: 'g', precio: 6000, cantidadRef: LIBRA },
  { nombre: 'Ajonjolí', unidadBase: 'g', precio: 11000, cantidadRef: LIBRA },
  { nombre: 'Chips de chocolate', unidadBase: 'g', precio: null, cantidadRef: LIBRA },
  // Conteo (unidades)
  { nombre: 'Huevos', unidadBase: 'u', precio: 450, cantidadRef: 1 },
  { nombre: 'Bolsa para francés', unidadBase: 'u', precio: 75, cantidadRef: 1 },
  { nombre: 'Bolsa 14x20', unidadBase: 'u', precio: 84, cantidadRef: 1 },
  { nombre: 'Bolsa x 3 kls', unidadBase: 'u', precio: 52, cantidadRef: 1 },
];

type Ingredientes = Record<string, number>;

// Fórmulas base por lote de 500 g de harina (gramos).
const BASE_FRANCES: Ingredientes = {
  'Harina de trigo': 500,
  Margarina: 40,
  Azúcar: 20,
  Sal: 10,
  Levadura: 3.3,
  'Esencia de vainilla': 1,
};
const BASE_ALINADO: Ingredientes = {
  'Harina de trigo': 500,
  Margarina: 80,
  Azúcar: 90,
  Sal: 10,
  Levadura: 7,
  'Esencia de vainilla': 1.5,
};
const BASE_DULCE: Ingredientes = {
  'Harina de trigo': 500,
  Margarina: 80,
  Azúcar: 120,
  Sal: 5,
  Levadura: 10,
};

const redondear = (n: number) => Math.round(n * 1000) / 1000;

/** Convierte una fórmula por lote a cantidades por unidad (lote ÷ rendimiento) + extras. */
function porUnidad(base: Ingredientes, rinde: number, extras: Ingredientes = {}): Ingredientes {
  const r: Ingredientes = {};
  for (const [k, v] of Object.entries(base)) r[k] = redondear(v / rinde);
  for (const [k, v] of Object.entries(extras)) r[k] = redondear((r[k] ?? 0) + v);
  return r;
}

interface SeedProducto {
  nombre: string;
  /** Precio a tiendas (entregas). */
  precioVenta: number;
  /** Precio al público en el mostrador (venta directa). */
  precioMostrador: number;
  receta: Ingredientes;
}

// Precios (COP): mostrador = precio al público; tienda = precio de entrega a tiendas.
const PRODUCTOS: SeedProducto[] = [
  { nombre: 'Francés Queso', precioVenta: 1500, precioMostrador: 2000, receta: porUnidad(BASE_FRANCES, 3.3, { 'Queso duro': 7 }) },
  { nombre: 'Francés Normal', precioVenta: 800, precioMostrador: 1000, receta: porUnidad(BASE_FRANCES, 5.8, { Ajonjolí: 1.5 }) },
  { nombre: 'Francés Pequeño', precioVenta: 400, precioMostrador: 500, receta: porUnidad(BASE_FRANCES, 11.5) },
  { nombre: 'Croissant', precioVenta: 1000, precioMostrador: 1200, receta: porUnidad(BASE_ALINADO, 11, { 'Queso semiduro': 7 }) },
  { nombre: 'Pan Dulce', precioVenta: 800, precioMostrador: 1000, receta: porUnidad(BASE_DULCE, 12) },
  { nombre: 'Rosca', precioVenta: 800, precioMostrador: 1000, receta: porUnidad(BASE_DULCE, 12, { Bocadillo: 10 }) },
  { nombre: 'Quesito Dulce', precioVenta: 800, precioMostrador: 1000, receta: porUnidad(BASE_DULCE, 12, { 'Queso semiduro': 6, Azúcar: 7 }) },
  { nombre: 'Panocha', precioVenta: 800, precioMostrador: 1000, receta: porUnidad(BASE_DULCE, 12, { Arequipe: 5 }) },
];

export const CATALOGO_RESUMEN = { insumos: INSUMOS.length, productos: PRODUCTOS.length };

/** Carga el catálogo inicial (insumos + compra de referencia + productos con receta). */
export async function cargarCatalogoInicial(
  repo: Repository,
): Promise<{ insumos: number; productos: number }> {
  const idPorNombre = new Map<string, string>();

  for (const s of INSUMOS) {
    // La semilla solo crea el insumo con su precio por unidad base (sin registrar
    // compras ni stock: eso lo hace el usuario al comprar de verdad).
    const precioBase = s.precio != null ? s.precio / s.cantidadRef : undefined;
    const insumo = await repo.insumos.create({
      nombre: s.nombre,
      unidadBase: s.unidadBase,
      precioBase,
    });
    idPorNombre.set(s.nombre, insumo.id);
  }

  for (const p of PRODUCTOS) {
    const prod = await repo.productos.create({
      nombre: p.nombre,
      precioVenta: p.precioVenta,
      precioMostrador: p.precioMostrador,
    });
    const receta = Object.entries(p.receta).map(([nombre, cantidad]) => {
      const insumoId = idPorNombre.get(nombre);
      if (!insumoId) throw new Error(`Insumo de receta no encontrado: ${nombre}`);
      return { insumoId, cantidad };
    });
    await repo.recetas.setByProducto(prod.id, receta);
  }

  return CATALOGO_RESUMEN;
}
