# Panadería 🍞

App de gestión para una panadería: producción, insumos, costos, ventas y
distribución a tiendas. Misma base de código en dos versiones:

- **Práctica** — corre en el celular, datos locales, offline, gratis.
- **Showcase** — misma app contra un backend en AWS (portafolio).

El plan completo está en [`PLAN_DE_IMPLEMENTACION.md`](PLAN_DE_IMPLEMENTACION.md);
las convenciones para desarrollar, en [`CLAUDE.md`](CLAUDE.md).

## Requisitos

- Node.js >= 20 (probado con 22)
- pnpm >= 9 (`npm install -g pnpm`)

## Arranque rápido

```bash
pnpm install
pnpm dev
```

Abre la URL que imprime Vite (por defecto http://localhost:5173). Con
`server.host` activado también es accesible desde el celular en la misma red Wi-Fi.

## Estructura

Monorepo con workspaces de pnpm:

```
packages/
  shared/    # tipos de dominio, cálculos, contrato de almacenamiento (Repository)
  frontend/  # React + Vite + PWA
  backend/   # Express + TS (Fase 3)
  mobile/    # Capacitor / APK (Fase 4)
infra/terraform/   # IaC (Fase 5)
.github/workflows/ # CI/CD (Fase 5)
docs/
```

## Scripts (desde la raíz)

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Levanta el frontend |
| `pnpm build` | Build de todos los paquetes |
| `pnpm typecheck` | Chequeo de tipos |
| `pnpm lint` | ESLint |
| `pnpm format` | Prettier |
| `pnpm test` | Pruebas |

## Estado

Fases 0–4 completas. Núcleo local offline/instalable (PWA) + reportes PDF, respaldo
JSON y cierre de mes; insumos por peso o por unidades. Versión nube (Fase 3: backend
Express + PostgreSQL + `docker compose`, verificada end-to-end). APK Android (Fase 4:
Capacitor + SQLite nativo + Filesystem/Share; el autor compila el APK, ver
[`packages/mobile/README.md`](packages/mobile/README.md)). Fase 5 (IaC + CI/CD)
**redactada** ([`infra/terraform/`](infra/terraform/) + [`.github/workflows/`](.github/workflows/));
la **aplica** el autor (ver [`infra/terraform/README.md`](infra/terraform/README.md)).
Ver el desglose en [`CLAUDE.md`](CLAUDE.md).

## Versión nube (Fase 3)

```bash
docker compose up --build
```

Frontend (modo API) en http://localhost:8080, API en http://localhost:3001/api,
PostgreSQL en localhost:5432. La misma UI corre con `VITE_STORAGE_MODE=api`.
