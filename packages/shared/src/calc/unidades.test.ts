import { describe, expect, it } from 'vitest';
import {
  GRAMOS_POR_LIBRA,
  gramosALibras,
  gramosAKilos,
  kilosAGramos,
  librasAGramos,
} from './unidades';

describe('conversión de unidades', () => {
  it('1 libra = 453.59237 g', () => {
    expect(librasAGramos(1)).toBe(GRAMOS_POR_LIBRA);
  });

  it('ida y vuelta libras<->gramos es identidad', () => {
    expect(gramosALibras(librasAGramos(5))).toBeCloseTo(5, 10);
  });

  it('kilos<->gramos', () => {
    expect(kilosAGramos(2)).toBe(2000);
    expect(gramosAKilos(2500)).toBe(2.5);
  });
});
