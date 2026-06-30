import { useState } from 'react';
import type { NuevaTienda, Tienda } from '@panaderia/shared';
import {
  Boton,
  BotonFlotante,
  Campo,
  EncabezadoPagina,
  PantallaVacia,
  Sheet,
  Tarjeta,
} from '../components/ui';
import { useDialog } from '../components/dialog';
import { useAccion, useTiendas } from '../data/hooks';

export function TiendasPage() {
  const { data: tiendas = [] } = useTiendas();
  const { confirmar } = useDialog();
  const crear = useAccion((repo, d: NuevaTienda) => repo.tiendas.create(d));
  const actualizar = useAccion((repo, a: { id: string; data: Partial<NuevaTienda> }) =>
    repo.tiendas.update(a.id, a.data),
  );
  const borrar = useAccion((repo, id: string) => repo.tiendas.delete(id));

  const [editando, setEditando] = useState<Tienda | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');
  const [contacto, setContacto] = useState('');

  function abrirNuevo() {
    setEditando(null);
    setNombre('');
    setDireccion('');
    setContacto('');
    setAbierto(true);
  }
  function abrirEditar(t: Tienda) {
    setEditando(t);
    setNombre(t.nombre);
    setDireccion(t.direccion ?? '');
    setContacto(t.contacto ?? '');
    setAbierto(true);
  }
  function guardar() {
    if (!nombre.trim()) return;
    const data: NuevaTienda = {
      nombre,
      direccion: direccion.trim() || undefined,
      contacto: contacto.trim() || undefined,
    };
    if (editando) actualizar.mutate({ id: editando.id, data });
    else crear.mutate(data);
    setAbierto(false);
  }

  return (
    <>
      <EncabezadoPagina titulo="Tiendas" />

      {tiendas.length === 0 ? (
        <PantallaVacia icono="🏪" titulo="Sin tiendas" descripcion="Agrega los puntos de venta." />
      ) : (
        <div className="flex flex-col gap-3">
          {tiendas.map((t) => (
            <Tarjeta key={t.id}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-amber-950">{t.nombre}</p>
                  {t.direccion && <p className="text-sm text-amber-600">{t.direccion}</p>}
                  {t.contacto && <p className="text-sm text-amber-600">{t.contacto}</p>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => abrirEditar(t)} className="p-2 text-xl" aria-label="Editar">
                    ✏️
                  </button>
                  <button
                    onClick={async () => {
                      if (await confirmar(`¿Borrar ${t.nombre}?`, { peligro: true, textoConfirmar: 'Borrar' }))
                        borrar.mutate(t.id);
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
        titulo={editando ? 'Editar tienda' : 'Nueva tienda'}
        onClose={() => setAbierto(false)}
      >
        <Campo
          etiqueta="Nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Tienda La Esquina"
        />
        <Campo
          etiqueta="Dirección (opcional)"
          value={direccion}
          onChange={(e) => setDireccion(e.target.value)}
        />
        <Campo
          etiqueta="Contacto (opcional)"
          value={contacto}
          onChange={(e) => setContacto(e.target.value)}
          placeholder="Teléfono o nombre"
        />
        <Boton onClick={guardar}>Guardar</Boton>
      </Sheet>
    </>
  );
}
