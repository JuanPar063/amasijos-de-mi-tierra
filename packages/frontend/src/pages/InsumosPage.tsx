import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  formatCantidadDetalle,
  GRAMOS_POR_LIBRA,
  type Insumo,
  type NuevoInsumo,
  type UnidadBase,
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
import { useAccion, useInsumos } from '../data/hooks';
import { cargarCatalogoInicial } from '../data/seed';
import { formatDinero } from '../lib/format';

/** Precio que se teclea (por libra si es peso, por unidad si es conteo) → precio por unidad base. */
function aPrecioBase(precio: string, unidadBase: UnidadBase): number | undefined {
  const n = Number(precio);
  if (!precio.trim() || !(n > 0)) return undefined;
  return unidadBase === 'g' ? n / GRAMOS_POR_LIBRA : n;
}
/** Precio por unidad base → valor a mostrar en el campo (por libra si es peso). */
function aPrecioInput(insumo: Insumo): string {
  if (insumo.precioBase == null) return '';
  const v = insumo.unidadBase === 'g' ? insumo.precioBase * GRAMOS_POR_LIBRA : insumo.precioBase;
  return String(Math.round(v * 100) / 100);
}

export function InsumosPage() {
  const { data: insumos = [] } = useInsumos();
  const { confirmar } = useDialog();
  const crear = useAccion((repo, d: NuevoInsumo) => repo.insumos.create(d));
  const actualizar = useAccion((repo, a: { id: string; data: Partial<NuevoInsumo> }) =>
    repo.insumos.update(a.id, a.data),
  );
  const borrar = useAccion((repo, id: string) => repo.insumos.delete(id));
  const sembrar = useAccion((repo) => cargarCatalogoInicial(repo));

  const [editando, setEditando] = useState<Insumo | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState('');
  const [unidadBase, setUnidadBase] = useState<UnidadBase>('g');
  const [stock, setStock] = useState(0);
  const [precio, setPrecio] = useState('');

  function abrirNuevo() {
    setEditando(null);
    setNombre('');
    setUnidadBase('g');
    setStock(0);
    setPrecio('');
    setAbierto(true);
  }
  function abrirEditar(i: Insumo) {
    setEditando(i);
    setNombre(i.nombre);
    setUnidadBase(i.unidadBase);
    setStock(i.stockActual);
    setPrecio(aPrecioInput(i));
    setAbierto(true);
  }
  function guardar() {
    if (!nombre.trim()) return;
    const precioBase = aPrecioBase(precio, unidadBase);
    if (editando)
      actualizar.mutate({ id: editando.id, data: { nombre, stockActual: stock, precioBase } });
    else crear.mutate({ nombre, unidadBase, stockActual: stock, precioBase });
    setAbierto(false);
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Insumos"
        accion={
          <Link to="/compras" className="text-sm font-semibold text-amber-700">
            Compras →
          </Link>
        }
      />

      {insumos.length === 0 ? (
        <div className="flex flex-col items-center gap-3">
          <PantallaVacia
            icono="🌾"
            titulo="Sin insumos"
            descripcion="Agrega harina (peso), huevos (unidades), etc."
          />
          <Boton variante="secundario" onClick={() => sembrar.mutate()} disabled={sembrar.isPending}>
            🧺 Cargar catálogo inicial
          </Boton>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {insumos.map((i) => (
            <Tarjeta key={i.id}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-amber-950">{i.nombre}</p>
                  <p className="text-sm text-amber-600">
                    {formatCantidadDetalle(i.stockActual, i.unidadBase)}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => abrirEditar(i)} className="p-2 text-xl" aria-label="Editar">
                    ✏️
                  </button>
                  <button
                    onClick={async () => {
                      if (await confirmar(`¿Borrar ${i.nombre}?`, { peligro: true, textoConfirmar: 'Borrar' }))
                        borrar.mutate(i.id);
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
        titulo={editando ? 'Editar insumo' : 'Nuevo insumo'}
        onClose={() => setAbierto(false)}
      >
        <Campo
          etiqueta="Nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Harina, Huevos…"
        />
        {editando ? (
          <p className="text-sm text-amber-600">
            Se mide en: <span className="font-semibold">{unidadBase === 'u' ? 'unidades' : 'peso'}</span>
          </p>
        ) : (
          <CampoSelector
            etiqueta="¿Cómo se mide?"
            value={unidadBase}
            onChange={(e) => {
              setUnidadBase(e.target.value as UnidadBase);
              setStock(0);
            }}
            opciones={[
              { valor: 'g', texto: 'Peso (gramos / libras)' },
              { valor: 'u', texto: 'Unidades (huevos, etc.)' },
            ]}
          />
        )}
        <div className="flex flex-col gap-1">
          <Campo
            etiqueta={unidadBase === 'g' ? 'Precio por libra (500 g)' : 'Precio por unidad'}
            type="number"
            inputMode="decimal"
            min="0"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            placeholder="0"
          />
          {unidadBase === 'g' && Number(precio) > 0 && (
            <span className="text-xs text-amber-600">
              ≈ {formatDinero(Number(precio) / GRAMOS_POR_LIBRA)} por gramo
            </span>
          )}
        </div>
        <CampoCantidad
          etiqueta="Stock actual"
          unidadBase={unidadBase}
          cantidad={stock}
          onCantidad={setStock}
        />
        <Boton onClick={guardar}>Guardar</Boton>
      </Sheet>
    </>
  );
}
