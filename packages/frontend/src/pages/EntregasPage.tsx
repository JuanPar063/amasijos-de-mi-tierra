import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ingresosDeEntrega, type NuevaEntrega, type NuevoEntregaItem } from '@panaderia/shared';
import {
  Boton,
  BotonFlotante,
  Campo,
  CampoSelector,
  EncabezadoPagina,
  PantallaVacia,
  Sheet,
  Tarjeta,
} from '../components/ui';
import {
  useAccion,
  useEntregaItems,
  useEntregas,
  useProductos,
  useTiendas,
} from '../data/hooks';
import { ahoraHHMM, formatDinero, formatFecha, hoyISO } from '../lib/format';

type FilaItem = { productoId: string; cantidad: number; precioUnitario: number };

export function EntregasPage() {
  const { data: entregas = [] } = useEntregas();
  const { data: items = [] } = useEntregaItems();
  const { data: tiendas = [] } = useTiendas();
  const { data: productos = [] } = useProductos();

  const crear = useAccion(
    (repo, a: { data: NuevaEntrega; items: NuevoEntregaItem[] }) =>
      repo.entregas.create(a.data, a.items),
  );
  const borrar = useAccion((repo, id: string) => repo.entregas.delete(id));

  const nombreTienda = useMemo(() => new Map(tiendas.map((t) => [t.id, t.nombre])), [tiendas]);
  const precioProducto = useMemo(
    () => new Map(productos.map((p) => [p.id, p.precioVenta])),
    [productos],
  );
  const itemsPorEntrega = useMemo(() => {
    const m = new Map<string, typeof items>();
    for (const it of items) {
      const arr = m.get(it.entregaId) ?? [];
      arr.push(it);
      m.set(it.entregaId, arr);
    }
    return m;
  }, [items]);

  const [abierto, setAbierto] = useState(false);
  const [tiendaId, setTiendaId] = useState('');
  const [fecha, setFecha] = useState(hoyISO());
  const [hora, setHora] = useState(ahoraHHMM());
  const [filas, setFilas] = useState<FilaItem[]>([]);

  function abrir() {
    setTiendaId(tiendas[0]?.id ?? '');
    setFecha(hoyISO());
    setHora(ahoraHHMM());
    setFilas([]);
    setAbierto(true);
  }
  function agregarFila() {
    const primero = productos[0];
    setFilas((f) => [
      ...f,
      { productoId: primero?.id ?? '', cantidad: 1, precioUnitario: primero?.precioVenta ?? 0 },
    ]);
  }
  function actualizarFila(idx: number, cambio: Partial<FilaItem>) {
    setFilas((f) => f.map((fila, i) => (i === idx ? { ...fila, ...cambio } : fila)));
  }
  function quitarFila(idx: number) {
    setFilas((f) => f.filter((_, i) => i !== idx));
  }
  function guardar() {
    const validas = filas.filter((f) => f.productoId && f.cantidad > 0);
    if (!tiendaId || validas.length === 0) return;
    crear.mutate({ data: { tiendaId, fecha, hora }, items: validas });
    setAbierto(false);
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Entregas"
        accion={
          <Link to="/tiendas" className="text-sm font-semibold text-amber-700">
            Tiendas →
          </Link>
        }
      />

      {tiendas.length === 0 || productos.length === 0 ? (
        <PantallaVacia
          icono="🚲"
          titulo="Falta información"
          descripcion="Necesitas al menos una tienda y un producto para registrar entregas."
        />
      ) : entregas.length === 0 ? (
        <PantallaVacia icono="🚲" titulo="Sin entregas" descripcion="Registra una entrega a una tienda." />
      ) : (
        <div className="flex flex-col gap-3">
          {entregas.map((e) => {
            const propios = itemsPorEntrega.get(e.id) ?? [];
            return (
              <Tarjeta key={e.id}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-amber-950">
                      {nombreTienda.get(e.tiendaId) ?? 'Tienda'}
                    </p>
                    <p className="text-sm text-amber-600">
                      {formatFecha(e.fecha)} · {e.hora} · {propios.length} producto(s)
                    </p>
                    <p className="text-sm font-semibold text-amber-700">
                      {formatDinero(ingresosDeEntrega(propios))}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      if (window.confirm('¿Borrar esta entrega?')) borrar.mutate(e.id);
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

      {tiendas.length > 0 && productos.length > 0 && (
        <BotonFlotante onClick={abrir} texto="+ Registrar entrega" />
      )}

      <Sheet abierto={abierto} titulo="Registrar entrega" onClose={() => setAbierto(false)}>
        <CampoSelector
          etiqueta="Tienda"
          value={tiendaId}
          onChange={(e) => setTiendaId(e.target.value)}
          opciones={tiendas.map((t) => ({ valor: t.id, texto: t.nombre }))}
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

        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-amber-900">Productos entregados</p>
          {filas.map((fila, idx) => (
            <div key={idx} className="rounded-xl border border-amber-200 bg-white/60 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-500">Renglón {idx + 1}</span>
                <button onClick={() => quitarFila(idx)} className="text-sm text-red-600">
                  Quitar
                </button>
              </div>
              <div className="flex flex-col gap-2">
                <CampoSelector
                  etiqueta="Producto"
                  value={fila.productoId}
                  onChange={(e) =>
                    actualizarFila(idx, {
                      productoId: e.target.value,
                      precioUnitario: precioProducto.get(e.target.value) ?? fila.precioUnitario,
                    })
                  }
                  opciones={productos.map((p) => ({ valor: p.id, texto: p.nombre }))}
                />
                <div className="flex gap-2">
                  <Campo
                    etiqueta="Cantidad"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    value={String(fila.cantidad)}
                    onChange={(e) => actualizarFila(idx, { cantidad: Number(e.target.value) })}
                    className="flex-1"
                  />
                  <Campo
                    etiqueta="Precio unitario"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    value={String(fila.precioUnitario)}
                    onChange={(e) => actualizarFila(idx, { precioUnitario: Number(e.target.value) })}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
          ))}
          <Boton variante="secundario" onClick={agregarFila}>
            + Producto
          </Boton>
        </div>

        <Boton onClick={guardar}>Guardar</Boton>
      </Sheet>
    </>
  );
}
