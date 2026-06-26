terraform {
  required_version = ">= 1.5"
  required_providers {
    aws    = { source = "hashicorp/aws", version = "~> 5.0" }
    random = { source = "hashicorp/random", version = "~> 3.0" }
  }

  # backend "s3" {
  #   bucket         = "panaderia-tfstate"
  #   key            = "prod/terraform.tfstate"
  #   region         = "us-east-1"
  #   dynamodb_table = "panaderia-tflock"
  # }
}

provider "aws" {
  region = var.region
}

variable "region" {
  type    = string
  default = "us-east-1"
}

variable "imagen_backend" {
  type        = string
  default     = "public.ecr.aws/docker/library/busybox:latest"
  description = "Imagen inicial del backend; el pipeline la reemplaza tras el primer push a ECR."
}

module "stack" {
  source            = "../../modules/stack"
  environment       = "prod"
  region            = var.region
  imagen_backend    = var.imagen_backend
  db_instance_class = "db.t3.micro"
}

output "ecr_repository_url" { value = module.stack.ecr_repository_url }
output "api_url" { value = module.stack.api_url }
output "frontend_url" { value = module.stack.frontend_url }
output "frontend_bucket" { value = module.stack.frontend_bucket }
output "cloudfront_distribution_id" { value = module.stack.cloudfront_distribution_id }
output "ecs_cluster" { value = module.stack.ecs_cluster }
output "ecs_service" { value = module.stack.ecs_service }
