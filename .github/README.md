# .github

Configuración de GitHub del proyecto.

## Workflows de CI/CD (Fase 5)

- [`workflows/backend.yml`](workflows/backend.yml) — test → build de imagen Docker
  → push a ECR → registra nueva task definition y actualiza el servicio de ECS.
- [`workflows/frontend.yml`](workflows/frontend.yml) — build del frontend (modo API)
  → sync a S3 → invalidación de CloudFront.

Se disparan al hacer push a `main` (según los archivos que cambian) o manualmente.
Requieren los secretos/variables configurados en *Settings → Secrets and variables
→ Actions* (ver [`infra/terraform/README.md`](../infra/terraform/README.md)).

> Para subir/editar estos workflows, el token o credencial de GitHub debe incluir
> el scope **`workflow`** (un PAT solo con `repo` no puede modificarlos).
