# Senha gerada automaticamente -- nunca digitada manualmente por ninguém.
# Disponível só via output sensível do Terraform (mesmo padrão já usado
# pra chave SSH da GPU no infra-aws-dev).
resource "random_password" "db" {
  length  = 24
  special = false # alguns caracteres especiais quebram connection strings; letras+números já é senha forte o suficiente
}

resource "aws_db_subnet_group" "main" {
  name       = "${var.project_name}-db-subnet-group-${var.environment}"
  subnet_ids = [aws_subnet.app_a.id, aws_subnet.app_b.id]

  tags = {
    Name = "${var.project_name}-db-subnet-group-${var.environment}"
  }
}

# Acesso restrito: só o IP do desenvolvedor, nada aberto pra internet --
# mesmo padrão da instância GPU.
resource "aws_security_group" "rds" {
  name        = "${var.project_name}-rds-${var.environment}"
  description = "Acesso ao RDS Postgres, restrito ao IP do desenvolvedor"
  vpc_id      = aws_vpc.app.id

  tags = {
    Name = "${var.project_name}-rds-sg-${var.environment}"
  }
}

resource "aws_vpc_security_group_ingress_rule" "rds_postgres" {
  security_group_id = aws_security_group.rds.id
  description       = "Postgres, so do IP do desenvolvedor"
  cidr_ipv4         = var.allowed_db_cidr
  from_port         = 5432
  to_port           = 5432
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "rds_all_outbound" {
  security_group_id = aws_security_group.rds.id
  description       = "Todo trafego de saida liberado"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

resource "aws_db_instance" "main" {
  identifier     = "${var.project_name}-db-${var.environment}"
  engine         = "postgres"
  engine_version = "16"

  # Menor instância e menor armazenamento possíveis -- POC, custo mínimo.
  instance_class    = var.db_instance_class
  allocated_storage = var.db_allocated_storage
  storage_type      = "gp3"

  db_name  = var.db_name
  username = var.db_username
  password = random_password.db.result

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  multi_az            = false # Single-AZ -- menor custo, aceitável pra dev/POC
  publicly_accessible = true  # acesso direto via IP liberado no security group, sem bastion/VPN por enquanto

  performance_insights_enabled = false
  skip_final_snapshot          = true # POC -- não precisa de snapshot final ao destruir
  deletion_protection          = false

  tags = {
    Name = "${var.project_name}-db-${var.environment}"
  }
}
