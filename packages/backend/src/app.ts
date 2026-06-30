import cors from 'cors';
import express, {
  type NextFunction,
  type Request,
  type Response,
  type Router,
} from 'express';
import type { CrudRepo, ID, Repository } from '@panaderia/shared';
import { PgRepository } from './PgRepository.js';

// Envuelve un handler async para enrutar errores al middleware de error.
type Handler = (req: Request, res: Response) => Promise<unknown>;
const ah =
  (fn: Handler) =>
  (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res).catch(next);
  };

/** Monta las rutas CRUD estándar de un recurso. */
function montarCrud<T extends { id: ID }, N>(
  router: Router,
  base: string,
  repo: CrudRepo<T, N>,
): void {
  router.get(
    base,
    ah(async (_req, res) => res.json(await repo.list())),
  );
  router.get(
    `${base}/:id`,
    ah(async (req, res) => {
      const r = await repo.get(req.params.id);
      return r ? res.json(r) : res.status(404).json({ error: 'No encontrado' });
    }),
  );
  router.post(
    base,
    ah(async (req, res) => res.status(201).json(await repo.create(req.body as N))),
  );
  router.patch(
    `${base}/:id`,
    ah(async (req, res) => res.json(await repo.update(req.params.id, req.body as Partial<N>))),
  );
  router.delete(
    `${base}/:id`,
    ah(async (req, res) => {
      await repo.delete(req.params.id);
      return res.status(204).end();
    }),
  );
}

export function crearApp(repo: Repository = new PgRepository()): express.Express {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '15mb' }));

  const api = express.Router();

  api.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  montarCrud(api, '/insumos', repo.insumos);
  montarCrud(api, '/compras', repo.compras);
  montarCrud(api, '/productos', repo.productos);
  montarCrud(api, '/tiendas', repo.tiendas);
  montarCrud(api, '/producciones', repo.producciones);

  // Recetas (por producto)
  api.get(
    '/recetas',
    ah(async (_req, res) => res.json(await repo.recetas.list())),
  );
  api.get(
    '/productos/:id/receta',
    ah(async (req, res) => res.json(await repo.recetas.getByProducto(req.params.id))),
  );
  api.put(
    '/productos/:id/receta',
    ah(async (req, res) => res.json(await repo.recetas.setByProducto(req.params.id, req.body))),
  );

  // Entregas (encabezado + items). 'items' antes de ':id' por el orden de match.
  api.get(
    '/entregas',
    ah(async (_req, res) => res.json(await repo.entregas.list())),
  );
  api.get(
    '/entregas/items',
    ah(async (_req, res) => res.json(await repo.entregas.listItems())),
  );
  api.get(
    '/entregas/:id',
    ah(async (req, res) => {
      const r = await repo.entregas.get(req.params.id);
      return r ? res.json(r) : res.status(404).json({ error: 'No encontrada' });
    }),
  );
  api.post(
    '/entregas',
    ah(async (req, res) => {
      const { data, items } = req.body;
      return res.status(201).json(await repo.entregas.create(data, items));
    }),
  );
  api.put(
    '/entregas/:id',
    ah(async (req, res) => {
      const { data, items } = req.body;
      return res.json(await repo.entregas.update(req.params.id, data, items));
    }),
  );
  api.delete(
    '/entregas/:id',
    ah(async (req, res) => {
      await repo.entregas.delete(req.params.id);
      return res.status(204).end();
    }),
  );

  // Ventas directas (mostrador): acumulado por día y producto.
  api.get(
    '/ventas-directas',
    ah(async (_req, res) => res.json(await repo.ventasDirectas.list())),
  );
  api.post(
    '/ventas-directas',
    ah(async (req, res) => res.status(201).json(await repo.ventasDirectas.registrar(req.body))),
  );
  api.patch(
    '/ventas-directas/:id',
    ah(async (req, res) =>
      res.json(await repo.ventasDirectas.setCantidad(req.params.id, req.body.cantidad)),
    ),
  );
  api.delete(
    '/ventas-directas/:id',
    ah(async (req, res) => {
      await repo.ventasDirectas.delete(req.params.id);
      return res.status(204).end();
    }),
  );

  // Mantenimiento de datos
  api.get(
    '/backup',
    ah(async (_req, res) => res.json(await repo.exportarBackup())),
  );
  api.post(
    '/backup',
    ah(async (req, res) => {
      await repo.importarBackup(req.body);
      return res.status(204).end();
    }),
  );
  api.post(
    '/mantenimiento/borrar',
    ah(async (req, res) => {
      await repo.borrarRegistros(req.body);
      return res.status(204).end();
    }),
  );

  app.use('/api', api);

  // Middleware de error
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error interno' });
  });

  return app;
}
