# infra/terraform

Infraestructura como código (IaC) de la versión nube. **La redacta el agente; la
revisa y aplica el autor (Pardo)** — Claude Code no ejecuta `terraform apply` ni
maneja credenciales de AWS.

## Qué crea

```
modules/
  network/    VPC + 2 subredes públicas + Internet Gateway (sin NAT, para no pagarlo)
  ecr/        repositorio de imágenes del backend
  database/   RDS PostgreSQL (free tier) + credenciales en Secrets Manager
  backend/    ALB público -> ECS Fargate (subred pública) + IAM mínimo + logs
  frontend/   S3 (privado) + CloudFront (OAC) para el sitio estático
  stack/      compone todo lo anterior
environments/
  dev/        entorno de desarrollo
  prod/       entorno de producción
```

Arquitectura: **CloudFront + S3** sirve el frontend; el backend corre en **ECS
Fargate** detrás de un **ALB**; la base de datos es **RDS PostgreSQL**, con la
`DATABASE_URL` guardada en **Secrets Manager** e inyectada al contenedor. Todo en
subredes públicas para evitar el costo del NAT Gateway.

## Aplicar (lo hace Pardo)

Requisitos: cuenta AWS + Free Tier, usuario IAM (no root), AWS CLI configurado
(`aws configure`), Terraform y Docker. **Nunca subas llaves al repo.**

```bash
cd infra/terraform/environments/dev
cp terraform.tfvars.example terraform.tfvars   # ajusta la región si quieres
terraform init
terraform plan        # léelo con calma
terraform apply       # crea la infraestructura (~10-15 min, sobre todo RDS)
```

Salidas útiles tras el apply (`terraform output`):

- `ecr_repository_url` — repositorio para la imagen del backend.
- `api_url` — URL del backend (DNS del ALB).
- `frontend_url` — URL pública del sitio (CloudFront).
- `frontend_bucket`, `cloudfront_distribution_id`, `ecs_cluster`, `ecs_service`
  — los usan los pipelines de CI/CD.

> El backend arranca con una imagen *placeholder* (`busybox`) hasta el primer
> despliegue del pipeline; es normal que el servicio esté "unhealthy" hasta
> entonces. Tras configurar CI/CD y hacer push, ECS corre la imagen real.

## Variables/secretos del pipeline (GitHub → Settings)

Tras el `apply`, configura en *Settings → Secrets and variables → Actions*:

| Tipo | Nombre | Valor |
|---|---|---|
| Secret | `AWS_ACCESS_KEY_ID` | llave del usuario IAM (o usa OIDC, ver abajo) |
| Secret | `AWS_SECRET_ACCESS_KEY` | llave del usuario IAM |
| Variable | `AWS_REGION` | p. ej. `us-east-1` |
| Variable | `ECR_REPOSITORY` | salida `ecr_repository_url` |
| Variable | `ECS_CLUSTER` | salida `ecs_cluster` |
| Variable | `ECS_SERVICE` | salida `ecs_service` |
| Variable | `FRONTEND_BUCKET` | salida `frontend_bucket` |
| Variable | `CLOUDFRONT_DISTRIBUTION_ID` | salida `cloudfront_distribution_id` |

> El frontend no necesita una URL de API: **CloudFront enruta `/api/*` al backend**
> (ALB), así que la app usa `/api` relativo (mismo origen, sin CORS).

> **Recomendado:** en vez de llaves de larga duración, configura **OIDC** entre
> GitHub y AWS (rol asumible) y reemplaza el paso de credenciales en los workflows.

## Costos y limpieza

- **NAT Gateway:** evitado por diseño (Fargate en subred pública).
- **RDS:** gratis 12 meses (free tier, db.t3.micro).
- **Fargate / ALB / CloudFront:** cobran por uso/tiempo.
- Al terminar el showcase: **`terraform destroy`** para no generar cobros.

## Estado remoto (opcional)

Para empezar, estado local. Cuando quieras hacerlo bien: crea un bucket S3 para el
`tfstate` y una tabla DynamoDB para el lock, y descomenta el bloque `backend "s3"`
en `environments/<env>/main.tf`.
