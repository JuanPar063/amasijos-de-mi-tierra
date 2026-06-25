// Generación de reportes PDF en el cliente (sin servidor) con pdfmake.
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import {
  formatCantidad,
  type Insumo,
  type Producto,
  type ResumenPeriodo,
} from '@panaderia/shared';
import { formatDinero, formatFecha } from './format';

// El módulo de fuentes expone el vfs de formas distintas según la versión.
const fuentes = pdfFonts as {
  vfs?: Record<string, string>;
  pdfMake?: { vfs: Record<string, string> };
};
const vfs = fuentes.vfs ?? fuentes.pdfMake?.vfs;
(pdfMake as unknown as { vfs?: Record<string, string> }).vfs = vfs;

export interface VentaProducto {
  productoId: string;
  cantidad: number;
  ingresos: number;
}

export interface DatosReporte {
  desde: string;
  hasta: string;
  resumen: ResumenPeriodo;
  productos: Producto[];
  insumos: Insumo[];
  ventasPorProducto: VentaProducto[];
}

const COLOR = '#b45309';
const th = (texto: string, derecha = false): TableCell => ({
  text: texto,
  style: 'th',
  alignment: derecha ? 'right' : 'left',
});
const seccion = (titulo: string): Content => ({
  text: titulo,
  style: 'seccion',
  margin: [0, 14, 0, 6],
});
const vacia = (cols: number): TableCell[] => {
  const fila: TableCell[] = [{ text: 'Sin datos en el periodo.', italics: true, colSpan: cols, color: '#999' }];
  for (let i = 1; i < cols; i++) fila.push({});
  return fila;
};

export function construirReportePeriodo(d: DatosReporte): TDocumentDefinitions {
  const nombreProducto = new Map(d.productos.map((p) => [p.id, p.nombre]));
  const insumoPorId = new Map(d.insumos.map((i) => [i.id, i]));
  const r = d.resumen;

  const bodyProduccion: TableCell[][] = [
    [th('Producto'), th('Unidades', true)],
    ...(r.produccionPorProducto.length > 0
      ? r.produccionPorProducto.map((pp): TableCell[] => [
          nombreProducto.get(pp.productoId) ?? 'Producto',
          { text: String(pp.unidades), alignment: 'right' },
        ])
      : [vacia(2)]),
    [
      { text: 'Total', bold: true },
      { text: String(r.unidadesProducidas), bold: true, alignment: 'right' },
    ],
  ];

  const bodyConsumo: TableCell[][] = [
    [th('Insumo'), th('Cantidad', true)],
    ...(r.consumoPorInsumo.length > 0
      ? r.consumoPorInsumo.map((c): TableCell[] => {
          const ins = insumoPorId.get(c.insumoId);
          return [
            ins?.nombre ?? 'Insumo',
            { text: formatCantidad(c.cantidad, ins?.unidadBase ?? 'g'), alignment: 'right' },
          ];
        })
      : [vacia(2)]),
  ];

  const bodyVentas: TableCell[][] = [
    [th('Producto'), th('Cantidad', true), th('Ingresos', true)],
    ...(d.ventasPorProducto.length > 0
      ? d.ventasPorProducto.map((v): TableCell[] => [
          nombreProducto.get(v.productoId) ?? 'Producto',
          { text: String(v.cantidad), alignment: 'right' },
          { text: formatDinero(v.ingresos), alignment: 'right' },
        ])
      : [vacia(3)]),
  ];

  const bodyCostos: TableCell[][] = [
    ['Ingresos', { text: formatDinero(r.ingresos), alignment: 'right' }],
    ['Costo de producción', { text: formatDinero(r.costoProduccion), alignment: 'right' }],
    [
      { text: 'Margen', style: 'total' },
      { text: formatDinero(r.margen), style: 'total', alignment: 'right' },
    ],
  ];

  return {
    pageSize: 'A4',
    pageMargins: [40, 50, 40, 40],
    defaultStyle: { fontSize: 10, color: '#333' },
    styles: {
      titulo: { fontSize: 18, bold: true, color: COLOR },
      seccion: { fontSize: 13, bold: true, color: COLOR },
      th: { bold: true, color: '#ffffff', fillColor: COLOR },
      total: { bold: true, fontSize: 12 },
    },
    content: [
      { text: 'Panadería — Reporte del periodo', style: 'titulo' },
      { text: `Del ${formatFecha(d.desde)} al ${formatFecha(d.hasta)}`, margin: [0, 2, 0, 0], color: '#666' },

      seccion('Producción'),
      { table: { headerRows: 1, widths: ['*', 'auto'], body: bodyProduccion }, layout: 'lightHorizontalLines' },

      seccion('Insumos consumidos'),
      { table: { headerRows: 1, widths: ['*', 'auto'], body: bodyConsumo }, layout: 'lightHorizontalLines' },

      seccion('Ventas / Entregas'),
      { table: { headerRows: 1, widths: ['*', 'auto', 'auto'], body: bodyVentas }, layout: 'lightHorizontalLines' },
      { text: `Entregas realizadas: ${r.numEntregas}`, margin: [0, 6, 0, 0], color: '#666' },

      seccion('Costos y margen'),
      { table: { widths: ['*', 'auto'], body: bodyCostos }, layout: 'noBorders' },
    ],
    footer: (pagina: number, total: number): Content => ({
      text: `página ${pagina} de ${total}`,
      alignment: 'center',
      fontSize: 8,
      color: '#999',
      margin: [0, 10, 0, 0],
    }),
  };
}

/**
 * Genera el PDF y lo entrega: en web lo descarga; en el APK (nativo) lo guarda
 * en el dispositivo y abre el diálogo para compartirlo.
 */
export async function descargarPDF(doc: TDocumentDefinitions, nombreArchivo: string): Promise<void> {
  const pdf = pdfMake.createPdf(doc);
  const { Capacitor } = await import('@capacitor/core');
  if (!Capacitor.isNativePlatform()) {
    pdf.download(nombreArchivo);
    return;
  }
  const base64 = await new Promise<string>((res) => pdf.getBase64((d) => res(d)));
  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  const { Share } = await import('@capacitor/share');
  const escrito = await Filesystem.writeFile({
    path: nombreArchivo,
    data: base64,
    directory: Directory.Cache,
  });
  await Share.share({ title: nombreArchivo, url: escrito.uri });
}
