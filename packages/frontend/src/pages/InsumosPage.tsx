import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  formatCantidadDetalle,
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
import { useAccion, useInsumos } from '../data/hooks';
import { cargarCatalogoInicial } from '../data/seed';

export function InsumosPage() {
  const { data: insumos = [] } = useInsumos();
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

  function abrirNuevo() {
    setEditando(null);
    setNombre('');
    setUnidadBase('g');
    setStock(0);
    setAbierto(true);
  }
  function abrirEditar(i: Insumo) {
    setEditando(i);
    setNombre(i.nombre);
    setUnidadBase(i.unidadBase);
    setStock(i.stockActual);
    setAbierto(true);
  }
  function guardar() {
    if (!nombre.trim()) return;
    if (editando) actualizar.mutate({ id: editando.id, data: { nombre, stockActual: stock } });
    else crear.mutate({ nombre, unidadBase, stockActual: stock });
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
                    onClick={() => {
                      if (window.confirm(`¿Borrar ${i.nombre}?`)) borrar.mutate(i.id);
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
