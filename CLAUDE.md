# CLAUDE.md — Convenciones del proyecto Panadería

Guía para trabajar en este repositorio. Derivada de `PLAN_DE_IMPLEMENTACION.md`.
Léela antes de tocar código.

## Qué es esto

App de gestión para una panadería: control de producción, insumos, costos,
ventas y distribución a tiendas. Existe en **dos versiones que comparten el mismo
código**, diferenciadas solo por el adaptador de almacenamiento:

- **Práctica (uso real, gratis, offline):** datos en el dispositivo. La usa a
  diario el papá del autor.
- **Showcase (portafolio, nube):** la misma app contra un backend en AWS.

La pieza clave es una **interfaz de almacenamiento intercambiable** (`Repository`):
el frontend se escribe una sola vez; solo cambia el adaptador (local vs API),
seleccionado por `VITE_STORAGE_MODE`.

## Principios no negociables

1. **UI extremadamente simple.** Usuario no técnico: botones grandes, poco texto
   que escribir, flujos de 2–3 toques.
2. **Offline-first** en la versión práctica.
3. **Una sola fuente de lógica.** Cálculos (costos, márgenes, conversión de
   unidades) viven en `packages/shared/src/calc`, nunca duplicados.
4. **Los datos importan.** Antes de permitir borrar, ofrecer respaldo (PDF + JSON).

## Regla de unidades (crítica)

Cada insumo tiene una **unidad base** (`Insumo.unidadBase`):

- `'g'` (**peso**): se almacena en gramos; libras/kg son solo presentación.
  En este negocio **1 libra = 500 g** (libra comercial colombiana, no la imperial);
  `GRAMOS_POR_LIBRA = 500` en `packages/shared/src/calc`. Fuente:
  `docs/datos-panaderia-insumos-unidades.md`.
- `'u'` (**conteo**): se almacena en unidades enteras (p. ej. huevos).

Todas las cantidades de un insumo (stock, compras, receta, consumo) usan **su**
unidad base. La **merma** (`mermaG`, en gramos) se distribuye solo entre los
insumos de peso; los de conteo no se ven afectados. Helpers de formato:
`formatCantidad`, `formatCantidadDetalle`, `formatLibras`.

## Stack

- **Lenguaje:** TypeScript en todo el proyecto.
- **Frontend:** React 19 + Vite, configurado como PWA. Tailwind CSS v4.
- **Estado:** React Query (datos) + hooks (estado local).
- **Local (web/MVP):** IndexedDB vía Dexie. **Local (nativo):** SQLite vía
  `@capacitor-community/sqlite`.
- **Nativo:** Capacitor (target Android / APK).
- **Backend (nube):** Node + Express + TypeScript. **BD:** PostgreSQL.
- **PDF:** `pdfmake` (en cliente, sin servidor).
- **Infra:** Docker + Docker Compose, Terraform, GitHub Actions.

## Estructura (monorepo pnpm)

```
packages/
  shared/    # tipos de dominio, cálculos, contrato Repository (sin dependencias de UI)
  frontend/  # React + Vite + PWA; adaptadores LocalRepository / ApiRepository
  backend/   # Express + TS (Fase 3)
  mobile/    # Capacitor (Fase 4)
infra/terraform/   # IaC (Fase 5)
.github/workflows/ # CI/CD (Fase 5)
docs/
```

- `@panaderia/shared` no importa nada de `frontend`/`backend`: es el núcleo puro.
- Los adaptadores de almacenamiento implementan la interfaz de
  `shared/src/storage` y viven en `frontend/src/storage`.

## Comandos

Desde la raíz:

| Comando | Qué hace |
|---|---|
| `pnpm install` | Instala dependencias de todos los paquetes |
| `pnpm dev` | Levanta el frontend (Vite) |
| `pnpm build` | Build de todos los paquetes |
| `pnpm typecheck` | Chequeo de tipos en todos los paquetes |
| `pnpm lint` | ESLint en todo el repo |
| `pnpm format` | Prettier --write |
| `pnpm test` | Pruebas de todos los paquetes |

Para un paquete puntual: `pnpm --filter @panaderia/frontend <script>`.

## Estilo de código

- ESLint (flat config en `eslint.config.js`) + Prettier (`.prettierrc.json`:
  comillas simples, `semi`, `trailingComma: all`, ancho 100).
- TS `strict` (ver `tsconfig.base.json`). Sin `any` salvo justificación.
- `verbatimModuleSyntax`: usa `import type` para tipos.
- Nombres de dominio y UI en **español** (insumos, recetas, entregas…), igual que
  el modelo de datos del plan.

## Modelo de datos (resumen)

Entidades: `insumos`, `compras_insumo`, `productos`, `recetas`, `producciones`,
`tiendas`, `entregas`, `entrega_items`. Esquema idéntico en concepto para el
adaptador local y para PostgreSQL.

**Valores derivados (se calculan, no se guardan crudos):** consumo de insumos
(receta × unidades, ajustado por merma), costo de producción (consumo × costo_por_g
vigente), ingresos (Σ entrega_items), margen (ingresos − costo). Todo en
`packages/shared/src/calc`.

## Flujo de trabajo por fases

Trabajamos **fase por fase** (ver sección 6 del plan) y **nos detenemos al final
de cada fase** para que Pardo revise antes de continuar.

- **Fase 0** — Andamiaje ✅
- **Fase 1** — Núcleo local ✅ (dominio, cálculos con pruebas, `LocalRepository`
  Dexie, pantallas CRUD, dashboard, PWA instalable)
- **Fase 2** — Reportes PDF + backup/restore JSON + "cerrar el mes" ✅
  (+ unidad de medida por insumo: peso `'g'` / conteo `'u'`)
- **Fase 3** — Backend Express + PostgreSQL + `ApiRepository` + docker-compose ✅
  (verificado end-to-end con `docker compose up`)
- **Fase 4** — Capacitor/APK + SQLite nativo + Filesystem/Share ✅
  (código y config completos; el autor compila el APK, ver `packages/mobile/README.md`)
- **Fase 5** — Terraform + GitHub Actions ✅ **redactados** (`infra/terraform/`,
  `.github/workflows/`); los **aplica** Pardo (sección 7 del plan). El agente no
  ejecuta `terraform apply` ni maneja credenciales de AWS.

## Límites del agente

- **No** ejecutar `terraform apply`, `aws configure`, ni manejar credenciales de
  AWS. La Fase 5 se redacta pero la aplica Pardo.
- **No** subir llaves/secretos al repositorio.
- Antes de cualquier flujo que borre datos, exigir respaldo previo.
