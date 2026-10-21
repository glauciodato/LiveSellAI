# Por padrão, só libera SSH (pro seu IP) e a porta do avatar-service — nada
# aberto pra internet. Tudo saindo é liberado (precisa baixar modelos de IA,
# imagens Docker, pacotes do sistema).

resource "aws_security_group" "gpu_instance" {
  name        = "${var.project_name}-gpu-instance-${var.environment}"
  description = "Acesso restrito a instancia GPU de dev (SSH + API do avatar-service, so do IP liberado)" # AWS so aceita ASCII nesse campo
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "${var.project_name}-gpu-instance-sg-${var.environment}"
  }
}

resource "aws_vpc_security_group_ingress_rule" "ssh" {
  security_group_id = aws_security_group.gpu_instance.id
  description       = "SSH, so do IP do desenvolvedor"
  cidr_ipv4         = var.allowed_ssh_cidr
  from_port         = 22
  to_port           = 22
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_ingress_rule" "avatar_service_api" {
  security_group_id = aws_security_group.gpu_instance.id
  description       = "API do avatar-service (teste manual), so do IP do desenvolvedor"
  cidr_ipv4         = var.allowed_ssh_cidr
  from_port         = 8000
  to_port           = 8000
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "all_outbound" {
  security_group_id = aws_security_group.gpu_instance.id
  description       = "Todo trafego de saida liberado (download de modelos/imagens Docker)"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}
