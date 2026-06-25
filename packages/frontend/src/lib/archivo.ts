// Descarga y lectura de archivos en el navegador (respaldo JSON).

export async function descargarJSON(data: unknown, nombreArchivo: string): Promise<void> {
  const contenido = JSON.stringify(data, null, 2);
  const { Capacitor } = await import('@capacitor/core');
  if (Capacitor.isNativePlatform()) {
    // APK: guardar en el dispositivo y compartir.
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    const escrito = await Filesystem.writeFile({
      path: nombreArchivo,
      data: contenido,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    await Share.share({ title: nombreArchivo, url: escrito.uri });
    return;
  }
  const blob = new Blob([contenido], { type: 'application/json' });
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
