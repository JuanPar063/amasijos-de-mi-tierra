import { useMemo, useState } from 'react';
import { formatCantidad, inventarioPorProducto, type Producto } from '@panaderia/shared';
import {
  Boton,
  Campo,
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
  useVentasDirectas,
} from '../data/hooks';
import { formatDinero, hoyISO } from '../lib/format';

const precioDe = (p: Producto): number => p.precioMostrador ?? p.precioVenta;

export function MostradorPage() {
  const { data: productos = [] } = useProductos();
  const { data: ventas = [] } = useVentasDirectas();
  const { data: insumos = [] } = useInsumos();
  const { data: producciones = [] } = useProducciones();
  const { data: entregaItems = [] } = useEntregaItems();
  const { alertar } = useDialog();
  const hoy = hoyISO();

  // Las bolsas son insumos por unidad ('u').
  const bolsas = useMemo(() => insumos.filter((i) => i.unidadBase === 'u'), [insumos]);

  // Inventario de pan disponible (acumulado): producido − entregado − vendido.
  const inventario = useMemo(
    () => inventarioPorProducto(producciones, entregaItems, ventas),
    [producciones, entregaItems, ventas],
  );
  const disponible = (id: string) => Math.max(0, Math.floor(inventario.get(id) ?? 0));

  const registrar = useAccion(
    (repo, a: { productoId: string; cantidad: number; precioUnitario: number }) =>
      repo.ventasDirectas.registrar({
        fecha: hoy,
        productoId: a.productoId,
        cantidad: a.cantidad,
        precioUnitario: a.precioUnitario,
      }),
  );
  const ajustar = useAccion((repo, a: { id: string; cantidad: number }) =>
    repo.ventasDirectas.setCantidad(a.id, a.cantidad),
  );
  const descontarBolsa = useAccion((repo, a: { id: string; stockActual: number }) =>
    repo.insumos.update(a.id, { stockActual: a.stockActual }),
  );

  // Consumo manual de bolsas (p. ej. 14x20) en el mostrador.
  const [bolsaId, setBolsaId] = useState('');
  const [bolsaCant, setBolsaCant] = useState('');
  function usarBolsas() {
    const bolsa = bolsas.find((b) => b.id === bolsaId);
    const n = Number(bolsaCant);
    if (!bolsa || n <= 0) return;
    descontarBolsa.mutate({ id: bolsa.id, stockActual: bolsa.stockActual - n });
    setBolsaCant('');
  }

  // Ventas de hoy por producto.
  const hoyPorProducto = useMemo(() => {
    const m = new Map<string, { id: string; cantidad: number }>();
    for (const v of ventas) {
      if (v.fecha === hoy) m.set(v.productoId, { id: v.id, cantidad: v.cantidad });
    }
    return m;
  }, [ventas, hoy]);

  const totalHoy = useMemo(
    () =>
      productos.reduce((acc, p) => acc + (hoyPorProducto.get(p.id)?.cantidad ?? 0) * precioDe(p), 0),
    [productos, hoyPorProducto],
  );

  async function sumar(p: Producto, n: number) {
    const disp = inventario.get(p.id) ?? 0;
    if (n > disp) {
      await alertar(
        `No hay suficiente "${p.nombre}" para vender ${n}. Disponible: ${disponible(p.id)}.\nRegistra producción primero.`,
        { titulo: 'Sin pan disponible' },
      );
      return;
    }
    registrar.mutate({ productoId: p.id, cantidad: n, precioUnitario: precioDe(p) });
  }
  function restar(p: Producto) {
    const actual = hoyPorProducto.get(p.id);
    if (!actual || actual.cantidad <= 0) return;
    ajustar.mutate({ id: actual.id, cantidad: actual.cantidad - 1 });
  }

  // --- Registro masivo ("todo de una") ---
  const [abierto, setAbierto] = useState(false);
  const [cantidades, setCantidades] = useState<Record<string, string>>({});
  function abrirMasivo() {
    setCantidades({});
    setAbierto(true);
  }
  async function guardarMasivo() {
    const errores: string[] = [];
    const aRegistrar: { p: Producto; n: number }[] = [];
    for (const p of productos) {
      const n = Number(cantidades[p.id]);
      if (n <= 0) continue;
      if (n > (inventario.get(p.id) ?? 0)) {
        errores.push(`• ${p.nombre}: pides ${n}, hay ${disponible(p.id)}`);
      } else {
        aRegistrar.push({ p, n });
      }
    }
    if (errores.length > 0) {
      await alertar(
        `No hay suficiente inventario para:\n\n${errores.join('\n')}\n\nProduce primero o reduce las cantidades.`,
        { titulo: 'Sin pan disponible' },
      );
      return;
    }
    for (const { p, n } of aRegistrar) {
      registrar.mutate({ productoId: p.id, cantidad: n, precioUnitario: precioDe(p) });
    }
    setAbierto(false);
  }

  return (
    <>
      <EncabezadoPagina titulo="Mostrador" />

      {productos.length === 0 ? (
        <PantallaVacia
          icono="🛒"
          titulo="Sin productos"
          descripcion="Crea productos (con su precio en mostrador) para registrar ventas directas."
        />
      ) : (
        <>
          <div className="mb-3 rounded-2xl bg-amber-700 p-4 text-white shadow-sm">
            <p className="text-sm font-semibold text-amber-100">Vendido hoy en mostrador</p>
            <p className="text-3xl font-bold text-white">{formatDinero(totalHoy)}</p>
          </div>

          <div className="flex flex-col gap-3">
            {productos.map((p) => {
              const cantidad = hoyPorProducto.get(p.id)?.cantidad ?? 0;
              return (
                <Tarjeta key={p.id}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-amber-950">{p.nombre}</p>
                      <p className="text-sm text-amber-600">
                        {formatDinero(precioDe(p))} c/u · hoy: <span className="font-semibold">{cantidad}</span>
                      </p>
                      <p className="text-sm text-amber-700">
                        disponible: <span className="font-semibold">{disponible(p.id)}</span>
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => restar(p)}
                        className="h-10 w-10 rounded-full bg-amber-100 text-lg font-bold text-amber-800 active:scale-95"
                        aria-label="Quitar uno"
                      >
                        −
                      </button>
                      <button
                        onClick={() => sumar(p, 1)}
                        className="h-12 rounded-full bg-amber-600 px-5 text-lg font-bold text-white active:scale-95"
                      >
                        +1
                      </button>
                      <button
                        onClick={() => sumar(p, 5)}
                        className="h-12 rounded-full bg-amber-600/90 px-4 text-base font-bold text-white active:scale-95"
                      >
                        +5
                      </button>
                    </div>
                  </div>
                </Tarjeta>
              );
            })}
          </div>

          <div className="mt-4">
            <Boton variante="secundario" className="w-full" onClick={abrirMasivo}>
              🧾 Registrar varias de una vez
            </Boton>
          </div>

          {bolsas.length > 0 && (
            <Tarjeta className="mt-4">
              <p className="mb-2 font-semibold text-amber-950">Bolsas usadas</p>
              <div className="flex flex-col gap-2">
                <CampoSelector
                  etiqueta="Bolsa"
                  value={bolsaId}
                  onChange={(e) => setBolsaId(e.target.value)}
                  opciones={bolsas.map((b) => ({
                    valor: b.id,
                    texto: `${b.nombre} (quedan ${formatCantidad(b.stockActual, 'u')})`,
                  }))}
                  placeholder="Elige una bolsa"
                />
                <div className="flex items-end gap-2">
                  <Campo
                    etiqueta="Cantidad usada"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    value={bolsaCant}
                    onChange={(e) => setBolsaCant(e.target.value)}
                    placeholder="0"
                    className="flex-1"
                  />
                  <Boton onClick={usarBolsas} className="shrink-0">
                    Descontar
                  </Boton>
                </div>
              </div>
            </Tarjeta>
          )}
        </>
      )}

      <Sheet abierto={abierto} titulo="Registrar ventas del día" onClose={() => setAbierto(false)}>
        <p className="text-sm text-amber-600">
          Escribe cuántas vendiste de cada producto; se suman a lo de hoy.
        </p>
        {productos.map((p) => (
          <label key={p.id} className="flex items-center justify-between gap-3 text-sm font-medium text-amber-900">
            <span className="min-w-0 truncate">
              {p.nombre}{' '}
              <span className="text-amber-500">(disp. {disponible(p.id)})</span>
            </span>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              value={cantidades[p.id] ?? ''}
              onChange={(e) => setCantidades((c) => ({ ...c, [p.id]: e.target.value }))}
              placeholder="0"
              className="w-24 rounded-xl border border-amber-200 bg-white px-3 py-2 text-base outline-none focus:border-amber-500"
            />
          </label>
        ))}
        <Boton onClick={guardarMasivo}>Sumar al día</Boton>
      </Sheet>
    </>
  );
}
