import { useMemo, useState } from 'react';
import {
  consumoDeProduccion,
  faltantesParaProduccion,
  formatCantidad,
  formatGramos,
  inventarioPorProducto,
  type NuevaProduccion,
  type Produccion,
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

/** Une horas en una sola cadena ordenada y sin repetir: '08:00, 15:00'. */
function unirHoras(previas: string, nueva: string): string {
  const set = new Set(
    previas
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
  if (nueva.trim()) set.add(nueva.trim());
  return [...set].sort().join(', ');
}

export function ProduccionPage() {
  const { data: producciones = [] } = useProducciones();
  const { data: productos = [] } = useProductos();
  const { data: recetas = [] } = useRecetas();
  const { data: insumos = [] } = useInsumos();
  const { data: entregaItems = [] } = useEntregaItems();
  const { data: ventasDirectas = [] } = useVentasDirectas();
  const { alertar, confirmar } = useDialog();
  const crear = useAccion((repo, d: NuevaProduccion) => repo.producciones.create(d));
  const actualizar = useAccion((repo, a: { id: string; data: Partial<NuevaProduccion> }) =>
    repo.producciones.update(a.id, a.data),
  );
  const borrar = useAccion((repo, id: string) => repo.producciones.delete(id));

  const nombreProducto = useMemo(
    () => new Map(productos.map((p) => [p.id, p.nombre])),
    [productos],
  );
  const insumoPorId = useMemo(() => new Map(insumos.map((i) => [i.id, i])), [insumos]);
  const unidadMap = useMemo(
    () => new Map(insumos.map((i) => [i.id, i.unidadBase])),
    [insumos],
  );

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

  const [editando, setEditando] = useState<Produccion | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [productoId, setProductoId] = useState('');
  const [fecha, setFecha] = useState(hoyISO());
  const [hora, setHora] = useState(ahoraHHMM());
  const [cantidad, setCantidad] = useState('');
  const [mermaG, setMermaG] = useState(0);

  function abrir() {
    setEditando(null);
    setProductoId(productos[0]?.id ?? '');
    setFecha(hoyISO());
    setHora(ahoraHHMM());
    setCantidad('');
    setMermaG(0);
    setAbierto(true);
  }
  function abrirEditar(p: Produccion) {
    setEditando(p);
    setProductoId(p.productoId);
    setFecha(p.fecha);
    setHora(p.hora);
    setCantidad(String(p.cantidadUnidades));
    setMermaG(p.mermaG ?? 0);
    setAbierto(true);
  }
  function cerrar() {
    setAbierto(false);
    setEditando(null);
  }

  // Muestra qué insumo falta y bloquea. `faltantes` ya viene calculado.
  async function avisarFaltantes(
    faltantes: { insumoId: string; necesita: number; disponible: number }[],
    unidades: number,
  ) {
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
  }

  async function guardar() {
    const unidades = Number(cantidad);
    if (!productoId || unidades <= 0) return;
    const mermaFinal = mermaG > 0 ? mermaG : undefined;

    if (editando) {
      // Editar: el producto y la fecha quedan fijos; solo cambian cantidad/horas/merma.
      const receta = recetas.filter((r) => r.productoId === editando.productoId);
      // Al editar, el consumo anterior se "devuelve" al stock antes de aplicar el nuevo;
      // por eso validamos contra el stock ajustado (stock actual + consumo previo).
      const consumoPrevio = consumoDeProduccion(editando, receta, unidadMap);
      const insumosAjustados = insumos.map((i) => {
        const c = consumoPrevio.find((x) => x.insumoId === i.id);
        return c ? { ...i, stockActual: i.stockActual + c.cantidad } : i;
      });
      const faltantes = faltantesParaProduccion(
        { cantidadUnidades: unidades, mermaG: mermaFinal },
        receta,
        insumosAjustados,
      );
      if (faltantes.length > 0) {
        await avisarFaltantes(faltantes, unidades);
        return;
      }
      await actualizar.mutateAsync({
        id: editando.id,
        data: { cantidadUnidades: unidades, hora, mermaG: mermaFinal },
      });
      cerrar();
      return;
    }

    // Registrar: bloquea si el consumo dejaría algún insumo en negativo (indica cuál falta).
    const receta = recetas.filter((r) => r.productoId === productoId);
    const faltantes = faltantesParaProduccion(
      { cantidadUnidades: unidades, mermaG: mermaFinal },
      receta,
      insumos,
    );
    if (faltantes.length > 0) {
      await avisarFaltantes(faltantes, unidades);
      return;
    }
    // Si ya hubo producción de este producto el mismo día, suma en vez de crear otra
    // tarjeta: actualiza la cantidad y junta las horas (mañana y tarde).
    const existente = producciones.find(
      (p) => p.productoId === productoId && p.fecha === fecha,
    );
    if (existente) {
      await actualizar.mutateAsync({
        id: existente.id,
        data: {
          cantidadUnidades: existente.cantidadUnidades + unidades,
          mermaG: (existente.mermaG ?? 0) + (mermaFinal ?? 0) || undefined,
          hora: unirHoras(existente.hora, hora),
        },
      });
    } else {
      await crear.mutateAsync({ productoId, fecha, hora, cantidadUnidades: unidades, mermaG: mermaFinal });
    }
    cerrar();
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
                    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                      disp. {Math.max(0, Math.floor(inventario.get(p.productoId) ?? 0))}
                    </span>
                  </p>
                  <p className="text-sm text-amber-600">
                    {formatFecha(p.fecha)} · {p.hora}
                    {p.mermaG ? ` · merma ${formatGramos(p.mermaG)}` : ''}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => abrirEditar(p)} className="p-2 text-xl" aria-label="Editar">
                    ✏️
                  </button>
                  <button
                    onClick={async () => {
                      // No permitir que el borrado deje el inventario en negativo:
                      // significaría que ya se entregó/vendió pan que dejaría de existir.
                      const restante = (inventario.get(p.productoId) ?? 0) - p.cantidadUnidades;
                      if (restante < 0) {
                        await alertar(
                          `No puedes borrar esta producción de ${p.cantidadUnidades} × ${
                            nombreProducto.get(p.productoId) ?? 'producto'
                          }: ya se entregaron o vendieron más unidades de las que quedarían (el inventario quedaría en ${restante}). Borra primero esas entregas o ventas de mostrador.`,
                          { titulo: 'No se puede borrar' },
                        );
                        return;
                      }
                      if (await confirmar('¿Borrar este registro?', { peligro: true, textoConfirmar: 'Borrar' }))
                        borrar.mutate(p.id);
                    }}
                    className="p-2 text-xl"
                    aria-label="Borrar"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </Tarjeta>
          ))}
        </div>
      )}

      {productos.length > 0 && <BotonFlotante onClick={abrir} texto="+ Registrar producción" />}

      <Sheet
        abierto={abierto}
        titulo={editando ? 'Editar producción' : 'Registrar producción'}
        onClose={cerrar}
      >
        {editando ? (
          <p className="text-sm text-amber-700">
            Producto: <span className="font-semibold">{nombreProducto.get(productoId)}</span> ·{' '}
            {formatFecha(fecha)}
          </p>
        ) : (
          <CampoSelector
            etiqueta="Producto"
            value={productoId}
            onChange={(e) => setProductoId(e.target.value)}
            opciones={productos.map((p) => ({ valor: p.id, texto: p.nombre }))}
          />
        )}
        <Campo
          etiqueta="Cantidad (unidades)"
          type="number"
          inputMode="numeric"
          min="0"
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          placeholder="0"
        />
        {editando ? (
          <Campo
            etiqueta="Hora(s)"
            value={hora}
            onChange={(e) => setHora(e.target.value)}
            placeholder="08:00, 15:00"
          />
        ) : (
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
        )}
        <CampoPeso etiqueta="Merma (opcional)" gramos={mermaG} onGramos={setMermaG} />
        <Boton onClick={guardar}>Guardar</Boton>
      </Sheet>
    </>
  );
}
