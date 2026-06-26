# Backend: ALB público -> ECS Fargate (en subred pública, sin NAT).
variable "nombre" { type = string }
variable "vpc_id" { type = string }
variable "subnet_ids" { type = list(string) }
variable "image" { type = string }
variable "db_secret_arn" { type = string }
variable "region" { type = string }
variable "puerto" {
  type    = number
  default = 3001
}
variable "cpu" {
  type    = string
  default = "256"
}
variable "memory" {
  type    = string
  default = "512"
}
variable "tags" {
  type    = map(string)
  default = {}
}

# --- Seguridad ---
resource "aws_security_group" "alb" {
  name   = "${var.nombre}-alb-sg"
  vpc_id = var.vpc_id
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = var.tags
}

resource "aws_security_group" "tarea" {
  name   = "${var.nombre}-task-sg"
  vpc_id = var.vpc_id
  ingress {
    from_port       = var.puerto
    to_port         = var.puerto
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = var.tags
}

# --- Balanceador ---
resource "aws_lb" "this" {
  name               = "${var.nombre}-alb"
  load_balancer_type = "application"
  subnets            = var.subnet_ids
  security_groups    = [aws_security_group.alb.id]
  tags               = var.tags
}

resource "aws_lb_target_group" "this" {
  name        = "${var.nombre}-tg"
  port        = var.puerto
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"
  health_check {
    path    = "/api/health"
    matcher = "200"
  }
  tags = var.tags
}

resource "aws_lb_listener" "this" {
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.this.arn
  }
}

# --- Logs ---
resource "aws_cloudwatch_log_group" "this" {
  name              = "/ecs/${var.nombre}-backend"
  retention_in_days = 14
  tags              = var.tags
}

# --- IAM (mínimo) ---
data "aws_iam_policy_document" "assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ejecucion" {
  name               = "${var.nombre}-exec"
  assume_role_policy = data.aws_iam_policy_document.assume.json
  tags               = var.tags
}

resource "aws_iam_role_policy_attachment" "ejecucion" {
  role       = aws_iam_role.ejecucion.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Permiso para leer solo el secreto de la BD.
resource "aws_iam_role_policy" "secreto" {
  name = "leer-secreto-bd"
  role = aws_iam_role.ejecucion.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = var.db_secret_arn
    }]
  })
}

resource "aws_iam_role" "tarea" {
  name               = "${var.nombre}-task"
  assume_role_policy = data.aws_iam_policy_document.assume.json
  tags               = var.tags
}

# --- ECS ---
resource "aws_ecs_cluster" "this" {
  name = var.nombre
  tags = var.tags
}

resource "aws_ecs_task_definition" "this" {
  family                   = "${var.nombre}-backend"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = aws_iam_role.ejecucion.arn
  task_role_arn            = aws_iam_role.tarea.arn
  container_definitions = jsonencode([{
    name         = "backend"
    image        = var.image
    essential    = true
    portMappings = [{ containerPort = var.puerto, protocol = "tcp" }]
    environment  = [{ name = "PORT", value = tostring(var.puerto) }]
    secrets      = [{ name = "DATABASE_URL", valueFrom = var.db_secret_arn }]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.this.name
        "awslogs-region"        = var.region
        "awslogs-stream-prefix" = "backend"
      }
    }
  }])
  tags = var.tags
}

resource "aws_ecs_service" "this" {
  name            = "${var.nombre}-backend"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.this.arn
  desired_count   = 1
  launch_type     = "FARGATE"
  network_configuration {
    subnets          = var.subnet_ids
    security_groups  = [aws_security_group.tarea.id]
    assign_public_ip = true
  }
  load_balancer {
    target_group_arn = aws_lb_target_group.this.arn
    container_name   = "backend"
    container_port   = var.puerto
  }
  # La definición de tarea la actualiza el pipeline; ignorar cambios de imagen.
  lifecycle {
    ignore_changes = [task_definition]
  }
  depends_on = [aws_lb_listener.this]
  tags       = var.tags
}

output "task_sg_id" { value = aws_security_group.tarea.id }
output "alb_domain" { value = aws_lb.this.dns_name }
output "api_url" { value = "http://${aws_lb.this.dns_name}" }
output "cluster_name" { value = aws_ecs_cluster.this.name }
output "service_name" { value = aws_ecs_service.this.name }
