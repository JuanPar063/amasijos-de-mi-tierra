import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { formatCantidad, resumenPeriodo, type ResumenInput } from '@panaderia/shared';
import { EncabezadoPagina, Tarjeta } from '../components/ui';
import {
  useCompras,
  useEntregaItems,
  useEntregas,
  useInsumos,
  useProducciones,
  useProductos,
  useRecetas,
} from '../data/hooks';
import { formatDinero, hoyISO, inicioDeMesISO } from '../lib/format';

export function Dashboard() {
  const { data: insumos = [] } = useInsumos();
  const { data: productos = [] } = useProductos();
  const { data: producciones = [] } = useProducciones();
  const { data: recetas = [] } = useRecetas();
  const { data: compras = [] } = useCompras();
  const { data: entregas = [] } = useEntregas();
  const { data: entregaItems = [] } = useEntregaItems();

  const hoy = hoyISO();
  const inicioMes = inicioDeMesISO();

  const base: Omit<ResumenInput, 'desde' | 'hasta'> = {
    producciones,
    recetas,
    compras,
    entregas,
    entregaItems,
    insumos,
  };
  const resumenHoy = useMemo(
    () => resumenPeriodo({ ...base, desde: hoy, hasta: hoy }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [producciones, recetas, compras, entregas, entregaItems, insumos, hoy],
  );
  const resumenMes = useMemo(
    () => resumenPeriodo({ ...base, desde: inicioMes, hasta: hoy }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [producciones, recetas, compras, entregas, entregaItems, insumos, inicioMes, hoy],
  );

  const nombreInsumo = useMemo(() => new Map(insumos.map((i) => [i.id, i.nombre])), [insumos]);
  const unidadInsumo = useMemo(() => new Map(insumos.map((i) => [i.id, i.unidadBase])), [insumos]);
  const nombreProducto = useMemo(
    () => new Map(productos.map((p) => [p.id, p.nombre])),
    [productos],
  );

  return (
    <>
      <EncabezadoPagina titulo="Inicio" />

      <div className="flex flex-col gap-3">
        <Tarjeta>
          <p className="text-sm font-semibold text-amber-500">Pan hecho hoy</p>
          <p className="text-3xl font-bold text-amber-950">{resumenHoy.unidadesProducidas}</p>
          {resumenHoy.produccionPorProducto.length > 0 && (
            <ul className="mt-1 text-sm text-amber-600">
              {resumenHoy.produccionPorProducto.map((pp) => (
                <li key={pp.productoId}>
                  {pp.unidades} × {nombreProducto.get(pp.productoId) ?? 'Producto'}
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>

        <Tarjeta>
          <p className="text-sm font-semibold text-amber-500">Insumos consumidos hoy</p>
          {resumenHoy.consumoPorInsumo.length === 0 ? (
            <p className="text-amber-600">—</p>
          ) : (
            <ul className="mt-1 text-sm text-amber-700">
              {resumenHoy.consumoPorInsumo.map((c) => (
                <li key={c.insumoId} className="flex justify-between">
                  <span>{nombreInsumo.get(c.insumoId) ?? 'Insumo'}</span>
                  <span className="font-medium">
                    {formatCantidad(c.cantidad, unidadInsumo.get(c.insumoId) ?? 'g')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>

        <Tarjeta>
          <p className="text-sm font-semibold text-amber-500">Entregas del día</p>
          <div className="flex items-end justify-between">
            <p className="text-3xl font-bold text-amber-950">{resumenHoy.numEntregas}</p>
            <p className="text-lg font-semibold text-amber-700">{formatDinero(resumenHoy.ingresos)}</p>
          </div>
        </Tarjeta>

        <Tarjeta className="bg-amber-600 text-white">
          <p className="text-sm font-semibold text-amber-100">Resumen del mes</p>
          <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
            <Metrica etiqueta="Producción" valor={`${resumenMes.unidadesProducidas} u`} />
            <Metrica etiqueta="Entregas" valor={String(resumenMes.numEntregas)} />
            <Metrica etiqueta="Ingresos" valor={formatDinero(resumenMes.ingresos)} />
            <Metrica etiqueta="Costo" valor={formatDinero(resumenMes.costoProduccion)} />
            <Metrica etiqueta="Margen" valor={formatDinero(resumenMes.margen)} destacar />
          </div>
        </Tarjeta>

        <div className="grid grid-cols-2 gap-3 pt-1">
          <Atajo to="/compras" icono="🧾" texto="Compras" />
          <Atajo to="/tiendas" icono="🏪" texto="Tiendas" />
        </div>
        <Atajo to="/reportes" icono="📄" texto="Reportes y respaldo" />
      </div>
    </>
  );
}

function Metrica({
  etiqueta,
  valor,
  destacar = false,
}: {
  etiqueta: string;
  valor: string;
  destacar?: boolean;
}) {
  return (
    <div>
      <p className="text-amber-100">{etiqueta}</p>
      <p className={`font-bold ${destacar ? 'text-lg' : ''}`}>{valor}</p>
    </div>
  );
}

function Atajo({ to, icono, texto }: { to: string; icono: string; texto: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2 rounded-2xl bg-white p-4 font-semibold text-amber-900 shadow-sm"
    >
      <span className="text-2xl">{icono}</span>
      {texto}
    </Link>
  );
}
