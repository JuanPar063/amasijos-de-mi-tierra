# Frontend: build estático con Vite (modo API) y servido por nginx.
# Contexto de build = raíz del monorepo.
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/frontend/package.json ./packages/frontend/
COPY packages/backend/package.json ./packages/backend/
RUN pnpm install --filter @panaderia/frontend... --frozen-lockfile

COPY packages/shared ./packages/shared
COPY packages/frontend ./packages/frontend

WORKDIR /app/packages/frontend
ENV VITE_STORAGE_MODE=api
RUN pnpm build

FROM nginx:alpine
COPY packages/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/packages/frontend/dist /usr/share/nginx/html
EXPOSE 80
