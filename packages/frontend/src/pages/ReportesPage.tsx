import { useRef, useState } from 'react';
import {
  resumenPeriodo,
  type BackupJSON,
  type Entrega,
  type EntregaItem,
} from '@panaderia/shared';
import { Boton, Campo, EncabezadoPagina, Tarjeta } from '../components/ui';
import {
  useAccion,
  useCompras,
  useEntregaItems,
  useEntregas,
  useInsumos,
  useProducciones,
  useProductos,
  useRecetas,
} from '../data/hooks';
import { useRepository } from '../storage/repo-context';
import { descargarJSON, leerArchivoJSON, selloFecha } from '../lib/archivo';
import type { VentaProducto } from '../lib/pdf';
import { formatFecha, hoyISO, inicioDeMesISO } from '../lib/format';

function ventasPorProducto(
  entregas: Entrega[],
  items: EntregaItem[],
  desde: string,
  hasta: string,
): VentaProducto[] {
  const ids = new Set(entregas.filter((e) => e.fecha >= desde && e.fecha <= hasta).map((e) => e.id));
  const acc = new Map<string, { cantidad: number; ingresos: number }>();
  for (const it of items) {
    if (!ids.has(it.entregaId)) continue;
    const prev = acc.get(it.productoId) ?? { cantidad: 0, ingresos: 0 };
    prev.cantidad += it.cantidad;
    prev.ingresos += it.cantidad * it.precioUnitario;
    acc.set(it.productoId, prev);
  }
  return [...acc].map(([productoId, v]) => ({ productoId, ...v }));
}

export function ReportesPage() {
  const repo = useRepository();
  const { data: insumos = [] } = useInsumos();
  const { data: productos = [] } = useProductos();
  const { data: producciones = [] } = useProducciones();
  const { data: recetas = [] } = useRecetas();
  const { data: compras = [] } = useCompras();
  const { data: entregas = [] } = useEntregas();
  const { data: entregaItems = [] } = useEntregaItems();

  const importar = useAccion((r, data: BackupJSON) => r.importarBackup(data));
  const cerrar = useAccion((r, hasta: string) => r.borrarRegistros({ hasta }));

  const [desde, setDesde] = useState(inicioDeMesISO());
  const [hasta, setHasta] = useState(hoyISO());
  const [mensaje, setMensaje] = useState('');
  const inputArchivo = useRef<HTMLInputElement>(null);

  // pdfmake se carga de forma diferida: el shell inicial no lo descarga.
  async function generarReporte(d: string, h: string) {
    const { construirReportePeriodo, descargarPDF } = await import('../lib/pdf');
    const resumen = resumenPeriodo({
      desde: d,
      hasta: h,
      producciones,
      recetas,
      compras,
      entregas,
      entregaItems,
      insumos,
    });
    const doc = construirReportePeriodo({
      desde: d,
      hasta: h,
      resumen,
      productos,
      insumos,
      ventasPorProducto: ventasPorProducto(entregas, entregaItems, d, h),
    });
    descargarPDF(doc, `reporte-${d}_${h}.pdf`);
  }

  async function descargarRespaldo() {
    const backup = await repo.exportarBackup();
    descargarJSON(backup, `respaldo-panaderia-${selloFecha()}.json`);
    setMensaje('Respaldo descargado.');
  }

  function elegirArchivo() {
    inputArchivo.current?.click();
  }
  async function alSeleccionarArchivo(file: File) {
    if (
      !window.confirm(
        'Restaurar un respaldo REEMPLAZA todos los datos actuales. ¿Continuar?',
      )
    )
      return;
    try {
      const data = await leerArchivoJSON<BackupJSON>(file);
      await importar.mutateAsync(data);
      setMensaje('Respaldo restaurado.');
    } catch {
      setMensaje('No se pudo leer el archivo de respaldo.');
    }
  }

  async function cerrarMes() {
    // Principio: respaldo antes de borrar. Descargamos JSON + PDF y luego borramos.
    if (
      !window.confirm(
        `Se descargará un respaldo (JSON) y el reporte (PDF) del periodo, y luego se borrarán las compras, producciones y entregas hasta el ${formatFecha(
          hasta,
        )}. Los catálogos y el stock se conservan. ¿Continuar?`,
      )
    )
      return;
    const backup = await repo.exportarBackup();
    descargarJSON(backup, `respaldo-cierre-${selloFecha()}.json`);
    await generarReporte(desde, hasta);
    await cerrar.mutateAsync(hasta);
    setMensaje(`Periodo cerrado hasta ${formatFecha(hasta)}. Respaldo y reporte descargados.`);
  }

  return (
    <>
      <EncabezadoPagina titulo="Reportes y respaldo" />

      <div className="flex flex-col gap-4">
        <Tarjeta>
          <p className="mb-3 font-semibold text-amber-950">Reporte PDF por periodo</p>
          <div className="flex gap-2">
            <Campo etiqueta="Desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="flex-1" />
            <Campo etiqueta="Hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="flex-1" />
          </div>
          <Boton className="mt-3 w-full" onClick={() => void generarReporte(desde, hasta)}>
            📄 Descargar reporte PDF
          </Boton>
        </Tarjeta>

        <Tarjeta>
          <p className="mb-1 font-semibold text-amber-950">Respaldo de datos</p>
          <p className="mb-3 text-sm text-amber-600">
            Guarda o restaura todos tus datos en un archivo JSON.
          </p>
          <div className="flex flex-col gap-2">
            <Boton variante="secundario" onClick={descargarRespaldo}>
              ⬇️ Descargar respaldo (JSON)
            </Boton>
            <Boton variante="secundario" onClick={elegirArchivo}>
              ⬆️ Restaurar respaldo
            </Boton>
            <input
              ref={inputArchivo}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void alSeleccionarArchivo(file);
                e.target.value = '';
              }}
            />
          </div>
        </Tarjeta>

        <Tarjeta>
          <p className="mb-1 font-semibold text-amber-950">Cerrar el mes</p>
          <p className="mb-3 text-sm text-amber-600">
            Descarga respaldo + reporte y borra las transacciones hasta la fecha
            elegida, conservando catálogos y stock.
          </p>
          <Campo etiqueta="Borrar hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          <Boton variante="peligro" className="mt-3 w-full" onClick={cerrarMes}>
            🔒 Cerrar periodo hasta {formatFecha(hasta)}
          </Boton>
        </Tarjeta>

        {mensaje && (
          <p className="rounded-xl bg-amber-100 px-4 py-3 text-sm font-medium text-amber-800">
            {mensaje}
          </p>
        )}
      </div>
    </>
  );
}
