# RDS PostgreSQL (free tier) + credenciales en Secrets Manager.
terraform {
  required_providers {
    random = { source = "hashicorp/random" }
  }
}

variable "nombre" { type = string }
variable "vpc_id" { type = string }
variable "vpc_cidr" { type = string }
variable "subnet_ids" { type = list(string) }
variable "instance_class" {
  type    = string
  default = "db.t3.micro"
}
variable "db_name" {
  type    = string
  default = "panaderia"
}
variable "db_user" {
  type    = string
  default = "panaderia"
}
variable "tags" {
  type    = map(string)
  default = {}
}

resource "random_password" "db" {
  length  = 20
  special = false
}

resource "aws_db_subnet_group" "this" {
  name       = "${var.nombre}-db"
  subnet_ids = var.subnet_ids
  tags       = var.tags
}

# La BD no es pública; solo acepta conexiones desde dentro de la VPC.
resource "aws_security_group" "db" {
  name   = "${var.nombre}-db-sg"
  vpc_id = var.vpc_id
  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = var.tags
}

resource "aws_db_instance" "this" {
  identifier             = "${var.nombre}-db"
  engine                 = "postgres"
  engine_version         = "16"
  instance_class         = var.instance_class
  allocated_storage      = 20
  storage_type           = "gp2"
  db_name                = var.db_name
  username               = var.db_user
  password               = random_password.db.result
  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [aws_security_group.db.id]
  publicly_accessible    = false
  skip_final_snapshot    = true
  deletion_protection    = false
  tags                   = var.tags
}

# Credenciales en Secrets Manager: el backend recibe DATABASE_URL desde aquí.
resource "aws_secretsmanager_secret" "db" {
  name                    = "${var.nombre}-database-url"
  recovery_window_in_days = 0
  tags                    = var.tags
}

resource "aws_secretsmanager_secret_version" "db" {
  secret_id     = aws_secretsmanager_secret.db.id
  secret_string = "postgres://${var.db_user}:${random_password.db.result}@${aws_db_instance.this.address}:5432/${var.db_name}"
}

output "secret_arn" { value = aws_secretsmanager_secret.db.arn }
output "endpoint" { value = aws_db_instance.this.address }
