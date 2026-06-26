# Red: VPC con 2 subredes públicas (sin NAT Gateway, para evitar su costo).
variable "nombre" { type = string }
variable "cidr" {
  type    = string
  default = "10.0.0.0/16"
}
variable "tags" {
  type    = map(string)
  default = {}
}

data "aws_availability_zones" "disponibles" {
  state = "available"
}

resource "aws_vpc" "this" {
  cidr_block           = var.cidr
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags                 = merge(var.tags, { Name = "${var.nombre}-vpc" })
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id
  tags   = merge(var.tags, { Name = "${var.nombre}-igw" })
}

resource "aws_subnet" "publicas" {
  count                   = 2
  vpc_id                  = aws_vpc.this.id
  cidr_block              = cidrsubnet(var.cidr, 8, count.index)
  availability_zone       = data.aws_availability_zones.disponibles.names[count.index]
  map_public_ip_on_launch = true
  tags                    = merge(var.tags, { Name = "${var.nombre}-public-${count.index}" })
}

resource "aws_route_table" "publica" {
  vpc_id = aws_vpc.this.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.this.id
  }
  tags = merge(var.tags, { Name = "${var.nombre}-rt-public" })
}

resource "aws_route_table_association" "a" {
  count          = 2
  subnet_id      = aws_subnet.publicas[count.index].id
  route_table_id = aws_route_table.publica.id
}

output "vpc_id" { value = aws_vpc.this.id }
output "vpc_cidr" { value = aws_vpc.this.cidr_block }
output "subnet_ids" { value = aws_subnet.publicas[*].id }
