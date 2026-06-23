# infra/terraform

Infraestructura como código (IaC) para la versión nube (showcase de portafolio).
**Se redacta en la Fase 5; el autor (Pardo) la aplica manualmente** — Claude Code
no ejecuta `terraform apply` ni maneja credenciales de AWS.

Estructura prevista:

```
modules/                # módulos reutilizables (vpc, ecr, ecs, rds, s3+cloudfront, iam)
environments/
  dev/                  # entorno de desarrollo
  prod/                 # entorno de producción
```

Recursos previstos: VPC con subred pública, ECR, ECS Fargate (subred pública para
evitar el costo de NAT Gateway), RDS PostgreSQL (free tier), S3 + CloudFront para el
frontend, roles IAM mínimos y Secrets Manager/SSM para credenciales de BD.
