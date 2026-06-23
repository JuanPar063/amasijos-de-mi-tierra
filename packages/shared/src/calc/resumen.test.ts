import { describe, expect, it } from 'vitest';
import type {
  CompraInsumo,
  Entrega,
  EntregaItem,
  Insumo,
  Produccion,
  RecetaItem,
} from '../domain/entities';
import { resumenPeriodo, type ResumenInput } from './resumen';

const insumos: Pick<Insumo, 'id' | 'unidadBase'>[] = [{ id: 'harina', unidadBase: 'g' }];
const recetas: RecetaItem[] = [
  { id: 'r1', productoId: 'pan', insumoId: 'harina', cantidad: 100 },
];
const compras: CompraInsumo[] = [
  { id: 'c1', insumoId: 'harina', fecha: '2026-06-01', cantidad: 1000, costoTotal: 2000 }, // 2/g
];
const producciones: Produccion[] = [
  { id: 'pr1', fecha: '2026-06-10', hora: '07:00', productoId: 'pan', cantidadUnidades: 10 },
  { id: 'pr2', fecha: '2026-05-30', hora: '07:00', productoId: 'pan', cantidadUnidades: 99 }, // fuera de rango
];
const entregas: Entrega[] = [{ id: 'e1', fecha: '2026-06-10', hora: '09:00', tiendaId: 't1' }];
const entregaItems: EntregaItem[] = [
  { id: 'i1', entregaId: 'e1', productoId: 'pan', cantidad: 8, precioUnitario: 1500 },
];

const input: ResumenInput = {
  desde: '2026-06-01',
  hasta: '2026-06-30',
  producciones,
  recetas,
  compras,
  entregas,
  entregaItems,
  insumos,
};

describe('resumenPeriodo', () => {
  const r = resumenPeriodo(input);

  it('solo cuenta registros dentro del rango', () => {
    expect(r.unidadesProducidas).toBe(10);
  });

  it('agrega consumo por insumo (10 unidades * 100 g)', () => {
    expect(r.consumoPorInsumo).toEqual([{ insumoId: 'harina', cantidad: 1000 }]);
  });

  it('calcula costo, ingresos y margen', () => {
    expect(r.costoProduccion).toBe(2000); // 1000 g * 2
    expect(r.ingresos).toBe(12000); // 8 * 1500
    expect(r.margen).toBe(10000);
  });

  it('cuenta entregas del periodo', () => {
    expect(r.numEntregas).toBe(1);
  });
});
