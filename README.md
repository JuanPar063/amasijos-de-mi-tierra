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

Fases 0, 1 y 2 completas (núcleo local offline/instalable + reportes PDF, respaldo
JSON y cierre de mes; insumos por peso o por unidades). Próximo: Fase 3 — backend
Express + PostgreSQL + adaptador de API. Ver el desglose en [`CLAUDE.md`](CLAUDE.md).
