import { useMemo, useState } from 'react';
import {
  costoPorBaseVigente,
  type NuevoProducto,
  type NuevoRecetaItem,
  type Producto,
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
import { useDialog } from '../components/dialog';
import { useAccion, useCompras, useInsumos, useProductos, useRecetas } from '../data/hooks';
import { useRepository } from '../storage/repo-context';
import { formatDinero, hoyISO } from '../lib/format';

type FilaReceta = { insumoId: string; cantidad: number };

export function ProductosPage() {
  const repo = useRepository();
  const { data: productos = [] } = useProductos();
  const { data: insumos = [] } = useInsumos();
  const { data: recetas = [] } = useRecetas();
  const { data: compras = [] } = useCompras();
  const { confirmar } = useDialog();

  const guardarProducto = useAccion(
    (r, a: { id?: string; data: NuevoProducto; receta: NuevoRecetaItem[] }) =>
      (async () => {
        const prod = a.id ? await r.productos.update(a.id, a.data) : await r.productos.create(a.data);
        await r.recetas.setByProducto(prod.id, a.receta);
        return prod;
      })(),
  );
  const borrar = useAccion((r, id: string) => r.productos.delete(id));

  const numIngredientes = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of recetas) m.set(r.productoId, (m.get(r.productoId) ?? 0) + 1);
    return m;
  }, [recetas]);

  const [editando, setEditando] = useState<Producto | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState('');
  const [precioMostrador, setPrecioMostrador] = useState('');
  const [empaqueInsumoId, setEmpaqueInsumoId] = useState('');
  const [filas, setFilas] = useState<FilaReceta[]>([]);

  // Las bolsas son insumos por unidad ('u').
  const bolsas = insumos.filter((i) => i.unidadBase === 'u');

  // Costo por unidad del producto = Σ (cantidad de receta × costo vigente del insumo).
  const costoUnitario = useMemo(
    () =>
      filas.reduce(
        (acc, f) =>
          f.insumoId && f.cantidad > 0
            ? acc + f.cantidad * costoPorBaseVigente(f.insumoId, hoyISO(), compras)
            : acc,
        0,
      ),
    [filas, compras],
  );

  function abrirNuevo() {
    setEditando(null);
    setNombre('');
    setPrecio('');
    setPrecioMostrador('');
    setEmpaqueInsumoId('');
    setFilas([]);
    setAbierto(true);
  }
  async function abrirEditar(p: Producto) {
    setEditando(p);
    setNombre(p.nombre);
    setPrecio(String(p.precioVenta));
    setPrecioMostrador(p.precioMostrador != null ? String(p.precioMostrador) : '');
    setEmpaqueInsumoId(p.empaqueInsumoId ?? '');
    const receta = await repo.recetas.getByProducto(p.id);
    setFilas(receta.map((r) => ({ insumoId: r.insumoId, cantidad: r.cantidad })));
    setAbierto(true);
  }

  function agregarFila() {
    setFilas((f) => [...f, { insumoId: insumos[0]?.id ?? '', cantidad: 0 }]);
  }
  function actualizarFila(idx: number, cambio: Partial<FilaReceta>) {
    setFilas((f) => f.map((fila, i) => (i === idx ? { ...fila, ...cambio } : fila)));
  }
  function quitarFila(idx: number) {
    setFilas((f) => f.filter((_, i) => i !== idx));
  }

  function guardar() {
    if (!nombre.trim()) return;
    const receta = filas.filter((f) => f.insumoId && f.cantidad > 0);
    guardarProducto.mutate({
      id: editando?.id,
      data: {
        nombre,
        precioVenta: Number(precio) || 0,
        precioMostrador: precioMostrador ? Number(precioMostrador) : undefined,
        empaqueInsumoId: empaqueInsumoId || undefined,
      },
      receta,
    });
    setAbierto(false);
  }

  return (
    <>
      <EncabezadoPagina titulo="Productos" />

      {productos.length === 0 ? (
        <PantallaVacia
          icono="🍞"
          titulo="Sin productos"
          descripcion="Define el pan y su receta."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {productos.map((p) => (
            <Tarjeta key={p.id}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-amber-950">{p.nombre}</p>
                  <p className="text-sm text-amber-600">
                    {formatDinero(p.precioVenta)} · {numIngredientes.get(p.id) ?? 0} ingrediente(s)
                  </p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => abrirEditar(p)} className="p-2 text-xl" aria-label="Editar">
                    ✏️
                  </button>
                  <button
                    onClick={async () => {
                      if (await confirmar(`¿Borrar ${p.nombre}?`, { peligro: true, textoConfirmar: 'Borrar' }))
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

      <BotonFlotante onClick={abrirNuevo} />

      <Sheet
        abierto={abierto}
        titulo={editando ? 'Editar producto' : 'Nuevo producto'}
        onClose={() => setAbierto(false)}
      >
        <Campo
          etiqueta="Nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Pan francés"
        />
        <div className="flex gap-2">
          <Campo
            etiqueta="Precio a tiendas"
            type="number"
            inputMode="decimal"
            min="0"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            placeholder="0"
            className="flex-1"
          />
          <Campo
            etiqueta="Precio en mostrador"
            type="number"
            inputMode="decimal"
            min="0"
            value={precioMostrador}
            onChange={(e) => setPrecioMostrador(e.target.value)}
            placeholder="(= tiendas)"
            className="flex-1"
          />
        </div>
        {bolsas.length > 0 && (
          <CampoSelector
            etiqueta="Bolsa al entregar (domicilio)"
            value={empaqueInsumoId}
            onChange={(e) => setEmpaqueInsumoId(e.target.value)}
            opciones={bolsas.map((b) => ({ valor: b.id, texto: b.nombre }))}
            placeholder="(ninguna)"
          />
        )}

        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-amber-900">Receta (por unidad)</p>
          {insumos.length === 0 && (
            <p className="text-sm text-amber-600">Agrega insumos primero para armar la receta.</p>
          )}
          {filas.map((fila, idx) => (
            <div key={idx} className="rounded-xl border border-amber-200 bg-white/60 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-500">Ingrediente {idx + 1}</span>
                <button onClick={() => quitarFila(idx)} className="text-sm text-red-600">
                  Quitar
                </button>
              </div>
              <div className="flex flex-col gap-2">
                <CampoSelector
                  etiqueta="Insumo"
                  value={fila.insumoId}
                  onChange={(e) => actualizarFila(idx, { insumoId: e.target.value, cantidad: 0 })}
                  opciones={insumos.map((i) => ({ valor: i.id, texto: i.nombre }))}
                />
                <CampoCantidad
                  etiqueta="Cantidad"
                  unidadBase={insumos.find((i) => i.id === fila.insumoId)?.unidadBase ?? 'g'}
                  cantidad={fila.cantidad}
                  onCantidad={(n) => actualizarFila(idx, { cantidad: n })}
                />
              </div>
            </div>
          ))}
          {insumos.length > 0 && (
            <Boton variante="secundario" onClick={agregarFila}>
              + Ingrediente
            </Boton>
          )}
        </div>

        {costoUnitario > 0 && (
          <div className="flex items-center justify-between rounded-xl bg-amber-100 px-4 py-3 text-sm font-medium text-amber-900">
            <span>Costo por unidad (insumos)</span>
            <span className="font-bold">{formatDinero(costoUnitario)}</span>
          </div>
        )}

        <Boton onClick={guardar}>Guardar</Boton>
      </Sheet>
    </>
  );
}
