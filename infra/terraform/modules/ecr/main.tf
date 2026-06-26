# Registro de contenedores para la imagen del backend.
variable "nombre" { type = string }
variable "tags" {
  type    = map(string)
  default = {}
}

resource "aws_ecr_repository" "this" {
  name                 = "${var.nombre}-backend"
  image_tag_mutability = "MUTABLE"
  force_delete         = true
  image_scanning_configuration {
    scan_on_push = true
  }
  tags = var.tags
}

resource "aws_ecr_lifecycle_policy" "this" {
  repository = aws_ecr_repository.this.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Conservar solo las ultimas 10 imagenes"
      selection    = { tagStatus = "any", countType = "imageCountMoreThan", countNumber = 10 }
      action       = { type = "expire" }
    }]
  })
}

output "repository_url" { value = aws_ecr_repository.this.repository_url }
output "repository_name" { value = aws_ecr_repository.this.name }
