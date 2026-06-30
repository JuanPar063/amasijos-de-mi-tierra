import { describe, expect, it } from 'vitest';
import type {
  CompraInsumo,
  Entrega,
  EntregaItem,
  Insumo,
  Produccion,
  RecetaItem,
  VentaDirecta,
} from '../domain/entities';
import { inventarioPorProducto, resumenPeriodo, type ResumenInput } from './resumen';

const insumos: Pick<Insumo, 'id' | 'unidadBase'>[] = [{ id: 'harina', unidadBase: 'g' }];
const recetas: RecetaItem[] = [
  { id: 'r1', productoId: 'pan', insumoId: 'harina', cantidad: 100 },
];
const compras: CompraInsumo[] = [
  { id: 'c1', insumoId: 'harina', fecha: '2026-06-01', cantidad: 1000, costoTotal: 2000 }, // 2/g
  { id: 'c2', insumoId: 'harina', fecha: '2026-06-15', cantidad: 500, costoTotal: 1500 }, // dentro del rango
  { id: 'c3', insumoId: 'harina', fecha: '2026-05-20', cantidad: 500, costoTotal: 9999 }, // fuera de rango
];
const producciones: Produccion[] = [
  { id: 'pr1', fecha: '2026-06-10', hora: '07:00', productoId: 'pan', cantidadUnidades: 10 },
  { id: 'pr2', fecha: '2026-05-30', hora: '07:00', productoId: 'pan', cantidadUnidades: 99 }, // fuera de rango
];
const entregas: Entrega[] = [{ id: 'e1', fecha: '2026-06-10', hora: '09:00', tiendaId: 't1' }];
const entregaItems: EntregaItem[] = [
  { id: 'i1', entregaId: 'e1', productoId: 'pan', cantidad: 8, precioUnitario: 1500 },
];
const ventasDirectas: VentaDirecta[] = [
  { id: 'v1', fecha: '2026-06-11', productoId: 'pan', cantidad: 2, precioUnitario: 2000 }, // mostrador
];

const input: ResumenInput = {
  desde: '2026-06-01',
  hasta: '2026-06-30',
  producciones,
  recetas,
  compras,
  entregas,
  entregaItems,
  ventasDirectas,
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

  it('separa ingresos de tiendas y mostrador, y suma el total', () => {
    expect(r.costoProduccion).toBe(2000); // 1000 g * 2
    expect(r.ingresosTiendas).toBe(12000); // 8 * 1500
    expect(r.ingresosMostrador).toBe(4000); // 2 * 2000
    expect(r.ingresos).toBe(16000); // tiendas + mostrador
    expect(r.margen).toBe(14000); // 16000 - 2000
  });

  it('cuenta entregas del periodo', () => {
    expect(r.numEntregas).toBe(1);
  });

  it('suma el gasto real en compras del periodo (excluye fuera de rango)', () => {
    expect(r.gastoInsumos).toBe(3500); // 2000 + 1500; la compra de mayo (9999) queda fuera
    expect(r.gastoPorInsumo).toEqual([{ insumoId: 'harina', monto: 3500 }]);
  });
});

describe('inventarioPorProducto', () => {
  it('produccion menos entregas menos ventas de mostrador', () => {
    const inv = inventarioPorProducto(
      [
        { productoId: 'pan', cantidadUnidades: 20 },
        { productoId: 'rosca', cantidadUnidades: 5 },
      ],
      [
        { productoId: 'pan', cantidad: 8 },
        { productoId: 'pan', cantidad: 2 },
      ],
      [{ productoId: 'pan', cantidad: 4 }], // mostrador
    );
    expect(inv.get('pan')).toBe(6); // 20 - 8 - 2 - 4
    expect(inv.get('rosca')).toBe(5); // sin movimientos
    expect(inv.get('croissant')).toBeUndefined(); // sin producción
  });
});
