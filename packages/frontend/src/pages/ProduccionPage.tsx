import { useMemo, useState } from 'react';
import { formatGramos, type NuevaProduccion } from '@panaderia/shared';
import {
  Boton,
  BotonFlotante,
  Campo,
  CampoPeso,
  CampoSelector,
  EncabezadoPagina,
  PantallaVacia,
  Sheet,
  Tarjeta,
} from '../components/ui';
import { useAccion, useProducciones, useProductos } from '../data/hooks';
import { ahoraHHMM, formatFecha, hoyISO } from '../lib/format';

export function ProduccionPage() {
  const { data: producciones = [] } = useProducciones();
  const { data: productos = [] } = useProductos();
  const crear = useAccion((repo, d: NuevaProduccion) => repo.producciones.create(d));
  const borrar = useAccion((repo, id: string) => repo.producciones.delete(id));

  const nombreProducto = useMemo(
    () => new Map(productos.map((p) => [p.id, p.nombre])),
    [productos],
  );

  const [abierto, setAbierto] = useState(false);
  const [productoId, setProductoId] = useState('');
  const [fecha, setFecha] = useState(hoyISO());
  const [hora, setHora] = useState(ahoraHHMM());
  const [cantidad, setCantidad] = useState('');
  const [mermaG, setMermaG] = useState(0);

  function abrir() {
    setProductoId(productos[0]?.id ?? '');
    setFecha(hoyISO());
    setHora(ahoraHHMM());
    setCantidad('');
    setMermaG(0);
    setAbierto(true);
  }
  function guardar() {
    const unidades = Number(cantidad);
    if (!productoId || unidades <= 0) return;
    crear.mutate({
      productoId,
      fecha,
      hora,
      cantidadUnidades: unidades,
      mermaG: mermaG > 0 ? mermaG : undefined,
    });
    setAbierto(false);
  }

  return (
    <>
      <EncabezadoPagina titulo="Producción" />

      {productos.length === 0 ? (
        <PantallaVacia
          icono="🍞"
          titulo="Primero registra productos"
          descripcion="Necesitas un producto (con receta) para registrar producción."
        />
      ) : producciones.length === 0 ? (
        <PantallaVacia icono="👨‍🍳" titulo="Sin producción" descripcion="Registra el pan que se hizo." />
      ) : (
        <div className="flex flex-col gap-3">
          {producciones.map((p) => (
            <Tarjeta key={p.id}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-amber-950">
                    {p.cantidadUnidades} × {nombreProducto.get(p.productoId) ?? 'Producto'}
                  </p>
                  <p className="text-sm text-amber-600">
                    {formatFecha(p.fecha)} · {p.hora}
                    {p.mermaG ? ` · merma ${formatGramos(p.mermaG)}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (window.confirm('¿Borrar este registro?')) borrar.mutate(p.id);
                  }}
                  className="p-2 text-xl"
                  aria-label="Borrar"
                >
                  🗑️
                </button>
              </div>
            </Tarjeta>
          ))}
        </div>
      )}

      {productos.length > 0 && <BotonFlotante onClick={abrir} texto="+ Registrar producción" />}

      <Sheet abierto={abierto} titulo="Registrar producción" onClose={() => setAbierto(false)}>
        <CampoSelector
          etiqueta="Producto"
          value={productoId}
          onChange={(e) => setProductoId(e.target.value)}
          opciones={productos.map((p) => ({ valor: p.id, texto: p.nombre }))}
        />
        <Campo
          etiqueta="Cantidad (unidades)"
          type="number"
          inputMode="numeric"
          min="0"
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          placeholder="0"
        />
        <div className="flex gap-2">
          <Campo
            etiqueta="Fecha"
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="flex-1"
          />
          <Campo
            etiqueta="Hora"
            type="time"
            value={hora}
            onChange={(e) => setHora(e.target.value)}
            className="flex-1"
          />
        </div>
        <CampoPeso etiqueta="Merma (opcional)" gramos={mermaG} onGramos={setMermaG} />
        <Boton onClick={guardar}>Guardar</Boton>
      </Sheet>
    </>
  );
}
