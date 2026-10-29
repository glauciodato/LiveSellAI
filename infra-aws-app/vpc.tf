# VPC mínima só pra essa infra de aplicação (separada da VPC do
# infra-aws-dev). O RDS exige um DB Subnet Group com pelo menos 2 subnets
# em availability zones diferentes, mesmo rodando em modo Single-AZ.

resource "aws_vpc" "app" {
  cidr_block           = "10.30.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "${var.project_name}-app-vpc-${var.environment}"
  }
}

resource "aws_internet_gateway" "app" {
  vpc_id = aws_vpc.app.id

  tags = {
    Name = "${var.project_name}-app-igw-${var.environment}"
  }
}

resource "aws_subnet" "app_a" {
  vpc_id                  = aws_vpc.app.id
  cidr_block              = "10.30.1.0/24"
  availability_zone       = "${var.aws_region}a"
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.project_name}-app-subnet-a-${var.environment}"
  }
}

resource "aws_subnet" "app_b" {
  vpc_id                  = aws_vpc.app.id
  cidr_block              = "10.30.2.0/24"
  availability_zone       = "${var.aws_region}b"
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.project_name}-app-subnet-b-${var.environment}"
  }
}

resource "aws_route_table" "app_public" {
  vpc_id = aws_vpc.app.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.app.id
  }

  tags = {
    Name = "${var.project_name}-app-public-rt-${var.environment}"
  }
}

resource "aws_route_table_association" "app_a" {
  subnet_id      = aws_subnet.app_a.id
  route_table_id = aws_route_table.app_public.id
}

resource "aws_route_table_association" "app_b" {
  subnet_id      = aws_subnet.app_b.id
  route_table_id = aws_route_table.app_public.id
}
