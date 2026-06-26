import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  costoPorBase,
  costoPorBaseVigente,
  formatCantidad,
  type NuevaCompraInsumo,
} from '@panaderia/shared';
import {
  Boton,
  BotonFlotante,
  Campo,
  CampoCantidad,
  CampoSelector,
  EncabezadoPagina,
  PantallaVacia,
  Sheet,
  Tarjeta,
} from '../components/ui';
import { useAccion, useCompras, useInsumos } from '../data/hooks';
import { formatDinero, formatFecha, hoyISO } from '../lib/format';

export function ComprasPage() {
  const { data: compras = [] } = useCompras();
  const { data: insumos = [] } = useInsumos();
  const crear = useAccion((repo, d: NuevaCompraInsumo) => repo.compras.create(d));
  const borrar = useAccion((repo, id: string) => repo.compras.delete(id));

  const porId = useMemo(() => new Map(insumos.map((i) => [i.id, i])), [insumos]);

  const [abierto, setAbierto] = useState(false);
  const [insumoId, setInsumoId] = useState('');
  const [fecha, setFecha] = useState(hoyISO());
  const [cantidad, setCantidad] = useState(0);
  const [costoTotal, setCostoTotal] = useState('');

  const unidadSel = porId.get(insumoId)?.unidadBase ?? 'g';
  // Precio por unidad base del insumo (de su última compra vigente en la fecha).
  const precioBase = useMemo(
    () => (insumoId ? costoPorBaseVigente(insumoId, fecha, compras) : 0),
    [insumoId, fecha, compras],
  );

  // Al cambiar la cantidad, autocompleta el costo total = cantidad × precio base.
  function aplicarCantidad(n: number) {
    setCantidad(n);
    if (precioBase > 0) setCostoTotal(String(Math.round(n * precioBase)));
  }

  function abrir() {
    setInsumoId(insumos[0]?.id ?? '');
    setFecha(hoyISO());
    setCantidad(0);
    setCostoTotal('');
    setAbierto(true);
  }
  function guardar() {
    const costo = Number(costoTotal);
    if (!insumoId || cantidad <= 0 || !costo) return;
    crear.mutate({ insumoId, fecha, cantidad, costoTotal: costo });
    setAbierto(false);
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Compras"
        accion={
          <Link to="/insumos" className="text-sm font-semibold text-amber-700">
            ← Insumos
          </Link>
        }
      />

      {insumos.length === 0 ? (
        <PantallaVacia
          icono="🌾"
          titulo="Primero registra insumos"
          descripcion="Necesitas un insumo para registrar su compra."
        />
      ) : compras.length === 0 ? (
        <PantallaVacia icono="🧾" titulo="Sin compras" descripcion="Registra la compra de un insumo." />
      ) : (
        <div className="flex flex-col gap-3">
          {compras.map((c) => {
            const insumo = porId.get(c.insumoId);
            const unidad = insumo?.unidadBase ?? 'g';
            return (
              <Tarjeta key={c.id}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-amber-950">{insumo?.nombre ?? 'Insumo'}</p>
                    <p className="text-sm text-amber-600">
                      {formatFecha(c.fecha)} · {formatCantidad(c.cantidad, unidad)}
                    </p>
                    <p className="text-sm text-amber-700">
                      {formatDinero(c.costoTotal)}{' '}
                      <span className="text-amber-400">
                        ({formatDinero(costoPorBase(c))}/{unidad})
                      </span>
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      if (window.confirm('¿Borrar esta compra?')) borrar.mutate(c.id);
                    }}
                    className="p-2 text-xl"
                    aria-label="Borrar"
                  >
                    🗑️
                  </button>
                </div>
              </Tarjeta>
            );
          })}
        </div>
      )}

      {insumos.length > 0 && <BotonFlotante onClick={abrir} texto="+ Registrar compra" />}

      <Sheet abierto={abierto} titulo="Registrar compra" onClose={() => setAbierto(false)}>
        <CampoSelector
          etiqueta="Insumo"
          value={insumoId}
          onChange={(e) => {
            setInsumoId(e.target.value);
            setCantidad(0);
            setCostoTotal('');
          }}
          opciones={insumos.map((i) => ({ valor: i.id, texto: i.nombre }))}
        />
        <Campo etiqueta="Fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        <CampoCantidad
          etiqueta="Cantidad comprada"
          unidadBase={unidadSel}
          cantidad={cantidad}
          onCantidad={aplicarCantidad}
        />
        <div className="flex flex-col gap-1">
          <Campo
            etiqueta="Costo total"
            type="number"
            inputMode="decimal"
            min="0"
            value={costoTotal}
            onChange={(e) => setCostoTotal(e.target.value)}
            placeholder="0"
          />
          {precioBase > 0 && (
            <span className="text-xs text-amber-600">
              Calculado con {formatDinero(precioBase)}/{unidadSel} (último precio). Puedes ajustarlo.
            </span>
          )}
        </div>
        <Boton onClick={guardar}>Guardar</Boton>
      </Sheet>
    </>
  );
}
