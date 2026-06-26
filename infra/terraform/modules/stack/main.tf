# Composición completa de la versión nube. Cada entorno (dev/prod) la instancia
# con sus variables.
variable "environment" { type = string }
variable "region" { type = string }
# Imagen del backend. Antes del primer push a ECR se usa un placeholder para que
# `terraform apply` no falle; luego el pipeline despliega la imagen real.
variable "imagen_backend" {
  type    = string
  default = "public.ecr.aws/docker/library/busybox:latest"
}
variable "db_instance_class" {
  type    = string
  default = "db.t3.micro"
}

locals {
  nombre = "panaderia-${var.environment}"
  tags   = { Proyecto = "panaderia", Entorno = var.environment }
}

module "network" {
  source = "../network"
  nombre = local.nombre
  tags   = local.tags
}

module "ecr" {
  source = "../ecr"
  nombre = local.nombre
  tags   = local.tags
}

module "database" {
  source         = "../database"
  nombre         = local.nombre
  vpc_id         = module.network.vpc_id
  vpc_cidr       = module.network.vpc_cidr
  subnet_ids     = module.network.subnet_ids
  instance_class = var.db_instance_class
  tags           = local.tags
}

module "backend" {
  source        = "../backend"
  nombre        = local.nombre
  vpc_id        = module.network.vpc_id
  subnet_ids    = module.network.subnet_ids
  image         = var.imagen_backend
  db_secret_arn = module.database.secret_arn
  region        = var.region
  tags          = local.tags
}

module "frontend" {
  source            = "../frontend"
  nombre            = local.nombre
  api_origin_domain = module.backend.alb_domain
  tags              = local.tags
}

output "ecr_repository_url" { value = module.ecr.repository_url }
output "api_url" { value = module.backend.api_url }
output "frontend_url" { value = module.frontend.url }
output "frontend_bucket" { value = module.frontend.bucket_name }
output "cloudfront_distribution_id" { value = module.frontend.distribution_id }
output "ecs_cluster" { value = module.backend.cluster_name }
output "ecs_service" { value = module.backend.service_name }
