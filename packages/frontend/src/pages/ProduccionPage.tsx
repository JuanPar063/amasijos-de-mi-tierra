import { useMemo, useState } from 'react';
import {
  faltantesParaProduccion,
  formatCantidad,
  formatGramos,
  inventarioPorProducto,
  type NuevaProduccion,
} from '@panaderia/shared';
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
import { useDialog } from '../components/dialog';
import {
  useAccion,
  useEntregaItems,
  useInsumos,
  useProducciones,
  useProductos,
  useRecetas,
  useVentasDirectas,
} from '../data/hooks';
import { ahoraHHMM, formatFecha, hoyISO } from '../lib/format';

export function ProduccionPage() {
  const { data: producciones = [] } = useProducciones();
  const { data: productos = [] } = useProductos();
  const { data: recetas = [] } = useRecetas();
  const { data: insumos = [] } = useInsumos();
  const { data: entregaItems = [] } = useEntregaItems();
  const { data: ventasDirectas = [] } = useVentasDirectas();
  const { alertar, confirmar } = useDialog();
  const crear = useAccion((repo, d: NuevaProduccion) => repo.producciones.create(d));
  const borrar = useAccion((repo, id: string) => repo.producciones.delete(id));

  const nombreProducto = useMemo(
    () => new Map(productos.map((p) => [p.id, p.nombre])),
    [productos],
  );
  const insumoPorId = useMemo(() => new Map(insumos.map((i) => [i.id, i])), [insumos]);

  // Inventario disponible (acumulado), igual que en Mostrador y Entregas.
  const inventario = useMemo(
    () => inventarioPorProducto(producciones, entregaItems, ventasDirectas),
    [producciones, entregaItems, ventasDirectas],
  );
  const disponibles = useMemo(
    () =>
      productos
        .map((p) => ({ p, n: Math.max(0, Math.floor(inventario.get(p.id) ?? 0)) }))
        .filter((x) => x.n > 0),
    [productos, inventario],
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
  async function guardar() {
    const unidades = Number(cantidad);
    if (!productoId || unidades <= 0) return;
    const prod = {
      productoId,
      fecha,
      hora,
      cantidadUnidades: unidades,
      mermaG: mermaG > 0 ? mermaG : undefined,
    };
    // Bloquea si el consumo dejaría algún insumo en negativo (indica cuál falta).
    const receta = recetas.filter((r) => r.productoId === productoId);
    const faltantes = faltantesParaProduccion(prod, receta, insumos);
    if (faltantes.length > 0) {
      const detalle = faltantes
        .map((f) => {
          const ins = insumoPorId.get(f.insumoId);
          const u = ins?.unidadBase ?? 'g';
          return `• ${ins?.nombre ?? 'Insumo'}: necesitas ${formatCantidad(
            f.necesita,
            u,
          )}, hay ${formatCantidad(f.disponible, u)}`;
        })
        .join('\n');
      await alertar(
        `No hay insumos suficientes para producir ${unidades} unidad(es):\n\n${detalle}\n\nReduce la cantidad o registra una compra.`,
        { titulo: 'Falta insumo' },
      );
      return;
    }
    crear.mutate(prod);
    setAbierto(false);
  }

  return (
    <>
      <EncabezadoPagina titulo="Producción" />

      {disponibles.length > 0 && (
        <Tarjeta className="mb-3">
          <p className="mb-1 text-sm font-semibold text-amber-500">
            Disponible para vender/entregar
          </p>
          <ul className="text-sm text-amber-800">
            {disponibles.map(({ p, n }) => (
              <li key={p.id} className="flex justify-between">
                <span>{p.nombre}</span>
                <span className="font-semibold">{n}</span>
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}

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
                  onClick={async () => {
                    if (await confirmar('¿Borrar este registro?', { peligro: true, textoConfirmar: 'Borrar' }))
                      borrar.mutate(p.id);
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
