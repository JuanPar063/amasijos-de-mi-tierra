# @panaderia/backend

Backend Express + TypeScript (versión nube). Expone el mismo contrato
`Repository` sobre una API REST, respaldado por **PostgreSQL**.

- `src/PgRepository.ts` — implementa `Repository` contra Postgres (reutiliza los
  cálculos de `@panaderia/shared`, igual que el adaptador local).
- `src/app.ts` — rutas REST (`/api/...`) que exponen el repositorio.
- `src/db.ts` — pool de conexión + creación idempotente del esquema.
- `sql/schema.sql` — esquema de la base de datos.

Se ejecuta con **tsx** (sin paso de build). Variables: `DATABASE_URL`, `PORT`.

## Correr localmente

Lo más fácil es con docker-compose desde la raíz del repo:

```bash
docker compose up --build
```

- Frontend (modo API): http://localhost:8080
- API: http://localhost:3001/api/health
- PostgreSQL: localhost:5432 (panaderia/panaderia)

Para correr solo el backend contra un Postgres propio:

```bash
cp packages/backend/.env.example packages/backend/.env   # ajusta DATABASE_URL
pnpm --filter @panaderia/backend dev
```

## API (resumen)

CRUD bajo `/api`: `insumos`, `compras`, `productos`, `tiendas`, `producciones`.
Recetas: `GET/PUT /api/productos/:id/receta`. Entregas: `/api/entregas`
(+ `/items`). Mantenimiento: `GET/POST /api/backup`, `POST /api/mantenimiento/borrar`.
