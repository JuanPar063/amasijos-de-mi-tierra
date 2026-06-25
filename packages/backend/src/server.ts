import { crearApp } from './app.js';
import { inicializarEsquema } from './db.js';

const PORT = Number(process.env.PORT ?? 3001);

async function main(): Promise<void> {
  await inicializarEsquema();
  const app = crearApp();
  app.listen(PORT, () => {
    console.log(`Backend de panadería escuchando en http://localhost:${PORT}`);
  });
}

main().catch((e) => {
  console.error('No se pudo iniciar el backend:', e);
  process.exit(1);
});
