// Descarga y lectura de archivos en el navegador (respaldo JSON).

export function descargarJSON(data: unknown, nombreArchivo: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  a.click();
  URL.revokeObjectURL(url);
}

export async function leerArchivoJSON<T>(file: File): Promise<T> {
  const texto = await file.text();
  return JSON.parse(texto) as T;
}

/** Sello de fecha 'YYYYMMDD' para nombrar archivos. */
export function selloFecha(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}
