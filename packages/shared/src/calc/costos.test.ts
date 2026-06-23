import { describe, expect, it } from 'vitest';
import type { CompraInsumo, ID, Produccion, RecetaItem, UnidadBase } from '../domain/entities';
import {
  consumoDeProduccion,
  costoDeProduccion,
  costoPorBase,
  costoPorBaseVigente,
  ingresosDeEntrega,
} from './costos';

const receta: RecetaItem[] = [
  { id: 'r1', productoId: 'p1', insumoId: 'harina', cantidad: 100 },
  { id: 'r2', productoId: 'p1', insumoId: 'agua', cantidad: 60 },
];

describe('costoPorBase', () => {
  it('divide costo total entre la cantidad', () => {
    expect(costoPorBase({ cantidad: 1000, costoTotal: 5000 })).toBe(5);
  });
  it('evita división por cero', () => {
    expect(costoPorBase({ cantidad: 0, costoTotal: 5000 })).toBe(0);
  });
});

describe('consumoDeProduccion', () => {
  it('multiplica receta por unidades', () => {
    const prod: Pick<Produccion, 'cantidadUnidades' | 'mermaG'> = { cantidadUnidades: 10 };
    expect(consumoDeProduccion(prod, receta)).toEqual([
      { insumoId: 'harina', cantidad: 1000 },
      { insumoId: 'agua', cantidad: 600 },
    ]);
  });

  it('distribuye la merma proporcionalmente (todo peso)', () => {
    // base: harina 1000, agua 600 (total 1600). Merma 160 -> +10% a cada uno.
    const prod = { cantidadUnidades: 10, mermaG: 160 };
    expect(consumoDeProduccion(prod, receta)).toEqual([
      { insumoId: 'harina', cantidad: 1100 },
      { insumoId: 'agua', cantidad: 660 },
    ]);
  });

  it('la merma NO afecta insumos de conteo (huevos)', () => {
    const recetaConHuevos: RecetaItem[] = [
      { id: 'r1', productoId: 'p1', insumoId: 'harina', cantidad: 100 },
      { id: 'r3', productoId: 'p1', insumoId: 'huevo', cantidad: 2 },
    ];
    const unidades = new Map<ID, UnidadBase>([
      ['harina', 'g'],
      ['huevo', 'u'],
    ]);
    const prod = { cantidadUnidades: 10, mermaG: 100 };
    // peso total = harina 1000; merma 100 va completa a harina. Huevos intactos.
    expect(consumoDeProduccion(prod, recetaConHuevos, unidades)).toEqual([
      { insumoId: 'harina', cantidad: 1100 },
      { insumoId: 'huevo', cantidad: 20 },
    ]);
  });
});

describe('costoPorBaseVigente', () => {
  const compras: CompraInsumo[] = [
    { id: 'c1', insumoId: 'harina', fecha: '2026-01-10', cantidad: 1000, costoTotal: 4000 }, // 4
    { id: 'c2', insumoId: 'harina', fecha: '2026-03-01', cantidad: 1000, costoTotal: 6000 }, // 6
  ];

  it('usa la última compra en o antes de la fecha', () => {
    expect(costoPorBaseVigente('harina', '2026-02-15', compras)).toBe(4);
    expect(costoPorBaseVigente('harina', '2026-03-10', compras)).toBe(6);
  });

  it('si la fecha es anterior a toda compra, usa la más antigua', () => {
    expect(costoPorBaseVigente('harina', '2025-12-01', compras)).toBe(4);
  });

  it('sin compras del insumo devuelve 0', () => {
    expect(costoPorBaseVigente('azucar', '2026-02-15', compras)).toBe(0);
  });
});

describe('costoDeProduccion', () => {
  it('combina consumo (peso y conteo) con costo vigente', () => {
    const recetaMixta: RecetaItem[] = [
      { id: 'r1', productoId: 'p1', insumoId: 'harina', cantidad: 100 },
      { id: 'r3', productoId: 'p1', insumoId: 'huevo', cantidad: 2 },
    ];
    const compras: CompraInsumo[] = [
      { id: 'c1', insumoId: 'harina', fecha: '2026-01-01', cantidad: 1000, costoTotal: 2000 }, // 2/g
      { id: 'c2', insumoId: 'huevo', fecha: '2026-01-01', cantidad: 30, costoTotal: 15000 }, // 500/u
    ];
    const unidades = new Map<ID, UnidadBase>([
      ['harina', 'g'],
      ['huevo', 'u'],
    ]);
    const prod: Produccion = {
      id: 'pr1',
      fecha: '2026-02-01',
      hora: '08:00',
      productoId: 'p1',
      cantidadUnidades: 10,
    };
    // harina 1000g * 2 + huevo 20u * 500 = 2000 + 10000 = 12000
    expect(costoDeProduccion(prod, recetaMixta, compras, unidades)).toBe(12000);
  });
});

describe('ingresosDeEntrega', () => {
  it('suma cantidad * precio_unitario', () => {
    expect(
      ingresosDeEntrega([
        { id: 'i1', entregaId: 'e1', productoId: 'p1', cantidad: 10, precioUnitario: 1500 },
        { id: 'i2', entregaId: 'e1', productoId: 'p2', cantidad: 5, precioUnitario: 2000 },
      ]),
    ).toBe(25000);
  });
});
