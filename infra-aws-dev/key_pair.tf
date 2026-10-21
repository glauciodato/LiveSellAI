# Gera o par de chaves SSH via Terraform, em vez de depender de um key pair
# criado manualmente no console da AWS (já perdemos uma chave assim uma vez
# — a AWS só deixa baixar o .pem no momento da criação). A chave privada
# fica disponível como output sensível (`terraform output -raw private_key_pem`).

resource "tls_private_key" "ssh" {
  algorithm = "RSA"
  rsa_bits  = 4096
}

resource "aws_key_pair" "generated" {
  key_name   = "${var.project_name}-${var.environment}-generated"
  public_key = tls_private_key.ssh.public_key_openssh

  tags = {
    Name = "${var.project_name}-${var.environment}-generated"
  }
}
