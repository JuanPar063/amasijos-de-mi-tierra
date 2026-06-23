// El paquete de fuentes de pdfmake no trae tipos; declaramos su forma mínima.
declare module 'pdfmake/build/vfs_fonts' {
  const content: {
    vfs?: Record<string, string>;
    pdfMake?: { vfs: Record<string, string> };
  };
  export default content;
}
