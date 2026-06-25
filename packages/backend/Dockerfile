# Backend Express + tsx. Contexto de build = raíz del monorepo.
FROM node:22-alpine
RUN corepack enable
WORKDIR /app

# Manifiestos primero (para cache de capas). Se copian todos los package.json
# de los workspaces para que el lockfile valide con --frozen-lockfile.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/frontend/package.json ./packages/frontend/
COPY packages/backend/package.json ./packages/backend/
RUN pnpm install --filter @panaderia/backend... --frozen-lockfile

# Código fuente (shared + backend; el backend corre con tsx, sin build)
COPY packages/shared ./packages/shared
COPY packages/backend ./packages/backend

WORKDIR /app/packages/backend
EXPOSE 3001
CMD ["pnpm", "start"]
